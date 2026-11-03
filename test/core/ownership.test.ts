import { describe, expect, it } from 'vitest'
import { normalizeTitle } from '../../src/core/titles'
import {
  buildTitleIndex,
  classifyOwnership,
  classifyOwnershipIndexed
} from '../../src/core/ownership'
import type { HumbleKey, OwnedData } from '../../src/shared/types'

function makeKey(name: string, steamAppId: number | null): HumbleKey {
  return {
    id: 'g:0:m',
    gamekey: 'g',
    keyindex: 0,
    machineName: 'm',
    name,
    keyTypeName: 'steam',
    isSteam: true,
    steamAppId,
    revealedKey: null,
    isGift: false,
    isExpired: false
  }
}
function ownedOf(...entries: [number, string][]): OwnedData {
  return { ids: new Set(entries.map(([id]) => id)), names: new Map(entries) }
}

describe('normalizeTitle', () => {
  it('strips edition suffixes and stopwords', () => {
    expect(normalizeTitle('Into the Breach: Advanced Edition')).toEqual([
      'into',
      'breach',
      'advanced'
    ])
  })
})

describe('classifyOwnership', () => {
  it('matches by app id', () => {
    expect(classifyOwnership(makeKey('Whatever', 400), ownedOf([400, 'Portal'])).ownership).toBe(
      'owned'
    )
  })
  it('treats GOTY edition as exact title match', () => {
    const r = classifyOwnership(
      makeKey('The Witcher 3: Wild Hunt - Game of the Year Edition', 999),
      ownedOf([1, 'The Witcher 3: Wild Hunt'])
    )
    expect(r.ownership).toBe('owned')
  })
  it('handles trademark signs', () => {
    expect(
      classifyOwnership(makeKey('Hollow Knight™', 999), ownedOf([1, 'Hollow Knight'])).ownership
    ).toBe('owned')
  })
  it('exact title without app id is maybe', () => {
    expect(
      classifyOwnership(makeKey('Hollow Knight', null), ownedOf([1, 'Hollow Knight'])).ownership
    ).toBe('maybe')
  })
  it('never marks a subset match owned', () => {
    const r = classifyOwnership(makeKey('Spirit', 999), ownedOf([1, 'The Spirit Lift']))
    expect(r).toEqual({ ownership: 'maybe', matchedName: 'The Spirit Lift' })
  })
  it('different games are not owned', () => {
    expect(
      classifyOwnership(makeKey('Book of Demons', 999), ownedOf([1, 'Book of Hours'])).ownership
    ).toBe('not_owned')
  })
  it('sequel numbers are excluded', () => {
    expect(classifyOwnership(makeKey('Portal', 999), ownedOf([1, 'Portal 2'])).ownership).toBe(
      'not_owned'
    )
    expect(
      classifyOwnership(makeKey('Civilization', 999), ownedOf([1, 'Civilization VI'])).ownership
    ).toBe('not_owned')
  })
  it('folds diacritics and punctuation', () => {
    expect(
      classifyOwnership(makeKey('Pokémon-like: Café', 999), ownedOf([1, 'Pokemon like Cafe']))
        .ownership
    ).toBe('owned')
  })
  it('picks highest jaccard then shorter name among maybes', () => {
    const owned = ownedOf(
      [1, 'Spirit Lift Extra Words'],
      [2, 'Spirit Lift Extra'],
      [3, 'Spirit Lift Plus']
    )
    const r = classifyOwnership(makeKey('Spirit Lift', 999), owned)
    expect(r).toEqual({ ownership: 'maybe', matchedName: 'Spirit Lift Plus' })
  })
  it('indexed path agrees', () => {
    const owned = ownedOf([1, 'The Spirit Lift'])
    const idx = buildTitleIndex(owned)
    expect(classifyOwnershipIndexed(makeKey('Spirit', 5), owned, idx)).toEqual(
      classifyOwnership(makeKey('Spirit', 5), owned)
    )
  })
})
