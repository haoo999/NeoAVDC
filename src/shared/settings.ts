import type { Settings } from './types/settings'

export const DEFAULT_SETTINGS: Settings = {
  enabledSites: ['JavBus', 'JavDB', 'Jav321'],
  proxyUrl: '',
  requestIntervalSec: 2,
  folderNaming: 'number',
  cropMode: 'center',
  followSubtitles: true,
  removeWatermark: true,
  downloadHdCover: true,
  generateNfo: true,
  downloadActorAvatars: false,
  skipExistingNfo: true
}
