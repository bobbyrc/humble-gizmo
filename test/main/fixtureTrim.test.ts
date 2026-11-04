import { describe, expect, it } from 'vitest'
import { extractKeys } from '../../src/core/keys'
import { trimOrders, trimOwnedNames, trimUserdata } from '../../src/main/dev/fixtureTrim'

const order = (
  id: string,
  created: string,
  extra: Record<string, unknown> = {}
): Record<string, unknown> => ({
  gamekey: id,
  created,
  amount_spent: 42.5,
  total: 42.5,
  path_ids: ['secret/path'],
  product: { human_name: 'Bundle' },
  subproducts: [
    {
      human_name: 'Game',
      downloads: [],
      tpkd_dict: {
        all_tpks: [
          {
            machine_name: 'game_steam',
            gamekey: id,
            keyindex: 0,
            key_type_human_name: 'Steam',
            steam_app_id: 123,
            redeemed_key_val: 'ABCDE-FGHIJ-KLMNO'
          }
        ]
      }
    }
  ],
  ...extra
})

describe('trimOrders', () => {
  it('zeroes amounts and removes path_ids', () => {
    const [out] = trimOrders([order('a', '2024-05-01T10:00:00.000Z')]) as Record<string, unknown>[]
    expect(out.amount_spent).toBe(0)
    expect(out.total).toBe(0)
    expect('path_ids' in out).toBe(false)
  })

  it('replaces created with synthetic dates that keep the original order', () => {
    const out = trimOrders([
      order('late', '2024-09-01T00:00:00.000Z'),
      order('early', '2020-01-01T00:00:00.000Z'),
      order('early-again', '2020-01-01T00:00:00.000Z')
    ]) as Record<string, unknown>[]
    const [late, early, earlyAgain] = out.map((o) => o.created as string)
    expect(early).toBe('2015-01-01T00:00:00.000Z')
    expect(late).toBe('2015-01-02T00:00:00.000Z')
    expect(earlyAgain).toBe(early)
    expect(early < late).toBe(true)
  })

  it('leaves nested data untouched so extractKeys still finds the key', () => {
    const input = [order('a', '2024-05-01T10:00:00.000Z')]
    const out = trimOrders(input)
    const keys = extractKeys(out)
    expect(keys.map((k) => k.revealedKey)).toEqual(['ABCDE-FGHIJ-KLMNO'])
    expect(keys[0].purchased).toBe((out[0] as { created: string }).created)
    expect(input[0].created).toBe('2024-05-01T10:00:00.000Z')
  })

  it('returns deep copies and passes non-object entries through', () => {
    const first = order('a', '2024-05-01T10:00:00.000Z')
    const out = trimOrders([first, 'raw'])
    expect(out[1]).toBe('raw')
    expect(out[0]).not.toBe(first)
    expect(first.amount_spent).toBe(42.5)
  })
})

describe('trimUserdata', () => {
  it('keeps only the two owned arrays', () => {
    const out = trimUserdata({
      rgOwnedApps: [1, 2],
      rgOwnedPackages: [3],
      rgWishlist: [4],
      rgIgnoredApps: { 5: 1 },
      hardware: { cpu: 'x' }
    })
    expect(out).toEqual({ rgOwnedApps: [1, 2], rgOwnedPackages: [3] })
  })

  it('defaults each list to [] when missing or not an array', () => {
    expect(trimUserdata({ rgOwnedApps: 'nope' })).toEqual({ rgOwnedApps: [], rgOwnedPackages: [] })
    expect(trimUserdata(null)).toEqual({ rgOwnedApps: [], rgOwnedPackages: [] })
  })
})

describe('trimOwnedNames', () => {
  it('keeps only appid and name per game', () => {
    const out = trimOwnedNames({
      response: {
        game_count: 2,
        games: [
          {
            appid: 10,
            name: 'Alpha',
            playtime_forever: 5,
            rtime_last_played: 9,
            img_icon_url: 'x'
          },
          { appid: 20, name: 'Beta', playtime_2weeks: 1 }
        ]
      }
    })
    expect(out).toEqual({
      response: {
        game_count: 2,
        games: [
          { appid: 10, name: 'Alpha' },
          { appid: 20, name: 'Beta' }
        ]
      }
    })
  })

  it('uses games.length when game_count is not a number', () => {
    const out = trimOwnedNames({ response: { games: [{ appid: 1, name: 'A' }] } })
    expect(out).toEqual({ response: { game_count: 1, games: [{ appid: 1, name: 'A' }] } })
  })

  it('returns an empty response for missing or invalid input', () => {
    const empty = { response: { game_count: 0, games: [] } }
    expect(trimOwnedNames(undefined)).toEqual(empty)
    expect(trimOwnedNames('text')).toEqual(empty)
    expect(trimOwnedNames({ response: 'bad' })).toEqual(empty)
    expect(trimOwnedNames({ response: { games: 'bad' } })).toEqual(empty)
  })
})
