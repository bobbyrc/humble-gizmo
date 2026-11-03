import { BrowserWindow, session, shell } from 'electron'
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
        nodeIntegration: false
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

/** Signed in when the status page loads directly instead of redirecting to a login page. */
export async function checkSignedIn(service: Service): Promise<boolean> {
  const res = await session
    .fromPartition(PARTITIONS[service])
    .fetch(STATUS_URLS[service], { redirect: 'manual' })
  return !(res.status === 301 || res.status === 302 || res.type === 'opaqueredirect')
}

export async function signOut(service: Service): Promise<void> {
  await session.fromPartition(PARTITIONS[service]).clearStorageData()
}
