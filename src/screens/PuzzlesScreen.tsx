import { useCallback, useEffect, useMemo, useState } from 'react'
import { db } from '../db/db'
import type { Puzzle, PuzzleType } from '../puzzles/types'
import { PuzzlePlayer } from '../puzzles/PuzzlePlayer'
import { buildSession, deckCounts, schedule, type LineReview } from '../trainer/schedule'
import { NEW_PUZZLES_PER_SESSION, PUZZLE_BATCH_DEFAULT } from '../config/puzzles'
import { CHESSCOM_USERNAME } from '../config/settings'
import { importGames } from '../services/chesscom'
import { batch, useBatch } from '../services/batch'
import { PHASE_LABELS, type Phase } from '../lib/phase'

const ALL = 'all'
const TYPE_LABELS: Record<PuzzleType, string> = { punish: 'Punis la gaffe', avoid: 'Évite la gaffe' }

type State =
  | { kind: 'menu' }
  | { kind: 'session'; items: { puzzle: Puzzle; scheduled: boolean }[]; index: number; results: Map<string, boolean>; finished: boolean }
  | { kind: 'done'; results: Map<string, boolean> }

export function PuzzlesScreen({ onOpenGame }: { onOpenGame: (gameId: string) => void }) {
  const [puzzles, setPuzzles] = useState<Puzzle[] | null>(null)
  const [reviews, setReviews] = useState<Map<string, LineReview>>(new Map())
  const [type, setType] = useState<string>(ALL)
  const [phase, setPhase] = useState<string>(ALL)
  const [family, setFamily] = useState<string>(ALL)
  const [count, setCount] = useState(PUZZLE_BATCH_DEFAULT)
  const [importing, setImporting] = useState<string | null>(null)
  const [state, setState] = useState<State>({ kind: 'menu' })
  const batchState = useBatch()

  const reload = useCallback(async () => {
    const [ps, rs] = await Promise.all([db.puzzles.toArray(), db.puzzleReviews.toArray()])
    setPuzzles(ps.filter((p) => !p.disabled).sort((a, b) => b.endTime - a.endTime || a.ply - b.ply))
    setReviews(new Map(rs.map((r) => [r.lineId, r])))
  }, [])
  useEffect(() => {
    reload()
  }, [reload, batchState.done, batchState.running])

  const families = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of puzzles ?? []) m.set(p.family, (m.get(p.family) ?? 0) + 1)
    return [...m].sort((a, b) => b[1] - a[1])
  }, [puzzles])

  if (!puzzles) return <p className="muted">Chargement…</p>
  const now = Date.now()
  const selected = puzzles.filter(
    (p) => (type === ALL || p.type === type) && (phase === ALL || p.phase === phase) && (family === ALL || p.family === family),
  )

  async function create() {
    try {
      setImporting('Récupération de tes nouvelles parties sur Chess.com…')
      await importGames(db, CHESSCOM_USERNAME)
    } catch (e) {
      setImporting(`Import impossible (${e instanceof Error ? e.message : e}) : je crée les puzzles avec les parties déjà importées.`)
      await new Promise((r) => setTimeout(r, 2500))
    }
    setImporting(null)
    void batch.start(count, 'rapid')
  }

  async function onFinished(success: boolean) {
    if (state.kind !== 'session') return
    const item = state.items[state.index]
    const results = new Map(state.results)
    if (!results.has(item.puzzle.id)) {
      results.set(item.puzzle.id, success)
      if (item.scheduled) {
        await db.puzzleReviews.put(schedule(reviews.get(item.puzzle.id), item.puzzle.id, success, Date.now()))
        await reload()
      }
    }
    setState({ ...state, results, finished: true })
  }

  function next() {
    if (state.kind !== 'session') return
    if (state.index + 1 >= state.items.length) setState({ kind: 'done', results: state.results })
    else setState({ ...state, index: state.index + 1, finished: false })
  }

  async function markWrong(p: Puzzle) {
    await db.puzzles.update(p.id, { disabled: true })
    await db.puzzleReviews.delete(p.id)
    await reload()
    if (state.kind === 'session') {
      // Drop it from the session; the next puzzle takes its place at the same index.
      const items = state.items.filter((it) => it.puzzle.id !== p.id)
      const results = new Map(state.results)
      results.delete(p.id)
      if (state.index >= items.length) setState({ kind: 'done', results })
      else setState({ ...state, items, results, finished: false })
    }
  }

  if (state.kind === 'session') {
    const item = state.items[state.index]
    return (
      <div>
        <div className="toolbar">
          <strong data-testid="puzzle-progress">Puzzle {state.index + 1} / {state.items.length}</strong>
          {!item.scheduled && <span className="muted">Entraînement libre (ne change pas le calendrier)</span>}
          {state.finished && (
            <button className="primary" onClick={next} data-testid="next-puzzle" autoFocus>
              {state.index + 1 >= state.items.length ? 'Terminer' : 'Puzzle suivant →'}
            </button>
          )}
          {state.finished && <button onClick={() => onOpenGame(item.puzzle.gameId)}>Voir la partie</button>}
          <button onClick={() => markWrong(item.puzzle)} title="Retire définitivement ce puzzle" data-testid="mark-wrong">
            Ce puzzle est faux
          </button>
          <button onClick={() => setState({ kind: 'done', results: state.results })}>Arrêter la session</button>
        </div>
        <PuzzlePlayer key={`${item.puzzle.id}#${state.index}`} puzzle={item.puzzle} onFinish={(r) => onFinished(r.success)} />
      </div>
    )
  }

  if (state.kind === 'done') {
    const rs = [...state.results.values()]
    const ok = rs.filter(Boolean).length
    return (
      <div className="trainer-menu">
        <h2>Session terminée</h2>
        <p data-testid="puzzle-session-result">
          {ok} puzzle(s) réussi(s) sur {rs.length}.{rs.length > ok && ' Les puzzles ratés reviendront demain.'}
        </p>
        <button className="primary" onClick={() => setState({ kind: 'menu' })}>Retour</button>
      </div>
    )
  }

  const session = buildSession(selected, reviews, now, NEW_PUZZLES_PER_SESSION)
  const counts = deckCounts(selected, reviews, now)
  const dueCount = session.filter((p) => reviews.has(p.id)).length

  return (
    <div className="trainer-menu">
      <h2>Puzzles de mes parties</h2>

      <div className="create-box">
        <button onClick={create} disabled={batchState.running || importing !== null} data-testid="create-puzzles">
          Créer des puzzles avec mes
        </button>
        <input type="number" min={1} max={2000} value={count} onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))} data-testid="puzzle-count" />
        <span>dernières parties rapides</span>
        <span className="muted small">(environ 10 s par partie ; les parties déjà traitées sont sautées)</span>
      </div>
      {importing && <p className="info">{importing}</p>}

      <div className="toolbar">
        <select value={type} onChange={(e) => setType(e.target.value)} data-testid="filter-type">
          <option value={ALL}>Tous les types</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v} ({puzzles.filter((p) => p.type === k).length})</option>
          ))}
        </select>
        <select value={phase} onChange={(e) => setPhase(e.target.value)}>
          <option value={ALL}>Toutes les phases</option>
          {(Object.keys(PHASE_LABELS) as Phase[]).map((k) => (
            <option key={k} value={k}>{PHASE_LABELS[k]} ({puzzles.filter((p) => p.phase === k).length})</option>
          ))}
        </select>
        <select value={family} onChange={(e) => setFamily(e.target.value)}>
          <option value={ALL}>Toutes les ouvertures</option>
          {families.map(([f, n]) => (
            <option key={f} value={f}>{f} ({n})</option>
          ))}
        </select>
      </div>

      <div className="cards" data-testid="puzzle-counts">
        <div className="card"><div className="card-label">Puzzles</div><div className="card-value">{counts.total}</div></div>
        <div className="card"><div className="card-label">À réviser</div><div className="card-value">{counts.due}</div></div>
        <div className="card"><div className="card-label">Jamais vus</div><div className="card-value">{counts.fresh}</div></div>
        <div className="card"><div className="card-label">Acquis</div><div className="card-value">{counts.learned}</div></div>
      </div>

      <div className="start-box">
        {session.length > 0 ? (
          <button className="primary big" onClick={() => setState({ kind: 'session', items: session.map((puzzle) => ({ puzzle, scheduled: true })), index: 0, results: new Map(), finished: false })} data-testid="start-puzzles">
            Commencer : {session.length} puzzle(s) — {dueCount} à réviser, {session.length - dueCount} nouveau(x)
          </button>
        ) : (
          <p>{counts.total ? 'Rien à réviser aujourd’hui pour cette sélection.' : 'Pas encore de puzzles : clique sur « Créer des puzzles ».'}</p>
        )}
        {selected.length > 0 && (
          <button onClick={() => setState({ kind: 'session', items: [...selected].sort(() => Math.random() - 0.5).map((puzzle) => ({ puzzle, scheduled: false })), index: 0, results: new Map(), finished: false })}>
            Entraînement libre ({selected.length} puzzles)
          </button>
        )}
      </div>
      <p className="muted small">
        « Punis la gaffe » : l’adversaire a fait une grosse erreur et tu ne l’as pas punie. « Évite la gaffe » : tu as gaffé dans la partie. Seuls
        les écarts nets (au moins 20 % de chances de gain entre le bon coup et le tien) deviennent des puzzles. Un coup presque aussi bon que celui de
        Stockfish est accepté. Répétition espacée comme pour les ouvertures.
      </p>
    </div>
  )
}
