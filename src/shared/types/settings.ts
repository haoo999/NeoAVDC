export const SITE_IDS = [
  'Heyzo',
  'FC2',
  'JavBus',
  'JavDB',
  'Jav321',
  'DMM'
] as const
export type SiteId = (typeof SITE_IDS)[number]

export const FOLDER_NAMING_MODES = ['number', 'numberTitle', 'numberActorTitle'] as const
export type FolderNamingMode = (typeof FOLDER_NAMING_MODES)[number]

export const ORGANIZE_MODES = ['inPlace', 'central'] as const
export type OrganizeMode = (typeof ORGANIZE_MODES)[number]

export const CROP_MODES = ['right', 'center', 'full'] as const
export type CropMode = (typeof CROP_MODES)[number]

export interface Settings {
  enabledSites: SiteId[]
  proxyUrl: string
  requestIntervalSec: number
  folderNaming: FolderNamingMode
  organizeMode: OrganizeMode
  centralLibraryDir: string
  cropMode: CropMode
  followSubtitles: boolean
  removeWatermark: boolean
  downloadHdCover: boolean
  downloadSamples: boolean
  generateNfo: boolean
  downloadActorAvatars: boolean
  skipExistingNfo: boolean
}
