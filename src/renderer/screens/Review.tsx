import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { gizmo } from '../gizmo'
import { useNav } from '../nav'
import { GROUP_LABELS } from '../../shared/copy'
import type { ReviewGroup, ReviewItem } from '../../shared/types'
import { Banner, Button, Spinner, Stamp, Tabs } from '../components/ui'
import { VirtualRows } from '../components/review/VirtualRows'
import { ReviewRow } from '../components/review/ReviewRow'
import { ColumnResizer } from '../components/review/ColumnResizer'
import ErrorBanner from '../components/ErrorBanner'
import { beginRunSession, isRunActive, setLastReview, takeFreshLibrary } from '../runState'
import '../components/review/review.css'

const GROUP_ORDER: ReviewGroup[] = [
  'will_redeem',
  'maybe_owned',
  'owned',
  'failed_before',
  'done_before'
]

const HINTS: Partial<Record<ReviewGroup, string>> = {
  maybe_owned: 'check these',
  owned: 'skipped',
  failed_before: 'tick to retry'
}

// Column widths in px. Defaults live in review.css; these mirror them, and the media query
// below mirrors review.css's narrow-window block.
const DEFAULT_COLS = { from: 260, note: 240 }
const NARROW_COLS = { from: 160, note: 150 }
const NARROW_QUERY = '(max-width: 1100px)'
const FROM_RANGE = { min: 120, max: 480 }
const NOTE_RANGE = { min: 140, max: 360 }
const GAME_MIN = 200
// The stub (64px) plus the right padding allowance (40px) that Game cannot use.
const FIXED_CHROME = 64 + 40
const COLS_KEY = 'gizmo.review.columns'

type Cols = { from: number; note: number }

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function isNarrow(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(NARROW_QUERY).matches
}

// Storage can be blocked or hold junk; either way the screen falls back to the CSS defaults.
function readStoredCols(): Cols | null {
  try {
    const raw = window.localStorage.getItem(COLS_KEY)
    if (raw === null) return null
    const v: unknown = JSON.parse(raw)
    if (typeof v !== 'object' || v === null) return null
    const { from, note } = v as Record<string, unknown>
    if (typeof from !== 'number' || typeof note !== 'number') return null
    if (!Number.isFinite(from) || !Number.isFinite(note)) return null
    return {
      from: clamp(from, FROM_RANGE.min, FROM_RANGE.max),
      note: clamp(note, NOTE_RANGE.min, NOTE_RANGE.max)
    }
  } catch {
    return null
  }
}

function writeStoredCols(cols: Cols): void {
  try {
    window.localStorage.setItem(COLS_KEY, JSON.stringify(cols))
  } catch {
    // Not persisted; the widths still apply for this session.
  }
}

function clearStoredCols(): void {
  try {
    window.localStorage.removeItem(COLS_KEY)
  } catch {
    // Nothing stored to remove.
  }
}

type Load = { status: 'loading' } | { status: 'error'; error: unknown } | { status: 'ready' }

export default function Review({ viewportHeight }: { viewportHeight?: number }): React.JSX.Element {
  const { go } = useNav()
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [items, setItems] = useState<ReviewItem[]>([])
  const [ticks, setTicks] = useState<Record<string, boolean>>({})
  const [runError, setRunError] = useState<unknown>(null)
  const [starting, setStarting] = useState(false)
  const [failedOrders, setFailedOrders] = useState(0)
  // null means the user has not resized: the CSS defaults (which vary with window width) apply.
  const [cols, setCols] = useState<Cols | null>(readStoredCols)
  const [narrow, setNarrow] = useState(isNarrow)
  const sheetRef = useRef<HTMLDivElement>(null)
  const defaults = narrow ? NARROW_COLS : DEFAULT_COLS
  const shown = cols ?? defaults

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia(NARROW_QUERY)
    const onChange = (): void => setNarrow(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (cols !== null) writeStoredCols(cols)
  }, [cols])

  function resizeColumn(kind: 'from' | 'note', dx: number): void {
    // dx is the pointer's movement to the right; dragging a divider left (dx < 0) widens the
    // column on its right.
    const sheetWidth = sheetRef.current?.clientWidth ?? 0
    setCols((prev) => {
      const base = prev ?? defaults
      if (kind === 'from') {
        // Game is what is left after the stub, padding, Note and From; keep it at GAME_MIN.
        // Without a layout (sheetWidth 0) only the From range applies.
        const fromMax =
          sheetWidth > 0 ? sheetWidth - FIXED_CHROME - base.note - GAME_MIN : FROM_RANGE.max
        return {
          from: clamp(base.from - dx, FROM_RANGE.min, Math.min(FROM_RANGE.max, fromMax)),
          note: base.note
        }
      }
      // The Note divider moves the From/Note boundary: From and Note trade pixels, Game is fixed.
      const shift = clamp(
        dx,
        Math.max(FROM_RANGE.min - base.from, base.note - NOTE_RANGE.max),
        Math.min(FROM_RANGE.max - base.from, base.note - NOTE_RANGE.min)
      )
      return { from: base.from + shift, note: base.note - shift }
    })
  }

  function resetColumns(): void {
    setCols(null)
    clearStoredCols()
  }

  const fetchReview = useCallback((refresh: boolean) => {
    const fresh = takeFreshLibrary()
    const library = refresh
      ? gizmo.loadLibrary({ refresh: true })
      : fresh
        ? Promise.resolve(fresh)
        : gizmo.loadLibrary()
    library
      .then(async (summary) => {
        const result = await gizmo.buildReview()
        setFailedOrders(summary.failedOrders)
        setLastReview(result)
        setItems(result)
        setTicks(Object.fromEntries(result.map((i) => [i.key.id, i.ticked])))
        setLoad({ status: 'ready' })
      })
      .catch((error: unknown) => setLoad({ status: 'error', error }))
  }, [])

  useEffect(() => {
    // A run in progress owns the screen; reattach instead of building a review.
    if (isRunActive()) {
      go('run')
      return
    }
    fetchReview(false)
  }, [fetchReview, go])

  // Refresh and the error banner's retry both refetch: a retry usually follows a failed load.
  function retry(): void {
    setLoad({ status: 'loading' })
    fetchReview(true)
  }

  const byGroup = useMemo(() => {
    const map = new Map<ReviewGroup, ReviewItem[]>()
    for (const item of items) {
      const list = map.get(item.group) ?? []
      list.push(item)
      map.set(item.group, list)
    }
    return map
  }, [items])

  const present = GROUP_ORDER.filter((g) => byGroup.has(g))
  const [selected, setSelected] = useState<ReviewGroup>('will_redeem')
  const group = present.includes(selected)
    ? selected
    : present.includes('will_redeem')
      ? 'will_redeem'
      : present[0]

  const tickedIds = items.filter((i) => i.tickable && ticks[i.key.id]).map((i) => i.key.id)
  const n = tickedIds.length
  const groupItems = byGroup.get(group) ?? []
  const tickable = groupItems.filter((i) => i.tickable)
  const tickedCount = tickable.filter((i) => ticks[i.key.id]).length
  const allTicked = tickable.length > 0 && tickedCount === tickable.length
  const someTicked = tickedCount > 0 && !allTicked
  const headRef = useRef<HTMLInputElement>(null)
  // indeterminate has no HTML attribute, so it is set on the element after each render.
  useEffect(() => {
    if (headRef.current) headRef.current.indeterminate = someTicked
  })

  // Ticks every tickable item in the group, or unticks them all when they are all ticked.
  function toggleGroup(): void {
    const next = !allTicked
    setTicks((prev) => {
      const out = { ...prev }
      for (const i of tickable) out[i.key.id] = next
      return out
    })
  }

  function redeem(): void {
    if (starting) return
    if (isRunActive()) {
      go('run')
      return
    }
    setRunError(null)
    setStarting(true)
    beginRunSession()
    gizmo.startRun(tickedIds).then(
      () => go('run'),
      (error: unknown) => {
        setStarting(false)
        setRunError(error)
      }
    )
  }

  if (load.status === 'loading') {
    return (
      <div className="screen-pad">
        <div className="sheet review-sheet-loading">
          <Spinner label="Loading your library…" />
        </div>
      </div>
    )
  }
  if (load.status === 'error') {
    return (
      <div className="screen-pad">
        <ErrorBanner error={load.error} onRetry={retry} />
      </div>
    )
  }

  return (
    <div className="screen-pad review-screen">
      <div className="screen-header">
        <h1>
          {items.length === 0 ? (
            'Redeem'
          ) : (
            <>
              Ready to redeem <span className="num">{n}</span> games
            </>
          )}
        </h1>
        <div className="screen-header-actions">
          <Button variant="secondary" onClick={retry}>
            Refresh
          </Button>
          {items.length > 0 && (
            <Button disabled={n === 0 || starting} onClick={redeem}>
              Redeem {n}
            </Button>
          )}
        </div>
      </div>
      {failedOrders > 0 && (
        <Banner tone="warn">{`Couldn't load ${failedOrders} orders — try again later`}</Banner>
      )}
      {runError !== null && <ErrorBanner error={runError} onRetry={redeem} />}
      {items.length === 0 && (
        <div className="sheet review-sheet-empty">
          <Stamp tone="redeemed">All caught up</Stamp>
          <p className="review-empty">Nothing new to redeem. You&apos;re all caught up.</p>
        </div>
      )}
      {items.length > 0 && (
        <Tabs
          label="Key groups"
          active={group}
          onChange={(id) => setSelected(id as ReviewGroup)}
          tabs={present.map((g) => ({
            id: g,
            label: GROUP_LABELS[g],
            count: byGroup.get(g)?.length ?? 0,
            tone: g === 'maybe_owned' ? 'warn' : g === 'failed_before' ? 'danger' : undefined
          }))}
        >
          {
            <div
              className="review-sheet"
              ref={sheetRef}
              style={
                cols
                  ? ({
                      '--col-from': `${cols.from}px`,
                      '--col-note': `${cols.note}px`
                    } as React.CSSProperties)
                  : undefined
              }
            >
              {HINTS[group] && <div className="review-hint">{HINTS[group]}</div>}
              <div className="sheet-cols review-cols">
                <input
                  ref={headRef}
                  type="checkbox"
                  className="review-head-check"
                  aria-label={`${allTicked ? 'Untick' : 'Tick'} all ${GROUP_LABELS[group]}`}
                  checked={allTicked}
                  disabled={tickable.length === 0}
                  onChange={toggleGroup}
                />
                <span>Game</span>
                <span>
                  From
                  <ColumnResizer
                    label="Resize From column"
                    value={shown.from}
                    min={FROM_RANGE.min}
                    max={FROM_RANGE.max}
                    onDelta={(dx) => resizeColumn('from', dx)}
                    onReset={resetColumns}
                  />
                </span>
                <span>
                  Note
                  <ColumnResizer
                    label="Resize Note column"
                    value={shown.note}
                    min={NOTE_RANGE.min}
                    max={NOTE_RANGE.max}
                    onDelta={(dx) => resizeColumn('note', dx)}
                    onReset={resetColumns}
                  />
                </span>
              </div>
              <VirtualRows
                items={groupItems}
                itemKey={(i) => i.key.id}
                viewportHeight={viewportHeight}
                renderRow={(i) => (
                  <ReviewRow
                    item={i}
                    ticked={ticks[i.key.id] ?? false}
                    onToggle={(checked) => setTicks((prev) => ({ ...prev, [i.key.id]: checked }))}
                  />
                )}
              />
            </div>
          }
        </Tabs>
      )}
    </div>
  )
}
