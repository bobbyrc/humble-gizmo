import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DEFAULT_SETTINGS } from '../../src/shared/types'
import { PRIVACY_TITLE } from '../../src/shared/copy'
import { mockGizmo } from './mockGizmo'
import App from '../../src/renderer/App'
import { gizmo } from '../../src/renderer/gizmo'

afterEach(cleanup)

async function renderApp(): Promise<void> {
  render(<App />)
}

describe('App', () => {
  it('shows Welcome when consent has not been shown', async () => {
    mockGizmo({ getSettings: vi.fn(async () => ({ ...DEFAULT_SETTINGS, consentShown: false })) })
    await renderApp()
    expect(await screen.findByRole('heading', { name: PRIVACY_TITLE })).toBeTruthy()
  })

  it('shows sign in when a service is signed out', async () => {
    mockGizmo({ status: vi.fn(async () => ({ humble: false, steam: true })) })
    await renderApp()
    expect(await screen.findByRole('heading', { name: 'Sign in to get started' })).toBeTruthy()
  })

  it('shows Redeem with a four-item sidebar when signed in', async () => {
    mockGizmo()
    await renderApp()
    expect(await screen.findByRole('heading', { name: 'Redeem' })).toBeTruthy()
    const nav = screen.getByRole('navigation')
    expect(nav.querySelectorAll('button').length).toBe(4)
    expect(screen.getByRole('button', { name: 'Humble Choice' })).toBeTruthy()
  })

  it('navigates to History', async () => {
    mockGizmo()
    await renderApp()
    await screen.findByRole('heading', { name: 'Redeem' })
    fireEvent.click(screen.getByRole('button', { name: 'History' }))
    expect(await screen.findByRole('heading', { name: 'History' })).toBeTruthy()
  })

  it('signs in from a signed-out sidebar row and refreshes status', async () => {
    let humble = true
    const api = mockGizmo({
      status: vi.fn(async () => ({ humble, steam: true })),
      signIn: vi.fn(async () => {
        humble = true
        return true
      })
    })
    await renderApp()
    await screen.findByRole('heading', { name: 'Redeem' })
    humble = false
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    const row = await screen.findByRole('button', { name: /Humble.*Signed out/ })
    fireEvent.click(row)
    expect(api.signIn).toHaveBeenCalledWith('humble')
    expect(await screen.findByText(/Humble.*Signed in/)).toBeTruthy()
  })

  it('shows a retryable error when startup loading fails', async () => {
    const getSettings = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue({ ...DEFAULT_SETTINGS, consentShown: true })
    mockGizmo({ getSettings })
    await renderApp()
    expect(await screen.findByText("Couldn't start. Try again.")).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('heading', { name: 'Redeem' })).toBeTruthy()
  })
})

describe('gizmo binding', () => {
  it('sees a mock installed after the module was imported', async () => {
    mockGizmo()
    const second = mockGizmo({ storageEncrypted: vi.fn(async () => false) })
    expect(await gizmo.storageEncrypted()).toBe(false)
    expect(second.storageEncrypted).toHaveBeenCalled()
  })
})
