import { useEffect, useRef, useState } from 'react'
import './review.css'

export const ROW_HEIGHT = 44
const BUFFER = 10
const FALLBACK_HEIGHT = 600

/** Renders only the rows in view (plus a buffer) of a fixed-height-row list. */
export function VirtualRows<T>({
  items,
  renderRow,
  itemKey,
  viewportHeight
}: {
  items: T[]
  renderRow: (item: T) => React.ReactNode
  itemKey: (item: T) => string
  viewportHeight?: number
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [measured, setMeasured] = useState(0)

  useEffect(() => {
    const measure = (): void => setMeasured(ref.current?.clientHeight ?? 0)
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const height = viewportHeight ?? (measured > 0 ? measured : FALLBACK_HEIGHT)
  const first = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER)
  const last = Math.min(items.length, Math.ceil((scrollTop + height) / ROW_HEIGHT) + BUFFER)
  const visible = items.slice(first, last)

  return (
    <div
      ref={ref}
      className="vrows"
      role="list"
      style={viewportHeight ? { maxHeight: viewportHeight } : undefined}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div className="vrows-spacer" style={{ height: items.length * ROW_HEIGHT }}>
        {visible.map((item, i) => (
          <div
            key={itemKey(item)}
            role="listitem"
            aria-setsize={items.length}
            aria-posinset={first + i + 1}
            className="review-row"
            style={{ top: (first + i) * ROW_HEIGHT }}
          >
            {renderRow(item)}
          </div>
        ))}
      </div>
    </div>
  )
}
