import { describe, expect, it } from 'vitest'
import {
  PARTITIONS,
  SIGN_IN_URLS,
  STATUS_URLS,
  isAllowedSignInNavigation,
  isIdentityProviderUrl,
  isSafeExternalUrl,
  isSameServiceNavigation,
  isSignInSuccessUrl
} from '../../src/main/windows/signInUrls'

describe('isSafeExternalUrl', () => {
  it('allows only http and https', () => {
    expect(isSafeExternalUrl('https://example.com/')).toBe(true)
    expect(isSafeExternalUrl('http://example.com/')).toBe(true)
    for (const u of [
      'file:///etc/passwd',
      'javascript:alert(1)',
      'smb://x/y',
      'ms-msdt:x',
      'nope'
    ]) {
      expect(isSafeExternalUrl(u)).toBe(false)
    }
  })
})

describe('identity providers', () => {
  it('allows each IdP host and nothing lookalike', () => {
    for (const h of [
      'accounts.google.com',
      'appleid.apple.com',
      'facebook.com',
      'www.facebook.com',
      'm.facebook.com'
    ]) {
      expect(isIdentityProviderUrl(`https://${h}/x`)).toBe(true)
      expect(isAllowedSignInNavigation(`https://${h}/x`)).toBe(true)
    }
    expect(isIdentityProviderUrl('https://accounts.google.com.evil.com/')).toBe(false)
    expect(isIdentityProviderUrl('http://accounts.google.com/')).toBe(false)
    expect(isAllowedSignInNavigation('https://accounts.google.com.evil.com/')).toBe(false)
    expect(isAllowedSignInNavigation('https://www.humblebundle.com/')).toBe(true)
  })
})

describe('constants', () => {
  it('uses the exact partitions and URLs', () => {
    expect(PARTITIONS).toEqual({ humble: 'persist:humble', steam: 'persist:steam' })
    expect(SIGN_IN_URLS).toEqual({
      humble: 'https://www.humblebundle.com/login?goto=/home/library',
      steam: 'https://store.steampowered.com/login/?redir=account%2Fregisterkey'
    })
    expect(STATUS_URLS).toEqual({
      humble: 'https://www.humblebundle.com/home/library',
      steam: 'https://store.steampowered.com/account/registerkey'
    })
  })
})

describe('isSignInSuccessUrl', () => {
  it('matches the status paths', () => {
    expect(isSignInSuccessUrl('humble', 'https://www.humblebundle.com/home/library')).toBe(true)
    expect(isSignInSuccessUrl('steam', 'https://store.steampowered.com/account/registerkey')).toBe(
      true
    )
  })
  it('rejects the login pages and other hosts', () => {
    expect(
      isSignInSuccessUrl('humble', 'https://www.humblebundle.com/login?goto=/home/library')
    ).toBe(false)
    expect(
      isSignInSuccessUrl(
        'steam',
        'https://store.steampowered.com/login/?redir=account%2Fregisterkey'
      )
    ).toBe(false)
    expect(isSignInSuccessUrl('humble', 'https://evil.com/home/library')).toBe(false)
    expect(isSignInSuccessUrl('humble', 'not a url')).toBe(false)
  })
})

describe('isSameServiceNavigation', () => {
  it('allows Humble and Steam hosts', () => {
    expect(isSameServiceNavigation('https://login.steampowered.com/jwt/x')).toBe(true)
    expect(isSameServiceNavigation('https://store.steampowered.com/')).toBe(true)
    expect(isSameServiceNavigation('https://steamcommunity.com/openid')).toBe(true)
    expect(isSameServiceNavigation('https://www.humblebundle.com/login')).toBe(true)
    expect(isSameServiceNavigation('https://humblebundle.com/')).toBe(true)
  })
  it('rejects others, lookalikes, http and garbage', () => {
    expect(isSameServiceNavigation('https://accounts.google.com/')).toBe(false)
    expect(isSameServiceNavigation('https://evilhumblebundle.com/')).toBe(false)
    expect(isSameServiceNavigation('https://humblebundle.com.evil.com/')).toBe(false)
    expect(isSameServiceNavigation('http://www.humblebundle.com/')).toBe(false)
    expect(isSameServiceNavigation('nope')).toBe(false)
  })
})
