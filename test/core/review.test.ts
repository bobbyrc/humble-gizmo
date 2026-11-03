import { describe, expect, it } from 'vitest'
import { buildReviewList, EXPORT_RUN_ID } from '../../src/core/review'
import type { HumbleKey, KeyRecord, Outcome, OwnedData } from '../../src/shared/types'

let seq = 0
function makeKey(name: string, over: Partial<HumbleKey> = {}): HumbleKey {
  const n = seq++
  return {
    id: `g:${n}:m`,
    gamekey: 'g',
    keyindex: n,
    machineName: `m${n}`,
    name,
    keyTypeName: 'steam',
    isSteam: true,
    steamAppId: null,
    revealedKey: 'AAAAA-BBBBB-CCCCC',
    isGift: false,
    isExpired: false,
    ...over
  }
}
function ownedOf(...entries: [number, string][]): OwnedData {
  return { ids: new Set(entries.map(([id]) => id)), names: new Map(entries) }
}
function rec(key: HumbleKey, outcome: Outcome, resultCode: number | null): KeyRecord {
  return {
    id: key.id,
    name: key.name,
    steamAppId: key.steamAppId,
    revealedKey: key.revealedKey,
    outcome,
    resultCode,
    runId: 'r',
    updatedAt: '2026-11-02T00:00:00Z'
  }
}
const none = ownedOf()
const noRecords = new Map<string, KeyRecord>()

describe('buildReviewList', () => {
  it('includes only steam keys', () => {
    const steam = makeKey('Alpha')
    const other = makeKey('Beta', { isSteam: false })
    const out = buildReviewList([steam, other], none, noRecords)
    expect(out.map((i) => i.key.id)).toEqual([steam.id])
  })

  it('rule 1: redeemed and owned records are done_before, unticked, not tickable', () => {
    const a = makeKey('Alpha')
    const b = makeKey('Beta')
    const out = buildReviewList(
      [a, b],
      none,
      new Map([
        [a.id, rec(a, 'redeemed', 0)],
        [b.id, rec(b, 'owned', 9)]
      ])
    )
    for (const i of out) {
      expect(i).toMatchObject({ group: 'done_before', ticked: false, tickable: false })
    }
  })

  it('rule 2: terminal error is failed_before, not tickable', () => {
    const a = makeKey('Alpha')
    const [i] = buildReviewList([a], none, new Map([[a.id, rec(a, 'error', 14)]]))
    expect(i).toMatchObject({ group: 'failed_before', ticked: false, tickable: false })
    expect(i.reasons).toContain('terminal_error')
  })

  it('rule 2: retryable error is failed_before, tickable', () => {
    const a = makeKey('Alpha')
    const [i] = buildReviewList([a], none, new Map([[a.id, rec(a, 'error', 53)]]))
    expect(i).toMatchObject({ group: 'failed_before', ticked: false, tickable: true })
    expect(i.reasons).toContain('retryable_error')
  })

  it('rule 2: error with null result code is retryable', () => {
    const a = makeKey('Alpha')
    const [i] = buildReviewList([a], none, new Map([[a.id, rec(a, 'error', null)]]))
    expect(i).toMatchObject({ group: 'failed_before', tickable: true })
    expect(i.reasons).toContain('retryable_error')
  })

  it('rule 3: pending record is will_redeem and ticked even if now owned', () => {
    const a = makeKey('Alpha', { steamAppId: 5 })
    const [i] = buildReviewList(
      [a],
      ownedOf([5, 'Alpha']),
      new Map([[a.id, rec(a, 'pending', null)]])
    )
    expect(i).toMatchObject({ group: 'will_redeem', ticked: true, tickable: true })
  })

  it('rule 4: owned by app id', () => {
    const a = makeKey('Alpha', { steamAppId: 5 })
    const [i] = buildReviewList([a], ownedOf([5, 'Alpha']), noRecords)
    expect(i).toMatchObject({ group: 'owned', ticked: false, tickable: true })
  })

  it('rule 4: maybe owned carries matchedName', () => {
    const a = makeKey('Alpha Deluxe Bundle Extras')
    const owned = ownedOf([7, 'Alpha'])
    const [i] = buildReviewList([a], owned, noRecords)
    expect(i.group).toBe('maybe_owned')
    expect(i).toMatchObject({ ticked: false, tickable: true, matchedName: 'Alpha' })
  })

  it('rule 4: not owned is will_redeem, ticked', () => {
    const a = makeKey('Alpha', { steamAppId: 1 })
    const [i] = buildReviewList([a], none, noRecords)
    expect(i).toMatchObject({ group: 'will_redeem', ticked: true, tickable: true })
    expect(i.reasons).toEqual([])
  })

  it('rule 5: duplicates by app id keep the first, untick the rest', () => {
    const a = makeKey('Alpha', { steamAppId: 9 })
    const b = makeKey('Different Name', { steamAppId: 9 })
    const out = buildReviewList([a, b], none, noRecords)
    const ia = out.find((i) => i.key.id === a.id)!
    const ib = out.find((i) => i.key.id === b.id)!
    expect(ia).toMatchObject({ ticked: true, tickable: true })
    expect(ia.reasons).not.toContain('duplicate')
    expect(ib).toMatchObject({ group: 'will_redeem', ticked: false, tickable: true })
    expect(ib.reasons).toContain('duplicate')
  })

  it('rule 5: duplicates by normalized title', () => {
    const a = makeKey('Alpha')
    const b = makeKey('ALPHA')
    const out = buildReviewList([a, b], none, noRecords)
    expect(out.filter((i) => i.ticked)).toHaveLength(1)
    expect(out.filter((i) => i.reasons.includes('duplicate'))).toHaveLength(1)
  })

  it('rule 5: unrevealed first, revealed second keeps the revealed one ticked', () => {
    const a = makeKey('Alpha', { steamAppId: 9, revealedKey: null })
    const b = makeKey('Alpha', { steamAppId: 9 })
    const out = buildReviewList([a, b], none, noRecords)
    const ia = out.find((i) => i.key.id === a.id)!
    const ib = out.find((i) => i.key.id === b.id)!
    expect(ib.ticked).toBe(true)
    expect(ia.ticked).toBe(false)
    expect(ia.reasons).toEqual(expect.arrayContaining(['duplicate', 'unrevealed']))
  })

  it('rule 5: a pending record counts in duplicate detection', () => {
    const a = makeKey('Alpha', { steamAppId: 9 })
    const b = makeKey('Alpha', { steamAppId: 9 })
    const out = buildReviewList([a, b], none, new Map([[a.id, rec(a, 'pending', null)]]))
    expect(out.filter((i) => i.ticked)).toHaveLength(1)
  })

  it('rule 5: keys without an app id and different titles are not duplicates', () => {
    const out = buildReviewList([makeKey('Alpha'), makeKey('Beta')], none, noRecords)
    expect(out.every((i) => i.ticked)).toBe(true)
  })

  it('rule 5: titles that normalize to nothing are not title duplicates', () => {
    const out = buildReviewList([makeKey('ゲーム'), makeKey('ゴルフ')], none, noRecords)
    expect(out.every((i) => i.ticked && !i.reasons.includes('duplicate'))).toBe(true)
  })

  it('rule 5: empty-token titles with the same app id are still deduped by id', () => {
    const a = makeKey('ゲーム', { steamAppId: 3 })
    const b = makeKey('ゴルフ', { steamAppId: 3 })
    const out = buildReviewList([a, b], none, noRecords)
    expect(out.filter((i) => i.ticked)).toHaveLength(1)
    expect(out.filter((i) => i.reasons.includes('duplicate'))).toHaveLength(1)
  })

  it('rule 6: unrevealed reason', () => {
    const a = makeKey('Alpha', { revealedKey: null })
    const [i] = buildReviewList([a], none, noRecords)
    expect(i.reasons).toContain('unrevealed')
  })

  it('rule 7: orders by group then name', () => {
    const redeemed = makeKey('Aaa')
    const owned = makeKey('Bbb', { steamAppId: 1 })
    const w2 = makeKey('Zzz')
    const w1 = makeKey('Mmm')
    const out = buildReviewList(
      [redeemed, owned, w2, w1],
      ownedOf([1, 'Bbb']),
      new Map([[redeemed.id, rec(redeemed, 'redeemed', 0)]])
    )
    expect(out.map((i) => i.key.name)).toEqual(['Mmm', 'Zzz', 'Bbb', 'Aaa'])
    expect(out.map((i) => i.group)).toEqual(['will_redeem', 'will_redeem', 'owned', 'done_before'])
  })

  it('handles 3,000 keys against 3,000 owned names in under 2,000 ms', () => {
    function mulberry32(seed: number) {
      let a = seed
      return () => {
        a = (a + 0x6d2b79f5) | 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
      }
    }
    const words = [
      'dark',
      'star',
      'quest',
      'legend',
      'iron',
      'ghost',
      'forest',
      'city',
      'dragon',
      'shadow',
      'river',
      'storm',
      'blade',
      'empire',
      'garden',
      'pixel',
      'rogue',
      'tower',
      'ocean',
      'ember',
      'frost',
      'hollow',
      'echo',
      'nova',
      'titan',
      'saga',
      'realm',
      'fury',
      'drift',
      'harbor'
    ]
    const rand = mulberry32(12345)
    const name = (): string =>
      Array.from({ length: 3 }, () => words[Math.floor(rand() * words.length)]).join(' ') +
      ' ' +
      Math.floor(rand() * 100000)
    const ownedEntries: [number, string][] = Array.from({ length: 3000 }, (_, i) => [i + 1, name()])
    const keys = Array.from({ length: 3000 }, (_, i) =>
      makeKey(name(), { steamAppId: rand() < 0.3 ? (i % 4000) + 1 : null })
    )
    const owned = ownedOf(...ownedEntries)
    const t0 = performance.now()
    const out = buildReviewList(keys, owned, noRecords)
    const ms = performance.now() - t0
    expect(out).toHaveLength(3000)
    expect(ms).toBeLessThan(2000)
  })
})

describe('export-pending records', () => {
  it('are ignored: an owned key stays owned and unticked', () => {
    const k = makeKey('Owned Game', { steamAppId: 7 })
    const exportPending = { ...rec(k, 'pending', null), runId: EXPORT_RUN_ID }
    const items = buildReviewList([k], ownedOf([7, 'Owned Game']), new Map([[k.id, exportPending]]))
    expect(items[0]).toMatchObject({ group: 'owned', ticked: false })
  })

  it('a pending record from a real run still means will_redeem', () => {
    const k = makeKey('Owned Game 2', { steamAppId: 8 })
    const items = buildReviewList(
      [k],
      ownedOf([8, 'Owned Game 2']),
      new Map([[k.id, rec(k, 'pending', null)]])
    )
    expect(items[0]).toMatchObject({ group: 'will_redeem', ticked: true })
  })
})
