import {
  CROP_MODES,
  FOLDER_NAMING_MODES,
  SITE_IDS,
  type CropMode,
  type FolderNamingMode,
  type Settings,
  type SiteId
} from '../../shared/types/settings'
import { DEFAULT_SETTINGS } from '../../shared/settings'

const SITE_SET = new Set<string>(SITE_IDS)
const NAMING_SET = new Set<string>(FOLDER_NAMING_MODES)
const CROP_SET = new Set<string>(CROP_MODES)

function asSiteArray(value: unknown): SiteId[] {
  if (!Array.isArray(value)) return DEFAULT_SETTINGS.enabledSites
  const sites = value.filter((x): x is SiteId => typeof x === 'string' && SITE_SET.has(x))
  return sites.length > 0 ? Array.from(new Set(sites)) : DEFAULT_SETTINGS.enabledSites
}

function asFolderNaming(value: unknown): FolderNamingMode {
  return typeof value === 'string' && NAMING_SET.has(value)
    ? (value as FolderNamingMode)
    : DEFAULT_SETTINGS.folderNaming
}

function asCropMode(value: unknown): CropMode {
  return typeof value === 'string' && CROP_SET.has(value)
    ? (value as CropMode)
    : DEFAULT_SETTINGS.cropMode
}

function asNonEmptyString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asInterval(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.min(value, 3600)
  }
  return DEFAULT_SETTINGS.requestIntervalSec
}

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

export function sanitizeSettings(input: unknown): Settings {
  if (input === null || typeof input !== 'object') return { ...DEFAULT_SETTINGS }
  const raw = input as Record<string, unknown>
  return {
    enabledSites: asSiteArray(raw['enabledSites']),
    proxyUrl: asNonEmptyString(raw['proxyUrl']),
    requestIntervalSec: asInterval(raw['requestIntervalSec']),
    folderNaming: asFolderNaming(raw['folderNaming']),
    cropMode: asCropMode(raw['cropMode']),
    followSubtitles: asBool(raw['followSubtitles'], DEFAULT_SETTINGS.followSubtitles),
    removeWatermark: asBool(raw['removeWatermark'], DEFAULT_SETTINGS.removeWatermark),
    downloadHdCover: asBool(raw['downloadHdCover'], DEFAULT_SETTINGS.downloadHdCover),
    downloadSamples: asBool(raw['downloadSamples'], DEFAULT_SETTINGS.downloadSamples),
    generateNfo: asBool(raw['generateNfo'], DEFAULT_SETTINGS.generateNfo),
    downloadActorAvatars: asBool(
      raw['downloadActorAvatars'],
      DEFAULT_SETTINGS.downloadActorAvatars
    ),
    skipExistingNfo: asBool(raw['skipExistingNfo'], DEFAULT_SETTINGS.skipExistingNfo)
  }
}

export function mergeSettings(patch: unknown, current: Settings): Settings {
  return sanitizeSettings({ ...current, ...(patch as object) })
}
