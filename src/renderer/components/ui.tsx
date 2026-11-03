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

export function Section({
  label,
  count,
  hint,
  defaultOpen = false,
  actions,
  children
}: {
  label: string
  count: number
  hint?: string
  defaultOpen?: boolean
  actions?: React.ReactNode
  children: React.ReactNode
}): React.JSX.Element {
  const [open, setOpen] = useState(defaultOpen)
  const bodyId = useId()
  // The header is a <button>, so interactive actions cannot nest inside it; they sit beside it.
  return (
    <section className="section">
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button
          type="button"
          className="section-head"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="section-chevron" aria-hidden="true">
            ▸
          </span>
          <span className="section-label">{label}</span>
          <span className="section-count">{count}</span>
          {hint && <span className="section-hint">{hint}</span>}
        </button>
        {actions && <div className="section-actions">{actions}</div>}
      </div>
      {open && (
        <div id={bodyId} className="section-body">
          {children}
        </div>
      )}
    </section>
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

  function onKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onCancel()
      return
    }
    if (e.key !== 'Tab') return
    const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
    if (items.length === 0) return
    const firstEl = items[0]
    const lastEl = items[items.length - 1]
    const active = document.activeElement
    if (e.shiftKey && (active === firstEl || !dialogRef.current?.contains(active))) {
      e.preventDefault()
      lastEl.focus()
    } else if (!e.shiftKey && (active === lastEl || !dialogRef.current?.contains(active))) {
      e.preventDefault()
      firstEl.focus()
    }
  }

  return (
    <div className="scrim">
      <div
        ref={dialogRef}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
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
