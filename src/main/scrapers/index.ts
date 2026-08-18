import { HttpClient } from '../net/httpClient'
import type { SiteId } from '../../shared/types'
import { JavBusSource } from './javbus/JavBusSource'
import type { ScrapeSource } from './types'

export interface ScraperConfig {
  proxyUrl: string
  requestIntervalSec: number
}

export function createHttpClient(config: ScraperConfig): HttpClient {
  return new HttpClient({
    proxyUrl: config.proxyUrl || undefined,
    intervalMs: Math.max(0, config.requestIntervalSec) * 1000,
    timeoutMs: 15000,
    retries: 2
  })
}

export function createSources(siteIds: SiteId[]): ScrapeSource[] {
  const sources: ScrapeSource[] = []
  for (const id of siteIds) {
    if (id === 'JavBus') sources.push(new JavBusSource())
  }
  return sources
}

export type { ScrapeSource, ScrapeContext } from './types'
