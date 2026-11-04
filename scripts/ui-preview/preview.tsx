import { fakeGizmo } from './fakeGizmo'

const params = new URLSearchParams(location.search)
const scenario = params.get('s') ?? 'review'
;(window as unknown as { gizmo: unknown }).gizmo = fakeGizmo(scenario)
await import('../../src/renderer/main.tsx')

// go=run clicks the primary header action; go=<label> clicks the first nav item or button whose text starts with it.
const go = params.get('go')?.trim().toLowerCase()
if (go) {
  const matchesLabel = (el: Element): boolean =>
    (el.textContent ?? '').trim().toLowerCase().startsWith(go)
  const findTarget = (): HTMLElement | undefined => {
    if (go === 'run') {
      return [
        ...document.querySelectorAll<HTMLButtonElement>('.screen-header-actions .btn-primary')
      ].find((b) => !b.disabled)
    }
    return (
      [...document.querySelectorAll<HTMLElement>('.nav-item')].find(matchesLabel) ??
      [...document.querySelectorAll<HTMLElement>('button')].find(matchesLabel)
    )
  }
  let ticks = 0
  const timer = setInterval(() => {
    const target = findTarget()
    if (target || ++ticks >= 50) clearInterval(timer)
    target?.click()
  }, 100)
}
