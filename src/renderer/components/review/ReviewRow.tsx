import type { ReviewItem } from '../../../shared/types'
import { UNREVEALED_LABEL } from '../../../shared/copy'
import { Checkbox, Pill } from '../ui'

export function ReviewRow({
  item,
  ticked,
  onToggle
}: {
  item: ReviewItem
  ticked: boolean
  onToggle: (checked: boolean) => void
}): React.JSX.Element {
  const { reasons, key } = item
  const from = [key.bundle, key.purchased?.slice(0, 4)].filter(Boolean).join(' · ') || '—'
  // The row is a grid; the Checkbox wrapper is display: contents so input and label take columns 1-2.
  return (
    <>
      <Checkbox checked={ticked} disabled={!item.tickable} onChange={onToggle} label={key.name} />
      <span className="data review-row-from" title={from}>
        {from}
      </span>
      <span className="review-row-pills">
        {reasons.includes('unrevealed') && <Pill tone="warn">{UNREVEALED_LABEL}</Pill>}
        {reasons.includes('duplicate') && <Pill tone="muted">duplicate</Pill>}
        {item.group === 'maybe_owned' && item.matchedName && (
          <Pill tone="muted">matches {item.matchedName}</Pill>
        )}
        {item.group === 'failed_before' && reasons.includes('terminal_error') && (
          <Pill tone="danger">won&apos;t work</Pill>
        )}
        {item.group === 'failed_before' && reasons.includes('retryable_error') && (
          <Pill tone="danger">tick to retry</Pill>
        )}
      </span>
    </>
  )
}
