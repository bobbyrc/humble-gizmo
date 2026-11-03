import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '../../src/shared/types'
import type { Settings } from '../../src/shared/types'
import { guardUpdaterSession, initUpdater, type UpdaterDeps } from '../../src/main/updater'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function setup(over: Partial<UpdaterDeps> = {}, autoUpdate = false, available = true) {
  let current: Settings = { ...DEFAULT_SETTINGS, autoUpdate }
  const flag: boolean[] = []
  let ticks: (() => void) | null = null
  const updater = {
    autoDownload: true,
    autoInstallOnAppQuit: true,
    logger: console as unknown,
    on: vi.fn(),
    checkForUpdates: vi.fn(async () => ({
      isUpdateAvailable: available,
      updateInfo: { version: '9.9.9' }
    })),
    downloadUpdate: vi.fn(async () => []),
    quitAndInstall: vi.fn()
  }
  const askInstall = vi.fn(async () => true)
  const beforeInstall = vi.fn()
  const clear = vi.fn()
  const deps = {
    settings: { get: () => current },
    updater,
    setUpdatesAllowed: (b: boolean) => void flag.push(b),
    askInstall,
    beforeInstall,
    setInterval: ((fn: () => void) => {
      ticks = fn
      return 1
    }) as unknown as typeof setInterval,
    clearInterval: clear as unknown as typeof clearInterval,
    ...over
  } as unknown as UpdaterDeps
  const u = initUpdater(deps)
  return {
    u,
    updater,
    flag,
    askInstall,
    beforeInstall,
    clear,
    tick: () => ticks?.(),
    set: (s: Partial<Settings>) => {
      current = { ...current, ...s }
      u.onSettingsChanged(current)
    }
  }
}

describe('initUpdater', () => {
  it('configures the updater to never download or install on its own, and not log', () => {
    const { updater } = setup()
    expect(updater.autoDownload).toBe(false)
    expect(updater.autoInstallOnAppQuit).toBe(false)
    expect(updater.logger).toBeNull()
  })

  it('does not check at init when autoUpdate is off', () => {
    const { updater, flag } = setup()
    expect(updater.checkForUpdates).not.toHaveBeenCalled()
    expect(flag).toEqual([])
  })

  it('checks at init when autoUpdate is on, then every 24h', async () => {
    const { updater, tick } = setup({}, true, false)
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1)
    await new Promise((r) => setTimeout(r, 0))
    tick()
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(2)
  })

  it('checkNow checks once and toggles the flag true then false', async () => {
    const { u, updater, flag } = setup({}, false, false)
    expect(await u.checkNow()).toBe('none')
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1)
    expect(flag).toEqual([true, false])
  })

  it('with autoUpdate off, the flag is true only while the check runs', async () => {
    const { u, updater, flag } = setup({}, false, false)
    const during: boolean[][] = []
    updater.checkForUpdates.mockImplementation(async () => {
      during.push([...flag])
      return { isUpdateAvailable: false, updateInfo: { version: '1' } }
    })
    await u.checkNow()
    expect(during).toEqual([[true]])
    expect(flag[flag.length - 1]).toBe(false)
  })

  it('restores the flag from settings (true) when autoUpdate is on', async () => {
    const { u, flag } = setup({}, true, false)
    await u.checkNow() // shares the startup check
    await vi.waitFor(() => expect(flag).toEqual([true, true]))
  })

  it('does not download when askInstall resolves false', async () => {
    const { u, updater, beforeInstall } = setup({ askInstall: vi.fn(async () => false) })
    expect(await u.checkNow()).toBe('available')
    expect(updater.downloadUpdate).not.toHaveBeenCalled()
    expect(updater.quitAndInstall).not.toHaveBeenCalled()
    expect(beforeInstall).not.toHaveBeenCalled()
  })

  it('downloads then installs when the user accepts, marking the app as quitting first', async () => {
    const { u, updater, askInstall, beforeInstall } = setup()
    const order: string[] = []
    beforeInstall.mockImplementation(() => order.push('before'))
    updater.downloadUpdate.mockImplementation(async () => {
      order.push('download')
      return []
    })
    updater.quitAndInstall.mockImplementation(() => void order.push('install'))
    await u.checkNow()
    expect(askInstall).toHaveBeenCalledWith('9.9.9')
    expect(order).toEqual(['download', 'before', 'install'])
  })

  it('dev mode never contacts anything', async () => {
    const { u, updater, flag } = setup({ isPackaged: false }, true)
    expect(await u.checkNow()).toBe('error')
    u.onSettingsChanged({ ...DEFAULT_SETTINGS, autoUpdate: true })
    expect(updater.checkForUpdates).not.toHaveBeenCalled()
    expect(flag).toEqual([])
  })

  it('returns error and restores the flag when the check fails', async () => {
    const { u, updater, flag } = setup()
    updater.checkForUpdates.mockRejectedValue(new Error('offline'))
    expect(await u.checkNow()).toBe('error')
    expect(flag).toEqual([true, false])
  })

  it('toggling autoUpdate on starts checks; off stops them and disallows updates', () => {
    const { updater, flag, clear, set } = setup()
    set({ autoUpdate: true })
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1)
    set({ autoUpdate: true })
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1)
    set({ autoUpdate: false })
    expect(clear).toHaveBeenCalledTimes(1)
    expect(flag[flag.length - 1]).toBe(false)
  })

  it('linux non-AppImage: shows the releases prompt and never downloads', async () => {
    const showReleasesPrompt = vi.fn(async () => undefined)
    const { u, updater, askInstall } = setup({ externalInstall: true, showReleasesPrompt })
    expect(await u.checkNow()).toBe('available')
    expect(showReleasesPrompt).toHaveBeenCalledTimes(1)
    expect(askInstall).not.toHaveBeenCalled()
    expect(updater.downloadUpdate).not.toHaveBeenCalled()
  })

  it('shares one in-flight check between overlapping calls', async () => {
    const { u, updater } = setup({}, false, false)
    await Promise.all([u.checkNow(), u.checkNow()])
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1)
  })

  it('closes the gate while the install prompt waits, reopens it for the download', async () => {
    const { u, updater, flag, askInstall } = setup()
    const seen: Record<string, boolean[]> = {}
    askInstall.mockImplementation(async () => {
      seen.ask = [...flag]
      return true
    })
    updater.downloadUpdate.mockImplementation(async () => {
      seen.download = [...flag]
      return []
    })
    await u.checkNow()
    expect(seen.ask).toEqual([true, false])
    expect(seen.download).toEqual([true, false, true])
    expect(flag[flag.length - 1]).toBe(false)
  })

  it('undoes beforeInstall when download or install throws', async () => {
    const afterInstallFailed = vi.fn()
    const a = setup({ afterInstallFailed })
    a.updater.quitAndInstall.mockImplementation(() => {
      throw new Error('boom')
    })
    expect(await a.u.checkNow()).toBe('error')
    expect(a.beforeInstall).toHaveBeenCalledTimes(1)
    expect(afterInstallFailed).toHaveBeenCalledTimes(1)

    const failDownload = vi.fn()
    const b = setup({ afterInstallFailed: failDownload })
    b.updater.downloadUpdate.mockRejectedValue(new Error('net'))
    expect(await b.u.checkNow()).toBe('error')
    expect(b.beforeInstall).not.toHaveBeenCalled()
    expect(failDownload).not.toHaveBeenCalled()
  })
})

describe('guardUpdaterSession', () => {
  it('guards the electron-updater partition and follows the updates flag', () => {
    let handler: ((d: { url: string }, cb: (r: { cancel: boolean }) => void) => void) | undefined
    const ses = { webRequest: { onBeforeRequest: (h: typeof handler) => void (handler = h) } }
    const fromPartition = vi.fn(() => ses)
    let allowed = false
    guardUpdaterSession(fromPartition as never, () => allowed)
    expect(fromPartition).toHaveBeenCalledWith('electron-updater', { cache: false })
    const cancelled = (url: string): boolean => {
      let c = false
      handler!({ url }, (r) => void (c = r.cancel))
      return c
    }
    expect(cancelled('https://api.github.com/repos/x')).toBe(true)
    allowed = true
    expect(cancelled('https://api.github.com/repos/x')).toBe(false)
    expect(cancelled('https://example.com/')).toBe(true)
  })
})
