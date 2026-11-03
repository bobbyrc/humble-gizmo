import { useState } from 'react'
import { NOT_AFFILIATED, PRIVACY_LINE_1, PRIVACY_LINE_2, PRIVACY_TITLE } from '../../shared/copy'
import { gizmo } from '../gizmo'
import { useNav } from '../nav'
import { Button } from '../components/ui'
import UpdateToggle from '../components/settings/UpdateToggle'
import '../components/settings/settings.css'

export default function Welcome(): React.JSX.Element {
  const { go } = useNav()
  const [autoUpdate, setAutoUpdate] = useState(false)
  const [busy, setBusy] = useState(false)

  async function onContinue(): Promise<void> {
    setBusy(true)
    try {
      await gizmo.setSettings({ consentShown: true, autoUpdate })
      const s = await gizmo.status()
      go(s.humble && s.steam ? 'review' : 'signin')
    } catch {
      setBusy(false)
    }
  }

  return (
    <div className="welcome">
      <h1>{PRIVACY_TITLE}</h1>
      <p>{PRIVACY_LINE_1}</p>
      <p>{PRIVACY_LINE_2}</p>
      <div className="welcome-toggle">
        <UpdateToggle checked={autoUpdate} onChange={setAutoUpdate} />
      </div>
      <p className="muted small">You can change this any time in Settings.</p>
      <div className="welcome-actions">
        <Button disabled={busy} onClick={() => void onContinue()}>
          Continue
        </Button>
      </div>
      <p className="muted small">{NOT_AFFILIATED}</p>
    </div>
  )
}
