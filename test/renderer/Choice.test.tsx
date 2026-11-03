import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ChoiceGame, ChoiceMonth } from '../../src/shared/types'
import { mockGizmo } from './mockGizmo'
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

  it('renders rating, header and caps ticking at choicesRemaining', async () => {
    mockGizmo({ listChoiceMonths: vi.fn(async () => [month()]) })
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
    const list = vi.fn().mockResolvedValueOnce([month()]).mockResolvedValueOnce([])
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
      listChoiceMonths: vi.fn(async () => [month()]),
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

  it('opens non-claimable games on Humble', async () => {
    const api = mockGizmo({ listChoiceMonths: vi.fn(async () => [month()]) })
    renderChoice()
    fireEvent.click(await screen.findByRole('button', { name: 'Claim on Humble' }))
    expect(api.openExternal).toHaveBeenCalledWith(
      'https://www.humblebundle.com/subscription/march-2025/d'
    )
  })

  it('Claim all ticks every claimable game when allowed', async () => {
    mockGizmo({ listChoiceMonths: vi.fn(async () => [month({ choicesRemaining: 3 })]) })
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
})
