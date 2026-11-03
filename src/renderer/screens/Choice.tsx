import { useCallback, useEffect, useState } from 'react'
import type { ChoiceMonth } from '../../shared/types'
import { serviceChanged } from '../../shared/copy'
import { errorName, gizmo } from '../gizmo'
import { Banner, Spinner } from '../components/ui'
import { MonthCard } from '../components/choice/MonthCard'
import '../components/choice/choice.css'

type Result =
  { kind: 'ok' } | { kind: 'failed'; titles: string[] } | { kind: 'error'; error: unknown }

function ErrorBanner({ error, retry }: { error: unknown; retry: () => void }): React.JSX.Element {
  const name = errorName(error)
  const service = (error as { service?: string })?.service
  if (name === 'ServiceChangedError') {
    return (
      <Banner
        tone="danger"
        action={{
          label: 'Get the latest version',
          onClick: () => void gizmo.openExternal('https://github.com/bobbyrc/humble-gizmo/releases')
        }}
      >
        {serviceChanged(service === 'steam' ? 'Steam' : 'Humble')}
      </Banner>
    )
  }
  if (name === 'SessionExpiredError') {
    const humble = service !== 'steam'
    return (
      <Banner
        tone="danger"
        action={{
          label: 'Sign in',
          onClick: () => void gizmo.signIn(humble ? 'humble' : 'steam')
        }}
      >
        {humble ? 'Sign in to Humble again' : 'Sign in to Steam again'}
      </Banner>
    )
  }
  return (
    <Banner tone="danger" action={{ label: 'Retry', onClick: retry }}>
      Something went wrong. Try again.
    </Banner>
  )
}

export default function Choice(): React.JSX.Element {
  const [months, setMonths] = useState<ChoiceMonth[] | null>(null)
  const [loadError, setLoadError] = useState<unknown>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [busy, setBusy] = useState(false)

  const [nonce, setNonce] = useState(0)
  const load = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    let cancelled = false
    gizmo.listChoiceMonths().then(
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
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="choice-header">
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
        <ErrorBanner error={result.error} retry={() => setResult(null)} />
      )}
      {loadError !== null && <ErrorBanner error={loadError} retry={load} />}
      {months === null ? (
        <Spinner label="Loading your Humble Choice months…" />
      ) : months.length === 0 ? (
        loadError === null && <p className="choice-muted">No Humble Choice picks left to make.</p>
      ) : (
        months.map((m) => <MonthCard key={m.gamekey} month={m} busy={busy} onClaim={claim} />)
      )}
    </div>
  )
}
