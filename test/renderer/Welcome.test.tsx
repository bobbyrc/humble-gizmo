import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  NOT_AFFILIATED,
  PRIVACY_LINE_1,
  PRIVACY_LINE_2,
  PRIVACY_TITLE,
  UPDATE_TOGGLE,
  UPDATE_TOGGLE_NOTE
} from '../../src/shared/copy'
import { mockGizmo } from './mockGizmo'
import { NavProvider, useNav } from '../../src/renderer/nav'
import Welcome from '../../src/renderer/screens/Welcome'

afterEach(cleanup)

function Where(): React.JSX.Element {
  return <div data-testid="where">{useNav().screen}</div>
}

function renderWelcome(): void {
  render(
    <NavProvider initial="welcome">
      <Welcome />
      <Where />
    </NavProvider>
  )
}

describe('Welcome', () => {
  it('shows the exact privacy copy and an unchecked update toggle', () => {
    mockGizmo()
    renderWelcome()
    expect(screen.getByRole('heading', { name: PRIVACY_TITLE })).toBeTruthy()
    expect(screen.getByText(PRIVACY_LINE_1)).toBeTruthy()
    expect(screen.getByText(PRIVACY_LINE_2)).toBeTruthy()
    expect(screen.getByText(NOT_AFFILIATED)).toBeTruthy()
    expect(screen.getByText('You can change this any time in Settings.')).toBeTruthy()
    const box = screen.getByRole('checkbox') as HTMLInputElement
    expect(box.checked).toBe(false)
    expect(screen.getByText(UPDATE_TOGGLE, { exact: false })).toBeTruthy()
    expect(screen.getByText(UPDATE_TOGGLE_NOTE)).toBeTruthy()
  })

  it('Continue without ticking saves autoUpdate false and goes to sign in when signed out', async () => {
    const g = mockGizmo({ status: vi.fn(async () => ({ humble: true, steam: false })) })
    renderWelcome()
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('signin'))
    expect(g.setSettings).toHaveBeenCalledWith({ consentShown: true, autoUpdate: false })
  })

  it('Continue after ticking saves autoUpdate true and goes to review when signed in', async () => {
    const g = mockGizmo()
    renderWelcome()
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('review'))
    expect(g.setSettings).toHaveBeenCalledWith({ consentShown: true, autoUpdate: true })
  })

  it('shows a retry banner when Continue fails and Retry re-runs it', async () => {
    const g = mockGizmo()
    g.setSettings.mockRejectedValueOnce(new Error('boom'))
    renderWelcome()
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(await screen.findByText('Something went wrong. Try again.')).toBeTruthy()
    expect(screen.getByTestId('where').textContent).toBe('welcome')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('review'))
    expect(g.setSettings).toHaveBeenCalledTimes(2)
  })
})
