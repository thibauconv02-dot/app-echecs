import { useCallback, useEffect, useMemo, useState } from 'react'
import { db } from '../db/db'
import { loadRepertoire } from '../repertoire/load'
import type { RepLine } from '../repertoire/parse'
import { buildSession, deckCounts, schedule, type LineReview } from '../trainer/schedule'
import { LinePlayer } from '../trainer/LinePlayer'
import { NEW_LINES_PER_SESSION } from '../config/trainer'

interface SessionItem {
  line: RepLine
  /** False for retries and free practice: the result does not change the schedule. */
  scheduled: boolean
  retry: boolean
}

type State =
  | { kind: 'menu' }
  | { kind: 'session'; items: SessionItem[]; index: number; attempt: number; firstTry: Map<string, boolean>; finished: boolean }
  | { kind: 'done'; firstTry: Map<string, boolean> }

const ALL = 'all'

export function TrainerScreen() {
  const { lines, error } = useMemo(() => {
    try {
      return { lines: loadRepertoire().lines, error: null }
    } catch (e) {
      return { lines: [] as RepLine[], error: e instanceof Error ? e.message : String(e) }
    }
  }, [])
  const [reviews, setReviews] = useState<Map<string, LineReview> | null>(null)
  const [selected, setSelected] = useState(ALL)
  const [state, setState] = useState<State>({ kind: 'menu' })

  const reload = useCallback(async () => {
    const all = await db.lineReviews.toArray()
    setReviews(new Map(all.map((r) => [r.lineId, r])))
  }, [])
  useEffect(() => {
    reload()
  }, [reload])

  const openings = useMemo(() => [...new Map(lines.map((l) => [l.opening, l.color])).entries()], [lines])
  const selectedLines = selected === ALL ? lines : lines.filter((l) => l.opening === selected)

  if (error) return <p className="error">Impossible de lire le répertoire : {error}</p>
  if (!reviews) return <p className="muted">Chargement…</p>
  const now = Date.now()

  function start(items: SessionItem[]) {
    if (items.length) setState({ kind: 'session', items, index: 0, attempt: 0, firstTry: new Map(), finished: false })
  }

  async function onLineFinished(success: boolean) {
    if (state.kind !== 'session') return
    const item = state.items[state.index]
    const firstTry = new Map(state.firstTry)
    let items = state.items
    if (!item.retry) {
      firstTry.set(item.line.id, success)
      if (item.scheduled) {
        await db.lineReviews.put(schedule(reviews!.get(item.line.id), item.line.id, success, Date.now()))
        await reload()
      }
      // A missed line comes back once at the end of the session.
      if (!success) items = [...items, { line: item.line, scheduled: false, retry: true }]
    }
    setState({ ...state, items, firstTry, finished: true })
  }

  function next() {
    if (state.kind !== 'session') return
    if (state.index + 1 >= state.items.length) setState({ kind: 'done', firstTry: state.firstTry })
    else setState({ ...state, index: state.index + 1, attempt: state.attempt + 1, finished: false })
  }

  if (state.kind === 'session') {
    const item = state.items[state.index]
    const progress = `Ligne ${state.index + 1} / ${state.items.length}`
    return (
      <div>
        <div className="toolbar">
          <strong data-testid="session-progress">{progress}</strong>
          {item.retry && <span className="badge" style={{ backgroundColor: '#e69a28' }}>Deuxième passage</span>}
          {!item.scheduled && !item.retry && <span className="muted">Entraînement libre (ne change pas le calendrier)</span>}
          {state.finished && (
            <button className="primary" onClick={next} data-testid="next-line" autoFocus>
              {state.index + 1 >= state.items.length ? 'Terminer' : 'Ligne suivante →'}
            </button>
          )}
          <button onClick={() => setState({ kind: 'done', firstTry: state.firstTry })}>Arrêter la session</button>
        </div>
        <LinePlayer key={`${item.line.id}#${state.attempt}`} line={item.line} onFinish={onLineFinished} />
      </div>
    )
  }

  if (state.kind === 'done') {
    const results = [...state.firstTry.values()]
    const ok = results.filter(Boolean).length
    return (
      <div className="trainer-menu">
        <h2>Session terminée</h2>
        <p data-testid="session-result">
          {ok} ligne(s) réussie(s) du premier coup sur {results.length}.
          {results.length > ok && ' Les lignes ratées reviendront demain.'}
        </p>
        <button className="primary" onClick={() => setState({ kind: 'menu' })}>Retour</button>
      </div>
    )
  }

  const session = buildSession(selectedLines, reviews, now)
  const counts = deckCounts(selectedLines, reviews, now)
  const dueCount = session.filter((l) => reviews.has(l.id)).length
  const newCount = session.length - dueCount

  return (
    <div className="trainer-menu">
      <h2>Réviser mes ouvertures</h2>
      <table className="games-table deck-table" data-testid="deck-table">
        <thead>
          <tr>
            <th />
            <th>Ouverture</th>
            <th>Couleur</th>
            <th>Lignes</th>
            <th>Apprises</th>
            <th>À réviser</th>
            <th>Jamais vues</th>
          </tr>
        </thead>
        <tbody>
          {[[ALL, null] as const, ...openings].map(([name, color]) => {
            const ls = name === ALL ? lines : lines.filter((l) => l.opening === name)
            const c = deckCounts(ls, reviews, now)
            return (
              <tr key={name} className={`clickable ${selected === name ? 'selected' : ''}`} onClick={() => setSelected(name)}>
                <td><input type="radio" readOnly checked={selected === name} /></td>
                <td>{name === ALL ? <strong>Tout mon répertoire</strong> : name}</td>
                <td>{color === null ? '' : color === 'white' ? 'Blancs' : 'Noirs'}</td>
                <td>{c.total}</td>
                <td>{c.learned}</td>
                <td className={c.due ? 'due' : ''}>{c.due}</td>
                <td>{c.fresh}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="start-box">
        {session.length > 0 ? (
          <button className="primary big" onClick={() => start(session.map((line) => ({ line, scheduled: true, retry: false })))} data-testid="start-session">
            Commencer : {session.length} ligne(s) — {dueCount} à réviser, {newCount} nouvelle(s)
          </button>
        ) : (
          <p data-testid="nothing-due">Rien à réviser aujourd’hui pour cette sélection. Reviens demain !</p>
        )}
        <button
          onClick={() => start([...selectedLines].sort(() => Math.random() - 0.5).map((line) => ({ line, scheduled: false, retry: false })))}
          data-testid="free-practice"
        >
          Entraînement libre ({selectedLines.length} lignes, sans effet sur le calendrier)
        </button>
      </div>
      <p className="muted small">
        Une ligne réussie sans faute revient de plus en plus tard (1, 3, 7, 16, 35 puis 80 jours) ; une erreur ou un indice la fait revenir le
        lendemain. « Apprises » = lignes espacées d’une semaine ou plus. Au plus {NEW_LINES_PER_SESSION} nouvelles lignes par session.
        {counts.total === 0 && ' Aucun fichier PGN trouvé dans repertoire/.'}
      </p>
    </div>
  )
}
