import { useMemo, useState } from 'react'
import { Chess } from 'chess.js'
import { Board, type BoardMove } from '../components/Board'
import { sanToFrench } from '../lib/notation'

/** Free play: both sides are played by the user. Game state = list of SAN moves (English, internal). */
export function FreePlayScreen() {
  const [moves, setMoves] = useState<string[]>([])
  const [orientation, setOrientation] = useState<'white' | 'black'>('white')

  const game = useMemo(() => {
    const c = new Chess()
    for (const san of moves) c.move(san)
    return c
  }, [moves])

  const history = game.history({ verbose: true })
  const last = history.at(-1)

  function onMove(m: BoardMove): boolean {
    const c = new Chess(game.fen())
    try {
      const played = c.move(m)
      setMoves([...moves, played.san])
      return true
    } catch {
      return false
    }
  }

  let status = game.turn() === 'w' ? 'Trait aux Blancs' : 'Trait aux Noirs'
  if (game.isCheckmate()) status = `Échec et mat — ${game.turn() === 'w' ? 'les Noirs' : 'les Blancs'} gagnent`
  else if (game.isDraw()) status = 'Partie nulle'
  else if (game.inCheck()) status += ' (échec)'

  return (
    <div className="screen-row">
      <Board fen={game.fen()} orientation={orientation} onMove={onMove} lastMove={last ? { from: last.from, to: last.to } : null} />
      <aside className="side-panel">
        <h2>Jeu libre</h2>
        <p data-testid="status">{status}</p>
        <div className="buttons">
          <button onClick={() => setMoves(moves.slice(0, -1))} disabled={moves.length === 0}>↶ Annuler</button>
          <button onClick={() => setOrientation(orientation === 'white' ? 'black' : 'white')}>⇅ Retourner</button>
          <button onClick={() => setMoves([])}>Nouvelle partie</button>
        </div>
        <ol className="free-moves" data-testid="free-moves">
          {pairMoves(moves).map(([w, b], i) => (
            <li key={i}>{sanToFrench(w)} {b ? sanToFrench(b) : ''}</li>
          ))}
        </ol>
      </aside>
    </div>
  )
}

function pairMoves(sans: string[]): [string, string | undefined][] {
  const out: [string, string | undefined][] = []
  for (let i = 0; i < sans.length; i += 2) out.push([sans[i], sans[i + 1]])
  return out
}
