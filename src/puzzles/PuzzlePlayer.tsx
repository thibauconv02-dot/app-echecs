import { useEffect, useMemo, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import { Board, type BoardMove } from '../components/Board'
import { ALT_TOLERANCE, VERIFY_DEPTH } from '../config/puzzles'
import { OPPONENT_MOVE_DELAY_MS } from '../config/trainer'
import { getEngine } from '../engine/engine'
import { sanToFrench } from '../lib/notation'
import { winPercent } from '../lib/winPercent'
import type { Puzzle } from './types'

const ARROW = 'rgba(0, 110, 200, 0.75)'

type Status = 'intro' | 'solve' | 'checking' | 'reply' | 'done'

export interface PuzzleResult {
  success: boolean
}

function toUci(m: { from: string; to: string; promotion?: string }) {
  return m.from + m.to + (m.promotion ?? '')
}

/** Replay UCI moves from a FEN; returns the FENs and SANs. */
function replay(fen: string, ucis: string[]) {
  const c = new Chess(fen)
  const fens = [c.fen()]
  const sans: string[] = []
  const squares: { from: string; to: string }[] = []
  for (const u of ucis) {
    const m = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] })
    sans.push(m.san)
    squares.push({ from: m.from, to: m.to })
    fens.push(c.fen())
  }
  return { fens, sans, squares }
}

/**
 * One puzzle: the opponent's move is animated, then I must find my move(s).
 * Any move within ALT_TOLERANCE of the best is accepted (checked by Stockfish if needed).
 */
export function PuzzlePlayer({ puzzle, onFinish }: { puzzle: Puzzle; onFinish: (r: PuzzleResult) => void }) {
  /** Full expected sequence from fenBefore: opponent move, then the solution line. */
  const expected = useMemo(() => [puzzle.opponentMove, ...puzzle.line], [puzzle])
  const [moves, setMoves] = useState<string[]>([]) // UCI actually on the board, from fenBefore
  const [status, setStatus] = useState<Status>('intro')
  const [failed, setFailed] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [reveal, setReveal] = useState(false)
  const [altNote, setAltNote] = useState<string | null>(null)
  const finished = useRef(false)

  const board = useMemo(() => replay(puzzle.fenBefore, moves), [puzzle, moves])
  const fen = board.fens.at(-1)!
  const k = moves.length // index of the next expected move
  const step = Math.floor((k - 1) / 2) // my step number (0-based)
  const mySteps = puzzle.stepWins.length

  // Animate the opponent's move that creates the puzzle.
  useEffect(() => {
    const t = setTimeout(() => {
      setMoves([puzzle.opponentMove])
      setStatus('solve')
    }, OPPONENT_MOVE_DELAY_MS + 300)
    return () => clearTimeout(t)
  }, [puzzle])

  function finish(success: boolean) {
    setStatus('done')
    setReveal(false)
    if (!finished.current) {
      finished.current = true
      onFinish({ success })
    }
  }

  function advance(played: string[]) {
    setMoves(played)
    setReveal(false)
    setMessage(null)
    if (played.length >= expected.length) return finish(!failed)
    setStatus('reply')
    setTimeout(() => {
      setMoves([...played, expected[played.length]])
      setStatus('solve')
    }, OPPONENT_MOVE_DELAY_MS)
  }

  function acceptAlternative(uci: string, san: string) {
    setMoves([...moves, uci])
    const best = replay(fen, [expected[k]]).sans[0]
    setAltNote(`${sanToFrench(san)} marche aussi ! Stockfish préférait ${sanToFrench(best)}.`)
    finish(!failed)
  }

  async function check(uci: string, san: string) {
    setStatus('checking')
    setMessage('Vérification par Stockfish…')
    try {
      const [line] = await getEngine().analyse(fen, VERIFY_DEPTH, { searchMoves: [uci] })
      if (line && puzzle.stepWins[step] - winPercent(line) <= ALT_TOLERANCE) {
        setMessage(null)
        acceptAlternative(uci, san)
        return
      }
    } catch {
      /* engine unavailable: treat as wrong */
    }
    fail(`✗ ${sanToFrench(san)} ne marche pas.`)
  }

  function fail(text: string) {
    setFailed(true)
    setReveal(true)
    setMessage(`${text} Le bon coup est indiqué par la flèche : joue-le pour continuer.`)
    setStatus('solve')
  }

  function onMove(m: BoardMove): boolean {
    if (status !== 'solve' || k % 2 === 0) return false
    const c = new Chess(fen)
    let san: string
    try {
      san = c.move(m).san
    } catch {
      return false
    }
    const uci = toUci({ ...m, promotion: m.promotion })
    const expectedUci = expected[k]
    if (uci === expectedUci || uci.slice(0, 4) === expectedUci.slice(0, 4)) {
      advance([...moves, expectedUci])
      return true
    }
    if (reveal) return false // after a mistake, only the shown move continues
    if (step === 0 && puzzle.alternatives.includes(uci)) {
      acceptAlternative(uci, san)
      return true
    }
    if (step === 0 && uci === puzzle.played.uci) {
      fail(`✗ C’est le coup joué dans la partie, et il était mauvais.`)
      return false
    }
    void check(uci, san)
    return false
  }

  const isPunish = puzzle.type === 'punish'
  const oppSan = board.sans[0] ? sanToFrench(board.sans[0]) : ''
  const arrows = reveal && status === 'solve' ? [{ startSquare: expected[k].slice(0, 2), endSquare: expected[k].slice(2, 4), color: ARROW }] : []
  const lastMove = board.squares.at(-1) ?? null
  const playedSan = sanToFrench(puzzle.played.san)

  let prompt: string
  if (status === 'intro') prompt = 'L’adversaire joue…'
  else if (status === 'done') prompt = failed ? 'Puzzle raté : il reviendra demain.' : '✓ Puzzle réussi !'
  else if (status === 'reply') prompt = 'L’adversaire répond…'
  else if (k === 1) prompt = isPunish ? `L’adversaire vient de jouer ${oppSan}, une grosse erreur. Punis-la !` : `L’adversaire a joué ${oppSan}. Trouve le bon coup, sans gaffer.`
  else prompt = 'Bien ! Continue : trouve le coup suivant.'

  return (
    <div className="screen-row">
      <Board fen={fen} orientation={puzzle.color} onMove={onMove} lastMove={lastMove} arrows={arrows} />
      <aside className="side-panel trainer-panel" data-testid="puzzle" data-id={puzzle.id}>
        <div>
          <span className="badge" style={{ backgroundColor: isPunish ? '#5c9a2e' : '#d03a2c' }}>
            {isPunish ? 'Punis la gaffe' : 'Évite la gaffe'}
          </span>{' '}
          <span className="muted small">
            {puzzle.family} · {puzzle.color === 'white' ? 'Blancs' : 'Noirs'}
            {mySteps > 1 && ` · ${mySteps} coups à trouver`}
          </span>
        </div>
        <div className="trainer-feedback" data-testid="puzzle-feedback">
          <div className={status === 'done' ? (failed ? 'ko' : 'ok') : ''}>{prompt}</div>
          {message && <div className={status === 'checking' ? 'muted' : 'ko'}>{message}</div>}
          {altNote && <div className="ok">{altNote}</div>}
        </div>
        {status === 'done' && (
          <div className="puzzle-explain" data-testid="puzzle-explain">
            <p>
              Solution : <strong>{board.sans.slice(1).length ? replay(puzzle.fen, puzzle.line).sans.map(sanToFrench).join(' ') : ''}</strong>
              {puzzle.continuation.length > 0 && <span className="muted"> puis {puzzle.continuation.map(sanToFrench).join(' ')}…</span>}
            </p>
            <p>
              Dans la partie, tu as joué <strong>{playedSan}</strong> : tes chances de gain sont passées à {Math.round(puzzle.played.win)} % au
              lieu de {Math.round(puzzle.stepWins[0])} %.
            </p>
          </div>
        )}
      </aside>
    </div>
  )
}
