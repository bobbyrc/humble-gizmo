import type { HumbleKey, OwnedData, Ownership } from '../shared/types'
import { normalizeTitle } from './titles'

type Entry = { name: string; tokens: string[]; set: Set<string> }
declare const titleIndexBrand: unique symbol
export type TitleIndex = {
  readonly [titleIndexBrand]: true
  entries: Entry[]
  byToken: Map<string, number[]> // token -> indexes into entries
}

const ROMAN = new Set(['ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x'])

export function buildTitleIndex(owned: OwnedData): TitleIndex {
  const entries: Entry[] = []
  const byToken = new Map<string, number[]>()
  for (const name of owned.names.values()) {
    const tokens = normalizeTitle(name)
    if (tokens.length === 0) continue
    const set = new Set(tokens)
    const i = entries.push({ name, tokens, set }) - 1
    for (const t of set) {
      const list = byToken.get(t)
      if (list) list.push(i)
      else byToken.set(t, [i])
    }
  }
  return { entries, byToken } as TitleIndex
}

function isExtraBenign(extra: string[]): boolean {
  return extra.every((t) => !/\d/.test(t) && !ROMAN.has(t))
}

export function classifyOwnershipIndexed(
  key: HumbleKey,
  owned: OwnedData,
  index: TitleIndex
): { ownership: Ownership; matchedName?: string } {
  if (key.steamAppId !== null && owned.ids.has(key.steamAppId)) return { ownership: 'owned' }
  const tokens = normalizeTitle(key.name)
  if (tokens.length === 0) return { ownership: 'not_owned' }
  const keySet = new Set(tokens)

  const candidates = new Set<number>()
  for (const t of keySet) for (const i of index.byToken.get(t) ?? []) candidates.add(i)

  let exact: Entry | undefined
  let best: { entry: Entry; score: number } | undefined
  for (const i of candidates) {
    const e = index.entries[i]
    if (e.tokens.length === tokens.length && e.tokens.every((t, j) => t === tokens[j])) {
      exact ??= e
      continue
    }
    let inter = 0
    for (const t of keySet) if (e.set.has(t)) inter++
    const union = keySet.size + e.set.size - inter
    const score = inter / union
    let qualifies = score >= 0.6
    if (!qualifies && inter > 0 && inter < union) {
      if (inter === keySet.size) {
        qualifies = isExtraBenign([...e.set].filter((t) => !keySet.has(t)))
      } else if (inter === e.set.size) {
        qualifies = isExtraBenign([...keySet].filter((t) => !e.set.has(t)))
      }
    }
    if (!qualifies) continue
    if (
      !best ||
      score > best.score ||
      (score === best.score && e.name.length < best.entry.name.length)
    ) {
      best = { entry: e, score }
    }
  }

  if (exact) {
    return key.steamAppId !== null
      ? { ownership: 'owned', matchedName: exact.name }
      : { ownership: 'maybe', matchedName: exact.name }
  }
  if (best) return { ownership: 'maybe', matchedName: best.entry.name }
  return { ownership: 'not_owned' }
}

export function classifyOwnership(
  key: HumbleKey,
  owned: OwnedData
): { ownership: Ownership; matchedName?: string } {
  return classifyOwnershipIndexed(key, owned, buildTitleIndex(owned))
}
