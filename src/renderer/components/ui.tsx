import { useEffect, useId, useRef, useState } from 'react'
import './ui.css'

export function Button({
  variant = 'primary',
  disabled,
  onClick,
  children,
  type = 'button'
}: {
  variant?: 'primary' | 'secondary' | 'danger' | 'link'
  disabled?: boolean
  onClick?: () => void
  children: React.ReactNode
  type?: 'button' | 'submit'
}): React.JSX.Element {
  return (
    <button type={type} className={`btn btn-${variant}`} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  )
}

export function Checkbox({
  checked,
  onChange,
  label,
  disabled,
  id
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: React.ReactNode
  disabled?: boolean
  id?: string
}): React.JSX.Element {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <span className="checkbox">
      <input
        id={inputId}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <label htmlFor={inputId}>{label}</label>
    </span>
  )
}

export function Pill({
  tone,
  children
}: {
  tone: 'warn' | 'muted' | 'danger' | 'ok'
  children: React.ReactNode
}): React.JSX.Element {
  return <span className={`pill pill-${tone}`}>{children}</span>
}

export function Banner({
  tone,
  children,
  action
}: {
  tone: 'warn' | 'danger' | 'ok'
  children: React.ReactNode
  action?: { label: string; onClick: () => void }
}): React.JSX.Element {
  return (
    <div className={`banner banner-${tone}`} role="status" aria-live="polite">
      <div>{children}</div>
      {action && (
        <Button variant="secondary" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}

export function Stamp({
  tone,
  children
}: {
  tone: 'redeemed' | 'owned' | 'void'
  children: React.ReactNode
}): React.JSX.Element {
  return <span className={`stamp stamp-${tone}`}>{children}</span>
}

export type TabSpec = { id: string; label: string; count: number; tone?: 'warn' | 'danger' }

export function Tabs({
  label,
  tabs,
  active,
  onChange,
  children
}: {
  label: string
  tabs: TabSpec[]
  active: string
  onChange: (id: string) => void
  children: React.ReactNode
}): React.JSX.Element {
  const base = useId()
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})
  const tabId = (id: string): string => `${base}-tab-${id}`
  const panelId = `${base}-panel`

  function onKeyDown(e: React.KeyboardEvent): void {
    const i = tabs.findIndex((t) => t.id === active)
    let next: number
    if (e.key === 'ArrowRight') next = (i + 1) % tabs.length
    else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = tabs.length - 1
    else return
    e.preventDefault()
    onChange(tabs[next].id)
    refs.current[tabs[next].id]?.focus()
  }

  return (
    <div className="tabs">
      <div role="tablist" aria-label={label} className="tabs-list" onKeyDown={onKeyDown}>
        {tabs.map((t) => (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[t.id] = el
            }}
            type="button"
            role="tab"
            id={tabId(t.id)}
            aria-selected={t.id === active}
            aria-controls={panelId}
            tabIndex={t.id === active ? 0 : -1}
            onClick={() => onChange(t.id)}
          >
            <span className="tabs-label">{t.label}</span>{' '}
            <span className={`tabs-count${t.tone ? ` tabs-count-${t.tone}` : ''}`}>{t.count}</span>
          </button>
        ))}
      </div>
      <div role="tabpanel" id={panelId} aria-labelledby={tabId(active)} className="tabs-panel">
        {children}
      </div>
    </div>
  )
}

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'

export function ConfirmDialog(props: ConfirmDialogProps): React.JSX.Element | null {
  // Mount the inner dialog only while open so its typed text and focus start fresh each time.
  return props.open ? <OpenDialog {...props} /> : null
}

type ConfirmDialogProps = {
  open: boolean
  title: string
  body: React.ReactNode
  confirmLabel: string
  tone?: 'primary' | 'danger'
  requireTyped?: string
  onConfirm: () => void
  onCancel: () => void
}

function OpenDialog({
  title,
  body,
  confirmLabel,
  tone = 'primary',
  requireTyped,
  onConfirm,
  onCancel
}: ConfirmDialogProps): React.JSX.Element {
  const [typed, setTyped] = useState('')
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const first = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE)
    first?.focus()
    return () => previous?.focus?.()
  }, [])

  const canConfirm = requireTyped === undefined || typed === requireTyped

  // Document-level so Esc and the Tab trap work even if focus has left the dialog.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        onCancel()
        return
      }
      if (e.key !== 'Tab') return
      const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
      if (items.length === 0) return
      const firstEl = items[0]
      const lastEl = items[items.length - 1]
      const active = document.activeElement
      const inside = dialogRef.current?.contains(active) ?? false
      if (e.shiftKey && (active === firstEl || !inside)) {
        e.preventDefault()
        lastEl.focus()
      } else if (!e.shiftKey && (active === lastEl || !inside)) {
        e.preventDefault()
        firstEl.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  return (
    <div className="scrim">
      <div
        ref={dialogRef}
        className={tone === 'danger' ? 'dialog dialog-danger' : 'dialog'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId} className="dialog-title">
          {title}
        </h2>
        <div className="dialog-body">{body}</div>
        {requireTyped !== undefined && (
          <input
            className="dialog-input"
            type="text"
            aria-label={`Type ${requireTyped} to confirm`}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
          />
        )}
        <div className="dialog-actions">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant={tone} disabled={!canConfirm} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function Spinner({ label }: { label?: string }): React.JSX.Element {
  return (
    <span className="spinner" role="status">
      <span className="spinner-ring" aria-hidden="true" />
      {label && <span>{label}</span>}
    </span>
  )
}
