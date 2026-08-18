import type { ParsedName } from '../../number/parseNumber'
import type { ScrapeContext, ScrapeSource } from '../types'
import type { ScrapeOutcome, ScrapedMetadata } from '../../../shared/types'
import {
  buildJavDbSearchUrl,
  buildJavDbUrl,
  extractJavDbSearchDetailUrl,
  parseJavDbDetail,
  parseJavDbSearchItem
} from './parseJavDb'

// JavDB 对裸 UA 会挑战 Cloudflare；模拟常规浏览器可降低被拦概率
const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  // over18=1 跳过年龄验证弹窗
  Cookie: 'over18=1; theme=light; locale=zh'
}

const ORIGIN = 'https://javdb.com'

export class JavDbSource implements ScrapeSource {
  readonly id = 'JavDB'

  async scrape(ctx: ScrapeContext, number: string, _parsed: ParsedName | null): Promise<ScrapeOutcome> {
    // 详情页 URL 是 /v/{内部ID}（如 /v/ZY5eq），不是 /v/{番号}；
    // 但部分番号恰好能通过 /v/{番号} 直达，先尝试一次
    const direct = await this.tryDetail(ctx, buildJavDbUrl(number), number)
    if (direct) return direct

    // 搜索：返回 HTML 中提取首个匹配番号的详情链接
    const search = await ctx.http.getText(buildJavDbSearchUrl(number), { headers: BROWSER_HEADERS })
    const detailUrl = extractJavDbSearchDetailUrl(search.text, ORIGIN, number)

    if (detailUrl) {
      const viaSearch = await this.tryDetail(ctx, detailUrl, number)
      if (viaSearch) return viaSearch
    }

    // 详情页被登录墙拦截（302→/login）时，从搜索结果项提取最小元数据（封面/标题/日期），
    // 至少能拿到 800×450 横版 fanart 封面
    const fromSearchItem = parseJavDbSearchItem(search.text, ORIGIN, number)
    if (fromSearchItem) {
      return { ok: true, data: fromSearchItem }
    }

    return { ok: false, reason: 'not_found' }
  }

  private async tryDetail(
    ctx: ScrapeContext,
    url: string,
    fallbackNumber: string
  ): Promise<{ ok: true; data: ScrapedMetadata } | null> {
    try {
      const res = await ctx.http.getText(url, { headers: BROWSER_HEADERS })
      // JavDB 对未登录用户访问部分无码/FC2 详情页会 302→/login（被 httpClient 跟随），
      // 最终 URL 含 /login 时视为登录墙，不算 404，让调用方走搜索兜底
      if (/\/login/i.test(res.finalUrl ?? '')) return null
      // 404 页没有 panel/title，解析器返回 null 即视为未找到
      const data = parseJavDbDetail(res.text, ORIGIN, res.finalUrl ?? url)
      if (!data) return null
      if (!data.number) data.number = fallbackNumber
      return { ok: true, data }
    } catch {
      return null
    }
  }
}
