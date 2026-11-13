import { useCallback, useEffect, useMemo, useState } from 'react'
import { db } from '../db/db'
import { loadRepertoire } from '../repertoire/load'
import type { RepLine } from '../repertoire/parse'
import { buildSession, deckCounts, schedule, type LineReview } from '../trainer/schedule'
import { LinePlayer } from '../trainer/LinePlayer'
import { NEW_LINES_PER_SESSION } from '../config/trainer'
import { Chess } from 'chess.js'
import { Board } from '../components/Board'
import { ProgressBar } from '../components/ProgressBar'
import { sanToFrench } from '../lib/notation'
import type { DeckCounts } from '../trainer/schedule'

/** Position where all the lines of a deck still agree (their common first moves). */
function keyPosition(lines: RepLine[]): { fen: string; label: string } {
  const first = lines[0]?.moves ?? []
  let n = 0
  while (n < first.length && lines.every((l) => l.moves[n]?.san === first[n].san)) n++
  const c = new Chess()
  const parts: string[] = []
  first.slice(0, n).forEach((m, i) => {
    c.move(m.san)
    parts.push((i % 2 === 0 ? `${i / 2 + 1}.` : '') + sanToFrench(m.san))
  })
  return { fen: c.fen(), label: parts.length ? parts.join(' ') : 'Position de départ' }
}

function DeckCard(props: {
  name: string
  color: 'white' | 'black' | null
  lines: RepLine[]
  counts: DeckCounts
  selected: boolean
  onSelect: () => void
}) {
  const { name, color, lines, counts, selected, onSelect } = props
  const key = useMemo(() => keyPosition(lines), [lines])
  const inProgress = counts.total - counts.fresh - counts.learned
  return (
    <div
      className={`deck-card ${selected ? 'selected' : ''}`}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect()}
      data-testid={`deck-${name}`}
    >
      <div className="deck-card-board">
        <Board id={`deck-${name}`} fen={key.fen} orientation={color ?? 'white'} width={196} showNotation={false} />
      </div>
      <div className="deck-card-body">
        <div className="deck-card-title">
          <span>{name}</span>
          {color && (
            <span className="side-chip">
              <span className={`side-dot ${color}`} />
              {color === 'white' ? 'Blancs' : 'Noirs'}
            </span>
          )}
        </div>
        <div className="deck-card-moves">
          <strong>{counts.total} lignes</strong> · {key.label}
        </div>
        <ProgressBar
          segments={[
            { value: counts.learned, className: 'learned', label: 'apprises' },
            { value: inProgress, className: 'learning', label: 'en cours' },
            { value: counts.fresh, className: 'fresh', label: 'jamais vues' },
          ]}
        />
        <div className="deck-card-stats">
          <div className={counts.due ? 'due' : ''}>
            <strong>{counts.due}</strong>à réviser
          </div>
          <div>
            <strong>{counts.fresh}</strong>nouvelles
          </div>
          <div>
            <strong>{counts.learned}</strong>apprises
          </div>
        </div>
      </div>
    </div>
  )
}

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

  const all = deckCounts(lines, reviews, now)
  const selectedName = selected === ALL ? 'Tout mon répertoire' : selected

  return (
    <div className="deck-page">
      <header className="deck-header">
        <h2>Réviser mes ouvertures</h2>
        <p className="muted">
          {all.total} lignes dans ton répertoire · <strong className={all.due ? 'due' : ''}>{all.due} à réviser aujourd’hui</strong> ·{' '}
          {all.fresh} jamais vues · {all.learned} apprises
        </p>
      </header>

      <div className="deck-grid" data-testid="deck-grid">
        {[[ALL, null] as const, ...openings].map(([name, color]) => {
          const ls = name === ALL ? lines : lines.filter((l) => l.opening === name)
          return (
            <DeckCard
              key={name}
              name={name === ALL ? 'Tout mon répertoire' : name}
              color={color}
              lines={ls}
              counts={deckCounts(ls, reviews, now)}
              selected={selected === name}
              onSelect={() => setSelected(name)}
            />
          )
        })}
      </div>

      <div className="start-panel">
        <div>
          <div className="muted small">Sélection</div>
          <div className="start-panel-title">{selectedName}</div>
        </div>
        <div className="start-panel-actions">
          {session.length > 0 ? (
            <button className="primary big" onClick={() => start(session.map((line) => ({ line, scheduled: true, retry: false })))} data-testid="start-session">
              Commencer · {session.length} ligne(s)
              <span className="btn-sub">
                {dueCount} à réviser, {newCount} nouvelle(s)
              </span>
            </button>
          ) : (
            <p className="nothing-due" data-testid="nothing-due">✓ Rien à réviser aujourd’hui pour cette sélection. Reviens demain !</p>
          )}
          <button
            onClick={() => start([...selectedLines].sort(() => Math.random() - 0.5).map((line) => ({ line, scheduled: false, retry: false })))}
            data-testid="free-practice"
          >
            Entraînement libre ({selectedLines.length} lignes)
          </button>
        </div>
      </div>
      <p className="muted small deck-help">
        Une ligne réussie sans faute revient de plus en plus tard (1, 3, 7, 16, 35 puis 80 jours) ; une erreur ou un indice la fait revenir le
        lendemain. « Apprises » = lignes espacées d’une semaine ou plus. Au plus {NEW_LINES_PER_SESSION} nouvelles lignes par session.
        {counts.total === 0 && ' Aucun fichier PGN trouvé dans repertoire/.'}
      </p>
    </div>
  )
}
