import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReviewItem, ReviewGroup, RunEvent } from '../../src/shared/types'
import { UNREVEALED_LABEL } from '../../src/shared/copy'
import { bridgeError, mockGizmo } from './mockGizmo'
import { NavProvider, useNav } from '../../src/renderer/nav'
import Review from '../../src/renderer/screens/Review'
import {
  beginRunSession,
  getRunEvents,
  isRunActive,
  nameFor,
  resetRunSession,
  setFreshLibrary
} from '../../src/renderer/runState'

afterEach(() => {
  cleanup()
  resetRunSession()
})

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
    expect(await screen.findByRole('heading', { name: 'Ready to redeem 2000 games' })).toBeTruthy()
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

  it('shows only the selected group and shows hint, matches pill and untick all', async () => {
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
    fireEvent.click(screen.getByRole('tab', { name: /^Might already own/ }))
    expect(screen.getByText('check these')).toBeTruthy()
    expect(screen.getByText('matches Game Two')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: /^Failed before/ }))
    expect(screen.getByText("won't work")).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: /^Will redeem/ }))
    fireEvent.click(screen.getByText('Untick all'))
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
    expect(screen.getByText('All caught up')).toBeTruthy()
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
    const err = bridgeError('SessionExpiredError', 'steam')
    const api = mockGizmo({ buildReview: vi.fn().mockRejectedValue(err) })
    renderReview()
    expect(await screen.findByText('Sign in to Steam again')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(api.signIn).toHaveBeenCalledWith('steam')
  })

  it('shows the update banner on ServiceChangedError', async () => {
    const err = bridgeError('ServiceChangedError', 'humble')
    const api = mockGizmo({ buildReview: vi.fn().mockRejectedValue(err) })
    renderReview()
    await screen.findByText('Humble changed something — check for an update.')
    fireEvent.click(screen.getByRole('button', { name: 'Get the latest version' }))
    expect(api.openExternal).toHaveBeenCalledWith(
      'https://github.com/bobbyrc/humble-gizmo/releases'
    )
  })

  it('does not send or count ticked items that are not tickable', async () => {
    const api = mockGizmo({
      buildReview: vi.fn(async () => [item(1), item(2, { ticked: true, tickable: false })])
    })
    renderReview()
    await screen.findByRole('button', { name: 'Redeem 1' })
    fireEvent.click(screen.getByRole('button', { name: 'Redeem 1' }))
    await waitFor(() => expect(api.startRun).toHaveBeenCalledWith(['g:1:m1']))
  })

  it('calls startRun once on double click and subscribes first', async () => {
    const order: string[] = []
    const api = mockGizmo({
      buildReview: vi.fn(async () => [item(1)]),
      onRunEvent: vi.fn(() => {
        order.push('subscribe')
        return () => undefined
      }),
      startRun: vi.fn(async () => {
        order.push('start')
      })
    })
    renderReview()
    const btn = await screen.findByRole('button', { name: 'Redeem 1' })
    fireEvent.click(btn)
    fireEvent.click(btn)
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('run'))
    expect(api.startRun).toHaveBeenCalledTimes(1)
    expect(order.slice(0, 2)).toEqual(['subscribe', 'start'])
  })

  it('shows the generic error banner when startRun rejects', async () => {
    mockGizmo({
      buildReview: vi.fn(async () => [item(1)]),
      startRun: vi.fn().mockRejectedValue(new Error('nope'))
    })
    renderReview()
    fireEvent.click(await screen.findByRole('button', { name: 'Redeem 1' }))
    expect(await screen.findByText('Something went wrong. Try again.')).toBeTruthy()
  })

  it('untick all only affects its own group', async () => {
    mockGizmo({
      buildReview: vi.fn(async () => [
        item(1),
        item(2, {}, 'owned'),
        item(3, { ticked: true }, 'owned')
      ])
    })
    renderReview()
    await screen.findByRole('button', { name: 'Redeem 2' })
    fireEvent.click(screen.getByRole('tab', { name: /^You already own/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Untick all You already own' }))
    expect(screen.getByRole('button', { name: 'Redeem 1' })).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: /^Will redeem/ }))
    expect((screen.getByLabelText('Game 1') as HTMLInputElement).checked).toBe(true)
  })

  it('hides untick all for a group with nothing ticked', async () => {
    mockGizmo({
      buildReview: vi.fn(async () => [
        item(1),
        item(2, { ticked: false, tickable: false }, 'done_before')
      ])
    })
    renderReview()
    await screen.findByRole('button', { name: 'Redeem 1' })
    expect(
      screen.queryByRole('button', { name: 'Untick all Already done in an earlier run' })
    ).toBeNull()
  })

  it('hides untick all for a group once its last tick is cleared', async () => {
    mockGizmo({ buildReview: vi.fn(async () => [item(1)]) })
    renderReview()
    await screen.findByRole('button', { name: 'Redeem 1' })
    fireEvent.click(screen.getByRole('button', { name: 'Untick all Will redeem' }))
    expect(screen.queryByRole('button', { name: 'Untick all Will redeem' })).toBeNull()
  })

  it('lists each non-empty group as a tab with its count', async () => {
    mockGizmo({
      buildReview: vi.fn(async () => [
        item(1),
        item(2),
        item(3, {}, 'maybe_owned'),
        item(4, {}, 'done_before')
      ])
    })
    renderReview()
    await screen.findByText('Game 1')
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((t) => t.textContent)).toEqual([
      'Will redeem 2',
      'Might already own 1',
      'Already done in an earlier run 1'
    ])
    expect(screen.getByRole('tablist', { name: 'Key groups' })).toBeTruthy()
    expect(tabs[0].getAttribute('aria-selected')).toBe('true')
  })

  it('keeps an untick when switching tabs and back', async () => {
    mockGizmo({ buildReview: vi.fn(async () => [item(1), item(2), item(3, {}, 'owned')]) })
    renderReview()
    await screen.findByRole('button', { name: 'Redeem 2' })
    fireEvent.click(screen.getByLabelText('Game 1'))
    fireEvent.click(screen.getByRole('tab', { name: /^You already own/ }))
    expect(screen.queryByLabelText('Game 1')).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: /^Will redeem/ }))
    expect((screen.getByLabelText('Game 1') as HTMLInputElement).checked).toBe(false)
    expect(screen.getByRole('button', { name: 'Redeem 1' })).toBeTruthy()
  })

  it('shows bundle and purchase year in the From cell, or a dash', async () => {
    const a = item(1)
    a.key.bundle = 'Humble Indie Bundle 19'
    a.key.purchased = '2018-03-06T18:00:23.123'
    mockGizmo({ buildReview: vi.fn(async () => [a, item(2)]) })
    renderReview()
    expect(await screen.findByText('Humble Indie Bundle 19 · 2018')).toBeTruthy()
    expect(screen.getByText('—')).toBeTruthy()
  })

  it('marks rows with set size and position', async () => {
    mockGizmo({ buildReview: vi.fn(async () => [item(1), item(2)]) })
    renderReview()
    await screen.findByText('Game 2')
    const rows = screen.getAllByRole('listitem')
    expect(rows[1].getAttribute('aria-setsize')).toBe('2')
    expect(rows[1].getAttribute('aria-posinset')).toBe('2')
  })
})

describe('Review refresh and reattach', () => {
  it('loads the library before building the review', async () => {
    const order: string[] = []
    mockGizmo({
      loadLibrary: vi.fn(async () => {
        order.push('load')
        return { keys: 1, steamKeys: 1, failedOrders: 0 }
      }),
      buildReview: vi.fn(async () => {
        order.push('build')
        return [item(1)]
      })
    })
    renderReview()
    await screen.findByRole('button', { name: 'Redeem 1' })
    expect(order).toEqual(['load', 'build'])
  })

  it('warns when some orders failed to load', async () => {
    mockGizmo({ loadLibrary: vi.fn(async () => ({ keys: 1, steamKeys: 1, failedOrders: 3 })) })
    renderReview()
    expect(await screen.findByText("Couldn't load 3 orders — try again later")).toBeTruthy()
  })

  it('shows no order warning when none failed', async () => {
    mockGizmo()
    renderReview()
    await screen.findByText("Nothing new to redeem. You're all caught up.")
    expect(screen.queryByText(/Couldn't load/)).toBeNull()
  })

  it('Refresh re-runs loadLibrary and buildReview', async () => {
    const api = mockGizmo({ buildReview: vi.fn(async () => [item(1)]) })
    renderReview()
    await screen.findByRole('button', { name: 'Redeem 1' })
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    await waitFor(() => expect(api.loadLibrary).toHaveBeenCalledTimes(2))
    await screen.findByRole('button', { name: 'Redeem 1' })
    expect(api.buildReview).toHaveBeenCalledTimes(2)
  })

  it('shows the error banner when loadLibrary rejects with a bridge error', async () => {
    const api = mockGizmo({
      loadLibrary: vi.fn().mockRejectedValue(bridgeError('SessionExpiredError', 'humble'))
    })
    renderReview()
    expect(await screen.findByText('Sign in to Humble again')).toBeTruthy()
    expect(api.buildReview).not.toHaveBeenCalled()
  })

  it('redirects to Run while a run is active and keeps the buffered events', async () => {
    let cb: (e: RunEvent) => void = () => undefined
    const api = mockGizmo({
      onRunEvent: vi.fn((c: (e: RunEvent) => void) => {
        cb = c
        return () => undefined
      })
    })
    beginRunSession()
    cb({ type: 'key-start', id: 'a' })
    renderReview()
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('run'))
    expect(getRunEvents()).toEqual([{ type: 'key-start', id: 'a' }])
    expect(isRunActive()).toBe(true)
    expect(api.loadLibrary).not.toHaveBeenCalled()
    expect(api.buildReview).not.toHaveBeenCalled()
  })

  it('redeem goes to Run instead of starting a second session when a run became active', async () => {
    const api = mockGizmo({ buildReview: vi.fn(async () => [item(1)]) })
    renderReview()
    const btn = await screen.findByRole('button', { name: 'Redeem 1' })
    beginRunSession()
    fireEvent.click(btn)
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('run'))
    expect(api.startRun).not.toHaveBeenCalled()
  })

  it('does not leak an unhandled rejection from banner actions', async () => {
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)
    const api = mockGizmo({
      buildReview: vi.fn().mockRejectedValue(bridgeError('SessionExpiredError', 'steam')),
      signIn: vi.fn().mockRejectedValue(new Error('nope'))
    })
    renderReview()
    fireEvent.click(await screen.findByRole('button', { name: 'Sign in' }))
    await new Promise((r) => setTimeout(r, 20))
    process.off('unhandledRejection', unhandled)
    expect(api.signIn).toHaveBeenCalledWith('steam')
    expect(unhandled).not.toHaveBeenCalled()
  })

  it('uses the library handed over by sign in once, then loads again', async () => {
    const g = mockGizmo({ buildReview: vi.fn(async () => [item(1)]) })
    setFreshLibrary({ keys: 1, steamKeys: 1, failedOrders: 0 })
    renderReview()
    expect(await screen.findByRole('heading', { name: 'Ready to redeem 1 games' })).toBeTruthy()
    expect(g.loadLibrary).not.toHaveBeenCalled()
    cleanup()
    renderReview()
    expect(await screen.findByRole('heading', { name: 'Ready to redeem 1 games' })).toBeTruthy()
    expect(g.loadLibrary).toHaveBeenCalledTimes(1)
  })
})
