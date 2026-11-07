import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ChoiceGame, ChoiceMonth } from '../../src/shared/types'
import { bridgeError, mockGizmo } from './mockGizmo'
import { NavProvider } from '../../src/renderer/nav'
import Choice from '../../src/renderer/screens/Choice'

afterEach(cleanup)

const game = (id: string, over: Partial<ChoiceGame> = {}): ChoiceGame => ({
  identifier: id,
  title: `Game ${id}`,
  rating: { text: 'Very Positive', percent: 0.93 },
  claimable: true,
  gamekey: 'gk',
  ...over
})

const month = (over: Partial<ChoiceMonth> = {}): ChoiceMonth => ({
  gamekey: 'mk1',
  name: 'March 2025',
  choiceUrl: 'march-2025',
  created: '2025-03-01T00:00:00Z',
  usesChoices: true,
  choicesRemaining: 2,
  parentIdentifier: 'p',
  games: [game('a'), game('b'), game('c'), game('d', { claimable: false, rating: null })],
  ...over
})

function renderChoice(): void {
  render(
    <NavProvider initial="choice">
      <Choice />
    </NavProvider>
  )
}

const box = (title: string): HTMLInputElement =>
  screen.getByRole('checkbox', { name: new RegExp(title) }) as HTMLInputElement

describe('Choice', () => {
  it('shows the empty state', async () => {
    mockGizmo()
    renderChoice()
    expect(await screen.findByText('No Humble Choice picks left to make.')).toBeTruthy()
  })

  it('shows the all-locked message when Humble opens no month', async () => {
    mockGizmo({ listChoiceMonths: vi.fn(async () => ({ months: [], locked: 4 })) })
    renderChoice()
    expect(
      await screen.findByText(
        "Humble wouldn't open your Humble Choice months, so Humble Gizmo can't tell whether any picks are left."
      )
    ).toBeTruthy()
    expect(
      screen.getByText(
        "4 months couldn't be checked. You can still check them on the Humble website."
      )
    ).toBeTruthy()
    expect(screen.queryByText('No Humble Choice picks left to make.')).toBeNull()
  })

  it('shows a warn banner above the months when some are locked', async () => {
    mockGizmo({ listChoiceMonths: vi.fn(async () => ({ months: [month()], locked: 2 })) })
    renderChoice()
    expect(
      await screen.findByText(
        "Humble wouldn't open 2 other months, so they may have picks left too."
      )
    ).toBeTruthy()
    expect(screen.getByText('Pick up to 2 (0 picked)')).toBeTruthy()
  })

  it('renders rating, header and caps ticking at choicesRemaining', async () => {
    mockGizmo({ listChoiceMonths: vi.fn(async () => ({ months: [month()], locked: 0 })) })
    renderChoice()
    expect(await screen.findByText('Pick up to 2 (0 picked)')).toBeTruthy()
    expect(screen.getAllByText('Very Positive · 93%').length).toBe(3)
    fireEvent.click(box('Game a'))
    fireEvent.click(box('Game b'))
    expect(screen.getByText('Pick up to 2 (2 picked)')).toBeTruthy()
    expect(box('Game c').disabled).toBe(true)
    expect(box('Game a').disabled).toBe(false)
    expect(screen.queryByRole('button', { name: 'Claim all' })).toBeNull()
  })

  it('requires confirmation, then claims and refreshes', async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce({ months: [month()], locked: 0 })
      .mockResolvedValueOnce({ months: [], locked: 0 })
    const api = mockGizmo({ listChoiceMonths: list })
    renderChoice()
    fireEvent.click(await screen.findByLabelText(/Game a/))
    fireEvent.click(screen.getByRole('button', { name: 'Claim 1' }))
    expect(api.claimChoices).not.toHaveBeenCalled()
    expect(
      screen.getByText("Claiming can't be undone. Claim 1 games from March 2025?")
    ).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: 'Claim 1' })[1])
    await screen.findByText('Claimed. New keys will appear in your review list.')
    expect(api.claimChoices).toHaveBeenCalledWith('mk1', ['a'])
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2))
  })

  it('lists failed games', async () => {
    mockGizmo({
      listChoiceMonths: vi.fn(async () => ({ months: [month()], locked: 0 })),
      claimChoices: vi.fn(async () => ({ failed: ['a'] }))
    })
    renderChoice()
    fireEvent.click(await screen.findByLabelText(/Game a/))
    fireEvent.click(screen.getByRole('button', { name: 'Claim 1' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Claim 1' })[1])
    const banner = (await screen.findByText(/Game a/, { selector: '.banner *' })).closest('.banner')
    expect(banner).toBeTruthy()
    expect(screen.queryByText('Claimed. New keys will appear in your review list.')).toBeNull()
  })

  it('refetches after a failed claim and offers Reload without re-claiming', async () => {
    const list = vi.fn(async () => ({ months: [month()], locked: 0 }))
    const api = mockGizmo({
      listChoiceMonths: list,
      claimChoices: vi.fn(async () => {
        throw new Error('boom')
      })
    })
    renderChoice()
    fireEvent.click(await screen.findByLabelText(/Game a/))
    fireEvent.click(screen.getByRole('button', { name: 'Claim 1' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Claim 1' })[1])
    await screen.findByText('Something went wrong. Try again.')
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2))
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }))
    await waitFor(() => expect(list).toHaveBeenCalledTimes(3))
    expect(api.claimChoices).toHaveBeenCalledTimes(1)
  })

  it('ignores a second confirm while a claim is in flight', async () => {
    let release: () => void = () => undefined
    const api = mockGizmo({
      listChoiceMonths: vi.fn(async () => ({ months: [month()], locked: 0 })),
      claimChoices: vi.fn(
        () =>
          new Promise<{ failed: string[] }>((res) => {
            release = () => res({ failed: [] })
          })
      )
    })
    renderChoice()
    fireEvent.click(await screen.findByLabelText(/Game a/))
    fireEvent.click(screen.getByRole('button', { name: 'Claim 1' }))
    const confirm = screen.getAllByRole('button', { name: 'Claim 1' })[1]
    fireEvent.click(confirm)
    fireEvent.click(confirm)
    expect(api.claimChoices).toHaveBeenCalledTimes(1)
    release()
    await screen.findByText('Claimed. New keys will appear in your review list.')
  })

  it('hides Claim all when nothing is claimable', async () => {
    mockGizmo({
      listChoiceMonths: vi.fn(async () => ({
        months: [month({ usesChoices: false, games: [game('d', { claimable: false })] })],
        locked: 0
      }))
    })
    renderChoice()
    await screen.findByRole('button', { name: 'Claim on Humble' })
    expect(screen.queryByRole('button', { name: 'Claim all' })).toBeNull()
  })

  it('opens non-claimable games on Humble', async () => {
    const api = mockGizmo({
      listChoiceMonths: vi.fn(async () => ({ months: [month()], locked: 0 }))
    })
    renderChoice()
    fireEvent.click(await screen.findByRole('button', { name: 'Claim on Humble' }))
    expect(api.openExternal).toHaveBeenCalledWith(
      'https://www.humblebundle.com/membership/march-2025/d'
    )
  })

  it('Claim all ticks every claimable game when allowed', async () => {
    mockGizmo({
      listChoiceMonths: vi.fn(async () => ({ months: [month({ choicesRemaining: 3 })], locked: 0 }))
    })
    renderChoice()
    fireEvent.click(await screen.findByRole('button', { name: 'Claim all' }))
    expect(box('Game a').checked && box('Game b').checked && box('Game c').checked).toBe(true)
    expect(screen.getByRole('button', { name: 'Claim 3' })).toBeTruthy()
  })

  it('shows a retry banner on unknown errors', async () => {
    mockGizmo({
      listChoiceMonths: vi.fn(async () => {
        throw new Error('boom')
      })
    })
    renderChoice()
    expect(await screen.findByText('Something went wrong. Try again.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
  })

  it('loads the library before listing months', async () => {
    const order: string[] = []
    mockGizmo({
      loadLibrary: vi.fn(async () => {
        order.push('load')
        return { keys: 0, steamKeys: 0, failedOrders: 0 }
      }),
      listChoiceMonths: vi.fn(async () => {
        order.push('list')
        return { months: [month()], locked: 0 }
      })
    })
    renderChoice()
    await screen.findByText('March 2025')
    expect(order).toEqual(['load', 'list'])
  })

  it('mount loads the library without forcing a refresh', async () => {
    const api = mockGizmo({
      listChoiceMonths: vi.fn(async () => ({ months: [month()], locked: 0 }))
    })
    renderChoice()
    await screen.findByText('March 2025')
    expect(api.loadLibrary).toHaveBeenCalledTimes(1)
    expect(api.loadLibrary).toHaveBeenCalledWith()
  })

  it('Refresh reloads the library with refresh, then lists the months again', async () => {
    const list = vi.fn(async () => ({ months: [month()], locked: 0 }))
    const api = mockGizmo({ listChoiceMonths: list })
    renderChoice()
    await screen.findByText('March 2025')
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2))
    expect(api.loadLibrary).toHaveBeenCalledTimes(2)
    expect(api.loadLibrary).toHaveBeenLastCalledWith({ refresh: true })
  })

  it('shows the sign-in banner for a bridge SessionExpiredError', async () => {
    const api = mockGizmo({
      listChoiceMonths: vi.fn().mockRejectedValue(bridgeError('SessionExpiredError', 'humble'))
    })
    renderChoice()
    expect(await screen.findByText('Sign in to Humble again')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(api.signIn).toHaveBeenCalledWith('humble')
  })
})
