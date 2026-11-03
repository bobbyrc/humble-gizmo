import { useEffect, useState } from 'react'
import { CHECK_UPDATES_NOW, NOT_AFFILIATED, NO_KEYRING_NOTICE } from '../../shared/copy'
import type { Service, Settings as SettingsData } from '../../shared/types'
import { gizmo } from '../gizmo'
import { useNav } from '../nav'
import { Banner, Button, Checkbox, ConfirmDialog, Section } from '../components/ui'
import UpdateToggle from '../components/settings/UpdateToggle'
import '../components/settings/settings.css'

const RELEASES_URL = 'https://github.com/bobbyrc/humble-gizmo/releases'

type CheckState = 'idle' | 'checking' | 'none' | 'available' | 'error'

const SCHEDULE: { value: string; label: string; hours: number | null }[] = [
  { value: 'off', label: 'Off', hours: null },
  { value: '6', label: 'Every 6 hours', hours: 6 },
  { value: '12', label: 'Every 12 hours', hours: 12 },
  { value: '24', label: 'Every 24 hours', hours: 24 }
]

export default function Settings(): React.JSX.Element {
  const { go } = useNav()
  const [settings, setSettings] = useState<SettingsData | null>(null)
  const [encrypted, setEncrypted] = useState(true)
  const [check, setCheck] = useState<CheckState>('idle')
  const [signedOut, setSignedOut] = useState<Partial<Record<Service, boolean>>>({})
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [apiKey, setApiKey] = useState('')

  useEffect(() => {
    let live = true
    void gizmo.getSettings().then((s) => {
      if (!live) return
      setSettings(s)
      setApiKey(s.steamApiKey ?? '')
    })
    void gizmo.storageEncrypted().then((e) => live && setEncrypted(e))
    return () => {
      live = false
    }
  }, [])

  async function save(patch: Partial<SettingsData>): Promise<void> {
    setSettings((s) => (s ? { ...s, ...patch } : s))
    const next = await gizmo.setSettings(patch)
    setSettings(next)
  }

  async function checkNow(): Promise<void> {
    setCheck('checking')
    try {
      setCheck(await gizmo.checkForUpdatesNow())
    } catch {
      setCheck('error')
    }
  }

  async function signOut(service: Service): Promise<void> {
    await gizmo.signOut(service)
    setSignedOut((s) => ({ ...s, [service]: true }))
  }

  async function deleteAll(): Promise<void> {
    setConfirmDelete(false)
    await gizmo.deleteAllData()
    go('welcome')
  }

  if (!settings) return <h1>Settings</h1>

  const scheduleValue = SCHEDULE.find((o) => o.hours === settings.scheduleHours)?.value ?? 'off'
  // vite/client types aren't loaded here, so type the env object by hand.
  const env = (import.meta as { env?: Record<string, string | undefined> }).env
  const version = env?.VITE_APP_VERSION

  return (
    <div className="settings">
      <h1>Settings</h1>

      <div className="settings-group">
        <h2>Privacy</h2>
        <UpdateToggle
          checked={settings.autoUpdate}
          onChange={(autoUpdate) => void save({ autoUpdate })}
        />
        <div className="settings-row">
          <Button
            variant="secondary"
            disabled={check === 'checking'}
            onClick={() => void checkNow()}
          >
            {CHECK_UPDATES_NOW}
          </Button>
          <span className="muted" role="status">
            {check === 'checking' && 'Checking…'}
            {check === 'none' && "You're up to date"}
            {check === 'error' && "Couldn't check"}
            {check === 'available' && 'A new version is available'}
          </span>
          {check === 'available' && (
            <Button variant="link" onClick={() => void gizmo.openExternal(RELEASES_URL)}>
              Open the releases page
            </Button>
          )}
        </div>
      </div>

      <div className="settings-group">
        <h2>Background</h2>
        <label className="settings-row">
          <span>Check schedule</span>
          <select
            className="settings-select"
            value={scheduleValue}
            onChange={(e) => {
              const opt = SCHEDULE.find((o) => o.value === e.target.value)
              void save({ scheduleHours: opt ? opt.hours : null })
            }}
          >
            {SCHEDULE.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <Checkbox
          checked={settings.keepInBackground}
          onChange={(keepInBackground) => void save({ keepInBackground })}
          label="Keep running in background"
        />
        <Checkbox
          checked={settings.launchAtLogin}
          onChange={(launchAtLogin) => void save({ launchAtLogin })}
          label="Launch at login"
        />
      </div>

      <div className="settings-group">
        <h2>Accounts</h2>
        {(
          [
            ['humble', 'Humble'],
            ['steam', 'Steam']
          ] as const
        ).map(([service, name]) => (
          <div className="settings-row" key={service}>
            <Button variant="secondary" onClick={() => void signOut(service)}>
              {`Sign out of ${name}`}
            </Button>
            {signedOut[service] && <span className="muted">Signed out</span>}
          </div>
        ))}
      </div>

      <Section label="Advanced" count={0}>
        <div className="settings-field">
          <label htmlFor="steam-api-key">Steam Web API key</label>
          <input
            id="steam-api-key"
            className="settings-input"
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            onBlur={() => {
              const trimmed = apiKey.trim()
              setApiKey(trimmed)
              void save({ steamApiKey: trimmed === '' ? null : trimmed })
            }}
          />
          <span className="muted small">
            Optional. Only needed if Humble Gizmo can&apos;t work out which games you own. Get one
            at steamcommunity.com/dev/apikey.
          </span>
        </div>
      </Section>

      <div className="settings-group">
        <h2>Data</h2>
        {!encrypted && <Banner tone="warn">{NO_KEYRING_NOTICE}</Banner>}
        <Button variant="danger" onClick={() => setConfirmDelete(true)}>
          Delete all local data
        </Button>
      </div>

      <div className="settings-group">
        <h2>About</h2>
        <p className="muted">{`Version ${version ?? ''}`.trim()}</p>
        <p className="muted small">{NOT_AFFILIATED}</p>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete all local data?"
        body="This signs you out and removes your history and settings from this computer."
        confirmLabel="Delete everything"
        tone="danger"
        onConfirm={() => void deleteAll()}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}
