import { useState, useEffect } from 'react'
import { batch, useBatch } from '../services/batch'

/** Compact batch-analysis indicator shown in the top bar on every screen. */
export function BatchStatus() {
  const s = useBatch()
  const [dismissed, setDismissed] = useState(false)
  useEffect(() => setDismissed(false), [s.finished, s.error])

  if (s.running) {
    const pct = s.total ? ((s.done + (s.position ? s.position.done / Math.max(1, s.position.total) : 0)) / s.total) * 100 : 0
    return (
      <div className="batch-status" data-testid="batch-status">
        <progress value={pct} max={100} />
        <span>
          Analyse {Math.min(s.done + 1, s.total)}/{s.total}
          {s.currentLabel && <span className="dim"> · {s.currentLabel}</span>}
        </span>
        <button onClick={() => batch.stop()}>Arrêter</button>
      </div>
    )
  }
  if (dismissed || (!s.finished && !s.error)) return null
  return (
    <div className="batch-status" data-testid="batch-status">
      {s.error ? (
        <span>Erreur d’analyse : {s.error}</span>
      ) : (
        <span>
          {s.finished!.stopped ? 'Analyse arrêtée' : 'Analyse terminée'} : {s.finished!.analysed} partie(s) analysée(s)
        </span>
      )}
      <button onClick={() => setDismissed(true)} aria-label="Fermer">✕</button>
    </div>
  )
}
