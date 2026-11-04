import { useRef, useState } from 'react'

/** Pixels one ArrowLeft / ArrowRight press moves the divider. */
const KEY_STEP = 16

/**
 * A vertical divider on a column head's left edge. Dragging or arrowing reports the
 * pixel change through onDelta; the parent decides the clamped result.
 */
export function ColumnResizer({
  label,
  value,
  min,
  max,
  onDelta,
  onReset
}: {
  label: string
  value: number
  min: number
  max: number
  onDelta: (dx: number) => void
  onReset: () => void
}): React.JSX.Element {
  const last = useRef<number | null>(null)
  const [dragging, setDragging] = useState(false)

  // Pointer capture keeps the moves coming even when the pointer leaves the 9px hit area;
  // the browser releases it on pointerup, so only the drag state needs clearing here.
  function endDrag(): void {
    last.current = null
    setDragging(false)
  }

  return (
    <span
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      className={dragging ? 'review-col-resizer is-dragging' : 'review-col-resizer'}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        last.current = e.clientX
        setDragging(true)
      }}
      onPointerMove={(e) => {
        if (last.current === null) return
        onDelta(e.clientX - last.current)
        last.current = e.clientX
      }}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={onReset}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') onDelta(-KEY_STEP)
        else if (e.key === 'ArrowRight') onDelta(KEY_STEP)
        else if (e.key === 'Home') onReset()
        else return
        e.preventDefault()
      }}
    />
  )
}
