import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { EngineEvent, NeoApi, Settings } from '../shared/types'
import { IPC } from '../shared/channels'

const api: NeoApi = {
  addPaths: (paths) => ipcRenderer.invoke(IPC.ENGINE_ADD_PATHS, paths),
  startAll: () => ipcRenderer.invoke(IPC.ENGINE_START_ALL),
  retryTask: (id) => ipcRenderer.invoke(IPC.ENGINE_RETRY_TASK, id),
  retryFailed: () => ipcRenderer.invoke(IPC.ENGINE_RETRY_FAILED),
  rescrapeTask: (id, options) => ipcRenderer.invoke(IPC.ENGINE_RESCRAPE, id, options),
  removeTask: (id) => ipcRenderer.invoke(IPC.ENGINE_REMOVE_TASK, id),
  clearFinished: () => ipcRenderer.invoke(IPC.ENGINE_CLEAR_FINISHED),
  selectFiles: () => ipcRenderer.invoke(IPC.DIALOG_SELECT_FILES),
  selectFolder: () => ipcRenderer.invoke(IPC.DIALOG_SELECT_FOLDER),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  getSettings: () => ipcRenderer.invoke(IPC.SETTINGS_GET),
  setSettings: (patch: Partial<Settings>) => ipcRenderer.invoke(IPC.SETTINGS_SET, patch),
  readImage: (source) => ipcRenderer.invoke(IPC.READ_IMAGE, source),
  onEngineEvent: (cb) => {
    const listener = (_e: Electron.IpcRendererEvent, ev: EngineEvent): void => cb(ev)
    ipcRenderer.on(IPC.ENGINE_EVENT, listener)
    return () => ipcRenderer.removeListener(IPC.ENGINE_EVENT, listener)
  }
}

contextBridge.exposeInMainWorld('neoavdc', api)
