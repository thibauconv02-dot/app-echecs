import { useEffect, useRef } from 'react'
import type { MoveClassification } from '../lib/classify'
import { sanToFrench } from '../lib/notation'
import { MoveBadge } from './MoveBadge'

interface Props {
  sans: string[]
  clocks: (number | null)[]
  moves: MoveClassification[] | null
  /** Current ply (0 = start position). */
  ply: number
  onSelect: (ply: number) => void
}

function formatClock(s: number | null): string {
  if (s === null) return ''
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

export function MoveList({ sans, clocks, moves, ply, onSelect }: Props) {
  const active = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    active.current?.scrollIntoView({ block: 'nearest' })
  }, [ply])

  const rows = []
  for (let i = 0; i < sans.length; i += 2) {
    rows.push(
      <div className="move-row" key={i}>
        <span className="move-number">{i / 2 + 1}.</span>
        {[i, i + 1].map((idx) =>
          idx < sans.length ? (
            <button
              key={idx}
              ref={ply === idx + 1 ? active : undefined}
              className={`move ${ply === idx + 1 ? 'current' : ''}`}
              onClick={() => onSelect(idx + 1)}
              data-testid={`move-${idx + 1}`}
            >
              {moves && <MoveBadge category={moves[idx].category} compact />}
              <span className="san">{sanToFrench(sans[idx])}</span>
              <span className="clock">{formatClock(clocks[idx])}</span>
            </button>
          ) : (
            <span key={idx} />
          ),
        )}
      </div>,
    )
  }
  return <div className="move-list" data-testid="move-list">{rows}</div>
}
