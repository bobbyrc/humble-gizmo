import { gizmo, errorName } from '../../gizmo'
import { serviceChanged } from '../../../shared/copy'
import { Banner } from '../ui'

/** The shared error banners from the screen addendum. */
export function ErrorBanner({
  error,
  onRetry
}: {
  error: unknown
  onRetry: () => void
}): React.JSX.Element {
  const name = errorName(error)
  const service = (error as { service?: 'humble' | 'steam' } | null)?.service ?? 'humble'
  const label = service === 'steam' ? 'Steam' : 'Humble'
  if (name === 'ServiceChangedError') {
    return (
      <Banner
        tone="danger"
        action={{
          label: 'Get the latest version',
          onClick: () => void gizmo.openExternal('https://github.com/bobbyrc/humble-gizmo/releases')
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
        action={{ label: 'Sign in', onClick: () => void gizmo.signIn(service) }}
      >
        Sign in to {label} again
      </Banner>
    )
  }
  return (
    <Banner tone="danger" action={{ label: 'Retry', onClick: onRetry }}>
      Something went wrong. Try again.
    </Banner>
  )
}
