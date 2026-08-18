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
  /** 作品简介 / 剧情大纲，写入 NFO 的 plot 字段 */
  outline?: string
  /**
   * 为 true 时海报不做 2:3 裁切。
   * Heyzo / FC2 / 欧美片的 fanart 不是 DMM 式光盘外包扫描件，本身已经是横版成品封面，
   * 不需要裁出右半边做正面海报；此时保留原始宽高比。
   */
  posterNoCrop?: boolean
}

export type ScrapeOutcome =
  | { ok: true; data: ScrapedMetadata }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'error'; message: string }
