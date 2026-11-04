import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractKeys, isValidSteamKeyFormat, steamKeys } from '../../src/core/keys'

const orders: unknown[] = JSON.parse(
  readFileSync(join(__dirname, '../fixtures/hand/orders.json'), 'utf8')
)

describe('extractKeys', () => {
  it('finds all four well-formed keys', () => {
    expect(extractKeys(orders)).toHaveLength(4)
  })

  it('reads the revealed Steam key', () => {
    const key = extractKeys(orders).find((k) => k.machineName === 'game_one_steam')
    expect(key?.revealedKey).toBe('AAAAA-BBBBB-CCCCC')
    expect(key?.isSteam).toBe(true)
    expect(key?.steamAppId).toBe(1001)
    expect(key?.id).toBe('gk1:0:game_one_steam')
  })

  it('treats steam_app_id 0 as Steam with no app id', () => {
    const key = extractKeys(orders).find((k) => k.machineName === 'game_two_steam')
    expect(key?.steamAppId).toBeNull()
    expect(key?.isSteam).toBe(true)
    expect(key?.revealedKey).toBeNull()
  })

  it('marks a key without a steam_app_id property as non-Steam', () => {
    const key = extractKeys(orders).find((k) => k.machineName === 'game_three_ebook')
    expect(key?.isSteam).toBe(false)
    expect(key?.steamAppId).toBeNull()
    expect(key?.keyTypeName).toBe('Ebook')
  })

  it('finds a Steam key nested under subproducts[].tpkd_dict.all_tpks', () => {
    const key = extractKeys(orders).find((k) => k.machineName === 'game_four_steam')
    expect(key?.isSteam).toBe(true)
    expect(key?.steamAppId).toBe(4004)
    expect(key?.isGift).toBe(true)
    expect(key?.revealedKey).toBeNull()
  })

  it('does not throw on a malformed order and skips the key missing gamekey', () => {
    expect(() => extractKeys(orders)).not.toThrow()
    expect(extractKeys(orders).some((k) => k.machineName === 'orphan_steam')).toBe(false)
  })

  it('trims the name', () => {
    const key = extractKeys(orders).find((k) => k.machineName === 'game_one_steam')
    expect(key?.name).toBe('Game One')
  })

  it('attaches the order bundle name and purchase date to its keys', () => {
    const key = extractKeys(orders).find((k) => k.machineName === 'game_four_steam')
    expect(key?.bundle).toBe('Humble Indie Bundle 19')
    expect(key?.purchased).toBe('2018-03-06T18:00:23.123')
  })

  it('omits bundle and purchased when the order has no product or created', () => {
    const key = extractKeys(orders).find((k) => k.machineName === 'game_two_steam')
    expect('bundle' in key!).toBe(false)
    expect('purchased' in key!).toBe(false)
  })

  it('dedupes keys by id, keeping the first occurrence', () => {
    const dup = [orders[0], orders[0]]
    expect(extractKeys(dup)).toHaveLength(3)
  })
})

describe('steamKeys', () => {
  it('returns only keys flagged isSteam', () => {
    const result = steamKeys(extractKeys(orders))
    expect(result).toHaveLength(3)
    expect(result.every((k) => k.isSteam)).toBe(true)
  })
})

describe('isValidSteamKeyFormat', () => {
  it('accepts the 5-5-5 format and rejects others', () => {
    expect(isValidSteamKeyFormat('AAAAA-BBBBB-CCCCC')).toBe(true)
    expect(isValidSteamKeyFormat('AAAA-BBBBB-CCCCC')).toBe(false)
    expect(isValidSteamKeyFormat(null)).toBe(false)
  })
})
