import { HttpClient } from '../net/httpClient'
import type { SiteId } from '../../shared/types'
import { JavBusSource } from './javbus/JavBusSource'
import { JavDbSource } from './javdb/JavDbSource'
import { Jav321Source } from './jav321/Jav321Source'
import { HeyzoSource } from './heyzo/HeyzoSource'
import { Fc2Source } from './fc2/Fc2Source'
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

// DMM 只作为图片 CDN 兜底（见 media/dmmCdn.ts），不是元数据源，这里不注册。
//
// HEYZO / FC2 是专用源：按番号类型自动路由，对不匹配的番号零网络开销直接 not_found，
// 因此它们始终启用、不跟随设置页的数据源开关，并固定排在最前优先命中官方源，
// 避免被 JavBus/JavDB 的二次搜索兜底。
export function createSources(siteIds: SiteId[]): ScrapeSource[] {
  const sources: ScrapeSource[] = [new HeyzoSource(), new Fc2Source()]
  for (const id of siteIds) {
    if (id === 'JavBus') sources.push(new JavBusSource())
    else if (id === 'JavDB') sources.push(new JavDbSource())
    else if (id === 'Jav321') sources.push(new Jav321Source())
  }
  return sources
}

export type { ScrapeSource, ScrapeContext } from './types'
