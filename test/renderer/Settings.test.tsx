import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DEFAULT_SETTINGS } from '../../src/shared/types'
import {
  CHECK_UPDATES_NOW,
  NOT_AFFILIATED,
  NO_KEYRING_NOTICE,
  UPDATE_TOGGLE
} from '../../src/shared/copy'
import { bridgeError, mockGizmo } from './mockGizmo'
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

  it('rolls back and shows a retry banner when saving fails, then retries', async () => {
    const g = mockGizmo()
    await renderSettings()
    g.setSettings.mockRejectedValueOnce(new Error('boom'))
    const box = screen.getByLabelText('Launch at login') as HTMLInputElement
    fireEvent.click(box)
    expect(await screen.findByText('Something went wrong. Try again.')).toBeTruthy()
    expect(box.checked).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(box.checked).toBe(true))
    expect(screen.queryByText('Something went wrong. Try again.')).toBeNull()
  })

  it('shows the session-expired banner for a SessionExpiredError', async () => {
    const err = bridgeError('SessionExpiredError', 'steam')
    const g = mockGizmo({ signOut: vi.fn(async () => Promise.reject(err)) })
    await renderSettings()
    fireEvent.click(screen.getByRole('button', { name: 'Sign out of Steam' }))
    expect(await screen.findByText('Sign in to Steam again')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(g.signIn).toHaveBeenCalledWith('steam')
  })

  it('shows the service-changed banner with a releases link', async () => {
    const err = bridgeError('ServiceChangedError', 'humble')
    const g = mockGizmo({ signOut: vi.fn(async () => Promise.reject(err)) })
    await renderSettings()
    fireEvent.click(screen.getByRole('button', { name: 'Sign out of Humble' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Get the latest version' }))
    expect(g.openExternal).toHaveBeenCalledWith(RELEASES)
  })

  it('shows a retry banner when sign out fails and retries it', async () => {
    const g = mockGizmo()
    await renderSettings()
    g.signOut.mockRejectedValueOnce(new Error('boom'))
    fireEvent.click(screen.getByRole('button', { name: 'Sign out of Humble' }))
    expect(await screen.findByText('Something went wrong. Try again.')).toBeTruthy()
    expect(screen.queryByText('Signed out')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Signed out')).toBeTruthy()
    expect(g.signOut).toHaveBeenCalledTimes(2)
  })

  it('stays on Settings with a retry banner when delete fails', async () => {
    const g = mockGizmo()
    await renderSettings()
    g.deleteAllData.mockRejectedValueOnce(new Error('boom'))
    fireEvent.click(screen.getByRole('button', { name: 'Delete all local data' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete everything' }))
    expect(await screen.findByText('Something went wrong. Try again.')).toBeTruthy()
    expect(screen.getByTestId('where').textContent).toBe('settings')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('welcome'))
    expect(g.deleteAllData).toHaveBeenCalledTimes(2)
  })

  it('shows a retry banner when loading fails and reloads', async () => {
    const g = mockGizmo()
    g.getSettings.mockRejectedValueOnce(new Error('boom'))
    render(
      <NavProvider initial="settings">
        <Settings />
      </NavProvider>
    )
    expect(await screen.findByText('Something went wrong. Try again.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('button', { name: CHECK_UPDATES_NOW })).toBeTruthy()
  })

  it('shows the app version from the build', async () => {
    vi.stubEnv('VITE_APP_VERSION', '1.2.3')
    mockGizmo()
    await renderSettings()
    expect(screen.getByText('Version 1.2.3')).toBeTruthy()
    vi.unstubAllEnvs()
  })
})
