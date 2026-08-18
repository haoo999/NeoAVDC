import { app, dialog, ipcMain, shell } from 'electron'
import { IPC } from '../shared/channels'
import type { Engine } from './engine'
import type { SettingsStore } from './store/settingsStore'

export function registerIpc(engine: Engine, settingsStore: SettingsStore): void {
  ipcMain.handle(IPC.ENGINE_ADD_PATHS, (_e, paths: string[]) => engine.addPaths(paths ?? []))

  ipcMain.handle(IPC.ENGINE_START_ALL, () => engine.startAll())

  ipcMain.handle(IPC.ENGINE_RETRY_TASK, (_e, id: string) => engine.retryTask(id))

  ipcMain.handle(IPC.ENGINE_RETRY_FAILED, () => engine.retryFailed())

  ipcMain.handle(IPC.ENGINE_REMOVE_TASK, (_e, id: string) => engine.removeTask(id))

  ipcMain.handle(IPC.ENGINE_CLEAR_FINISHED, () => engine.clearFinished())

  ipcMain.handle(IPC.DIALOG_SELECT_FILES, async () => {
    const result = await dialog.showOpenDialog({
      title: '选择视频文件',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: '视频', extensions: ['mp4', 'mkv', 'avi', 'wmv', 'mov', 'm4v', 'flv', 'webm', 'ts', 'm2ts'] }]
    })
    return result.canceled ? [] : result.filePaths
  })

  ipcMain.handle(IPC.DIALOG_SELECT_FOLDER, async () => {
    const result = await dialog.showOpenDialog({
      title: '选择媒体文件夹',
      properties: ['openDirectory']
    })
    return result.canceled ? [] : result.filePaths
  })

  ipcMain.handle(IPC.SETTINGS_GET, () => settingsStore.getAll())

  ipcMain.handle(IPC.SETTINGS_SET, (_e, patch: unknown) => settingsStore.update(patch))

  ipcMain.handle(IPC.READ_IMAGE, (_e, source: string) => engine.readImage(source))

  ipcMain.handle('app:openPath', async (_e, target: string) => {
    if (typeof target === 'string' && target.length > 0) await shell.openPath(target)
  })

  app.on('will-quit', () => {
    for (const channel of [
      IPC.ENGINE_ADD_PATHS,
      IPC.ENGINE_START_ALL,
      IPC.ENGINE_RETRY_TASK,
      IPC.ENGINE_RETRY_FAILED,
      IPC.ENGINE_REMOVE_TASK,
      IPC.ENGINE_CLEAR_FINISHED,
      IPC.DIALOG_SELECT_FILES,
      IPC.DIALOG_SELECT_FOLDER,
      IPC.SETTINGS_GET,
      IPC.SETTINGS_SET,
      IPC.READ_IMAGE,
      'app:openPath'
    ] as const) {
      ipcMain.removeHandler(channel)
    }
  })
}
