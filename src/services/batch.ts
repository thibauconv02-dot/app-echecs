import { useSyncExternalStore } from 'react'
import { db } from '../db/db'
import { getEngine } from '../engine/engine'
import { BatchAnalyser, type BatchState } from './batchAnalysis'

/** App-wide batch analyser: keeps running when switching tabs. */
export const batch = new BatchAnalyser(db, getEngine)

export function useBatch(): BatchState {
  return useSyncExternalStore(
    (cb) => batch.subscribe(cb),
    () => batch.getState(),
  )
}
