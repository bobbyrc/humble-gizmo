import { describe, expect, it } from 'vitest'
import { isAllowedUrl } from '../../src/main/net/allowlist'

const off = { updatesAllowed: false }
const on = { updatesAllowed: true }

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

  it('denies other hosts', () => {
    expect(isAllowedUrl('https://www.google-analytics.com/collect', off)).toBe(false)
    expect(isAllowedUrl('https://www.google-analytics.com/collect', on)).toBe(false)
  })

  it('allows localhost http only for the dev server', () => {
    expect(isAllowedUrl('http://localhost:5173/', off)).toBe(false)
    expect(isAllowedUrl('http://localhost:5173/', { ...off, devServer: false })).toBe(false)
    expect(isAllowedUrl('http://localhost:5173/', { ...off, devServer: true })).toBe(true)
  })

  it('allows the app-owned file, devtools and data schemes', () => {
    expect(isAllowedUrl('file:///Applications/Humble%20Gizmo/index.html', off)).toBe(true)
    expect(isAllowedUrl('devtools://devtools/bundled/inspector.html', off)).toBe(true)
    expect(isAllowedUrl('data:text/plain,hello', off)).toBe(true)
  })

  it('denies unparseable input', () => {
    expect(isAllowedUrl('not a url', off)).toBe(false)
    expect(isAllowedUrl('', off)).toBe(false)
  })
})
