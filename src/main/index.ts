import { app, dialog, ipcMain, Notification, powerSaveBlocker, session, shell } from 'electron'
import type { BrowserWindow } from 'electron'
import { promises as fs } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { newKeysNotification } from '../shared/copy'
import type { Settings } from '../shared/types'
import { applyLinuxAutostart } from './autostart'
import { createBackgroundCheck } from './backgroundCheck'
import { startScheduler } from './scheduler'
import { createTray } from './tray'
import { runCapture } from './dev/capture'
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

// Only these mean "the saved file is unreadable"; anything else (EACCES, ...) is not fixed by starting fresh.
function isUnreadableStore(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : ''
  return (
    msg === 'keys.json is encrypted but no encrypting codec is available' ||
    msg.includes('corrupt JSON in keys.json') ||
    /decrypt/i.test(msg)
  )
}

async function openKeyStore(dir: string, codec: SecretCodec): Promise<KeyStore | null> {
  try {
    return await KeyStore.open(dir, codec)
  } catch (e) {
    if (!isUnreadableStore(e)) throw e
    const { response } = await dialog.showMessageBox({
      type: 'warning',
      message:
        "Humble Gizmo can't read its saved progress (the system keychain may have changed). Start fresh? Your Humble and Steam accounts are not affected.",
      buttons: ['Start fresh', 'Quit'],
      defaultId: 0,
      cancelId: 1
    })
    if (response !== 0) return null
    try {
      await fs.rename(join(dir, 'keys.json'), join(dir, `keys.unreadable-${Date.now()}.json`))
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
    }
    return KeyStore.open(dir, codec)
  }
}

// Kept until clicked or closed so Electron cannot collect them first.
const liveNotifications = new Set<Notification>()

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

  let quitting = false
  app.on('before-quit', () => {
    quitting = true
    scheduler.stop()
  })
  let tray: { destroy(): void } | null = null

  const open = (): void => {
    const win = createAppWindow()
    appWindow = win
    // With keepInBackground (and a tray to bring it back) closing only hides the window.
    win.on('close', (e) => {
      if (!quitting && tray && settings.get().keepInBackground) {
        e.preventDefault()
        win.hide()
      }
    })
    win.on('closed', () => {
      if (appWindow === win) appWindow = null
    })
  }
  const showWindow = (): void => {
    if (!appWindow || appWindow.isDestroyed()) {
      open()
      return
    }
    if (appWindow.isMinimized()) appWindow.restore()
    appWindow.show()
    appWindow.focus()
  }

  const applyTray = (s: Settings): void => {
    if (s.keepInBackground && !tray) {
      tray = createTray(showWindow, () => {
        quitting = true
        app.quit()
      })
    } else if (!s.keepInBackground && tray) {
      tray.destroy()
      tray = null
      // The window may be hidden; make sure the user is not left with no way back in.
      if (appWindow && !appWindow.isDestroyed() && !appWindow.isVisible()) showWindow()
    }
  }
  const applyLaunchAtLogin = (enabled: boolean): void => {
    if (process.platform === 'linux') {
      void applyLinuxAutostart(enabled, homedir(), process.execPath).catch(() => undefined)
    } else {
      app.setLoginItemSettings({ openAtLogin: enabled })
    }
  }

  // Scheduled checks only announce new keys (see backgroundCheck.ts); they never reveal or redeem.
  const showNotification = (body: string): void => {
    if (!Notification.isSupported()) return
    const n = new Notification({ title: 'Humble Gizmo', body })
    // Electron may garbage-collect a notification before the user clicks it.
    liveNotifications.add(n)
    n.on('click', () => {
      liveNotifications.delete(n)
      showWindow()
    })
    n.on('close', () => liveNotifications.delete(n))
    n.show()
  }
  const scheduler = startScheduler({
    getHours: () => settings.get().scheduleHours,
    check: createBackgroundCheck({
      isRunActive: () => handlers.isRunActive(),
      peekWillRedeemIds: () => handlers.peekWillRedeemIds()
    }),
    notify: (n) => showNotification(newKeysNotification(n)),
    notifySignedOut: (s) =>
      showNotification(`Sign in to ${s === 'humble' ? 'Humble' : 'Steam'} again to keep checking.`),
    setTimer: setTimeout
  })

  const handlers = createHandlers({
    humble,
    steam,
    keys,
    settings,
    storageEncrypted: codec.encrypted,
    platform,
    onSettingsChanged: (s) => {
      scheduler.reschedule()
      applyTray(s)
      applyLaunchAtLogin(s.launchAtLogin)
    }
  })
  registerHandlers(ipcMain, handlers)
  applyTray(settings.get())
  applyLaunchAtLogin(settings.get().launchAtLogin)

  open()
  app.on('activate', showWindow)
  app.on('second-instance', () => {
    if (!appWindow || appWindow.isDestroyed()) return
    if (appWindow.isMinimized()) appWindow.restore()
    appWindow.focus()
  })
}

if (process.env.GIZMO_PROBE === '1') {
  // Dev spike (npm run probe): no app window, only the sign-in windows.
  void app.whenReady().then(runProbe)
} else if (process.env.GIZMO_CAPTURE === '1') {
  // Dev tool (npm run capture): saves sanitized fixtures, no app window.
  void app.whenReady().then(runCapture)
} else if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  void app.whenReady().then(() =>
    start().catch(() => {
      dialog.showErrorBox('Humble Gizmo', 'Humble Gizmo could not start.')
      app.quit()
    })
  )

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
