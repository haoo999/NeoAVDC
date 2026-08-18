import type { ParsedName } from '../../number/parseNumber'
import type { ScrapeContext, ScrapeSource } from '../types'
import type { ScrapeOutcome } from '../../../shared/types'
import { buildHeyzoUrl, isHeyzoNumber, parseHeyzoDetail } from './parseHeyzo'

const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8'
}

export class HeyzoSource implements ScrapeSource {
  readonly id = 'Heyzo'

  async scrape(
    ctx: ScrapeContext,
    number: string,
    parsed: ParsedName | null
  ): Promise<ScrapeOutcome> {
    if (!isHeyzoNumber(parsed, number)) {
      return { ok: false, reason: 'not_found' }
    }

    const url = buildHeyzoUrl(number)
    if (!url) return { ok: false, reason: 'not_found' }

    try {
      const res = await ctx.http.getText(url, {
        headers: BROWSER_HEADERS,
        cookies: { age_check_done: '1' }
      })
      if (!res.text) return { ok: false, reason: 'not_found' }

      // Heyzo 对不存在番号会跳转/返回软 404 页面
      if (isSoftNotFound(res.text)) {
        return { ok: false, reason: 'not_found' }
      }

      const data = parseHeyzoDetail(res.text, url, number)
      if (!data) return { ok: false, reason: 'not_found' }
      return { ok: true, data }
    } catch (err) {
      if (isNotFound(err)) return { ok: false, reason: 'not_found' }
      return {
        ok: false,
        reason: 'error',
        message: err instanceof Error ? err.message : String(err)
      }
    }
  }
}

function isNotFound(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    (err as { status: number | null }).status === 404
  )
}

function isSoftNotFound(html: string): boolean {
  const head = html.slice(0, 6000)
  return /お探しの作品は見つかりません|見つかりませんでした|404\s*Not\s*Found/i.test(head)
}
