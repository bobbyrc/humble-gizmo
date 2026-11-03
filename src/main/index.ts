import { app, BrowserWindow, dialog, ipcMain, powerSaveBlocker, session, shell } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { runProbe } from './dev/probe'
import { createAppWindow } from './windows/appWindow'
import { checkSignedIn, openSignInWindow, signOut } from './windows/signIn'
import { installAppSessionGuard } from './net/allowlist'
import { getUpdatesAllowed } from './net/updatesFlag'
import { createHumbleHttpClient } from './net/transportConfig'
import { SessionHttpClient } from './net/sessionHttpClient'
import { HumbleApi } from './humble/humbleApi'
import { SteamApi } from './steam/steamApi'
import { createOwnedNamesSource } from './steam/ownedNames'
import { KeyStore } from './store/keyStore'
import { SettingsStore } from './store/settingsStore'
import { createSafeStorageCodec, type SecretCodec } from './store/secretCodec'
import { createHandlers, registerHandlers, type Platform } from './ipc/handlers'

async function openKeyStore(dir: string, codec: SecretCodec): Promise<KeyStore | null> {
  try {
    return await KeyStore.open(dir, codec)
  } catch {
    const { response } = await dialog.showMessageBox({
      type: 'warning',
      message:
        "Humble Gizmo can't read its saved progress (the system keychain may have changed). Start fresh? Your Humble and Steam accounts are not affected.",
      buttons: ['Start fresh', 'Quit'],
      defaultId: 0,
      cancelId: 1
    })
    if (response !== 0) return null
    await fs.rename(join(dir, 'keys.json'), join(dir, `keys.unreadable-${Date.now()}.json`))
    return KeyStore.open(dir, codec)
  }
}

async function start(): Promise<void> {
  installAppSessionGuard(session.defaultSession, () => ({
    updatesAllowed: getUpdatesAllowed(),
    devServer: !app.isPackaged,
    appFileRoot: app.getAppPath()
  }))

  const dir = app.getPath('userData')
  const codec = createSafeStorageCodec()
  const settings = await SettingsStore.open(dir)
  const keys = await openKeyStore(dir, codec)
  if (!keys) {
    app.quit()
    return
  }

  const humble = new HumbleApi(createHumbleHttpClient())
  const steamHttp = new SessionHttpClient('persist:steam')
  const steam = new SteamApi(
    steamHttp,
    createOwnedNamesSource(steamHttp, () => settings.get().steamApiKey)
  )

  let appWindow: BrowserWindow | null = null
  let blockerId: number | null = null
  const platform: Platform = {
    send: (channel, payload) => {
      if (appWindow && !appWindow.isDestroyed()) appWindow.webContents.send(channel, payload)
    },
    openSignIn: (service) => openSignInWindow(service, appWindow ?? undefined),
    checkSignedIn,
    signOut,
    showSaveDialog: async (defaultName) => {
      const opts = { defaultPath: defaultName, filters: [{ name: 'CSV', extensions: ['csv'] }] }
      const res =
        appWindow && !appWindow.isDestroyed()
          ? await dialog.showSaveDialog(appWindow, opts)
          : await dialog.showSaveDialog(opts)
      return res.canceled || !res.filePath ? null : res.filePath
    },
    writeFile: (path, data) => fs.writeFile(path, data, 'utf8'),
    openExternal: (url) => shell.openExternal(url),
    powerSave: {
      start: () => {
        if (blockerId === null) blockerId = powerSaveBlocker.start('prevent-app-suspension')
      },
      stop: () => {
        if (blockerId !== null) powerSaveBlocker.stop(blockerId)
        blockerId = null
      }
    },
    checkForUpdates: async () => 'error' // stub until Task 25
  }

  registerHandlers(
    ipcMain,
    createHandlers({ humble, steam, keys, settings, storageEncrypted: codec.encrypted, platform })
  )

  const open = (): void => {
    appWindow = createAppWindow()
  }
  open()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) open()
  })
  app.on('second-instance', () => {
    if (!appWindow || appWindow.isDestroyed()) return
    if (appWindow.isMinimized()) appWindow.restore()
    appWindow.focus()
  })
}

if (process.env.GIZMO_PROBE === '1') {
  // Dev spike (npm run probe): no app window, only the sign-in windows.
  void app.whenReady().then(runProbe)
} else if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  void app.whenReady().then(start)

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
