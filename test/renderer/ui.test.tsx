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

  it('traps Tab: forward from last wraps to first, Shift+Tab from first wraps to last', () => {
    render(<ConfirmDialog {...base} requireTyped="X" onConfirm={() => {}} onCancel={() => {}} />)
    const input = screen.getByRole('textbox')
    const confirm = screen.getByRole('button', { name: 'Reveal all' }) as HTMLButtonElement
    fireEvent.change(input, { target: { value: 'X' } })
    confirm.focus()
    fireEvent.keyDown(confirm, { key: 'Tab' })
    expect(document.activeElement).toBe(input)
    fireEvent.keyDown(input, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(confirm)
  })

  it('Esc cancels even when focus is outside the dialog', () => {
    const onCancel = vi.fn()
    render(
      <div>
        <button>outside</button>
        <ConfirmDialog {...base} onConfirm={() => {}} onCancel={onCancel} />
      </div>
    )
    screen.getByRole('button', { name: 'outside' }).focus()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('returns focus to the opener on close', () => {
    const noop = (): void => {}
    const tree = (open: boolean): React.JSX.Element => (
      <div>
        <button>opener</button>
        <ConfirmDialog {...base} open={open} onConfirm={noop} onCancel={noop} />
      </div>
    )
    const { rerender } = render(tree(false))
    const opener = screen.getByRole('button', { name: 'opener' })
    opener.focus()
    rerender(tree(true))
    expect(document.activeElement).not.toBe(opener)
    rerender(tree(false))
    expect(document.activeElement).toBe(opener)
  })

  it('initial focus: typed input when requireTyped, else Cancel', () => {
    const noop = (): void => {}
    const { unmount } = render(
      <ConfirmDialog {...base} requireTyped="X" onConfirm={noop} onCancel={noop} />
    )
    expect(document.activeElement).toBe(screen.getByRole('textbox'))
    unmount()
    render(<ConfirmDialog {...base} onConfirm={noop} onCancel={noop} />)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }))
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
    expect(header.hasAttribute('aria-controls')).toBe(false)
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
