import type { IpcRenderer } from 'electron'

export const IPC = {
  ENGINE_ADD_PATHS: 'engine:addPaths',
  ENGINE_START_ALL: 'engine:startAll',
  ENGINE_RETRY_TASK: 'engine:retryTask',
  ENGINE_RETRY_FAILED: 'engine:retryFailed',
  ENGINE_REMOVE_TASK: 'engine:removeTask',
  ENGINE_CLEAR_FINISHED: 'engine:clearFinished',
  DIALOG_SELECT_FILES: 'dialog:selectFiles',
  DIALOG_SELECT_FOLDER: 'dialog:selectFolder',
  ENGINE_EVENT: 'engine:event'
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
