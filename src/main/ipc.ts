import { app, dialog, ipcMain, shell } from 'electron'
import type { BrowserWindow } from 'electron'
import { IPC } from '../shared/channels'
import type { Engine } from './engine'
import type { SettingsStore } from './store/settingsStore'
import type { ToolRunner } from './tools/toolRunner'
import type { CropExportOptions } from '../shared/types'

export function registerIpc(
  engine: Engine,
  settingsStore: SettingsStore,
  tools: ToolRunner,
  getMainWindow: () => BrowserWindow | null
): void {
  ipcMain.handle(IPC.ENGINE_ADD_PATHS, (_e, paths: string[]) => engine.addPaths(paths ?? []))

  ipcMain.handle(IPC.ENGINE_START_ALL, () => engine.startAll())

  ipcMain.handle(IPC.ENGINE_RETRY_TASK, (_e, id: string) => engine.retryTask(id))

  ipcMain.handle(IPC.ENGINE_RETRY_FAILED, () => engine.retryFailed())

  ipcMain.handle(
    IPC.ENGINE_RESCRAPE,
    (_e, id: string, options?: { number?: string }) => engine.rescrapeTask(id, options ?? {})
  )

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
    const win = getMainWindow()
    const result = await dialog.showOpenDialog(win ?? undefined as never, {
      title: '选择媒体文件夹',
      properties: ['openDirectory']
    })
    return result.canceled ? [] : result.filePaths
  })

  ipcMain.handle(
    IPC.DIALOG_SAVE_FILE,
    async (_e, defaultName: string, filters?: { name: string; extensions: string[] }[]) => {
      const win = getMainWindow()
      const result = await dialog.showSaveDialog(win ?? undefined as never, {
        title: '保存海报',
        defaultPath: defaultName,
        filters: filters && filters.length > 0 ? filters : [{ name: 'JPEG', extensions: ['jpg'] }]
      })
      return result.canceled ? '' : result.filePath
    }
  )

  ipcMain.handle(IPC.SETTINGS_GET, () => settingsStore.getAll())

  ipcMain.handle(IPC.SETTINGS_SET, (_e, patch: unknown) => settingsStore.update(patch))

  ipcMain.handle(IPC.READ_IMAGE, (_e, source: string) => engine.readImage(source))

  ipcMain.handle(IPC.TOOLS_PROBE, (_e, number: string) => tools.probe(number))

  ipcMain.handle(IPC.TOOLS_CROP_PREVIEW, (_e, input) => tools.cropPreview(input))

  ipcMain.handle(
    IPC.TOOLS_CROP_EXPORT,
    (_e, options: CropExportOptions, targetPath: string) => tools.cropExport(options, targetPath)
  )

  ipcMain.handle(IPC.TOOLS_SCAN, (_e, rootDir: string) => tools.scan(rootDir))

  ipcMain.handle(
    IPC.TOOLS_AVATARS_START,
    (_e, rootDir: string, options: { updateNfo: boolean }) =>
      tools.backfillAvatars(rootDir, options ?? { updateNfo: false })
  )

  ipcMain.handle(IPC.TOOLS_AVATARS_CANCEL, () => tools.cancelAvatars())

  ipcMain.handle('app:openPath', async (_e, target: string) => {
    if (typeof target === 'string' && target.length > 0) await shell.openPath(target)
  })

  app.on('will-quit', () => {
    for (const channel of [
      IPC.ENGINE_ADD_PATHS,
      IPC.ENGINE_START_ALL,
      IPC.ENGINE_RETRY_TASK,
      IPC.ENGINE_RETRY_FAILED,
      IPC.ENGINE_RESCRAPE,
      IPC.ENGINE_REMOVE_TASK,
      IPC.ENGINE_CLEAR_FINISHED,
      IPC.DIALOG_SELECT_FILES,
      IPC.DIALOG_SELECT_FOLDER,
      IPC.DIALOG_SAVE_FILE,
      IPC.SETTINGS_GET,
      IPC.SETTINGS_SET,
      IPC.READ_IMAGE,
      IPC.TOOLS_PROBE,
      IPC.TOOLS_CROP_PREVIEW,
      IPC.TOOLS_CROP_EXPORT,
      IPC.TOOLS_SCAN,
      IPC.TOOLS_AVATARS_START,
      IPC.TOOLS_AVATARS_CANCEL,
      'app:openPath'
    ] as const) {
      ipcMain.removeHandler(channel)
    }
  })
}
