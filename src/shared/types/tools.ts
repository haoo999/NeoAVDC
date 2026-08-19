import type { CropMode } from './settings'
import type { ScrapedActor } from './scrape'

export type ToolId = 'probe' | 'crop' | 'scan' | 'avatars'

export interface CropInput {
  number?: string
  fanartUrl?: string
  fanartPath?: string
  removeWatermark: boolean
}

export interface CropExportOptions extends CropInput {
  mode: CropMode
}

export type ProbeChannelStatus = 'pending' | 'querying' | 'hit' | 'miss' | 'skip' | 'error'

export interface ProbeChannelState {
  source: string
  status: ProbeChannelStatus
  error?: string
}

export type ProbeEvent =
  | { type: 'start'; number: string; sources: string[] }
  | { type: 'channel'; state: ProbeChannelState; hit?: ProbeHit }
  | { type: 'done'; result: ProbeResult }

export interface ProbeHit {
  source: string
  ok: boolean
  title: string
  coverUrl: string
  posterDataUrl?: string
  actors: ScrapedActor[]
  releaseDate: string
  runtimeMin: number
  maker: string
  series: string
  genres: string[]
  sourceUrl: string
  message?: string
}

export interface ProbeResult {
  number: string
  hits: ProbeHit[]
}

export interface CropVariant {
  mode: CropMode
  dataUrl: string
  width: number
  height: number
}

export interface CropPreviewResult {
  sourceLabel: string
  width: number
  height: number
  variants: CropVariant[]
}

export interface ScanWork {
  nfoPath: string
  dir: string
  number: string
  title: string
  actors: string[]
  hasPoster: boolean
  hasFanart: boolean
  missingAvatars: string[]
}

export interface ScanResult {
  rootDir: string
  totalWorks: number
  missingPoster: number
  missingFanart: number
  missingAvatarActors: number
  works: ScanWork[]
}

export type AvatarStage = 'scan' | 'lookup' | 'download' | 'writeNfo' | 'done'

export interface AvatarProgress {
  stage: AvatarStage
  current: number
  total: number
  actor?: string
  work?: string
  message?: string
}

export interface AvatarSummary {
  scannedWorks: number
  uniqueActors: number
  downloaded: number
  reused: number
  failed: string[]
  nfoUpdated: number
}
