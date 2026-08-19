import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { EngineEvent, NeoApi } from '../shared/types'
import { IPC } from '../shared/channels'
import type { AvatarProgress, AvatarSummary, ProbeEvent } from '../shared/types'

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
  saveFile: (defaultName, filters) =>
    ipcRenderer.invoke(IPC.DIALOG_SAVE_FILE, defaultName, filters ?? []),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  getSettings: () => ipcRenderer.invoke(IPC.SETTINGS_GET),
  setSettings: (patch) => ipcRenderer.invoke(IPC.SETTINGS_SET, patch),
  readImage: (source) => ipcRenderer.invoke(IPC.READ_IMAGE, source),
  onEngineEvent: (cb) => {
    const listener = (_e: Electron.IpcRendererEvent, ev: EngineEvent): void => cb(ev)
    ipcRenderer.on(IPC.ENGINE_EVENT, listener)
    return () => ipcRenderer.removeListener(IPC.ENGINE_EVENT, listener)
  },

  toolsProbe: (number) => ipcRenderer.invoke(IPC.TOOLS_PROBE, number),
  onProbeEvent: (cb) => {
    const listener = (_e: Electron.IpcRendererEvent, ev: ProbeEvent): void => cb(ev)
    ipcRenderer.on(IPC.TOOLS_PROBE_EVENT, listener)
    return () => ipcRenderer.removeListener(IPC.TOOLS_PROBE_EVENT, listener)
  },
  toolsCropPreview: (input) => ipcRenderer.invoke(IPC.TOOLS_CROP_PREVIEW, input),
  toolsCropExport: (options, targetPath: string) =>
    ipcRenderer.invoke(IPC.TOOLS_CROP_EXPORT, options, targetPath),
  toolsScan: (rootDir) => ipcRenderer.invoke(IPC.TOOLS_SCAN, rootDir),
  toolsAvatarsStart: (rootDir, options) =>
    ipcRenderer.invoke(IPC.TOOLS_AVATARS_START, rootDir, options),
  toolsAvatarsCancel: () => ipcRenderer.invoke(IPC.TOOLS_AVATARS_CANCEL),
  onToolsEvent: (cb) => {
    const listener = (
      _e: Electron.IpcRendererEvent,
      ev:
        | { type: 'progress'; progress: AvatarProgress }
        | { type: 'done'; summary: AvatarSummary }
        | { type: 'error'; message: string }
    ): void => cb(ev)
    ipcRenderer.on(IPC.TOOLS_EVENT, listener)
    return () => ipcRenderer.removeListener(IPC.TOOLS_EVENT, listener)
  }
}

contextBridge.exposeInMainWorld('neoavdc', api)
