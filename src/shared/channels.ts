import type { IpcRenderer } from 'electron'

export const IPC = {
  ENGINE_ADD_PATHS: 'engine:addPaths',
  ENGINE_START_ALL: 'engine:startAll',
  ENGINE_RETRY_TASK: 'engine:retryTask',
  ENGINE_RETRY_FAILED: 'engine:retryFailed',
  ENGINE_RESCRAPE: 'engine:rescrape',
  ENGINE_REMOVE_TASK: 'engine:removeTask',
  ENGINE_CLEAR_FINISHED: 'engine:clearFinished',
  DIALOG_SELECT_FILES: 'dialog:selectFiles',
  DIALOG_SELECT_FOLDER: 'dialog:selectFolder',
  DIALOG_SAVE_FILE: 'dialog:saveFile',
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  ENGINE_EVENT: 'engine:event',
  READ_IMAGE: 'media:readImage',
  TOOLS_PROBE: 'tools:probe',
  TOOLS_PROBE_EVENT: 'tools:probeEvent',
  TOOLS_CROP_PREVIEW: 'tools:cropPreview',
  TOOLS_CROP_EXPORT: 'tools:cropExport',
  TOOLS_SCAN: 'tools:scan',
  TOOLS_AVATARS_START: 'tools:avatarsStart',
  TOOLS_AVATARS_CANCEL: 'tools:avatarsCancel',
  TOOLS_EVENT: 'tools:event'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]

export function TypedIpcRenderer(r: IpcRenderer) {
  return {
    invoke<T>(channel: IpcChannel, ...args: unknown[]): Promise<T> {
      return r.invoke(channel, ...args) as Promise<T>
    },
    on(channel: IpcChannel, listener: (event: Electron.IpcRendererEvent, ...args: unknown[]) => void): () => void {
      r.on(channel, listener)
      return () => r.removeListener(channel, listener)
    }
  }
}
