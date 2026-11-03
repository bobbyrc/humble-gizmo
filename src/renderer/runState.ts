import type { LibrarySummary } from '../shared/ipc'
import type { ReviewItem, RunEvent } from '../shared/types'
import { gizmo } from './gizmo'

let lastReview: ReviewItem[] = []
let freshLibrary: LibrarySummary | null = null

/** SignIn hands the summary it just loaded to Review so Review doesn't fetch every order twice. */
export function setFreshLibrary(summary: LibrarySummary): void {
  freshLibrary = summary
}

/** Returns the handed-over summary once, then null. */
export function takeFreshLibrary(): LibrarySummary | null {
  const summary = freshLibrary
  freshLibrary = null
  return summary
}

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

// --- Run session: buffers run events so Run can mount late or re-mount mid-run. ---
let events: RunEvent[] = []
let active = false
let stopGizmo: (() => void) | null = null
const listeners = new Set<(e: RunEvent) => void>()

function handle(e: RunEvent): void {
  events.push(e)
  if (e.type === 'finished' || e.type === 'stopped') {
    active = false
    stopGizmo?.()
    stopGizmo = null
  }
  for (const cb of [...listeners]) cb(e)
}

/** Call BEFORE gizmo.startRun so no event is missed. Resets the buffer. */
export function beginRunSession(): void {
  events = []
  active = true
  if (!stopGizmo) stopGizmo = gizmo.onRunEvent(handle)
}

export function subscribeRun(cb: (e: RunEvent) => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export function getRunEvents(): RunEvent[] {
  return events
}

export function isRunActive(): boolean {
  return active
}

/** Drops the session and its gizmo listener (used by tests). */
export function resetRunSession(): void {
  stopGizmo?.()
  stopGizmo = null
  events = []
  active = false
  freshLibrary = null
  listeners.clear()
}
