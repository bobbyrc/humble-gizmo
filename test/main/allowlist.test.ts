import type { Session } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import { installAppSessionGuard, isAllowedUrl } from '../../src/main/net/allowlist'

const off = { updatesAllowed: false }
const on = { updatesAllowed: true }
const APP_ROOT = '/Applications/Humble Gizmo/app'
const withRoot = { updatesAllowed: false, appFileRoot: APP_ROOT }

describe('isAllowedUrl', () => {
  it('allows Humble and Steam https hosts and their subdomains', () => {
    expect(isAllowedUrl('https://www.humblebundle.com/api/v1/user/order', off)).toBe(true)
    expect(isAllowedUrl('https://store.steampowered.com/account/ajaxregisterkey/', off)).toBe(true)
    expect(isAllowedUrl('https://steamcommunity.com/', off)).toBe(true)
    expect(isAllowedUrl('https://cdn.steamstatic.com/a.jpg', off)).toBe(true)
    expect(isAllowedUrl('https://humblebundle.com/', off)).toBe(true)
  })

  it('allows exactly hb.imgix.net', () => {
    expect(isAllowedUrl('https://hb.imgix.net/image.png', off)).toBe(true)
    expect(isAllowedUrl('https://x.hb.imgix.net/image.png', off)).toBe(false)
  })

  it('matches suffixes only on a dot boundary', () => {
    expect(isAllowedUrl('https://evilhumblebundle.com/', off)).toBe(false)
    expect(isAllowedUrl('https://humblebundle.com.evil.example/', off)).toBe(false)
  })

  it('denies plain http', () => {
    expect(isAllowedUrl('http://www.humblebundle.com/', off)).toBe(false)
  })

  it('allows GitHub hosts only when updates are allowed', () => {
    const url = 'https://api.github.com/repos/bobbyrc/humble-gizmo/releases'
    expect(isAllowedUrl(url, off)).toBe(false)
    expect(isAllowedUrl(url, on)).toBe(true)
    expect(isAllowedUrl('https://github.com/bobbyrc/humble-gizmo', off)).toBe(false)
    expect(isAllowedUrl('https://github.com/bobbyrc/humble-gizmo', on)).toBe(true)
    expect(isAllowedUrl('https://objects.githubusercontent.com/x', on)).toBe(true)
    expect(isAllowedUrl('https://release-assets.githubusercontent.com/x', off)).toBe(false)
  })

  it('matches GitHub hosts exactly, not by subdomain', () => {
    expect(isAllowedUrl('https://x.api.github.com/', on)).toBe(false)
    expect(isAllowedUrl('https://gist.github.com/', on)).toBe(false)
  })

  it('denies other hosts', () => {
    expect(isAllowedUrl('https://www.google-analytics.com/collect', off)).toBe(false)
    expect(isAllowedUrl('https://www.google-analytics.com/collect', on)).toBe(false)
  })

  it('allows localhost http only for the dev server', () => {
    expect(isAllowedUrl('http://localhost:5173/', off)).toBe(false)
    expect(isAllowedUrl('http://localhost:5173/', { ...off, devServer: false })).toBe(false)
    expect(isAllowedUrl('http://localhost:5173/', { ...off, devServer: true })).toBe(true)
  })

  it('allows devtools and data schemes', () => {
    expect(isAllowedUrl('devtools://devtools/bundled/inspector.html', off)).toBe(true)
    expect(isAllowedUrl('data:text/plain,hello', off)).toBe(true)
  })

  it('allows file URLs only under the app file root', () => {
    expect(isAllowedUrl('file:///Applications/Humble%20Gizmo/app/index.html', withRoot)).toBe(true)
    expect(isAllowedUrl('file:///etc/passwd', withRoot)).toBe(false)
    expect(isAllowedUrl('file:///app-evil/x', { ...off, appFileRoot: '/app' })).toBe(false)
    expect(isAllowedUrl('file:///Applications/Humble%20Gizmo/app/index.html', off)).toBe(false)
  })

  it('does not let encoded or relative segments escape the app file root', () => {
    expect(
      isAllowedUrl('file:///Applications/Humble%20Gizmo/app/%2e%2e/secret.txt', withRoot)
    ).toBe(false)
    expect(isAllowedUrl('file:///Applications/Humble%20Gizmo/app/..%2fsecret.txt', withRoot)).toBe(
      false
    )
  })

  it('denies unparseable input', () => {
    expect(isAllowedUrl('not a url', off)).toBe(false)
    expect(isAllowedUrl('', off)).toBe(false)
  })
})

describe('installAppSessionGuard', () => {
  function stubSession(): {
    ses: Session
    fire: (url: string, callback: (r: { cancel: boolean }) => void) => void
  } {
    let listener: (
      details: { url: string },
      callback: (r: { cancel: boolean }) => void
    ) => void = () => {}
    const ses = {
      webRequest: {
        onBeforeRequest(fn: typeof listener) {
          listener = fn
        }
      }
    } as unknown as Session
    return {
      ses,
      fire: (url: string, callback: (r: { cancel: boolean }) => void) => listener({ url }, callback)
    }
  }

  it('cancels disallowed requests and lets allowed ones through', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { ses, fire } = stubSession()
    installAppSessionGuard(ses, () => off)

    const allowed = vi.fn()
    fire('https://www.humblebundle.com/api/v1/user/order', allowed)
    expect(allowed).toHaveBeenCalledWith({ cancel: false })

    const blocked = vi.fn()
    fire('https://www.google-analytics.com/collect', blocked)
    expect(blocked).toHaveBeenCalledWith({ cancel: true })
    vi.restoreAllMocks()
  })
})
