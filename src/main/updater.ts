import type { AppUpdater } from 'electron-updater'
import type { Session } from 'electron'
import type { Settings } from '../shared/types'
import { installAppSessionGuard } from './net/allowlist'

export type UpdateCheck = 'none' | 'available' | 'error'

const DAY_MS = 24 * 60 * 60 * 1000

export interface UpdaterDeps {
  settings: { get(): Settings }
  updater: Pick<
    AppUpdater,
    | 'checkForUpdates'
    | 'downloadUpdate'
    | 'quitAndInstall'
    | 'on'
    | 'autoDownload'
    | 'autoInstallOnAppQuit'
    | 'logger'
  >
  /** Feeds the network allowlist. True only around a check or download the user allowed. */
  setUpdatesAllowed(b: boolean): void
  /** Asks the user whether to download and install `version`. */
  askInstall(version: string): Promise<boolean>
  /** False in dev: nothing is contacted and checkNow returns 'error'. Defaults to true. */
  isPackaged?: boolean
  /** Linux installs that cannot self-update (not AppImage): tell the user and link to Releases. */
  externalInstall?: boolean
  showReleasesPrompt?(): Promise<void>
  /** Runs just before quitAndInstall so the app's own quit guards let it through. */
  beforeInstall?(): void
  /** Undoes beforeInstall when the download or install throws. */
  afterInstallFailed?(): void
  setInterval?: typeof setInterval
  clearInterval?: typeof clearInterval
}

export interface Updater {
  checkNow(): Promise<UpdateCheck>
  /** Call when settings change: starts or stops the 24 h checks. */
  onSettingsChanged(s: Settings): void
  stop(): void
}

export function initUpdater(deps: UpdaterDeps): Updater {
  const { updater, settings } = deps
  const packaged = deps.isPackaged ?? true
  const setTick = deps.setInterval ?? setInterval
  const clearTick = deps.clearInterval ?? clearInterval

  updater.autoDownload = false
  updater.autoInstallOnAppQuit = false
  // Null so nothing (feed URLs included) is logged.
  updater.logger = null
  // An unhandled 'error' event would throw; failures surface as the rejected promise instead.
  updater.on('error', () => undefined)

  let inFlight: Promise<UpdateCheck> | null = null
  let timer: ReturnType<typeof setInterval> | null = null

  const restoreFlag = (): void => deps.setUpdatesAllowed(settings.get().autoUpdate)

  const run = async (): Promise<UpdateCheck> => {
    deps.setUpdatesAllowed(true)
    let installing = false
    try {
      const res = await updater.checkForUpdates()
      if (!res || !res.isUpdateAvailable) return 'none'
      const version = res.updateInfo.version
      // No network is needed while a dialog waits, so close the gate first.
      restoreFlag()
      if (deps.externalInstall) {
        await deps.showReleasesPrompt?.()
        return 'available'
      }
      // The user decides before anything is downloaded.
      if (await deps.askInstall(version)) {
        deps.setUpdatesAllowed(true)
        await updater.downloadUpdate()
        restoreFlag()
        installing = true
        deps.beforeInstall?.()
        updater.quitAndInstall()
      }
      return 'available'
    } catch {
      if (installing) deps.afterInstallFailed?.()
      return 'error'
    } finally {
      restoreFlag()
    }
  }

  const checkNow = (): Promise<UpdateCheck> => {
    if (!packaged) return Promise.resolve('error')
    inFlight ??= run().finally(() => {
      inFlight = null
    })
    return inFlight
  }

  const start = (): void => {
    if (timer !== null || !packaged) return
    void checkNow()
    timer = setTick(() => void checkNow(), DAY_MS)
  }
  const stop = (): void => {
    if (timer !== null) clearTick(timer)
    timer = null
  }

  const onSettingsChanged = (s: Settings): void => {
    if (s.autoUpdate) {
      start()
    } else {
      stop()
      deps.setUpdatesAllowed(false)
    }
  }

  // Startup: only when the user opted in.
  if (settings.get().autoUpdate) start()

  return { checkNow, onSettingsChanged, stop }
}

/**
 * electron-updater sends its requests through its own session, which the app-wide guard does not
 * cover. Guard that session too so update traffic is blocked unless updates are allowed.
 */
export function guardUpdaterSession(
  fromPartition: (partition: string, opts: { cache: boolean }) => Session,
  getUpdatesAllowed: () => boolean
): void {
  installAppSessionGuard(fromPartition('electron-updater', { cache: false }), () => ({
    updatesAllowed: getUpdatesAllowed()
  }))
}
