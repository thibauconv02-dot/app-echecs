import { Fragment, useEffect, useMemo, useState } from 'react'
import { db, type AnalysisRecord, type GameRecord } from '../db/db'
import { DEFAULT_TIME_CLASS } from '../config/settings'
import { FAST_MOVE_SECONDS, LOW_CLOCK_SECONDS } from '../config/stats'
import { gameFacts, openingStats, timeStats, type OpeningStats } from '../lib/stats'
import { PHASE_LABELS, type Phase } from '../lib/phase'
import { useBatch } from '../services/batch'

const TIME_CLASSES: Record<string, string> = { all: 'Toutes', rapid: 'Rapides', blitz: 'Blitz', bullet: 'Bullet', daily: 'Par correspondance' }
const COLORS: Record<string, string> = { all: 'Les deux couleurs', white: 'Avec les Blancs', black: 'Avec les Noirs' }
const PHASES: Phase[] = ['opening', 'middlegame', 'endgame']

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : '—')
const num = (x: number | null, d = 1) => (x === null ? '—' : x.toFixed(d).replace('.', ','))

export function StatsScreen() {
  const [rows, setRows] = useState<{ game: GameRecord; analysis: AnalysisRecord }[] | null>(null)
  const [timeClass, setTimeClass] = useState<string>(DEFAULT_TIME_CLASS)
  const [color, setColor] = useState('all')
  const [open, setOpen] = useState<Set<string>>(new Set())
  const batchState = useBatch()

  useEffect(() => {
    ;(async () => {
      const analyses = await db.analyses.toArray()
      const games = await db.games.bulkGet(analyses.map((a) => a.gameId))
      setRows(analyses.flatMap((analysis, i) => (games[i] ? [{ game: games[i]!, analysis }] : [])))
    })()
  }, [batchState.done, batchState.running])

  const facts = useMemo(
    () =>
      (rows ?? [])
        .filter(({ game }) => (timeClass === 'all' || game.timeClass === timeClass) && (color === 'all' || game.myColor === color))
        .map(({ game, analysis }) => gameFacts(game, analysis)),
    [rows, timeClass, color],
  )
  const openings = useMemo(() => openingStats(facts), [facts])
  const overall = useMemo(() => openingStats(facts.map((f) => ({ ...f, family: 'all', variation: 'all' })))[0], [facts])
  const time = useMemo(() => timeStats(facts), [facts])

  function toggle(name: string) {
    const next = new Set(open)
    if (next.has(name)) next.delete(name)
    else next.add(name)
    setOpen(next)
  }

  if (!rows) return <p className="muted">Chargement…</p>

  return (
    <div className="stats">
      <div className="toolbar">
        <select value={timeClass} onChange={(e) => setTimeClass(e.target.value)} data-testid="stats-timeclass">
          {Object.entries(TIME_CLASSES).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select value={color} onChange={(e) => setColor(e.target.value)} data-testid="stats-color">
          {Object.entries(COLORS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <span className="muted" data-testid="stats-count">
          {facts.length} partie(s) analysée(s)
        </span>
      </div>

      {facts.length === 0 ? (
        <p className="muted">
          Aucune partie analysée pour ce filtre. Lance « Analyser mes 50 dernières parties » depuis l’onglet Mes parties.
        </p>
      ) : (
        <>
          <div className="cards">
            <Card label="Score" value={`${Math.round(overall.score)} %`} sub={`${overall.wins} G · ${overall.draws} N · ${overall.losses} P`} />
            <Card label="Précision moyenne" value={`${num(overall.accuracy)} %`} />
            <Card label="Erreurs par partie" value={num(overall.mistakesPerGame)} />
            <Card label="Gaffes par partie" value={num(overall.blundersPerGame)} />
          </div>

          <h2>Sur le temps</h2>
          <ul className="time-stats" data-testid="time-stats">
            <li>
              <strong>{pct(time.blundersLowClock, time.blunders)}</strong> de tes gaffes ({time.blundersLowClock} sur {time.blunders}) ont été
              jouées avec moins de {LOW_CLOCK_SECONDS} s à la pendule, alors que <strong>{pct(time.movesLowClock, time.moves)}</strong> de
              tous tes coups le sont.
            </li>
            <li>
              <strong>{pct(time.criticalFast, time.critical)}</strong> de tes coups critiques ({time.criticalFast} sur {time.critical}) ont été
              joués en moins de {FAST_MOVE_SECONDS} s.
            </li>
            <li>
              Temps moyen : <strong>{num(time.avgSpentCritical)} s</strong> sur un coup critique, contre {num(time.avgSpentAll)} s sur
              l’ensemble de tes coups.
            </li>
          </ul>
          <p className="muted small">
            Coup critique = tes erreurs et gaffes, plus tes réponses à une erreur ou gaffe adverse (une occasion à saisir).
          </p>

          <h2>Par ouverture</h2>
          <table className="games-table openings-table" data-testid="openings-table">
            <thead>
              <tr>
                <th>Ouverture</th>
                <th>Parties</th>
                <th>G / N / P</th>
                <th>Score</th>
                <th>Précision</th>
                <th>Erreurs / partie</th>
                <th>Gaffes / partie</th>
                <th>Où tombent erreurs et gaffes</th>
              </tr>
            </thead>
            <tbody>
              {openings.map((o) => (
                <Fragment key={o.name}>
                  <OpeningRow o={o} onClick={() => toggle(o.name)} expanded={open.has(o.name)} />
                  {open.has(o.name) && o.variations!.map((v) => <OpeningRow key={v.name} o={v} sub />)}
                </Fragment>
              ))}
            </tbody>
          </table>
          <p className="muted small">
            Ouverture = 12 premiers coups ; finale = 6 pièces ou moins (hors rois et pions). Clique sur une ouverture pour voir ses variantes.
            Noms d’ouvertures fournis par Chess.com.
          </p>
        </>
      )}
    </div>
  )
}

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card">
      <div className="card-label">{label}</div>
      <div className="card-value">{value}</div>
      {sub && <div className="muted small">{sub}</div>}
    </div>
  )
}

function OpeningRow({ o, sub = false, expanded, onClick }: { o: OpeningStats; sub?: boolean; expanded?: boolean; onClick?: () => void }) {
  const errors = PHASES.reduce((s, p) => s + o.errorsByPhase[p], 0)
  return (
    <tr className={sub ? 'variation' : 'clickable'} onClick={onClick}>
      <td>
        {!sub && <span className="caret">{expanded ? '▾' : '▸'}</span>} {o.name}
      </td>
      <td>{o.games}</td>
      <td>
        {o.wins} / {o.draws} / {o.losses}
      </td>
      <td className={o.score >= 55 ? 'good-score' : o.score <= 45 ? 'bad-score' : ''}>{Math.round(o.score)} %</td>
      <td>{num(o.accuracy)} %</td>
      <td>{num(o.mistakesPerGame)}</td>
      <td>{num(o.blundersPerGame)}</td>
      <td>
        {errors === 0 ? (
          <span className="muted">—</span>
        ) : (
          <span className="phases">
            {PHASES.map((p) => (
              <span key={p} className={`phase ${p}`} title={`${PHASE_LABELS[p]} : ${o.errorsByPhase[p]}`}>
                {PHASE_LABELS[p]} {pct(o.errorsByPhase[p], errors)}
              </span>
            ))}
          </span>
        )}
      </td>
    </tr>
  )
}
