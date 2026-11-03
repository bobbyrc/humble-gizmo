import { describe, expect, it } from 'vitest'
import {
  PARTITIONS,
  SIGN_IN_URLS,
  STATUS_URLS,
  isSameServiceNavigation,
  isSignInSuccessUrl
} from '../../src/main/windows/signInUrls'

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
