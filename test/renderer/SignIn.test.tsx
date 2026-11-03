import { afterEach, describe, expect, it, vi } from 'vitest'
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
    mockGizmo({
      loadLibrary: vi.fn(async () => {
        throw bridgeError('ServiceChangedError', 'humble')
      })
    })
    renderSignIn()
    expect(await screen.findByText(serviceChanged('Humble'))).toBeTruthy()
    expect(screen.getByTestId('where').textContent).toBe('signin')
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
  })
})
