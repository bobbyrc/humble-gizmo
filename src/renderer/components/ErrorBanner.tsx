import { serviceChanged } from '../../shared/copy'
import { errorName, errorService, gizmo } from '../gizmo'
import { Banner } from './ui'

const RELEASES_URL = 'https://github.com/bobbyrc/humble-gizmo/releases'

/** Runs a bridge call from a button; a rejection must not escape as an unhandled rejection. */
function fire(call: () => Promise<unknown>): void {
  call().catch(() => undefined)
}

/** The one error banner: service changed, session expired, or generic with a Retry. */
export default function ErrorBanner({
  error,
  onRetry,
  retryLabel = 'Retry',
  onSignIn
}: {
  error: unknown
  onRetry: () => void
  retryLabel?: string
  onSignIn?: (service: 'humble' | 'steam') => void
}): React.JSX.Element {
  const name = errorName(error)
  const service = errorService(error) ?? 'humble'
  const label = service === 'steam' ? 'Steam' : 'Humble'
  if (name === 'ServiceChangedError') {
    return (
      <Banner
        tone="danger"
        action={{
          label: 'Get the latest version',
          onClick: () => fire(async () => gizmo.openExternal(RELEASES_URL))
        }}
      >
        {serviceChanged(label)}
      </Banner>
    )
  }
  if (name === 'SessionExpiredError') {
    return (
      <Banner
        tone="danger"
        action={{
          label: 'Sign in',
          onClick: () => (onSignIn ? onSignIn(service) : fire(async () => gizmo.signIn(service)))
        }}
      >
        {`Sign in to ${label} again`}
      </Banner>
    )
  }
  return (
    <Banner tone="danger" action={{ label: retryLabel, onClick: onRetry }}>
      Something went wrong. Try again.
    </Banner>
  )
}
