import { app, BrowserWindow } from 'electron'
import path from 'node:path'
import { Engine } from './engine'
import { registerIpc } from './ipc'
import { SettingsStore } from './store/settingsStore'
import { ToolRunner } from './tools/toolRunner'

app.commandLine.appendSwitch('no-sandbox')
if (process.env['ELECTRON_RENDERER_URL']) {
  app.commandLine.appendSwitch('remote-debugging-port', '9229')
}

const settingsStore = new SettingsStore()
const engine = new Engine(settingsStore)
const tools = new ToolRunner(settingsStore)
let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0a0c0f',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 20 },
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow = win
  win.once('ready-to-show', () => win.show())
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
  })
  engine.attach(win)
  tools.attach(win)

  if (process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerIpc(engine, settingsStore, tools, () => mainWindow)
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
