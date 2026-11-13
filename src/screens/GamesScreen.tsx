import { useCallback, useEffect, useState } from 'react'
import Dexie from 'dexie'
import { db, type GameRecord } from '../db/db'
import { importGames, type ImportProgress } from '../services/chesscom'
import { CHESSCOM_USERNAME, DEFAULT_TIME_CLASS } from '../config/settings'
import { BATCH_DEFAULT_COUNT } from '../config/stats'
import { ANALYSIS_DEPTH } from '../config/classification'
import { batch, useBatch } from '../services/batch'

const TIME_CLASS_LABELS: Record<string, string> = {
  all: 'Toutes',
  rapid: 'Rapides',
  blitz: 'Blitz',
  bullet: 'Bullet',
  daily: 'Par correspondance',
}
const OUTCOME_LABELS = { win: 'Gain', loss: 'Perte', draw: 'Nulle' } as const
const FILTER_KEY = 'games.timeClass'
const PAGE_SIZE = 50

function loadFilter(): string {
  try {
    return localStorage.getItem(FILTER_KEY) ?? DEFAULT_TIME_CLASS
  } catch {
    return DEFAULT_TIME_CLASS
  }
}

export function GamesScreen({ onOpen }: { onOpen: (id: string) => void }) {
  const [games, setGames] = useState<GameRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [filter, setFilter] = useState(loadFilter)
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [batchCount, setBatchCount] = useState(BATCH_DEFAULT_COUNT)
  const batchState = useBatch()

  const reload = useCallback(async () => {
    const collection =
      filter === 'all'
        ? db.games.orderBy('endTime')
        : db.games.where('[timeClass+endTime]').between([filter, Dexie.minKey], [filter, Dexie.maxKey])
    const [count, rows] = await Promise.all([
      collection.clone().count(),
      collection.clone().reverse().offset(page * PAGE_SIZE).limit(PAGE_SIZE).toArray(),
    ])
    setTotal(count)
    setGames(rows)
  }, [filter, page])

  useEffect(() => {
    reload()
  }, [reload, batchState.done, batchState.running])

  function changeFilter(v: string) {
    setFilter(v)
    setPage(0)
    try {
      localStorage.setItem(FILTER_KEY, v)
    } catch {
      /* ignore */
    }
  }

  async function runImport() {
    setError(null)
    setMessage(null)
    try {
      const r = await importGames(db, CHESSCOM_USERNAME, setProgress)
      setMessage(`${r.newGames} nouvelle(s) partie(s) importée(s) (${r.archivesFetched} mois téléchargé(s)).`)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setProgress(null)
    }
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="games">
      <div className="toolbar">
        <button onClick={runImport} disabled={progress !== null} data-testid="import">
          Importer depuis Chess.com
        </button>
        <label>
          Cadence :{' '}
          <select value={filter} onChange={(e) => changeFilter(e.target.value)} data-testid="filter">
            {Object.entries(TIME_CLASS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        <span className="batch-form">
          <button
            onClick={() => batch.start(batchCount, filter, ANALYSIS_DEPTH)}
            disabled={batchState.running || total === 0}
            data-testid="batch-start"
          >
            Analyser mes
          </button>
          <input
            type="number"
            min={1}
            max={1000}
            value={batchCount}
            onChange={(e) => setBatchCount(Math.max(1, Number(e.target.value) || 1))}
            data-testid="batch-count"
          />
          dernières parties
        </span>
        <span className="muted" data-testid="count">{total} partie(s) — compte {CHESSCOM_USERNAME}</span>
      </div>
      {progress && (
        <div className="progress" data-testid="progress">
          <progress value={progress.done} max={progress.total} /> Mois {progress.done}/{progress.total}{' '}
          {progress.current && `(${progress.current})`} — {progress.newGames} nouvelle(s) partie(s)
        </div>
      )}
      {message && <p className="info" data-testid="import-message">{message}</p>}
      {error && <p className="error">Erreur : {error}</p>}

      {total === 0 ? (
        <p className="muted">Aucune partie. Clique sur « Importer depuis Chess.com ».</p>
      ) : (
        <table className="games-table" data-testid="games-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Couleur</th>
              <th>Adversaire</th>
              <th>Résultat</th>
              <th>Ouverture</th>
              <th>Coups</th>
              <th>Analyse</th>
            </tr>
          </thead>
          <tbody>
            {games.map((g) => {
              const opp = g.myColor === 'white' ? g.black : g.white
              const me = g.myColor === 'white' ? g.white : g.black
              return (
                <tr key={g.id} onClick={() => onOpen(g.id)} className="clickable">
                  <td>{new Date(g.endTime * 1000).toLocaleDateString('fr-FR')}</td>
                  <td>{g.myColor === 'white' ? '○ Blancs' : '● Noirs'}</td>
                  <td>
                    {opp.username} ({opp.rating}) <span className="muted">— moi {me.rating}</span>
                  </td>
                  <td className={`outcome ${g.outcome}`}>{OUTCOME_LABELS[g.outcome]}</td>
                  <td title={g.opening ?? ''}>
                    <span className="muted">{g.eco}</span> {g.opening}
                  </td>
                  <td>{Math.ceil(g.sans.length / 2)}</td>
                  <td>{g.analysedDepth ? `✓ p${g.analysedDepth}` : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      {total > PAGE_SIZE && (
        <div className="pager">
          <button onClick={() => setPage(0)} disabled={page === 0}>«</button>
          <button onClick={() => setPage(page - 1)} disabled={page === 0}>‹ Plus récentes</button>
          <span data-testid="page">Page {page + 1} / {pageCount}</span>
          <button onClick={() => setPage(page + 1)} disabled={page >= pageCount - 1}>Plus anciennes ›</button>
          <button onClick={() => setPage(pageCount - 1)} disabled={page >= pageCount - 1}>»</button>
        </div>
      )}
    </div>
  )
}
