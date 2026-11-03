import { describe, expect, it } from 'vitest'
import { selectExportKeys, toExportCsv } from '../../src/core/export'
import type { HumbleKey, Ownership } from '../../src/shared/types'
import type { ExportOptions } from '../../src/shared/ipc'

const BOM = '﻿'

function key(overrides: Partial<HumbleKey> & { id: string }): HumbleKey {
  return {
    gamekey: 'gk',
    keyindex: 0,
    machineName: 'm',
    name: 'Game',
    keyTypeName: 'Steam',
    isSteam: true,
    steamAppId: 1,
    revealedKey: null,
    isGift: false,
    isExpired: false,
    ...overrides
  }
}

// Minimal RFC 4180 parser used to verify round-tripping.
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\r' && text[i + 1] === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i++
    } else {
      field += c
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

const ALL: ExportOptions = { steamOnly: false, includeRevealed: true, includeUnrevealed: true }

describe('selectExportKeys', () => {
  const steamRevealed = key({ id: 'a', isSteam: true, revealedKey: 'KEY-A' })
  const steamUnrevealed = key({ id: 'b', isSteam: true, revealedKey: null })
  const otherRevealed = key({ id: 'c', isSteam: false, revealedKey: 'KEY-C' })
  const otherUnrevealed = key({ id: 'd', isSteam: false, revealedKey: null })
  const keys = [steamRevealed, steamUnrevealed, otherRevealed, otherUnrevealed]
  const ids = (ks: HumbleKey[]): string[] => ks.map((k) => k.id)

  it('keeps everything when all flags are on and steamOnly is off', () => {
    expect(ids(selectExportKeys(keys, ALL))).toEqual(['a', 'b', 'c', 'd'])
  })

  it('keeps only Steam keys when steamOnly is on', () => {
    expect(ids(selectExportKeys(keys, { ...ALL, steamOnly: true }))).toEqual(['a', 'b'])
  })

  it('drops revealed keys when includeRevealed is off', () => {
    expect(ids(selectExportKeys(keys, { ...ALL, includeRevealed: false }))).toEqual(['b', 'd'])
  })

  it('drops unrevealed keys when includeUnrevealed is off', () => {
    expect(ids(selectExportKeys(keys, { ...ALL, includeUnrevealed: false }))).toEqual(['a', 'c'])
  })

  it('combines steamOnly with the revealed filters', () => {
    expect(
      ids(
        selectExportKeys(keys, {
          steamOnly: true,
          includeRevealed: false,
          includeUnrevealed: true
        })
      )
    ).toEqual(['b'])
    expect(
      ids(
        selectExportKeys(keys, {
          steamOnly: true,
          includeRevealed: true,
          includeUnrevealed: false
        })
      )
    ).toEqual(['a'])
  })

  it('returns nothing when both revealed and unrevealed are excluded', () => {
    expect(
      selectExportKeys(keys, { steamOnly: false, includeRevealed: false, includeUnrevealed: false })
    ).toEqual([])
  })

  it('does not mutate the input array', () => {
    const copy = [...keys]
    selectExportKeys(keys, { ...ALL, steamOnly: true })
    expect(keys).toEqual(copy)
  })
})

describe('toExportCsv', () => {
  it('starts with a UTF-8 BOM and the exact header line, ending in CRLF', () => {
    const csv = toExportCsv([], null)
    expect(csv).toBe(`${BOM}name,key,is_gift,key_type,is_expired,steam_owned\r\n`)
  })

  it('writes booleans as true or false', () => {
    const csv = toExportCsv(
      [
        key({ id: '1', isGift: true, isExpired: false }),
        key({ id: '2', isGift: false, isExpired: true })
      ],
      null
    )
    const rows = parseCsv(csv.slice(BOM.length))
    expect([rows[1][2], rows[1][4]]).toEqual(['true', 'false'])
    expect([rows[2][2], rows[2][4]]).toEqual(['false', 'true'])
  })

  it('writes the key column as the revealed key, or empty when unrevealed', () => {
    const csv = toExportCsv(
      [key({ id: '1', revealedKey: 'ABC-123' }), key({ id: '2', revealedKey: null })],
      null
    )
    const rows = parseCsv(csv.slice(BOM.length))
    expect(rows[1][1]).toBe('ABC-123')
    expect(rows[2][1]).toBe('')
  })

  it('writes key_type from keyTypeName', () => {
    const csv = toExportCsv([key({ id: '1', keyTypeName: 'Steam key' })], null)
    expect(parseCsv(csv.slice(BOM.length))[1][3]).toBe('Steam key')
  })

  it('leaves steam_owned empty when the ownership map is null', () => {
    const csv = toExportCsv([key({ id: '1', isSteam: true })], null)
    expect(parseCsv(csv.slice(BOM.length))[1][5]).toBe('')
  })

  it('maps ownership values to yes, maybe and no for Steam keys', () => {
    const map = new Map<string, Ownership>([
      ['1', 'owned'],
      ['2', 'maybe'],
      ['3', 'not_owned']
    ])
    const csv = toExportCsv(
      [
        key({ id: '1', isSteam: true }),
        key({ id: '2', isSteam: true }),
        key({ id: '3', isSteam: true })
      ],
      map
    )
    const rows = parseCsv(csv.slice(BOM.length))
    expect([rows[1][5], rows[2][5], rows[3][5]]).toEqual(['yes', 'maybe', 'no'])
  })

  it('leaves steam_owned empty for non-Steam keys even if they are in the map', () => {
    const map = new Map<string, Ownership>([['1', 'owned']])
    const csv = toExportCsv([key({ id: '1', isSteam: false })], map)
    expect(parseCsv(csv.slice(BOM.length))[1][5]).toBe('')
  })

  it('leaves steam_owned empty when the key id is missing from the map', () => {
    const map = new Map<string, Ownership>([['other', 'owned']])
    const csv = toExportCsv([key({ id: '1', isSteam: true })], map)
    expect(parseCsv(csv.slice(BOM.length))[1][5]).toBe('')
  })

  it('round-trips a name with quotes, a comma, a newline and a trademark symbol', () => {
    const name = 'Tom Clancy\'s "Rainbow", Six\nSiege™'
    const csv = toExportCsv([key({ id: '1', name })], null)
    const rows = parseCsv(csv.slice(BOM.length))
    expect(rows).toHaveLength(2)
    expect(rows[1][0]).toBe(name)
  })

  it('quotes fields containing a carriage return and doubles inner quotes', () => {
    const csv = toExportCsv([key({ id: '1', name: 'a\rb"c' })], null)
    expect(csv).toContain('"a\rb""c"')
    expect(parseCsv(csv.slice(BOM.length))[1][0]).toBe('a\rb"c')
  })

  it('neutralises spreadsheet formulas with a leading apostrophe', () => {
    for (const bad of ['=SUM(A1)', '+1', '-1', '@cmd', '\tx', '\rx']) {
      const csv = toExportCsv([key({ id: '1', name: bad })], null)
      const cell = parseCsv(csv.slice(BOM.length))[1][0]
      expect(cell).toBe(`'${bad}`)
    }
    const ok = toExportCsv([key({ id: '1', name: 'Fine =x' })], null)
    expect(parseCsv(ok.slice(BOM.length))[1][0]).toBe('Fine =x')
  })

  it('does not quote plain fields', () => {
    const csv = toExportCsv([key({ id: '1', name: 'Plain Name' })], null)
    expect(csv).toContain('\r\nPlain Name,')
  })

  it('uses CRLF line endings for every row', () => {
    const csv = toExportCsv([key({ id: '1' }), key({ id: '2' })], null)
    expect(csv.split('\r\n')).toHaveLength(4) // header, two rows, trailing empty
    expect(csv.replace(/\r\n/g, '')).not.toMatch(/\n/)
  })
})
