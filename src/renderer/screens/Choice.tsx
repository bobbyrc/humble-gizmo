import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChoiceMonth } from '../../shared/types'
import { gizmo } from '../gizmo'
import ErrorBanner from '../components/ErrorBanner'
import { Banner, Spinner } from '../components/ui'
import { MonthCard } from '../components/choice/MonthCard'
import '../components/choice/choice.css'

type Result =
  { kind: 'ok' } | { kind: 'failed'; titles: string[] } | { kind: 'error'; error: unknown }

export default function Choice(): React.JSX.Element {
  const [months, setMonths] = useState<ChoiceMonth[] | null>(null)
  const [loadError, setLoadError] = useState<unknown>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const libraryLoaded = useRef(false)

  const [nonce, setNonce] = useState(0)
  const load = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    let cancelled = false
    // Refresh the library once per visit so claimed-elsewhere state is current.
    const ready = libraryLoaded.current
      ? Promise.resolve()
      : gizmo.loadLibrary().then(() => {
          libraryLoaded.current = true
        })
    ready
      .then(() => gizmo.listChoiceMonths())
      .then(
        (m) => {
          if (cancelled) return
          setMonths(m)
          setLoadError(null)
        },
        (e: unknown) => {
          if (cancelled) return
          setLoadError(e)
          setMonths((prev) => prev ?? [])
        }
      )
    return () => {
      cancelled = true
    }
  }, [nonce])

  async function claim(month: ChoiceMonth, identifiers: string[]): Promise<void> {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setResult(null)
    try {
      const { failed } = await gizmo.claimChoices(month.gamekey, identifiers)
      if (failed.length === 0) {
        setResult({ kind: 'ok' })
      } else {
        const title = (id: string): string =>
          month.games.find((g) => g.identifier === id)?.title ?? id
        setResult({ kind: 'failed', titles: failed.map(title) })
      }
      load()
    } catch (e) {
      setResult({ kind: 'error', error: e })
      load() // some games may have been claimed before the failure
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="screen-header">
        <h1>Humble Choice</h1>
      </div>
      {result?.kind === 'ok' && (
        <Banner tone="ok">Claimed. New keys will appear in your review list.</Banner>
      )}
      {result?.kind === 'failed' && (
        <Banner tone="warn">
          Some games couldn&apos;t be claimed:
          <ul className="choice-failed">
            {result.titles.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </Banner>
      )}
      {result?.kind === 'error' && (
        <ErrorBanner error={result.error} onRetry={load} retryLabel="Reload" />
      )}
      {loadError !== null && <ErrorBanner error={loadError} onRetry={load} />}
      {months === null ? (
        <Spinner label="Loading your Humble Choice months…" />
      ) : months.length === 0 ? (
        loadError === null && (
          <div className="sheet choice-empty">
            <p>No Humble Choice picks left to make.</p>
          </div>
        )
      ) : (
        <div className="choice-months">
          {months.map((m) => (
            <MonthCard key={m.gamekey} month={m} busy={busy} onClaim={claim} />
          ))}
        </div>
      )}
    </div>
  )
}
