import { BrowserWindow, session, shell } from 'electron'
import { checkSignedInWith } from './checkSignedInWith'
import type { Service } from '../../shared/types'
import {
  PARTITIONS,
  SIGN_IN_URLS,
  STATUS_URLS,
  isAllowedSignInNavigation,
  isSafeExternalUrl,
  isSignInSuccessUrl
} from './signInUrls'

export {
  isAllowedSignInNavigation,
  isIdentityProviderUrl,
  isSafeExternalUrl,
  PARTITIONS,
  SIGN_IN_URLS,
  STATUS_URLS,
  isSameServiceNavigation,
  isSignInSuccessUrl
} from './signInUrls'

/**
 * Opens the service's real login page. The app never sees the password; it only watches
 * navigation. Resolves true once the status page loads, false if the user closes the window.
 */
export function openSignInWindow(service: Service, parent?: BrowserWindow): Promise<boolean> {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 520,
      height: 760,
      parent,
      title: service === 'humble' ? 'Sign in to Humble Bundle' : 'Sign in to Steam',
      webPreferences: {
        partition: PARTITIONS[service],
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        spellcheck: false
      }
    })
    let settled = false
    const finish = (ok: boolean): void => {
      if (settled) return
      settled = true
      resolve(ok)
      if (!win.isDestroyed()) win.close()
    }

    const contents = win.webContents
    const checkUrl = (url: string): void => {
      if (isSignInSuccessUrl(service, url)) finish(true)
    }
    contents.on('did-navigate', (_e, url) => checkUrl(url))
    contents.on('did-navigate-in-page', (_e, url) => checkUrl(url))
    const openExternal = (url: string): void => {
      if (isSafeExternalUrl(url)) void shell.openExternal(url)
    }
    const guard = (event: { preventDefault: () => void }, url: string): void => {
      if (!isAllowedSignInNavigation(url)) {
        event.preventDefault()
        openExternal(url)
      }
    }
    contents.on('will-navigate', (event, url) => guard(event, url))
    contents.on('will-redirect', (event, url) => guard(event, url))
    contents.setWindowOpenHandler(({ url }) => {
      if (isAllowedSignInNavigation(url)) void contents.loadURL(url)
      else openExternal(url)
      return { action: 'deny' }
    })
    win.on('closed', () => finish(false))
    void win.loadURL(SIGN_IN_URLS[service])
  })
}

const refreshing: Partial<Record<Service, Promise<boolean>>> = {}

/**
 * Steam's store login token lasts about a day; its pages renew it from a longer-lived login
 * cookie, which a plain request cannot do. Loads the status page in a hidden window: true if it
 * lands there, false on the login page, a blocked navigation or a 20s timeout.
 */
export function refreshSession(service: Service): Promise<boolean> {
  return (refreshing[service] ??= new Promise<boolean>((resolve) => {
    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        partition: PARTITIONS[service],
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        spellcheck: false
      }
    })
    const login = new URL(SIGN_IN_URLS[service])
    const finish = (ok: boolean): void => {
      clearTimeout(timer)
      resolve(ok)
      if (!win.isDestroyed()) win.destroy()
    }
    const timer = setTimeout(() => finish(false), 20_000)
    const contents = win.webContents
    contents.on('did-navigate', (_e, url) => {
      if (isSignInSuccessUrl(service, url)) finish(true)
      const u = new URL(url)
      if (u.hostname === login.hostname && u.pathname === login.pathname) finish(false)
    })
    // -3 is a navigation replaced by a redirect, which the refresh does; subframes don't count.
    contents.on('did-fail-load', (_e, code, _desc, _url, isMainFrame) => {
      if (isMainFrame && code !== -3) finish(false)
    })
    const guard = (event: { preventDefault: () => void }, url: string): void => {
      if (!isAllowedSignInNavigation(url)) {
        event.preventDefault()
        finish(false)
      }
    }
    contents.on('will-navigate', guard)
    contents.on('will-redirect', guard)
    contents.setWindowOpenHandler(() => ({ action: 'deny' }))
    // A rejection can mean a redirect replaced the load; did-fail-load and the timeout decide.
    win.loadURL(STATUS_URLS[service]).catch(() => undefined)
  }).finally(() => {
    delete refreshing[service]
  }))
}

/** Signed in when the status page loads directly instead of redirecting to a login page. */
export async function checkSignedIn(service: Service): Promise<boolean> {
  const check = (): Promise<boolean> =>
    checkSignedInWith(session.fromPartition(PARTITIONS[service]), STATUS_URLS[service])
  if (await check()) return true
  // Only Steam's token expires daily; Humble's session cookie does not need this.
  return service === 'steam' && (await refreshSession(service)) && (await check())
}

export async function signOut(service: Service): Promise<void> {
  await session.fromPartition(PARTITIONS[service]).clearStorageData()
}
