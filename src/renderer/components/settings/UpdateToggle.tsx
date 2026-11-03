import { UPDATE_TOGGLE, UPDATE_TOGGLE_NOTE } from '../../../shared/copy'
import { Checkbox } from '../ui'
import './settings.css'

/** The "check for updates" checkbox and its note, shared by Welcome and Settings. */
export default function UpdateToggle({
  checked,
  onChange
}: {
  checked: boolean
  onChange: (checked: boolean) => void
}): React.JSX.Element {
  return (
    <Checkbox
      checked={checked}
      onChange={onChange}
      label={
        <>
          {UPDATE_TOGGLE} <span className="muted">{UPDATE_TOGGLE_NOTE}</span>
        </>
      }
    />
  )
}
