import type { ReviewItem } from '../shared/types'

let lastReview: ReviewItem[] = []

/** Remembers the items shown on Review so Run can turn event ids back into game names. */
export function setLastReview(items: ReviewItem[]): void {
  lastReview = items
}

export function getLastReview(): ReviewItem[] {
  return lastReview
}

export function nameFor(id: string): string {
  return lastReview.find((i) => i.key.id === id)?.key.name ?? id
}
