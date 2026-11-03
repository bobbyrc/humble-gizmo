import { useCallback, useEffect, useState } from 'react'
import { gizmo, errorName } from '../gizmo'
import { Banner, Button, Checkbox, ConfirmDialog, Pill, Spinner } from '../components/ui'
import { CODE_LABELS } from '../../core/steamCodes'
import { serviceChanged } from '../../shared/copy'
import type { KeyRecord } from '../../shared/types'
import '../components/history/history.css'

const RELEASES_URL = 'https://github.com/bobbyrc/humble-gizmo/releases'

function ResultPill({ record }: { record: KeyRecord }): React.JSX.Element {
  switch (record.outcome) {
    case 'redeemed':
      return <Pill tone="ok">Added</Pill>
    case 'owned':
      return <Pill tone="muted">Already owned</Pill>
    case 'error':
      return (
        <Pill tone="danger">
          {(record.resultCode !== null && CODE_LABELS[record.resultCode]) || 'Error'}
        </Pill>
      )
    default:
      return <Pill tone="muted">In progress</Pill>
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

function ErrorBanner({
  error,
  onRetry
}: {
  error: unknown
  onRetry: () => void
}): React.JSX.Element {
  const name = errorName(error)
  const service = (error as { service?: string })?.service
  if (name === 'ServiceChangedError') {
    return (
      <Banner
        tone="danger"
        action={{
          label: 'Get the latest version',
          onClick: () => void gizmo.openExternal(RELEASES_URL)
        }}
      >
        {serviceChanged(service === 'steam' ? 'Steam' : 'Humble')}
      </Banner>
    )
  }
  if (name === 'SessionExpiredError') {
    const svc = service === 'steam' ? 'steam' : 'humble'
    return (
      <Banner tone="danger" action={{ label: 'Sign in', onClick: () => void gizmo.signIn(svc) }}>
        {svc === 'steam' ? 'Sign in to Steam again' : 'Sign in to Humble again'}
      </Banner>
    )
  }
  return (
    <Banner tone="danger" action={{ label: 'Retry', onClick: onRetry }}>
      Something went wrong. Try again.
    </Banner>
  )
}

export default function History(): React.JSX.Element {
  const [records, setRecords] = useState<KeyRecord[] | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [steamOnly, setSteamOnly] = useState(true)
  const [includeRevealed, setIncludeRevealed] = useState(true)
  const [includeUnrevealed, setIncludeUnrevealed] = useState(false)
  const [withOwnership, setWithOwnership] = useState(false)
  const [revealAll, setRevealAll] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [savedPath, setSavedPath] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const fetchHistory = useCallback(() => {
    gizmo.history().then(setRecords, setError)
  }, [])

  const retry = useCallback(() => {
    setError(null)
    setRecords(null)
    fetchHistory()
  }, [fetchHistory])

  useEffect(fetchHistory, [fetchHistory])

  const nothingToExport = !includeRevealed && !includeUnrevealed

  async function runExport(): Promise<void> {
    setConfirming(false)
    setSavedPath(null)
    setError(null)
    setExporting(true)
    try {
      const res = await gizmo.exportCsv({
        steamOnly,
        includeRevealed,
        includeUnrevealed,
        withOwnership,
        revealAll
      })
      if (res.saved) setSavedPath(res.path ?? '')
    } catch (e) {
      setError(e)
    } finally {
      setExporting(false)
    }
  }

  function onExportClick(): void {
    if (revealAll) setConfirming(true)
    else void runExport()
  }

  return (
    <div className="history">
      <h1 className="history-title">History</h1>
      {error !== null && <ErrorBanner error={error} onRetry={retry} />}
      {savedPath !== null && <Banner tone="ok">{`Saved to ${savedPath}`}</Banner>}
      <div className="history-cols">
        <div className="history-table-wrap">
          {records === null ? (
            error === null && <Spinner label="Loading…" />
          ) : records.length === 0 ? (
            <p className="history-empty">Nothing redeemed yet.</p>
          ) : (
            <table className="history-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Result</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td>
                      <ResultPill record={r} />
                    </td>
                    <td className="history-date">{formatDate(r.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="export-card">
          <h2>Export to CSV</h2>
          <Checkbox label="Steam keys only" checked={steamOnly} onChange={setSteamOnly} />
          <Checkbox
            label="Include revealed"
            checked={includeRevealed}
            onChange={setIncludeRevealed}
          />
          <Checkbox
            label="Include unrevealed"
            checked={includeUnrevealed}
            onChange={(on) => {
              setIncludeUnrevealed(on)
              if (!on) setRevealAll(false)
            }}
          />
          <Checkbox
            label="Add “already owned on Steam” column"
            checked={withOwnership}
            onChange={setWithOwnership}
          />
          <Checkbox
            label="Reveal all unrevealed keys first"
            checked={revealAll}
            onChange={setRevealAll}
            disabled={!includeUnrevealed}
          />
          {nothingToExport && <span className="export-muted">Nothing to export</span>}
          <Button disabled={nothingToExport || exporting} onClick={onExportClick}>
            Export…
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={confirming}
        title="Reveal all unrevealed keys?"
        body="This reveals every unrevealed key on Humble. It can't be undone and uses up their gift links."
        confirmLabel="Reveal and export"
        tone="danger"
        requireTyped="REVEAL"
        onConfirm={() => void runExport()}
        onCancel={() => setConfirming(false)}
      />
    </div>
  )
}
