import { afterEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { LibrarySummary } from '../../src/shared/ipc'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { serviceChanged } from '../../src/shared/copy'
import { bridgeError, mockGizmo } from './mockGizmo'
import { NavProvider, useNav } from '../../src/renderer/nav'
import SignIn from '../../src/renderer/screens/SignIn'
import { resetRunSession, takeFreshLibrary } from '../../src/renderer/runState'

afterEach(() => {
  cleanup()
  resetRunSession()
  vi.useRealTimers()
})

function Where(): React.JSX.Element {
  return <div data-testid="where">{useNav().screen}</div>
}

function renderSignIn(): void {
  render(
    <NavProvider initial="signin">
      <SignIn />
      <Where />
    </NavProvider>
  )
}

const out = { humble: false, steam: false }

function card(name: string): HTMLElement {
  return screen.getByRole('region', { name })
}

function signInButton(name: string): HTMLButtonElement {
  const buttons = card(name).querySelectorAll('button')
  return buttons[0] as HTMLButtonElement
}

describe('SignIn', () => {
  it('keeps each sign-in button independent while one is pending', async () => {
    let finish: (v: boolean) => void = () => undefined
    mockGizmo({
      status: vi.fn(async () => out),
      signIn: vi.fn(() => new Promise<boolean>((r) => (finish = r)))
    })
    renderSignIn()
    await screen.findByRole('region', { name: 'Humble Bundle' })
    expect(signInButton('Humble Bundle').disabled).toBe(false)
    expect(signInButton('Steam').disabled).toBe(false)
    fireEvent.click(signInButton('Humble Bundle'))
    await waitFor(() => expect(signInButton('Humble Bundle').disabled).toBe(true))
    expect(signInButton('Steam').disabled).toBe(false)
    await act(async () => finish(true))
  })

  it('re-checks status after sign in and loads the library once when both are in', async () => {
    const status = vi.fn(async () => out)
    const g = mockGizmo({ status })
    renderSignIn()
    await screen.findByRole('region', { name: 'Steam' })
    status.mockResolvedValue({ humble: true, steam: true })
    fireEvent.click(signInButton('Steam'))
    await waitFor(() => expect(g.loadLibrary).toHaveBeenCalledTimes(1))
    expect(g.signIn).toHaveBeenCalledWith('steam')
    expect(status).toHaveBeenCalledTimes(2)
  })

  it('shows the count and the failed-orders warning, then goes to review', async () => {
    const summary = { keys: 5, steamKeys: 3, failedOrders: 2 }
    mockGizmo({ loadLibrary: vi.fn(async () => summary) })
    renderSignIn()
    expect(await screen.findByText('Found 3 Steam keys')).toBeTruthy()
    expect(screen.getByText("Couldn't load 2 orders — try again later")).toBeTruthy()
    expect(screen.getByTestId('where').textContent).toBe('signin')
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('review'), {
      timeout: 3000
    })
    expect(takeFreshLibrary()).toEqual(summary)
  })

  it('shows no warning when no orders failed', async () => {
    mockGizmo({ loadLibrary: vi.fn(async () => ({ keys: 1, steamKeys: 1, failedOrders: 0 })) })
    renderSignIn()
    expect(await screen.findByText('Found 1 Steam key')).toBeTruthy()
    expect(screen.queryByText(/Couldn't load/)).toBeNull()
  })

  it('shows the service-changed copy and stays put', async () => {
    const g = mockGizmo({
      loadLibrary: vi.fn(async () => {
        throw bridgeError('ServiceChangedError', 'humble')
      })
    })
    renderSignIn()
    expect(await screen.findByText(serviceChanged('Humble'))).toBeTruthy()
    expect(screen.getByTestId('where').textContent).toBe('signin')
    fireEvent.click(screen.getByRole('button', { name: 'Get the latest version' }))
    expect(g.openExternal).toHaveBeenCalledWith('https://github.com/bobbyrc/humble-gizmo/releases')
  })

  it('retries loadLibrary after a generic failure', async () => {
    const loadLibrary = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue({ keys: 0, steamKeys: 0, failedOrders: 0 })
    mockGizmo({ loadLibrary })
    renderSignIn()
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(loadLibrary).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('Found 0 Steam keys')).toBeTruthy()
  })

  function expiredLoad(): Mock<() => Promise<LibrarySummary>> {
    return vi
      .fn<() => Promise<LibrarySummary>>()
      .mockRejectedValueOnce(bridgeError('SessionExpiredError', 'steam'))
      .mockResolvedValue({ keys: 1, steamKeys: 1, failedOrders: 0 })
  }

  it('reloads after the card Sign in following a session-expired failure', async () => {
    const loadLibrary = expiredLoad()
    const status = vi
      .fn()
      .mockResolvedValueOnce({ humble: true, steam: true })
      .mockResolvedValueOnce({ humble: true, steam: false })
      .mockResolvedValue({ humble: true, steam: true })
    mockGizmo({ status, loadLibrary })
    renderSignIn()
    await waitFor(() => expect(signInButton('Steam')).toBeTruthy())
    fireEvent.click(signInButton('Steam'))
    expect(await screen.findByText('Found 1 Steam key')).toBeTruthy()
    expect(loadLibrary).toHaveBeenCalledTimes(2)
  })

  it('reloads after the error banner Sign in', async () => {
    const loadLibrary = expiredLoad()
    const g = mockGizmo({ loadLibrary })
    renderSignIn()
    fireEvent.click(await screen.findByRole('button', { name: 'Sign in' }))
    await waitFor(() => expect(loadLibrary).toHaveBeenCalledTimes(2))
    expect(g.signIn).toHaveBeenCalledWith('steam')
  })

  it('offers Retry when the first status check fails', async () => {
    const status = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue({ humble: false, steam: false })
    mockGizmo({ status })
    renderSignIn()
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Sign in' })).toHaveLength(2))
  })

  it('hands nothing to Review when unmounted before the timer fires', async () => {
    mockGizmo({ loadLibrary: vi.fn(async () => ({ keys: 1, steamKeys: 1, failedOrders: 0 })) })
    renderSignIn()
    await screen.findByText('Found 1 Steam key')
    cleanup()
    await new Promise((r) => setTimeout(r, 1100))
    expect(takeFreshLibrary()).toBeNull()
  })
})
