import { useCallback, useEffect, useMemo, useState } from 'react'
import { gizmo } from '../gizmo'
import { useNav } from '../nav'
import { GROUP_LABELS } from '../../shared/copy'
import type { ReviewGroup, ReviewItem } from '../../shared/types'
import { Banner, Button, Spinner, Stamp, Tabs } from '../components/ui'
import { VirtualRows } from '../components/review/VirtualRows'
import { ReviewRow } from '../components/review/ReviewRow'
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

type Load = { status: 'loading' } | { status: 'error'; error: unknown } | { status: 'ready' }

export default function Review({ viewportHeight }: { viewportHeight?: number }): React.JSX.Element {
  const { go } = useNav()
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [items, setItems] = useState<ReviewItem[]>([])
  const [ticks, setTicks] = useState<Record<string, boolean>>({})
  const [runError, setRunError] = useState<unknown>(null)
  const [starting, setStarting] = useState(false)
  const [failedOrders, setFailedOrders] = useState(0)

  const fetchReview = useCallback(() => {
    const fresh = takeFreshLibrary()
    ;(fresh ? Promise.resolve(fresh) : gizmo.loadLibrary())
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
    fetchReview()
  }, [fetchReview, go])

  function retry(): void {
    setLoad({ status: 'loading' })
    fetchReview()
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

  function untickAll(group: ReviewGroup): void {
    setTicks((prev) => {
      const next = { ...prev }
      for (const i of byGroup.get(group) ?? []) next[i.key.id] = false
      return next
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
          {(() => {
            const groupItems = byGroup.get(group) ?? []
            const anyTicked = groupItems.some((i) => ticks[i.key.id])
            return (
              <div className="review-sheet">
                {(HINTS[group] || anyTicked) && (
                  <div className="review-hint">
                    <span>{HINTS[group]}</span>
                    {anyTicked && (
                      <button
                        type="button"
                        className="btn btn-link review-untick"
                        aria-label={`Untick all ${GROUP_LABELS[group]}`}
                        onClick={() => untickAll(group)}
                      >
                        Untick all
                      </button>
                    )}
                  </div>
                )}
                <div className="sheet-cols review-cols">
                  <span />
                  <span>Game</span>
                  <span>From</span>
                  <span>Note</span>
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
            )
          })()}
        </Tabs>
      )}
    </div>
  )
}
