import { useEffect, useMemo, useState } from 'react'
import { Chess } from 'chess.js'
import { Board, type BoardMove } from '../components/Board'
import { OPPONENT_MOVE_DELAY_MS } from '../config/trainer'
import { sanToFrench } from '../lib/notation'
import type { RepLine, RepMove } from '../repertoire/parse'

const HINT_COLOR = 'rgba(0, 110, 200, 0.75)'

/** Display a repertoire move in French with its annotation (Cf3!). */
export function repMoveLabel(m: RepMove): string {
  return sanToFrench(m.san) + (m.annotation ?? '')
}

interface Props {
  line: RepLine
  /** Called once the line is complete. success = no wrong move and no hint. */
  onFinish: (success: boolean) => void
}

/**
 * Plays one repertoire line: the app plays the opponent's moves, the user must find each of his moves.
 * A wrong move is refused and the expected move is shown; the user then plays it to go on.
 */
export function LinePlayer({ line, onFinish }: Props) {
  const [ply, setPly] = useState(0)
  const [failed, setFailed] = useState(false)
  const [reveal, setReveal] = useState<{ wrong: string | null } | null>(null)
  const myParity = line.color === 'white' ? 0 : 1
  const done = ply >= line.moves.length
  const myTurn = !done && ply % 2 === myParity

  const positions = useMemo(() => {
    const c = new Chess()
    const fens = [c.fen()]
    const squares: { from: string; to: string }[] = []
    for (const m of line.moves) {
      const mv = c.move(m.san)
      squares.push({ from: mv.from, to: mv.to })
      fens.push(c.fen())
    }
    return { fens, squares }
  }, [line])

  // The app plays the opponent's moves after a short delay.
  useEffect(() => {
    if (done || myTurn) return
    const t = setTimeout(() => setPly((p) => p + 1), OPPONENT_MOVE_DELAY_MS)
    return () => clearTimeout(t)
  }, [ply, done, myTurn])

  // Finish: notify once when the last (my) move has been played.
  useEffect(() => {
    if (done) onFinish(!failed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done])

  function onMove(m: BoardMove): boolean {
    if (!myTurn) return false
    const expected = positions.squares[ply]
    const c = new Chess(positions.fens[ply])
    let played: string
    try {
      played = c.move(m).san
    } catch {
      return false
    }
    if (played === line.moves[ply].san || (m.from === expected.from && m.to === expected.to)) {
      setReveal(null)
      setPly(ply + 1)
      return true
    }
    setFailed(true)
    setReveal({ wrong: played })
    return false
  }

  function hint() {
    setFailed(true)
    setReveal({ wrong: null })
  }

  const expectedMove = myTurn ? line.moves[ply] : null
  const arrows =
    reveal && myTurn
      ? [{ startSquare: positions.squares[ply].from, endSquare: positions.squares[ply].to, color: HINT_COLOR }]
      : []
  const lastMove = ply > 0 ? positions.squares[ply - 1] : null
  const lastPlayed = ply > 0 ? line.moves[ply - 1] : null

  return (
    <div className="screen-row">
      <Board fen={positions.fens[ply]} orientation={line.color} onMove={onMove} lastMove={lastMove} arrows={arrows} />
      <aside className="side-panel trainer-panel">
        <div className="muted small">{line.opening} · {line.color === 'white' ? 'avec les Blancs' : 'avec les Noirs'}</div>
        <h3 className="chapter">{line.chapter}</h3>

        <div className="trainer-feedback" data-testid="trainer-feedback">
          {done ? (
            failed ? (
              <span className="ko">Ligne terminée, avec au moins une erreur : elle reviendra demain.</span>
            ) : (
              <span className="ok">✓ Ligne réussie sans faute !</span>
            )
          ) : reveal && expectedMove ? (
            <span className="ko">
              {reveal.wrong ? <>✗ {sanToFrench(reveal.wrong)} n’est pas dans ton répertoire. </> : null}
              Le répertoire prévoit <strong>{repMoveLabel(expectedMove)}</strong> (flèche bleue). Joue-le pour continuer.
            </span>
          ) : myTurn ? (
            <span>À toi de jouer : quel est ton coup ?</span>
          ) : (
            <span className="muted">L’adversaire joue…</span>
          )}
        </div>
        {lastPlayed?.comment && <p className="rep-comment">« {lastPlayed.comment} »</p>}

        <ol className="trainer-moves" data-testid="trainer-moves">
          {Array.from({ length: Math.ceil(ply / 2) }, (_, i) => (
            <li key={i}>
              {[2 * i, 2 * i + 1].map((k) =>
                k < ply ? (
                  <span key={k} className={k % 2 === myParity ? 'mine' : ''}>
                    {repMoveLabel(line.moves[k])}{' '}
                  </span>
                ) : null,
              )}
            </li>
          ))}
        </ol>

        {!done && (
          <button onClick={hint} disabled={!myTurn || reveal !== null} data-testid="hint">
            Indice (compte comme une erreur)
          </button>
        )}
      </aside>
    </div>
  )
}
