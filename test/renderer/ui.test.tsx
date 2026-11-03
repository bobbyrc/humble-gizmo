import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Checkbox, ConfirmDialog, Section } from '../../src/renderer/components/ui'

afterEach(cleanup)

describe('ConfirmDialog', () => {
  const base = { open: true, title: 'Reveal', body: 'Sure?', confirmLabel: 'Reveal all' }

  it('keeps Confirm disabled until the typed text matches', () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmDialog {...base} requireTyped="REVEAL" onConfirm={onConfirm} onCancel={() => {}} />
    )
    const confirm = screen.getByRole('button', { name: 'Reveal all' }) as HTMLButtonElement
    expect(confirm.disabled).toBe(true)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'reveal' } })
    expect(confirm.disabled).toBe(true)
    fireEvent.change(input, { target: { value: 'REVEAL' } })
    expect(confirm.disabled).toBe(false)
    fireEvent.click(confirm)
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('is a modal dialog, focuses inside on open, and Esc cancels', () => {
    const onCancel = vi.fn()
    render(<ConfirmDialog {...base} onConfirm={() => {}} onCancel={onCancel} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.contains(document.activeElement)).toBe(true)
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('renders nothing when closed', () => {
    render(<ConfirmDialog {...base} open={false} onConfirm={() => {}} onCancel={() => {}} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('traps Tab inside the dialog', () => {
    render(<ConfirmDialog {...base} onConfirm={() => {}} onCancel={() => {}} />)
    const dialog = screen.getByRole('dialog')
    const confirm = screen.getByRole('button', { name: 'Reveal all' })
    confirm.focus()
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(dialog.contains(document.activeElement)).toBe(true)
  })
})

describe('Section', () => {
  it('toggles aria-expanded', () => {
    render(
      <Section label="Owned" count={2} defaultOpen={false}>
        <p>inside</p>
      </Section>
    )
    const header = screen.getByRole('button', { name: /Owned/ })
    expect(header.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(header)
    expect(header.getAttribute('aria-expanded')).toBe('true')
  })
})

describe('Checkbox', () => {
  it('calls onChange(true)', () => {
    const onChange = vi.fn()
    render(<Checkbox checked={false} onChange={onChange} label="Pick me" />)
    fireEvent.click(screen.getByLabelText('Pick me'))
    expect(onChange).toHaveBeenCalledWith(true)
  })
})
