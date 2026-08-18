export const SITE_IDS = [
  'JavBus',
  'JavDB',
  'Jav321',
  'AvBase',
  'DMM',
  'MGStage',
  'XCity'
] as const
export type SiteId = (typeof SITE_IDS)[number]

export const FOLDER_NAMING_MODES = ['number', 'numberTitle', 'numberActorTitle'] as const
export type FolderNamingMode = (typeof FOLDER_NAMING_MODES)[number]

export const CROP_MODES = ['center', 'full', 'top'] as const
export type CropMode = (typeof CROP_MODES)[number]

export interface Settings {
  enabledSites: SiteId[]
  proxyUrl: string
  requestIntervalSec: number
  folderNaming: FolderNamingMode
  cropMode: CropMode
  followSubtitles: boolean
  removeWatermark: boolean
  downloadHdCover: boolean
  generateNfo: boolean
  downloadActorAvatars: boolean
  skipExistingNfo: boolean
}
