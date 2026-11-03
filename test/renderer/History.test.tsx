import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import History from '../../src/renderer/screens/History'
import { NavProvider } from '../../src/renderer/nav'
import { bridgeError, mockGizmo } from './mockGizmo'
import type { KeyRecord } from '../../src/shared/types'

afterEach(cleanup)

const rec = (over: Partial<KeyRecord>): KeyRecord => ({
  id: 'a',
  name: 'Game A',
  steamAppId: 1,
  revealedKey: null,
  outcome: 'redeemed',
  resultCode: null,
  runId: 'r',
  updatedAt: '2026-11-01T10:00:00Z',
  ...over
})

function renderScreen(): void {
  render(
    <NavProvider initial="history">
      <History />
    </NavProvider>
  )
}

const exportBtn = (): HTMLButtonElement =>
  screen.getByRole('button', { name: /^Export/ }) as HTMLButtonElement

describe('History', () => {
  it('lists records with outcome pills', async () => {
    mockGizmo({
      history: async () => [
        rec({ id: '1', name: 'Alpha' }),
        rec({ id: '2', name: 'Beta', outcome: 'owned' }),
        rec({ id: '3', name: 'Gamma', outcome: 'error', resultCode: 9 }),
        rec({ id: '4', name: 'Delta', outcome: 'pending' })
      ]
    })
    renderScreen()
    expect(await screen.findByText('Alpha')).toBeTruthy()
    expect(screen.getByText('Added')).toBeTruthy()
    expect(screen.getByText('Already owned')).toBeTruthy()
    expect(screen.getByText('In progress')).toBeTruthy()
    expect(screen.getAllByRole('row')).toHaveLength(5)
  })

  it('shows the empty state', async () => {
    mockGizmo()
    renderScreen()
    expect(await screen.findByText('Nothing redeemed yet.')).toBeTruthy()
  })

  it('disables export with "Nothing to export" when neither revealed nor unrevealed', async () => {
    mockGizmo()
    renderScreen()
    await screen.findByText('Nothing redeemed yet.')
    expect(exportBtn().disabled).toBe(false)
    fireEvent.click(screen.getByLabelText('Include revealed'))
    expect(exportBtn().disabled).toBe(true)
    expect(screen.getByText('Nothing to export')).toBeTruthy()
  })

  it('exports with the default options and shows the saved path', async () => {
    const api = mockGizmo({
      exportCsv: vi.fn(async () => ({ saved: true, path: '/tmp/k.csv' }))
    })
    renderScreen()
    await screen.findByText('Nothing redeemed yet.')
    fireEvent.click(exportBtn())
    expect(await screen.findByText('Saved to /tmp/k.csv')).toBeTruthy()
    expect(api.exportCsv).toHaveBeenCalledWith({
      steamOnly: true,
      includeRevealed: true,
      includeUnrevealed: false,
      withOwnership: false,
      revealAll: false
    })
  })

  it('shows nothing when the save dialog is cancelled', async () => {
    const api = mockGizmo()
    renderScreen()
    await screen.findByText('Nothing redeemed yet.')
    fireEvent.click(exportBtn())
    await waitFor(() => expect(api.exportCsv).toHaveBeenCalled())
    expect(screen.queryByText(/Saved to/)).toBeNull()
  })

  it('gates reveal-all on includeUnrevealed and clears it when unticked', async () => {
    mockGizmo()
    renderScreen()
    await screen.findByText('Nothing redeemed yet.')
    const reveal = screen.getByLabelText('Reveal all unrevealed keys first') as HTMLInputElement
    expect(reveal.disabled).toBe(true)
    fireEvent.click(screen.getByLabelText('Include unrevealed'))
    expect(reveal.disabled).toBe(false)
    fireEvent.click(reveal)
    expect(reveal.checked).toBe(true)
    fireEvent.click(screen.getByLabelText('Include unrevealed'))
    expect(reveal.checked).toBe(false)
    expect(reveal.disabled).toBe(true)
  })

  it('requires typing REVEAL before a reveal-all export', async () => {
    const api = mockGizmo()
    renderScreen()
    await screen.findByText('Nothing redeemed yet.')
    fireEvent.click(screen.getByLabelText('Include unrevealed'))
    fireEvent.click(screen.getByLabelText('Reveal all unrevealed keys first'))
    fireEvent.click(screen.getByLabelText('Add “already owned on Steam” column'))
    fireEvent.click(exportBtn())
    expect(api.exportCsv).not.toHaveBeenCalled()
    expect(screen.getByText(/can't be undone/)).toBeTruthy()
    const confirm = screen.getByRole('button', { name: 'Reveal and export' }) as HTMLButtonElement
    expect(confirm.disabled).toBe(true)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'REVEAL' } })
    fireEvent.click(confirm)
    await waitFor(() =>
      expect(api.exportCsv).toHaveBeenCalledWith({
        steamOnly: true,
        includeRevealed: true,
        includeUnrevealed: true,
        withOwnership: true,
        revealAll: true
      })
    )
  })

  it('cancelling the reveal dialog does not export', async () => {
    const api = mockGizmo()
    renderScreen()
    await screen.findByText('Nothing redeemed yet.')
    fireEvent.click(screen.getByLabelText('Include unrevealed'))
    fireEvent.click(screen.getByLabelText('Reveal all unrevealed keys first'))
    fireEvent.click(exportBtn())
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(api.exportCsv).not.toHaveBeenCalled()
  })

  it('shows a retry banner when history fails to load', async () => {
    mockGizmo({
      history: async () => {
        throw new Error('boom')
      }
    })
    renderScreen()
    expect(await screen.findByText('Something went wrong. Try again.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
  })

  it('shows the service-changed banner for a bridge ServiceChangedError', async () => {
    const api = mockGizmo({
      history: vi.fn().mockRejectedValue(bridgeError('ServiceChangedError', 'steam'))
    })
    renderScreen()
    expect(await screen.findByText('Steam changed something — check for an update.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Get the latest version' }))
    expect(api.openExternal).toHaveBeenCalledWith(
      'https://github.com/bobbyrc/humble-gizmo/releases'
    )
  })
})
