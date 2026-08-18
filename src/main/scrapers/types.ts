import type { HttpClient } from '../net/httpClient'
import type { ParsedName } from '../number/parseNumber'
import type { ScrapeOutcome } from '../../shared/types'

export interface ScrapeContext {
  http: Pick<HttpClient, 'getText'>
}

export interface ScrapeSource {
  readonly id: string
  scrape(ctx: ScrapeContext, number: string, parsed: ParsedName | null): Promise<ScrapeOutcome>
}
