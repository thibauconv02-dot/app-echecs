import { useEffect, useMemo, useState } from 'react'
import { Chess } from 'chess.js'
import { db, type AnalysisRecord, type GameRecord } from '../db/db'
import { Board, BOARD_COLORS } from '../components/Board'
import { EvalBar, whiteView } from '../components/EvalBar'
import { MoveList } from '../components/MoveList'
import { MoveBadge } from '../components/MoveBadge'
import { GameSummary } from '../components/GameSummary'
import { analyseGame, gameFens } from '../services/analysis'
import { getEngine } from '../engine/engine'
import { ANALYSIS_DEPTH, CATEGORY_INFO } from '../config/classification'
import { sanToFrench } from '../lib/notation'

const BOARD_SIZE = 560
const OUTCOME_LABELS = { win: 'Gain', loss: 'Perte', draw: 'Nulle' } as const

export function GameViewScreen({ gameId, onBack }: { gameId: string; onBack: () => void }) {
  const [game, setGame] = useState<GameRecord | null>(null)
  const [analysis, setAnalysis] = useState<AnalysisRecord | null>(null)
  const [ply, setPly] = useState(0)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [orientation, setOrientation] = useState<'white' | 'black'>('white')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [g, a] = await Promise.all([db.games.get(gameId), db.analyses.get(gameId)])
      if (cancelled || !g) return
      setGame(g)
      setAnalysis(a ?? null)
      setOrientation(g.myColor)
      setPly(0)
    })()
    return () => {
      cancelled = true
    }
  }, [gameId])

  const fens = useMemo(() => (game ? gameFens(game) : []), [game])
  const lastPly = fens.length - 1

  // Keyboard navigation: ← / → move by move, Home / End.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
      if (e.key === 'ArrowLeft') setPly((p) => Math.max(0, p - 1))
      else if (e.key === 'ArrowRight') setPly((p) => Math.min(lastPly, p + 1))
      else if (e.key === 'Home') setPly(0)
      else if (e.key === 'End') setPly(lastPly)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lastPly])

  async function runAnalysis() {
    if (!game) return
    setError(null)
    setProgress({ done: 0, total: fens.length })
    try {
      const a = await analyseGame(db, getEngine(), game, ANALYSIS_DEPTH, (done, total) => setProgress({ done, total }))
      setAnalysis(a)
      setGame({ ...game, analysedDepth: a.depth })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setProgress(null)
    }
  }

  if (!game) return <p className="muted">Chargement…</p>

  const fen = fens[ply]
  const whiteToMove = new Chess(fen).turn() === 'w'
  const view = analysis ? whiteView(analysis.evals[ply], whiteToMove) : null
  const current = analysis && ply > 0 ? analysis.moves[ply - 1] : null

  let lastMove: { from: string; to: string } | null = null
  if (ply > 0) {
    const m = new Chess(fens[ply - 1]).move(game.sans[ply - 1])
    lastMove = { from: m.from, to: m.to }
  }

  // Best-move arrow on mistakes and blunders (move that should have been played instead).
  const showBest = current && (current.category === 'mistake' || current.category === 'blunder') && current.bestMove
  const arrows = showBest
    ? [{ startSquare: current.bestMove!.slice(0, 2), endSquare: current.bestMove!.slice(2, 4), color: BOARD_COLORS.bestMoveArrow }]
    : []

  const names = { white: game.white.username, black: game.black.username }
  const moveNumber = current ? `${Math.ceil(current.ply / 2)}.${current.color === 'black' ? '..' : ''}` : ''

  return (
    <div>
      <div className="game-header">
        <button onClick={onBack}>← Mes parties</button>
        <strong>
          {game.white.username} ({game.white.rating}) – {game.black.username} ({game.black.rating})
        </strong>
        <span className={`outcome ${game.outcome}`}>{OUTCOME_LABELS[game.outcome]}</span>
        <span className="muted">
          {new Date(game.endTime * 1000).toLocaleDateString('fr-FR')} · {game.eco} {game.opening}
        </span>
        <a href={game.url} target="_blank" rel="noreferrer">Voir sur Chess.com</a>
      </div>

      <div className="screen-row">
        <EvalBar view={view} orientation={orientation} height={BOARD_SIZE} />
        <div>
          <Board fen={fen} orientation={orientation} lastMove={lastMove} arrows={arrows} width={BOARD_SIZE} />
          <div className="nav-buttons">
            <button onClick={() => setPly(0)} title="Début">⏮</button>
            <button onClick={() => setPly(Math.max(0, ply - 1))} title="←">◀</button>
            <button onClick={() => setPly(Math.min(lastPly, ply + 1))} title="→">▶</button>
            <button onClick={() => setPly(lastPly)} title="Fin">⏭</button>
            <button onClick={() => setOrientation(orientation === 'white' ? 'black' : 'white')}>⇅ Retourner</button>
          </div>
        </div>

        <aside className="side-panel game-panel">
          {!analysis && !progress && (
            <button className="primary" onClick={runAnalysis} data-testid="analyse">
              Analyser (profondeur {ANALYSIS_DEPTH})
            </button>
          )}
          {progress && (
            <div data-testid="analysis-progress">
              <progress value={progress.done} max={progress.total} /> Analyse : position {progress.done}/{progress.total}
            </div>
          )}
          {error && <p className="error">Erreur : {error}</p>}

          <div className="move-comment" data-testid="move-comment">
            {current ? (
              <>
                <MoveBadge category={current.category} />{' '}
                <strong>
                  {moveNumber} {sanToFrench(current.san)}
                </strong>{' '}
                {current.category !== 'best' && current.category !== 'theory' && (
                  <span className="muted">(−{current.loss.toFixed(1)} %)</span>
                )}
                {showBest && current.bestMoveSan && (
                  <div>
                    Meilleur coup : <strong>{sanToFrench(current.bestMoveSan)}</strong> (flèche bleue)
                  </div>
                )}
              </>
            ) : (
              <span className="muted">
                {analysis ? (ply === 0 ? 'Position initiale' : '') : 'Partie non analysée.'} · ← → pour naviguer
              </span>
            )}
          </div>

          <MoveList sans={game.sans} clocks={game.clocks} moves={analysis?.moves ?? null} ply={ply} onSelect={setPly} />

          {analysis && (
            <>
              <h3>Résumé</h3>
              <GameSummary moves={analysis.moves} myColor={game.myColor} names={names} />
              <p className="muted small">
                Précision = 100 − perte moyenne de pourcentage de gain par coup. Seuils : {CATEGORY_INFO.best.label} ≤ 2 %,{' '}
                {CATEGORY_INFO.good.label} &lt; 10 %, {CATEGORY_INFO.mistake.label} ≤ 25 %, {CATEGORY_INFO.blunder.label} au-delà.
              </p>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}
