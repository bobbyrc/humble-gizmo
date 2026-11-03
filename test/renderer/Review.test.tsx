import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReviewItem, ReviewGroup } from '../../src/shared/types'
import { UNREVEALED_LABEL } from '../../src/shared/copy'
import { mockGizmo } from './mockGizmo'
import { NavProvider, useNav } from '../../src/renderer/nav'
import Review from '../../src/renderer/screens/Review'
import { nameFor } from '../../src/renderer/runState'

afterEach(cleanup)

function item(
  n: number,
  over: Partial<ReviewItem> = {},
  group: ReviewGroup = 'will_redeem'
): ReviewItem {
  return {
    key: {
      id: `g:${n}:m${n}`,
      gamekey: 'g',
      keyindex: n,
      machineName: `m${n}`,
      name: `Game ${n}`,
      keyTypeName: 'steam',
      isSteam: true,
      steamAppId: n,
      revealedKey: null,
      isGift: false,
      isExpired: false
    },
    group,
    ticked: group === 'will_redeem',
    tickable: true,
    reasons: [],
    ...over
  }
}

function Where(): React.JSX.Element {
  return <div data-testid="where">{useNav().screen}</div>
}

function renderReview(): void {
  render(
    <NavProvider initial="review">
      <Review />
      <Where />
    </NavProvider>
  )
}

describe('Review', () => {
  it('virtualizes: 2,000 items render fewer than 100 rows', async () => {
    const items = Array.from({ length: 2000 }, (_, i) => item(i))
    mockGizmo({ buildReview: vi.fn(async () => items) })
    renderReview()
    expect(await screen.findByText('Ready to redeem 2000 games')).toBeTruthy()
    const rows = screen.getAllByRole('listitem')
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.length).toBeLessThan(100)
  })

  it('shows a spinner while loading', async () => {
    mockGizmo({ buildReview: vi.fn(() => new Promise<ReviewItem[]>(() => undefined)) })
    renderReview()
    expect(screen.getByText('Loading your library…')).toBeTruthy()
  })

  it('unticking changes the button to Redeem N-1', async () => {
    mockGizmo({ buildReview: vi.fn(async () => [item(1), item(2), item(3)]) })
    renderReview()
    await screen.findByRole('button', { name: 'Redeem 3' })
    fireEvent.click(screen.getByLabelText('Game 2'))
    expect(screen.getByRole('button', { name: 'Redeem 2' })).toBeTruthy()
  })

  it('disables the checkbox of an untickable row', async () => {
    mockGizmo({ buildReview: vi.fn(async () => [item(1), item(2, { tickable: false })]) })
    renderReview()
    await screen.findByText('Game 2')
    expect((screen.getByLabelText('Game 2') as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByLabelText('Game 1') as HTMLInputElement).disabled).toBe(false)
  })

  it('shows pills for unrevealed and duplicate', async () => {
    mockGizmo({
      buildReview: vi.fn(async () => [item(1, { reasons: ['unrevealed', 'duplicate'] })])
    })
    renderReview()
    expect(await screen.findByText(UNREVEALED_LABEL)).toBeTruthy()
    expect(screen.getByText('duplicate')).toBeTruthy()
  })

  it('collapses other groups and shows hint, matches pill and untick all', async () => {
    mockGizmo({
      buildReview: vi.fn(async () => [
        item(1),
        item(2, { matchedName: 'Game Two' }, 'maybe_owned'),
        item(3, { tickable: false, reasons: ['terminal_error'] }, 'failed_before')
      ])
    })
    renderReview()
    await screen.findByText('Game 1')
    expect(screen.queryByText('Game 2')).toBeNull()
    expect(screen.getByText('check these')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Might already own/ }))
    expect(screen.getByText('matches Game Two')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Failed before/ }))
    expect(screen.getByText("won't work")).toBeTruthy()
    fireEvent.click(screen.getAllByText('Untick all')[0])
    expect(screen.getByRole('button', { name: 'Redeem 0' }).hasAttribute('disabled')).toBe(true)
  })

  it('Redeem starts the run with ticked ids, remembers names and goes to run', async () => {
    const api = mockGizmo({ buildReview: vi.fn(async () => [item(1), item(2)]) })
    renderReview()
    await screen.findByRole('button', { name: 'Redeem 2' })
    fireEvent.click(screen.getByLabelText('Game 1'))
    fireEvent.click(screen.getByRole('button', { name: 'Redeem 1' }))
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('run'))
    expect(api.startRun).toHaveBeenCalledWith(['g:2:m2'])
    expect(nameFor('g:1:m1')).toBe('Game 1')
    expect(nameFor('unknown')).toBe('unknown')
  })

  it('shows the empty state', async () => {
    mockGizmo()
    renderReview()
    expect(await screen.findByText("Nothing new to redeem. You're all caught up.")).toBeTruthy()
  })

  it('shows a Retry banner on a generic error', async () => {
    const buildReview = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue([])
    mockGizmo({ buildReview })
    renderReview()
    expect(await screen.findByText('Something went wrong. Try again.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText("Nothing new to redeem. You're all caught up.")).toBeTruthy()
  })

  it('shows the sign-in banner on SessionExpiredError', async () => {
    const err = Object.assign(new Error('x'), { name: 'SessionExpiredError', service: 'steam' })
    const api = mockGizmo({ buildReview: vi.fn().mockRejectedValue(err) })
    renderReview()
    expect(await screen.findByText('Sign in to Steam again')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(api.signIn).toHaveBeenCalledWith('steam')
  })

  it('shows the update banner on ServiceChangedError', async () => {
    const err = Object.assign(new Error('x'), { name: 'ServiceChangedError', service: 'humble' })
    const api = mockGizmo({ buildReview: vi.fn().mockRejectedValue(err) })
    renderReview()
    await screen.findByText('Humble changed something — check for an update.')
    fireEvent.click(screen.getByRole('button', { name: 'Get the latest version' }))
    expect(api.openExternal).toHaveBeenCalledWith(
      'https://github.com/bobbyrc/humble-gizmo/releases'
    )
  })
})
