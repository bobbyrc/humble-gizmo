import { useCallback, useEffect, useMemo, useState } from 'react'
import { gizmo } from '../gizmo'
import { useNav } from '../nav'
import { GROUP_LABELS } from '../../shared/copy'
import type { ReviewGroup, ReviewItem } from '../../shared/types'
import { Button, Section, Spinner } from '../components/ui'
import { VirtualRows } from '../components/review/VirtualRows'
import { ReviewRow } from '../components/review/ReviewRow'
import { ErrorBanner } from '../components/review/ErrorBanner'
import { setLastReview } from '../runState'
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

  const fetchReview = useCallback(() => {
    gizmo.buildReview().then(
      (result) => {
        setLastReview(result)
        setItems(result)
        setTicks(Object.fromEntries(result.map((i) => [i.key.id, i.ticked])))
        setLoad({ status: 'ready' })
      },
      (error: unknown) => setLoad({ status: 'error', error })
    )
  }, [])

  useEffect(() => {
    fetchReview()
  }, [fetchReview])

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

  const tickedIds = items.filter((i) => ticks[i.key.id]).map((i) => i.key.id)
  const n = tickedIds.length

  function untickAll(group: ReviewGroup): void {
    setTicks((prev) => {
      const next = { ...prev }
      for (const i of byGroup.get(group) ?? []) next[i.key.id] = false
      return next
    })
  }

  function redeem(): void {
    setRunError(null)
    gizmo.startRun(tickedIds).then(
      () => go('run'),
      (error: unknown) => setRunError(error)
    )
  }

  if (load.status === 'loading') {
    return (
      <div className="screen-pad">
        <Spinner label="Loading your library…" />
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
    <div className="screen-pad">
      <div className="screen-header">
        <h1>{items.length === 0 ? 'Redeem' : `Ready to redeem ${n} games`}</h1>
        {items.length > 0 && (
          <Button disabled={n === 0} onClick={redeem}>
            Redeem {n}
          </Button>
        )}
      </div>
      {runError !== null && <ErrorBanner error={runError} onRetry={redeem} />}
      {items.length === 0 && (
        <p className="review-empty">Nothing new to redeem. You&apos;re all caught up.</p>
      )}
      {GROUP_ORDER.map((group) => {
        const groupItems = byGroup.get(group)
        if (!groupItems || groupItems.length === 0) return null
        return (
          <Section
            key={group}
            label={GROUP_LABELS[group]}
            count={groupItems.length}
            hint={HINTS[group]}
            defaultOpen={group === 'will_redeem'}
            actions={
              <Button variant="link" onClick={() => untickAll(group)}>
                Untick all
              </Button>
            }
          >
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
          </Section>
        )
      })}
    </div>
  )
}
