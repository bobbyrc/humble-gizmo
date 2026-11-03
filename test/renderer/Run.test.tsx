import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { RunEvent, ReviewItem } from '../../src/shared/types'
import { mockGizmo } from './mockGizmo'
import { NavProvider, useNav } from '../../src/renderer/nav'
import Run from '../../src/renderer/screens/Run'
import { setLastReview } from '../../src/renderer/runState'

afterEach(cleanup)

function Where(): React.JSX.Element {
  return <div data-testid="where">{useNav().screen}</div>
}

function setup(overrides = {}): {
  emit: (e: RunEvent) => void
  api: ReturnType<typeof mockGizmo>
  unsub: () => void
} {
  let cb: (e: RunEvent) => void = () => undefined
  const unsub = vi.fn()
  const api = mockGizmo({
    onRunEvent: vi.fn((c: (e: RunEvent) => void) => {
      cb = c
      return unsub
    }),
    ...overrides
  })
  render(
    <NavProvider initial="run">
      <Run />
      <Where />
    </NavProvider>
  )
  return { emit: (e) => act(() => cb(e)), api, unsub }
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

  it('unsubscribes on unmount', () => {
    const { unsub } = setup()
    cleanup()
    expect(unsub).toHaveBeenCalled()
  })
})
