import { useEffect, useState } from 'react'
import { gizmo } from '../gizmo'
import { useNav } from '../nav'
import { rateLimitMessage } from '../../shared/copy'
import { CODE_LABELS } from '../../core/steamCodes'
import type { Outcome, RunEvent, RunSummary } from '../../shared/types'
import { Banner, Button, Pill } from '../components/ui'
import { nameFor } from '../runState'
import '../components/review/review.css'

type Finished = { id: string; outcome: Exclude<Outcome, 'pending'>; code: number | null }
type Status =
  | { kind: 'running' }
  | { kind: 'rate-limited'; time: string }
  | { kind: 'stopped'; reason: Extract<RunEvent, { type: 'stopped' }>['reason'] }
  | { kind: 'finished'; summary: RunSummary }

function OutcomePill({ f }: { f: Finished }): React.JSX.Element {
  if (f.outcome === 'redeemed') return <Pill tone="ok">added</Pill>
  if (f.outcome === 'owned') return <Pill tone="muted">already owned</Pill>
  const label = (f.code !== null && CODE_LABELS[f.code]) || 'error'
  return <Pill tone="danger">{label}</Pill>
}

export default function Run(): React.JSX.Element {
  const { go } = useNav()
  const [rows, setRows] = useState<Finished[]>([])
  const [status, setStatus] = useState<Status>({ kind: 'running' })

  useEffect(() => {
    return gizmo.onRunEvent((e) => {
      switch (e.type) {
        case 'key-done':
          setRows((prev) => [{ id: e.id, outcome: e.outcome, code: e.code }, ...prev])
          setStatus((s) => (s.kind === 'rate-limited' ? { kind: 'running' } : s))
          break
        case 'key-start':
        case 'revealing':
          setStatus((s) => (s.kind === 'rate-limited' ? { kind: 'running' } : s))
          break
        case 'rate-limited':
          setStatus({
            kind: 'rate-limited',
            time: new Date(e.resumeAt).toLocaleTimeString([], {
              hour: 'numeric',
              minute: '2-digit'
            })
          })
          break
        case 'stopped':
          setStatus({ kind: 'stopped', reason: e.reason })
          break
        case 'finished':
          setStatus({ kind: 'finished', summary: e.summary })
          break
      }
    })
  }, [])

  const counts =
    status.kind === 'finished'
      ? status.summary
      : {
          redeemed: rows.filter((r) => r.outcome === 'redeemed').length,
          owned: rows.filter((r) => r.outcome === 'owned').length,
          errors: rows.filter((r) => r.outcome === 'error').length
        }

  const active = status.kind === 'running' || status.kind === 'rate-limited'
  const heading =
    status.kind === 'finished' ? 'Done' : status.kind === 'stopped' ? 'Stopped' : 'Redeeming…'

  function banner(): React.JSX.Element | null {
    switch (status.kind) {
      case 'rate-limited':
        return <Banner tone="warn">{rateLimitMessage(status.time)}</Banner>
      case 'finished':
        return (
          <Banner tone="ok" action={{ label: 'Back to review', onClick: () => go('review') }}>
            Done — {status.summary.redeemed} added, {status.summary.owned} already owned,{' '}
            {status.summary.errors} errors
          </Banner>
        )
      case 'stopped':
        if (status.reason === 'steam-signed-out' || status.reason === 'humble-signed-out') {
          const service = status.reason === 'steam-signed-out' ? 'steam' : 'humble'
          const label = service === 'steam' ? 'Steam' : 'Humble'
          return (
            <Banner
              tone="danger"
              action={{ label: 'Sign in', onClick: () => void gizmo.signIn(service) }}
            >
              Sign in to {label} again
            </Banner>
          )
        }
        if (status.reason === 'error') {
          return (
            <Banner tone="danger" action={{ label: 'Back to review', onClick: () => go('review') }}>
              Something went wrong. Your progress is saved.
            </Banner>
          )
        }
        return (
          <Banner tone="warn" action={{ label: 'Back to review', onClick: () => go('review') }}>
            Stopped. Your progress is saved.
          </Banner>
        )
      default:
        return null
    }
  }

  return (
    <div className="screen-pad">
      <div className="screen-header">
        <h1>{heading}</h1>
        <Pill tone="ok">{counts.redeemed} added</Pill>
        <Pill tone="muted">{counts.owned} already owned</Pill>
        <Pill tone="danger">{counts.errors} errors</Pill>
        {active && (
          <Button variant="secondary" onClick={() => void gizmo.stopRun()}>
            Stop
          </Button>
        )}
      </div>
      {banner()}
      <ul className="run-list" aria-live="polite">
        {rows.map((f, i) => (
          <li key={`${f.id}-${rows.length - i}`} className="run-row">
            <span>{nameFor(f.id)}</span>
            <OutcomePill f={f} />
          </li>
        ))}
      </ul>
    </div>
  )
}
