import type {
  HumbleKey,
  KeyRecord,
  OwnedData,
  ReviewGroup,
  ReviewItem,
  ReviewReason
} from '../shared/types'
import { buildTitleIndex, classifyOwnershipIndexed } from './ownership'
import type { TitleIndex } from './ownership'
import { isRetryableError } from './steamCodes'
import { normalizeTitle } from './titles'

const GROUP_ORDER: ReviewGroup[] = [
  'will_redeem',
  'maybe_owned',
  'owned',
  'failed_before',
  'done_before'
]

function classify(
  key: HumbleKey,
  record: KeyRecord | undefined,
  owned: OwnedData,
  index: TitleIndex
): ReviewItem {
  const item = (
    group: ReviewGroup,
    ticked: boolean,
    tickable: boolean,
    reasons: ReviewReason[] = [],
    matchedName?: string
  ): ReviewItem => {
    const r: ReviewItem = { key, group, ticked, tickable, reasons }
    if (matchedName !== undefined) r.matchedName = matchedName
    return r
  }

  if (record) {
    if (record.outcome === 'redeemed' || record.outcome === 'owned') {
      return item('done_before', false, false)
    }
    if (record.outcome === 'error') {
      // A null result code means the attempt never reached Steam: retryable.
      const retryable = record.resultCode === null || isRetryableError(record.resultCode)
      return retryable
        ? item('failed_before', false, true, ['retryable_error'])
        : item('failed_before', false, false, ['terminal_error'])
    }
    if (record.outcome === 'pending') return item('will_redeem', true, true)
  }

  const { ownership, matchedName } = classifyOwnershipIndexed(key, owned, index)
  if (ownership === 'owned') return item('owned', false, true)
  if (ownership === 'maybe') return item('maybe_owned', false, true, [], matchedName)
  return item('will_redeem', true, true)
}

function markDuplicates(items: ReviewItem[]): void {
  const buckets = new Map<string, ReviewItem[]>()
  const add = (k: string, it: ReviewItem): void => {
    const b = buckets.get(k)
    if (b) b.push(it)
    else buckets.set(k, [it])
  }
  for (const it of items) {
    if (it.group !== 'will_redeem' || !it.ticked) continue
    if (it.key.steamAppId !== null) add(`id:${it.key.steamAppId}`, it)
    // Titles that normalize to nothing (e.g. CJK) must not all share one bucket.
    const tokens = normalizeTitle(it.key.name)
    if (tokens.length > 0) add(`t:${tokens.join(' ')}`, it)
  }
  // An item can sit in two buckets (same id and same title). Only items still
  // ticked count as candidates, so an item unticked by one bucket is never kept
  // by another.
  for (const b of buckets.values()) {
    const live = b.filter((it) => it.ticked)
    if (live.length < 2) continue
    const keep = live.find((it) => it.key.revealedKey !== null) ?? live[0]
    for (const it of live) {
      if (it === keep) continue
      it.ticked = false
      it.reasons.push('duplicate')
    }
  }
}

export function buildReviewList(
  keys: HumbleKey[],
  owned: OwnedData,
  records: Map<string, KeyRecord>
): ReviewItem[] {
  const index = buildTitleIndex(owned)
  const items = keys
    .filter((k) => k.isSteam)
    .map((k) => classify(k, records.get(k.id), owned, index))

  markDuplicates(items)

  for (const it of items) {
    if (it.key.revealedKey === null) it.reasons.push('unrevealed')
  }

  const rank = (g: ReviewGroup): number => GROUP_ORDER.indexOf(g)
  return items
    .map((it, i) => ({ it, i }))
    .sort(
      (a, b) =>
        rank(a.it.group) - rank(b.it.group) ||
        a.it.key.name.localeCompare(b.it.key.name) ||
        a.i - b.i
    )
    .map((x) => x.it)
}
