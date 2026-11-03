import { useCallback, useEffect, useRef, useState } from 'react'
import { gizmo } from '../gizmo'
import { useNav } from '../nav'
import { setFreshLibrary } from '../runState'
import type { LibrarySummary } from '../../shared/ipc'
import { Banner, Button, Pill, Spinner } from '../components/ui'
import ErrorBanner from '../components/ErrorBanner'
import './signin.css'

type Service = 'humble' | 'steam'
type Status = { humble: boolean; steam: boolean }
type Phase = 'idle' | 'loading' | { done: LibrarySummary } | { error: unknown }

const CARDS: { service: Service; name: string }[] = [
  { service: 'humble', name: 'Humble Bundle' },
  { service: 'steam', name: 'Steam' }
]

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`

export default function SignIn(): React.JSX.Element {
  const { go } = useNav()
  const [status, setStatus] = useState<Status | null>(null)
  const [pending, setPending] = useState<Record<Service, boolean>>({ humble: false, steam: false })
  const [phase, setPhase] = useState<Phase>('idle')
  const started = useRef(false)

  const refreshStatus = useCallback(async (): Promise<void> => {
    try {
      setStatus(await gizmo.status())
    } catch {
      // Keep the last known status.
    }
  }, [])

  useEffect(() => {
    gizmo.status().then(setStatus, () => undefined)
  }, [])

  const load = useCallback((): void => {
    setPhase('loading')
    gizmo.loadLibrary().then(
      (summary) => {
        setFreshLibrary(summary)
        setPhase({ done: summary })
      },
      (error: unknown) => {
        setPhase({ error })
        void refreshStatus()
      }
    )
  }, [refreshStatus])

  const bothIn = status !== null && status.humble && status.steam
  useEffect(() => {
    if (bothIn && !started.current) {
      started.current = true
      load()
    }
  }, [bothIn, load])

  const done = typeof phase === 'object' && 'done' in phase
  useEffect(() => {
    if (!done) return
    const timer = setTimeout(() => go('review'), 1000)
    return () => clearTimeout(timer)
  }, [done, go])

  async function signIn(service: Service): Promise<void> {
    setPending((p) => ({ ...p, [service]: true }))
    try {
      await gizmo.signIn(service)
      await refreshStatus()
    } catch {
      // A failed or cancelled sign-in leaves the card as it was.
    } finally {
      setPending((p) => ({ ...p, [service]: false }))
    }
  }

  if (status === null) {
    return (
      <div className="screen-pad">
        <h1>Sign in to get started</h1>
        <Spinner />
      </div>
    )
  }

  return (
    <div className="screen-pad">
      <h1>Sign in to get started</h1>
      <p className="signin-intro">
        You&apos;ll sign in on Humble Bundle&apos;s and Steam&apos;s own pages. Humble Gizmo never
        sees your password.
      </p>
      <div className="signin-cards">
        {CARDS.map(({ service, name }) => (
          <section key={service} className="signin-card" aria-label={name}>
            <div className="signin-name">{name}</div>
            {status[service] ? (
              <Pill tone="ok">Signed in ✓</Pill>
            ) : (
              <>
                <Pill tone="muted">Not signed in</Pill>
                <Button disabled={pending[service]} onClick={() => void signIn(service)}>
                  Sign in
                </Button>
              </>
            )}
          </section>
        ))}
      </div>
      <div className="signin-result">
        {phase === 'loading' && <Spinner label="Loading your library…" />}
        {typeof phase === 'object' && 'done' in phase && (
          <>
            <div>Found {plural(phase.done.steamKeys, 'Steam key')}</div>
            {phase.done.failedOrders > 0 && (
              <Banner tone="warn">
                {`Couldn't load ${plural(phase.done.failedOrders, 'order')} — try again later`}
              </Banner>
            )}
          </>
        )}
        {typeof phase === 'object' && 'error' in phase && (
          <ErrorBanner error={phase.error} onRetry={load} />
        )}
      </div>
    </div>
  )
}
