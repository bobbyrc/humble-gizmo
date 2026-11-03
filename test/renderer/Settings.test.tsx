import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DEFAULT_SETTINGS } from '../../src/shared/types'
import {
  CHECK_UPDATES_NOW,
  NOT_AFFILIATED,
  NO_KEYRING_NOTICE,
  UPDATE_TOGGLE
} from '../../src/shared/copy'
import { mockGizmo } from './mockGizmo'
import { NavProvider, useNav } from '../../src/renderer/nav'
import Settings from '../../src/renderer/screens/Settings'

afterEach(cleanup)

function Where(): React.JSX.Element {
  return <div data-testid="where">{useNav().screen}</div>
}

async function renderSettings(): Promise<void> {
  render(
    <NavProvider initial="settings">
      <Settings />
      <Where />
    </NavProvider>
  )
  await screen.findByRole('button', { name: CHECK_UPDATES_NOW })
}

const RELEASES = 'https://github.com/bobbyrc/humble-gizmo/releases'

describe('Settings', () => {
  it('shows copy and loads current values', async () => {
    mockGizmo({ getSettings: vi.fn(async () => ({ ...DEFAULT_SETTINGS, autoUpdate: true })) })
    await renderSettings()
    const box = screen.getByLabelText(UPDATE_TOGGLE, { exact: false }) as HTMLInputElement
    expect(box.checked).toBe(true)
    expect(screen.getByText(NOT_AFFILIATED)).toBeTruthy()
    expect(screen.queryByText(NO_KEYRING_NOTICE)).toBeNull()
  })

  it('shows the keyring notice when storage is not encrypted', async () => {
    mockGizmo({ storageEncrypted: vi.fn(async () => false) })
    await renderSettings()
    expect(await screen.findByText(NO_KEYRING_NOTICE)).toBeTruthy()
  })

  it('saves the update toggle and background options', async () => {
    const g = mockGizmo()
    await renderSettings()
    fireEvent.click(screen.getByLabelText(UPDATE_TOGGLE, { exact: false }))
    await waitFor(() => expect(g.setSettings).toHaveBeenCalledWith({ autoUpdate: true }))
    fireEvent.click(screen.getByLabelText('Keep running in background'))
    await waitFor(() => expect(g.setSettings).toHaveBeenCalledWith({ keepInBackground: true }))
    fireEvent.click(screen.getByLabelText('Launch at login'))
    await waitFor(() => expect(g.setSettings).toHaveBeenCalledWith({ launchAtLogin: true }))
  })

  it('maps schedule options to scheduleHours', async () => {
    const g = mockGizmo()
    await renderSettings()
    const select = screen.getByLabelText('Check schedule') as HTMLSelectElement
    expect(Array.from(select.options).map((o) => o.text)).toEqual([
      'Off',
      'Every 6 hours',
      'Every 12 hours',
      'Every 24 hours'
    ])
    fireEvent.change(select, { target: { value: '12' } })
    await waitFor(() => expect(g.setSettings).toHaveBeenCalledWith({ scheduleHours: 12 }))
    fireEvent.change(select, { target: { value: 'off' } })
    await waitFor(() => expect(g.setSettings).toHaveBeenCalledWith({ scheduleHours: null }))
  })

  it('shows the check result for each outcome', async () => {
    const g = mockGizmo()
    await renderSettings()
    const btn = (): HTMLElement => screen.getByRole('button', { name: CHECK_UPDATES_NOW })
    fireEvent.click(btn())
    expect(await screen.findByText("You're up to date")).toBeTruthy()

    g.checkForUpdatesNow.mockResolvedValueOnce('error')
    fireEvent.click(btn())
    expect(await screen.findByText("Couldn't check")).toBeTruthy()

    g.checkForUpdatesNow.mockResolvedValueOnce('available')
    fireEvent.click(btn())
    expect(await screen.findByText('A new version is available')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Open the releases page' }))
    expect(g.openExternal).toHaveBeenCalledWith(RELEASES)
  })

  it('shows Checking… while pending', async () => {
    let resolve: (v: 'none') => void = () => undefined
    mockGizmo({ checkForUpdatesNow: vi.fn(() => new Promise<'none'>((r) => (resolve = r))) })
    await renderSettings()
    fireEvent.click(screen.getByRole('button', { name: CHECK_UPDATES_NOW }))
    expect(await screen.findByText('Checking…')).toBeTruthy()
    resolve('none')
    expect(await screen.findByText("You're up to date")).toBeTruthy()
  })

  it('signs out of each service and says so', async () => {
    const g = mockGizmo()
    await renderSettings()
    fireEvent.click(screen.getByRole('button', { name: 'Sign out of Humble' }))
    await waitFor(() => expect(g.signOut).toHaveBeenCalledWith('humble'))
    expect(await screen.findAllByText('Signed out')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Sign out of Steam' }))
    await waitFor(() => expect(g.signOut).toHaveBeenCalledWith('steam'))
    expect(await screen.findAllByText('Signed out')).toHaveLength(2)
  })

  it('keeps the Steam API key in a collapsed Advanced section and saves it trimmed on blur', async () => {
    const g = mockGizmo({
      getSettings: vi.fn(async () => ({ ...DEFAULT_SETTINGS, steamApiKey: 'SECRETKEY' }))
    })
    await renderSettings()
    expect(screen.queryByLabelText('Steam Web API key')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Advanced/ }))
    const input = screen.getByLabelText('Steam Web API key') as HTMLInputElement
    expect(input.type).toBe('password')
    expect(input.value).toBe('SECRETKEY')
    fireEvent.change(input, { target: { value: '  NEWKEY  ' } })
    fireEvent.blur(input)
    await waitFor(() => expect(g.setSettings).toHaveBeenCalledWith({ steamApiKey: 'NEWKEY' }))
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.blur(input)
    await waitFor(() => expect(g.setSettings).toHaveBeenCalledWith({ steamApiKey: null }))
  })

  it('does not delete when the confirmation is cancelled', async () => {
    const g = mockGizmo()
    await renderSettings()
    fireEvent.click(screen.getByRole('button', { name: 'Delete all local data' }))
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(g.deleteAllData).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(g.deleteAllData).not.toHaveBeenCalled()
  })

  it('deletes everything after confirming, then returns to Welcome', async () => {
    const g = mockGizmo()
    await renderSettings()
    fireEvent.click(screen.getByRole('button', { name: 'Delete all local data' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete everything' }))
    await waitFor(() => expect(g.deleteAllData).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('welcome'))
  })
})
