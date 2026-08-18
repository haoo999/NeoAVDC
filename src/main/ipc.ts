import { app, dialog, ipcMain } from 'electron'
import { Engine } from './engine'
import { SettingsStore } from './store/settingsStore'
import { IPC } from '../shared/channels'
import type { Settings } from '../shared/types'

export function registerIpc(engine: Engine): void {
  const settingsStore = new SettingsStore()

  ipcMain.handle(IPC.ENGINE_ADD_PATHS, (_e, paths: string[]) => engine.addPaths(paths))
  ipcMain.handle(IPC.ENGINE_START_ALL, () => engine.startAll())
  ipcMain.handle(IPC.ENGINE_RETRY_TASK, (_e, id: string) => engine.retryTask(id))
  ipcMain.handle(IPC.ENGINE_RETRY_FAILED, () => engine.retryFailed())
  ipcMain.handle(IPC.ENGINE_REMOVE_TASK, (_e, id: string) => engine.removeTask(id))
  ipcMain.handle(IPC.ENGINE_CLEAR_FINISHED, () => engine.clearFinished())

  ipcMain.handle(IPC.SETTINGS_GET, () => settingsStore.getAll())
  ipcMain.handle(IPC.SETTINGS_SET, (_e, patch: Partial<Settings>) =>
    settingsStore.update(patch)
  )

  ipcMain.handle(IPC.DIALOG_SELECT_FILES, async () => {
    const res = await dialog.showOpenDialog({
      title: '选择视频文件',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: '视频', extensions: ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm'] }]
    })
    return res.canceled ? [] : res.filePaths
  })

  ipcMain.handle(IPC.DIALOG_SELECT_FOLDER, async () => {
    const res = await dialog.showOpenDialog({
      title: '选择视频目录',
      properties: ['openDirectory', 'multiSelections']
    })
    return res.canceled ? [] : res.filePaths
  })

  app.on('will-quit', () => {
    ipcMain.removeAllListeners(IPC.ENGINE_ADD_PATHS)
    ipcMain.removeAllListeners(IPC.ENGINE_START_ALL)
    ipcMain.removeAllListeners(IPC.ENGINE_RETRY_TASK)
    ipcMain.removeAllListeners(IPC.ENGINE_RETRY_FAILED)
    ipcMain.removeAllListeners(IPC.ENGINE_REMOVE_TASK)
    ipcMain.removeAllListeners(IPC.ENGINE_CLEAR_FINISHED)
    ipcMain.removeAllListeners(IPC.SETTINGS_GET)
    ipcMain.removeAllListeners(IPC.SETTINGS_SET)
    ipcMain.removeAllListeners(IPC.DIALOG_SELECT_FILES)
    ipcMain.removeAllListeners(IPC.DIALOG_SELECT_FOLDER)
  })
}
