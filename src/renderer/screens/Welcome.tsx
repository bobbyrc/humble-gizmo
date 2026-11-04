import { useState } from 'react'
import { NOT_AFFILIATED, PRIVACY_LINE_1, PRIVACY_LINE_2, PRIVACY_TITLE } from '../../shared/copy'
import { gizmo } from '../gizmo'
import { useNav } from '../nav'
import { Button } from '../components/ui'
import ErrorBanner from '../components/ErrorBanner'
import UpdateToggle from '../components/settings/UpdateToggle'
import './signin.css'

export default function Welcome(): React.JSX.Element {
  const { go } = useNav()
  const [autoUpdate, setAutoUpdate] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ e: unknown } | null>(null)

  async function onContinue(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      await gizmo.setSettings({ consentShown: true, autoUpdate })
      const s = await gizmo.status()
      go(s.humble && s.steam ? 'review' : 'signin')
    } catch (e) {
      setError({ e })
      setBusy(false)
    }
  }

  return (
    <div className="welcome">
      {error && <ErrorBanner error={error.e} onRetry={() => void onContinue()} />}
      <h1>{PRIVACY_TITLE}</h1>
      <p className="welcome-copy">{PRIVACY_LINE_1}</p>
      <p className="welcome-copy">{PRIVACY_LINE_2}</p>
      <div className="welcome-toggle">
        <UpdateToggle checked={autoUpdate} onChange={setAutoUpdate} />
      </div>
      <p className="muted small welcome-note">You can change this any time in Settings.</p>
      <div className="welcome-actions">
        <Button disabled={busy} onClick={() => void onContinue()}>
          Continue
        </Button>
      </div>
      <p className="muted small welcome-foot">{NOT_AFFILIATED}</p>
    </div>
  )
}
