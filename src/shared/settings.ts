import type { Settings } from './types/settings'

export const DEFAULT_SETTINGS: Settings = {
  enabledSites: ['Heyzo', 'FC2', 'JavBus', 'JavDB', 'Jav321'],
  proxyUrl: '',
  requestIntervalSec: 2,
  folderNaming: 'number',
  organizeMode: 'inPlace',
  centralLibraryDir: '',
  cropMode: 'right',
  followSubtitles: true,
  removeWatermark: true,
  downloadHdCover: true,
  downloadSamples: false,
  generateNfo: true,
  downloadActorAvatars: false,
  skipExistingNfo: true
}
