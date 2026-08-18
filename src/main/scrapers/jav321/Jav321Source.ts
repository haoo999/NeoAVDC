import type { ParsedName } from '../../number/parseNumber'
import type { ScrapeContext, ScrapeSource } from '../types'
import type { ScrapeOutcome } from '../../../shared/types'
import { buildJav321DirectUrl, parseJav321Detail } from './parseJav321'

const ORIGIN = 'https://www.jav321.com'
const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
}

export class Jav321Source implements ScrapeSource {
  readonly id = 'Jav321'

  async scrape(
    ctx: ScrapeContext,
    number: string,
    _parsed: ParsedName | null
  ): Promise<ScrapeOutcome> {
    // 1) 先尝试直连 /video/{number}（部分番号可命中，尤其带连字符的大写番号）
    const direct = await this.tryFetch(ctx, buildJav321DirectUrl(number), number)
    if (direct) return direct

    // 2) 直连未命中时，POST 搜索表单（字段 sn），站点会 301 到真实详情页
    try {
      const search = await ctx.http.postText(`${ORIGIN}/search`, {
        headers: {
          ...BROWSER_HEADERS,
          'Content-Type': 'application/x-www-form-urlencoded',
          Referer: ORIGIN + '/'
        },
        body: `sn=${encodeURIComponent(number)}`,
        followRedirect: true,
        maxRedirects: 5
      })
      // 跟随重定向后 finalUrl 通常是 /video/{slug}
      if (/\/video\//.test(search.finalUrl)) {
        const data = parseJav321Detail(search.text, ORIGIN, search.finalUrl)
        if (data) {
          if (!data.number) data.number = number
          if (data.coverUrl) data.coverUrl = upgradeDmmThumbnail(data.coverUrl)
          return { ok: true, data }
        }
      }
      // 少数情况下搜索返回列表页，尝试从列表中找链接
      const linkMatch = search.text.match(
        /href="(https?:\/\/www\.jav321\.com\/video\/[^"]+)"/i
      )
      if (linkMatch) {
        const viaLink = await this.tryFetch(ctx, linkMatch[1], number)
        if (viaLink) return viaLink
      }
      return { ok: false, reason: 'not_found' }
    } catch (err) {
      if (isNotFound(err)) return { ok: false, reason: 'not_found' }
      return { ok: false, reason: 'error', message: describe(err) }
    }
  }

  private async tryFetch(
    ctx: ScrapeContext,
    url: string,
    fallbackNumber: string
  ): Promise<ScrapeOutcome | null> {
    try {
      const res = await ctx.http.getText(url, { headers: BROWSER_HEADERS })
      const data = parseJav321Detail(res.text, ORIGIN, res.finalUrl ?? url)
      if (!data) return null
      if (!data.number) data.number = fallbackNumber
      // Jav321 页面里的封面是 DMM ps.jpg（147×200 竖版缩略图），
      // 直接替换为 pl.jpg 可拿到 800×538 横版高清封面（fanart 可用）。
      if (data.coverUrl) {
        data.coverUrl = upgradeDmmThumbnail(data.coverUrl)
      }
      return { ok: true, data }
    } catch (err) {
      if (isNotFound(err)) return null
      // 非 404 错误交由搜索兜底
      return null
    }
  }
}

// DMM 缩略图命名：xxxps.jpg -> xxxpl.jpg（高清横版封面）
// 仅对 pics.dmm.co.jp 域名生效，避免误改非 DMM 图片
function upgradeDmmThumbnail(url: string): string {
  if (!/pics\.dmm\.co\.jp/i.test(url)) return url
  return url.replace(/ps(\.jpe?g)$/i, 'pl$1')
}

function isNotFound(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    (err as { status: number | null }).status === 404
  )
}

function describe(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}
