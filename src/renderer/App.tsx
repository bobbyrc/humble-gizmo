import { useCallback, useEffect, useState } from 'react'
import type { Service, Settings } from '../shared/types'
import { gizmo } from './gizmo'
import { NavProvider, useNav, type Screen } from './nav'
import { Banner, Spinner } from './components/ui'
import Welcome from './screens/Welcome'
import SignIn from './screens/SignIn'
import Review from './screens/Review'
import Run from './screens/Run'
import Choice from './screens/Choice'
import History from './screens/History'
import Settings_ from './screens/Settings'
import './app.css'

type Status = Record<Service, boolean>

const NAV_ITEMS: { label: string; screen: Screen }[] = [
  { label: 'Redeem', screen: 'review' },
  { label: 'Humble Choice', screen: 'choice' },
  { label: 'History', screen: 'history' },
  { label: 'Settings', screen: 'settings' }
]

const SERVICES: { service: Service; name: string }[] = [
  { service: 'humble', name: 'Humble' },
  { service: 'steam', name: 'Steam' }
]

function Wordmark({ variant }: { variant: 'rail' | 'card' }): React.JSX.Element {
  const mark = (
    <svg className="wordmark-mark" viewBox="0 0 28 12" aria-hidden="true">
      <path d="M5 0h8l-5 12H0z" />
      <path d="M17 0h11l-5 12H12z" />
    </svg>
  )
  return variant === 'rail' ? (
    <div className="wordmark wordmark-rail">
      {mark}
      <span className="wordmark-text">
        <span className="wordmark-small">HUMBLE</span>
        <span className="wordmark-big">GIZMO</span>
      </span>
    </div>
  ) : (
    <div className="wordmark wordmark-card">
      {mark}
      <span>HUMBLE GIZMO</span>
    </div>
  )
}

function ScreenView({ screen }: { screen: Screen }): React.JSX.Element {
  switch (screen) {
    case 'welcome':
      return <Welcome />
    case 'signin':
      return <SignIn />
    case 'review':
      return <Review />
    case 'run':
      return <Run />
    case 'choice':
      return <Choice />
    case 'history':
      return <History />
    case 'settings':
      return <Settings_ />
  }
}

function Shell({ initialStatus }: { initialStatus: Status }): React.JSX.Element {
  const { screen, go } = useNav()
  const [status, setStatus] = useState<Status>(initialStatus)

  const refresh = useCallback(async () => {
    try {
      setStatus(await gizmo.status())
    } catch {
      // Keep the last known status; the next screen change polls again.
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    gizmo
      .status()
      .then((s) => {
        if (!cancelled) setStatus(s)
      })
      .catch(() => undefined) // keep the last known status
    return () => {
      cancelled = true
    }
  }, [screen])

  if (screen === 'welcome' || screen === 'signin') {
    return (
      <div className="shell-card">
        <main className="shell-card-inner">
          <Wordmark variant="card" />
          <div className="shell-card-body">
            <ScreenView screen={screen} />
          </div>
        </main>
      </div>
    )
  }

  const active: Screen = screen === 'run' ? 'review' : screen
  return (
    <div className="shell-main">
      <aside className="sidebar">
        <Wordmark variant="rail" />
        <nav className="sidebar-nav" aria-label="Main">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.screen}
              type="button"
              className="nav-item"
              aria-current={item.screen === active ? 'page' : undefined}
              onClick={() => go(item.screen)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          {SERVICES.map(({ service, name }) => {
            const signedIn = status[service]
            const content = (
              <>
                <span className="account-name">{name}</span>{' '}
                <span className={signedIn ? 'dot' : 'dot dot-off'} aria-hidden="true" />{' '}
                {signedIn ? 'Signed in' : 'Signed out'}
              </>
            )
            return signedIn ? (
              <div key={service} className="account-row">
                {content}
              </div>
            ) : (
              <button
                key={service}
                type="button"
                className="account-row"
                onClick={async () => {
                  try {
                    await gizmo.signIn(service)
                  } finally {
                    await refresh()
                  }
                }}
              >
                {content}
              </button>
            )
          })}
        </div>
      </aside>
      <main className="content">
        <ScreenView screen={screen} />
      </main>
    </div>
  )
}

function App(): React.JSX.Element {
  const [loaded, setLoaded] = useState<{ settings: Settings; status: Status } | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    Promise.all([gizmo.getSettings(), gizmo.status()]).then(
      ([settings, status]) => {
        if (!cancelled) setLoaded({ settings, status })
      },
      () => {
        if (!cancelled) setFailed(true)
      }
    )
    return () => {
      cancelled = true
    }
  }, [attempt])

  if (failed) {
    return (
      <div className="loading">
        <Banner
          tone="danger"
          action={{
            label: 'Retry',
            onClick: () => {
              setFailed(false)
              setAttempt((n) => n + 1)
            }
          }}
        >
          Couldn&apos;t start. Try again.
        </Banner>
      </div>
    )
  }

  if (!loaded) {
    return (
      <div className="loading">
        <Spinner label="Loading…" />
      </div>
    )
  }

  const { settings, status } = loaded
  const initial: Screen = !settings.consentShown
    ? 'welcome'
    : !status.humble || !status.steam
      ? 'signin'
      : 'review'
  return (
    <NavProvider initial={initial}>
      <Shell initialStatus={status} />
    </NavProvider>
  )
}

export default App
