import type { ParsedName } from '../../number/parseNumber'
import type { ScrapeContext, ScrapeSource } from '../types'
import type { ScrapeOutcome } from '../../../shared/types'
import {
  buildFc2ArticleUrl,
  buildFc2TagApiUrl,
  extractFc2Id,
  isFc2NotFound,
  isFc2Number,
  parseFc2Detail
} from './parseFc2'

const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8'
}

const COOKIES: Record<string, string> = {
  wei6H: '1',
  fc2ag: '1',
  age_check_done: '1'
}

export class Fc2Source implements ScrapeSource {
  readonly id = 'FC2'

  async scrape(
    ctx: ScrapeContext,
    number: string,
    parsed: ParsedName | null
  ): Promise<ScrapeOutcome> {
    if (!isFc2Number(parsed, number)) {
      return { ok: false, reason: 'not_found' }
    }
    const id = extractFc2Id(number)
    if (!id) return { ok: false, reason: 'not_found' }

    const articleUrl = buildFc2ArticleUrl(id)
    const tagUrl = buildFc2TagApiUrl(id)

    try {
      const articleRes = await ctx.http.getText(articleUrl, {
        headers: BROWSER_HEADERS,
        cookies: COOKIES
      })
      const html = articleRes.text
      if (!html) return { ok: false, reason: 'not_found' }
      if (isFc2NotFound(html)) return { ok: false, reason: 'not_found' }

      // 标签 API 是 best-effort：失败不阻断主流程
      let tagJson: string | undefined
      try {
        const tagRes = await ctx.http.getText(tagUrl, {
          headers: { ...BROWSER_HEADERS, Accept: 'application/json' },
          cookies: COOKIES
        })
        if (tagRes.text) tagJson = tagRes.text
      } catch {
        // 忽略标签 API 失败，parser 会从 data-tag 兜底
      }

      const data = parseFc2Detail(html, articleUrl, number, tagJson)
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
