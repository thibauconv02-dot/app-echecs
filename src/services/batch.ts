import { useSyncExternalStore } from 'react'
import { db } from '../db/db'
import { getEngine } from '../engine/engine'
import { PUZZLE_VERSION } from '../config/puzzles'
import { generatePuzzlesForGame } from '../puzzles/generate'
import { BatchAnalyser, type BatchState } from './batchAnalysis'

/** App-wide background job: turns recent games into puzzles. Keeps running when switching tabs. */
export const batch = new BatchAnalyser(
  db,
  async (game, onProgress, signal) => {
    await generatePuzzlesForGame(db, getEngine(), game, onProgress, signal)
    await db.games.update(game.id, { puzzleVersion: PUZZLE_VERSION })
  },
  (game) => game.puzzleVersion === PUZZLE_VERSION,
)

export function useBatch(): BatchState {
  return useSyncExternalStore(
    (cb) => batch.subscribe(cb),
    () => batch.getState(),
  )
}
