export const SITE_IDS = ['JavBus', 'JavDB', 'Jav321', 'DMM'] as const
export type SiteId = (typeof SITE_IDS)[number]

export const FOLDER_NAMING_MODES = ['number', 'numberTitle', 'numberActorTitle'] as const
export type FolderNamingMode = (typeof FOLDER_NAMING_MODES)[number]

export const ORGANIZE_MODES = ['inPlace', 'central'] as const
export type OrganizeMode = (typeof ORGANIZE_MODES)[number]

export const CROP_MODES = ['right', 'center', 'full'] as const
export type CropMode = (typeof CROP_MODES)[number]

// 演员头像目标平台：决定头像落盘方式与 NFO <thumb> 写法
// - Kodi / Emby / Jellyfin / Plex：使用 .actors/ 子目录（纯演员名），NFO 写本地相对路径
// - Infuse：不读本地头像文件，NFO 写 DMM 无防盗链远程 URL（覆盖不到则不写）
export const ACTOR_AVATAR_PLATFORMS = ['Kodi', 'Emby', 'Jellyfin', 'Plex', 'Infuse'] as const
export type ActorAvatarPlatform = (typeof ACTOR_AVATAR_PLATFORMS)[number]

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
  actorAvatarPlatform: ActorAvatarPlatform
  skipExistingNfo: boolean
}
