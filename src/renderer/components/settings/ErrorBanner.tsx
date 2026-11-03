import { serviceChanged } from '../../../shared/copy'
import { errorName, gizmo } from '../../gizmo'
import { Banner } from '../ui'

const RELEASES_URL = 'https://github.com/bobbyrc/humble-gizmo/releases'

/** Error banner per the screen addendum: service changed, session expired, or generic with Retry. */
export default function ErrorBanner({
  error,
  onRetry
}: {
  error: unknown
  onRetry: () => void
}): React.JSX.Element {
  const name = errorName(error)
  const service = (error as { service?: string })?.service
  const label = service === 'steam' ? 'Steam' : 'Humble'
  if (name === 'ServiceChangedError') {
    return (
      <Banner
        tone="danger"
        action={{
          label: 'Get the latest version',
          onClick: () => void gizmo.openExternal(RELEASES_URL)
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
          onClick: () => void gizmo.signIn(service === 'steam' ? 'steam' : 'humble')
        }}
      >
        {`Sign in to ${label} again`}
      </Banner>
    )
  }
  return (
    <Banner tone="danger" action={{ label: 'Retry', onClick: onRetry }}>
      Something went wrong. Try again.
    </Banner>
  )
}
