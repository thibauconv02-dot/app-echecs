import Dexie from 'dexie'
import type { AppDB } from '../db/db'
import { analyseGame, type Evaluator } from './analysis'

export interface BatchState {
  running: boolean
  /** Games to analyse in this run (already analysed ones are excluded). */
  total: number
  done: number
  /** Progress inside the current game. */
  position: { done: number; total: number } | null
  currentLabel: string | null
  error: string | null
  /** Set when the last run ended: how many games were analysed and whether it was stopped. */
  finished: { analysed: number; stopped: boolean } | null
}

const IDLE: BatchState = { running: false, total: 0, done: 0, position: null, currentLabel: null, error: null, finished: null }

/**
 * Analyses the N most recent games of a time class, one after another, in the background.
 * Games already analysed at the requested depth are skipped. Each finished game is saved
 * immediately, so stopping loses at most the game in progress.
 */
export class BatchAnalyser {
  private state: BatchState = IDLE
  private listeners = new Set<(s: BatchState) => void>()
  private abort: AbortController | null = null

  private db: AppDB
  private engine: () => Evaluator

  constructor(db: AppDB, engine: () => Evaluator) {
    this.db = db
    this.engine = engine
  }

  getState(): BatchState {
    return this.state
  }

  subscribe(fn: (s: BatchState) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private set(patch: Partial<BatchState>) {
    this.state = { ...this.state, ...patch }
    this.listeners.forEach((fn) => fn(this.state))
  }

  /** Ids of the `count` most recent games of `timeClass` ('all' = every class) still to analyse. */
  async pendingGames(count: number, timeClass: string, depth: number): Promise<string[]> {
    const collection =
      timeClass === 'all'
        ? this.db.games.orderBy('endTime')
        : this.db.games.where('[timeClass+endTime]').between([timeClass, Dexie.minKey], [timeClass, Dexie.maxKey])
    const recent = await collection.reverse().limit(count).toArray()
    return recent.filter((g) => (g.analysedDepth ?? 0) < depth).map((g) => g.id)
  }

  async start(count: number, timeClass: string, depth: number): Promise<void> {
    if (this.state.running) return
    const abort = new AbortController()
    this.abort = abort
    this.set({ ...IDLE, running: true })
    let analysed = 0
    try {
      const ids = await this.pendingGames(count, timeClass, depth)
      this.set({ total: ids.length })
      for (const id of ids) {
        if (abort.signal.aborted) break
        const game = await this.db.games.get(id)
        if (!game) continue
        const opp = game.myColor === 'white' ? game.black.username : game.white.username
        this.set({ currentLabel: `contre ${opp} (${new Date(game.endTime * 1000).toLocaleDateString('fr-FR')})`, position: null })
        await analyseGame(this.db, this.engine(), game, depth, (done, total) => this.set({ position: { done, total } }), undefined, abort.signal)
        analysed++
        this.set({ done: analysed })
      }
      this.set({ running: false, position: null, currentLabel: null, finished: { analysed, stopped: abort.signal.aborted } })
    } catch (e) {
      const stopped = abort.signal.aborted
      this.set({
        running: false,
        position: null,
        currentLabel: null,
        error: stopped ? null : e instanceof Error ? e.message : String(e),
        finished: { analysed, stopped },
      })
    } finally {
      this.abort = null
    }
  }

  stop() {
    this.abort?.abort()
  }
}
