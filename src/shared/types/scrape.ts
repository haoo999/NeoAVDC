export interface ScrapedActor {
  name: string
  avatarUrl?: string
}

export interface ScrapedMetadata {
  number: string
  title: string
  coverUrl?: string
  coverThumbUrl?: string
  sampleUrls: string[]
  releaseDate?: string
  runtimeMin?: number
  director?: string
  maker?: string
  publisher?: string
  series?: string
  genres: string[]
  actors: ScrapedActor[]
  isUncensored: boolean
  sourceUrl: string
}

export type ScrapeOutcome =
  | { ok: true; data: ScrapedMetadata }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'error'; message: string }
