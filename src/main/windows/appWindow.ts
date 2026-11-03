import { BrowserWindow } from 'electron'
import type { WebPreferences } from 'electron'
import { join } from 'path'

export const APP_WINDOW_WEB_PREFERENCES: WebPreferences = {
  preload: join(__dirname, '../preload/index.js'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true
}

export function createAppWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    webPreferences: APP_WINDOW_WEB_PREFERENCES
  })

  win.on('ready-to-show', () => win.show())

  // Never open arbitrary windows; later tasks route allowed URLs via openExternal.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  if (process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return win
}
