import type { ParsedName } from '../../number/parseNumber'
import type { ScrapeContext, ScrapeSource } from '../types'
import type { ScrapeOutcome, ScrapedMetadata } from '../../../shared/types'
import {
  buildJavBusSearchUrl,
  buildJavBusUrl,
  extractSearchDetailUrl,
  parseJavBusDetail
} from './parseJavBus'

const BASE_URL = 'https://www.javbus.com'

export class JavBusSource implements ScrapeSource {
  readonly id = 'JavBus'

  async scrape(
    ctx: ScrapeContext,
    number: string,
    parsed: ParsedName | null
  ): Promise<ScrapeOutcome> {
    const uncensored = parsed?.isUncensored === true

    // 先直连根路径（有码番号、HEYZO/FC2 等无码番号都在此命中）
    const root = await this.tryDirect(ctx, number, false)
    if (root.err) return { ok: false, reason: 'error', message: describe(root.err) }
    if (root.data) return { ok: true, data: ensureNumber(root.data, number) }

    // 无码番号再尝试 /uncensored/ 前缀（部分欧美/纯数字无码作品在此）
    if (uncensored) {
      const alt = await this.tryDirect(ctx, number, true)
      if (alt.err) return { ok: false, reason: 'error', message: describe(alt.err) }
      if (alt.data) return { ok: true, data: ensureNumber(alt.data, number) }
    }

    return this.trySearch(ctx, number, uncensored)
  }

  private async tryDirect(
    ctx: ScrapeContext,
    number: string,
    uncensoredPath: boolean
  ): Promise<{ data: ScrapedMetadata | null; err?: unknown }> {
    const directUrl = buildJavBusUrl(number, uncensoredPath)
    try {
      const direct = await ctx.http.getText(directUrl)
      return { data: parseJavBusDetail(direct.text, BASE_URL, directUrl, uncensoredPath) }
    } catch (err) {
      if (isNotFound(err)) return { data: null }
      return { data: null, err }
    }
  }

  private async trySearch(
    ctx: ScrapeContext,
    number: string,
    uncensored: boolean
  ): Promise<ScrapeOutcome> {
    const searchUrl = buildJavBusSearchUrl(number, uncensored)
    try {
      const res = await ctx.http.getText(searchUrl, { cookies: { existmag: 'all' } })
      if (!res.text) return { ok: false, reason: 'not_found' }
      const detailUrl = extractSearchDetailUrl(res.text, number, BASE_URL)
      if (!detailUrl) return { ok: false, reason: 'not_found' }

      const detail = await ctx.http.getText(detailUrl)
      const parsedDetail = parseJavBusDetail(
        detail.text,
        BASE_URL,
        detailUrl,
        uncensored || detailUrl.includes('/uncensored/')
      )
      if (!parsedDetail) return { ok: false, reason: 'not_found' }
      return { ok: true, data: ensureNumber(parsedDetail, number) }
    } catch (err) {
      if (isNotFound(err)) return { ok: false, reason: 'not_found' }
      return { ok: false, reason: 'error', message: describe(err) }
    }
  }
}

function ensureNumber<T extends { number: string }>(data: T, fallback: string): T {
  if (!data.number) data.number = fallback
  return data
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
