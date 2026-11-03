import { useState } from 'react'
import type { ChoiceGame, ChoiceMonth } from '../../../shared/types'
import { gizmo } from '../../gizmo'
import { Button, Checkbox, ConfirmDialog } from '../ui'
import './choice.css'

function ratingText(rating: ChoiceGame['rating']): string | null {
  if (!rating) return null
  if (rating.percent === null) return rating.text
  return `${rating.text} · ${Math.round(rating.percent * 100)}%`
}

export function MonthCard({
  month,
  busy,
  onClaim
}: {
  month: ChoiceMonth
  busy: boolean
  onClaim: (month: ChoiceMonth, identifiers: string[]) => Promise<void>
}): React.JSX.Element {
  const [picked, setPicked] = useState<string[]>([])
  const [confirming, setConfirming] = useState(false)

  const claimable = month.games.filter((g) => g.claimable)
  const limit = month.usesChoices ? month.choicesRemaining : Infinity
  const atLimit = picked.length >= limit
  const canClaimAll = !month.usesChoices || month.choicesRemaining >= claimable.length
  const k = picked.length

  function toggle(id: string, on: boolean): void {
    setPicked((p) =>
      on ? (p.includes(id) || p.length >= limit ? p : [...p, id]) : p.filter((x) => x !== id)
    )
  }

  return (
    <section className="choice-month">
      <header className="choice-month-header">
        <h2 className="choice-month-name">{month.name}</h2>
        <span className="choice-muted">
          {month.usesChoices
            ? `Pick up to ${month.choicesRemaining} (${k} picked)`
            : `Claim all ${claimable.length} games`}
        </span>
      </header>
      <ul className="choice-games">
        {month.games.map((g) => {
          const rating = ratingText(g.rating)
          return (
            <li key={g.identifier} className="choice-game">
              {g.claimable ? (
                <Checkbox
                  checked={picked.includes(g.identifier)}
                  disabled={busy || (atLimit && !picked.includes(g.identifier))}
                  onChange={(on) => toggle(g.identifier, on)}
                  label={g.title}
                />
              ) : (
                <>
                  <span className="choice-title">{g.title}</span>
                  <Button
                    variant="link"
                    onClick={() =>
                      void gizmo.openExternal(
                        `https://www.humblebundle.com/subscription/${month.choiceUrl}/${g.identifier}`
                      )
                    }
                  >
                    Claim on Humble
                  </Button>
                </>
              )}
              {rating && <span className="choice-muted">{rating}</span>}
            </li>
          )
        })}
      </ul>
      <footer className="choice-footer">
        {canClaimAll && (
          <Button
            variant="link"
            disabled={busy}
            onClick={() => setPicked(claimable.map((g) => g.identifier))}
          >
            Claim all
          </Button>
        )}
        <Button disabled={busy || k === 0} onClick={() => setConfirming(true)}>
          {`Claim ${k}`}
        </Button>
      </footer>
      <ConfirmDialog
        open={confirming}
        title="Claim games"
        body={`Claiming can't be undone. Claim ${k} games from ${month.name}?`}
        confirmLabel={`Claim ${k}`}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false)
          void onClaim(month, picked).then(() => setPicked([]))
        }}
      />
    </section>
  )
}
