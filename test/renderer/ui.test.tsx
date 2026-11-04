import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Checkbox, ConfirmDialog, Stamp, Tabs } from '../../src/renderer/components/ui'

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

  it('marks a danger dialog with dialog-danger and leaves a primary one unmarked', () => {
    const { unmount } = render(
      <ConfirmDialog {...base} tone="danger" onConfirm={() => {}} onCancel={() => {}} />
    )
    expect(screen.getByRole('dialog').classList.contains('dialog-danger')).toBe(true)
    unmount()
    render(<ConfirmDialog {...base} tone="primary" onConfirm={() => {}} onCancel={() => {}} />)
    expect(screen.getByRole('dialog').classList.contains('dialog-danger')).toBe(false)
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

describe('Checkbox', () => {
  it('calls onChange(true)', () => {
    const onChange = vi.fn()
    render(<Checkbox checked={false} onChange={onChange} label="Pick me" />)
    fireEvent.click(screen.getByLabelText('Pick me'))
    expect(onChange).toHaveBeenCalledWith(true)
  })
})

describe('Stamp', () => {
  it('renders its text with the tone class', () => {
    render(<Stamp tone="void">VOID</Stamp>)
    const el = screen.getByText('VOID')
    expect(el.className).toBe('stamp stamp-void')
  })
})

describe('Tabs', () => {
  const tabs = [
    { id: 'a', label: 'Ready', count: 3 },
    { id: 'b', label: 'Owned', count: 0, tone: 'warn' as const },
    { id: 'c', label: 'Failed', count: 1, tone: 'danger' as const }
  ]
  function setup(active = 'a'): ReturnType<typeof vi.fn> {
    const onChange = vi.fn()
    render(
      <Tabs label="Keys" tabs={tabs} active={active} onChange={onChange}>
        <p>panel body</p>
      </Tabs>
    )
    return onChange
  }

  it('renders a labelled tablist with counts and roving tabIndex', () => {
    setup()
    expect(screen.getByRole('tablist', { name: 'Keys' })).toBeTruthy()
    const ready = screen.getByRole('tab', { name: 'Ready 3' })
    expect(ready.getAttribute('aria-selected')).toBe('true')
    expect(ready.tabIndex).toBe(0)
    const owned = screen.getByRole('tab', { name: 'Owned 0' })
    expect(owned.getAttribute('aria-selected')).toBe('false')
    expect(owned.tabIndex).toBe(-1)
  })

  it('labels the panel by the active tab', () => {
    setup('b')
    const panel = screen.getByRole('tabpanel')
    const owned = screen.getByRole('tab', { name: 'Owned 0' })
    expect(panel.getAttribute('aria-labelledby')).toBe(owned.id)
    expect(owned.getAttribute('aria-controls')).toBe(panel.id)
    expect(screen.getByText('panel body')).toBeTruthy()
  })

  it('calls onChange on click', () => {
    const onChange = setup()
    fireEvent.click(screen.getByRole('tab', { name: 'Failed 1' }))
    expect(onChange).toHaveBeenCalledWith('c')
  })

  it('moves with arrows (wrapping), Home and End', () => {
    const onChange = setup('c')
    const last = screen.getByRole('tab', { name: 'Failed 1' })
    fireEvent.keyDown(last, { key: 'ArrowRight' })
    expect(onChange).toHaveBeenLastCalledWith('a')
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Ready 3' }))
    fireEvent.keyDown(last, { key: 'ArrowLeft' })
    expect(onChange).toHaveBeenLastCalledWith('b')
    fireEvent.keyDown(last, { key: 'Home' })
    expect(onChange).toHaveBeenLastCalledWith('a')
    fireEvent.keyDown(last, { key: 'End' })
    expect(onChange).toHaveBeenLastCalledWith('c')
  })
})
