import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { RunEvent, ReviewItem } from '../../src/shared/types'
import { mockGizmo } from './mockGizmo'
import { NavProvider, useNav } from '../../src/renderer/nav'
import Run from '../../src/renderer/screens/Run'
import { beginRunSession, resetRunSession, setLastReview } from '../../src/renderer/runState'

afterEach(cleanup)

function Where(): React.JSX.Element {
  return <div data-testid="where">{useNav().screen}</div>
}

function setup(mountNow = true): {
  emit: (e: RunEvent) => void
  api: ReturnType<typeof mockGizmo>
  unsub: ReturnType<typeof vi.fn>
  mount: () => void
  raw: (e: RunEvent) => void
} {
  let cb: (e: RunEvent) => void = () => undefined
  const unsub = vi.fn()
  const api = mockGizmo({
    onRunEvent: vi.fn((c: (e: RunEvent) => void) => {
      cb = c
      return unsub
    })
  })
  resetRunSession()
  beginRunSession()
  const mount = (): void => {
    render(
      <NavProvider initial="run">
        <Run />
        <Where />
      </NavProvider>
    )
  }
  if (mountNow) mount()
  return { emit: (e) => act(() => cb(e)), api, unsub, mount, raw: (e) => cb(e) }
}

describe('Run', () => {
  it('lists finished keys newest first with counts', () => {
    setLastReview([{ key: { id: 'a', name: 'Alpha' } } as ReviewItem])
    const { emit } = setup()
    emit({ type: 'key-done', id: 'a', outcome: 'redeemed', code: 0 })
    emit({ type: 'key-done', id: 'b', outcome: 'owned', code: 9 })
    emit({ type: 'key-done', id: 'c', outcome: 'error', code: 13 })
    const rows = screen.getAllByRole('listitem')
    expect(rows[0].textContent).toContain('c')
    expect(rows[0].textContent).toContain('region locked')
    expect(rows[2].textContent).toContain('Alpha')
    expect(rows[2].textContent).toContain('added')
    expect(screen.getByText('1 added')).toBeTruthy()
    expect(screen.getByText('1 already owned')).toBeTruthy()
    expect(screen.getByText('1 errors')).toBeTruthy()
  })

  it('shows the rate limit message with the local resume time', () => {
    const { emit } = setup()
    emit({
      type: 'rate-limited',
      id: 'a',
      resumeAt: new Date(2026, 0, 1, 15, 42).toISOString(),
      attempt: 1
    })
    expect(screen.getByText(/Continuing at .*3:42/)).toBeTruthy()
  })

  it('shows the attempt number from the second rate-limit on', () => {
    const { emit } = setup()
    const resumeAt = new Date(2026, 0, 1, 15, 42).toISOString()
    emit({ type: 'rate-limited', id: 'a', resumeAt, attempt: 1 })
    expect(screen.queryByText(/Attempt/)).toBeNull()
    emit({ type: 'rate-limited', id: 'a', resumeAt, attempt: 3 })
    expect(screen.getByText(/Attempt 3/)).toBeTruthy()
  })

  it('prompts to sign in again to Steam', () => {
    const { emit, api } = setup()
    emit({ type: 'stopped', reason: 'steam-signed-out' })
    expect(screen.getByText('Sign in to Steam again')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(api.signIn).toHaveBeenCalledWith('steam')
  })

  it('prompts to sign in again to Humble', () => {
    const { emit } = setup()
    emit({ type: 'stopped', reason: 'humble-signed-out' })
    expect(screen.getByText('Sign in to Humble again')).toBeTruthy()
  })

  it('shows an error banner that goes back to review', () => {
    const { emit } = setup()
    emit({ type: 'stopped', reason: 'error' })
    expect(screen.getByText('Something went wrong. Your progress is saved.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Back to review' }))
    expect(screen.getByTestId('where').textContent).toBe('review')
  })

  it('shows Done when finished', () => {
    const { emit } = setup()
    emit({ type: 'finished', summary: { redeemed: 3, owned: 2, errors: 1, remaining: 0 } })
    expect(screen.getByText('Done — 3 added, 2 already owned, 1 errors')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Done' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Back to review' }))
    expect(screen.getByTestId('where').textContent).toBe('review')
  })

  it('Stop calls stopRun', () => {
    const { api } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    expect(api.stopRun).toHaveBeenCalled()
  })

  it('shows events emitted before Run mounted, including a terminal one', () => {
    const { emit, mount } = setup(false)
    emit({ type: 'key-done', id: 'a', outcome: 'redeemed', code: 0 })
    emit({ type: 'finished', summary: { redeemed: 1, owned: 0, errors: 0, remaining: 0 } })
    mount()
    expect(screen.getByText('Done — 1 added, 0 already owned, 0 errors')).toBeTruthy()
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })

  it('keeps the list and counts when remounted mid-run', () => {
    const { emit } = setup()
    emit({ type: 'key-done', id: 'a', outcome: 'redeemed', code: 0 })
    cleanup()
    render(
      <NavProvider initial="run">
        <Run />
      </NavProvider>
    )
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByText('1 added')).toBeTruthy()
    emit({ type: 'key-done', id: 'b', outcome: 'owned', code: 9 })
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('subscribes to gizmo once per run and drops it after a terminal event', () => {
    const { api, emit, unsub } = setup(false)
    beginRunSession()
    expect(api.onRunEvent).toHaveBeenCalledTimes(1)
    emit({ type: 'stopped', reason: 'user' })
    expect(unsub).toHaveBeenCalledTimes(1)
    beginRunSession()
    expect(api.onRunEvent).toHaveBeenCalledTimes(2)
  })

  it('applies events buffered between render and subscribe', () => {
    const { raw } = setup(false)
    let fired = false
    function EmitDuringRender(): null {
      if (!fired) {
        fired = true
        raw({ type: 'finished', summary: { redeemed: 2, owned: 0, errors: 0, remaining: 0 } })
      }
      return null
    }
    render(
      <NavProvider initial="run">
        <Run />
        <EmitDuringRender />
      </NavProvider>
    )
    expect(screen.getByText('Done — 2 added, 0 already owned, 0 errors')).toBeTruthy()
  })
})
