import { parseBestMove, parseInfo, type EngineEval } from './uci'

const ENGINE_URL = `${import.meta.env.BASE_URL}stockfish/stockfish-19-lite-single.js`

interface Job {
  fen: string
  depth: number
  resolve: (e: EngineEval) => void
  reject: (err: Error) => void
}

/**
 * Stockfish running in a Web Worker (lite, single-thread WASM), driven over UCI.
 * Jobs are queued and processed one at a time. MultiPV 1.
 */
export class Engine {
  private worker: Worker
  private ready: Promise<void>
  private queue: Job[] = []
  private current: Job | null = null
  private last: EngineEval | null = null
  private onLine: ((line: string) => void) | null = null

  constructor(url = ENGINE_URL) {
    this.worker = new Worker(url)
    this.worker.onmessage = (e: MessageEvent) => this.onLine?.(String(e.data))
    this.worker.onerror = (e) => {
      const err = new Error(`Stockfish : ${e.message || 'échec du chargement du moteur'}`)
      this.current?.reject(err)
      this.queue.forEach((j) => j.reject(err))
      this.queue = []
      this.current = null
    }
    this.ready = this.handshake()
  }

  private waitFor(predicate: (line: string) => boolean): Promise<void> {
    return new Promise((resolve) => {
      this.onLine = (line) => {
        if (predicate(line)) resolve()
      }
    })
  }

  private async handshake() {
    const uciok = this.waitFor((l) => l === 'uciok')
    this.worker.postMessage('uci')
    await uciok
    this.worker.postMessage('setoption name MultiPV value 1')
    const readyok = this.waitFor((l) => l === 'readyok')
    this.worker.postMessage('isready')
    await readyok
  }

  /** Evaluate a position to a fixed depth. Score is from the side to move's point of view. */
  evaluate(fen: string, depth: number): Promise<EngineEval> {
    return new Promise((resolve, reject) => {
      this.queue.push({ fen, depth, resolve, reject })
      void this.pump()
    })
  }

  private async pump() {
    if (this.current) return
    await this.ready
    if (this.current) return
    const job = this.queue.shift()
    if (!job) return
    this.current = job
    this.last = null
    this.onLine = (line) => {
      const info = parseInfo(line)
      if (info && info.multipv === 1) {
        this.last = { depth: info.depth, cp: info.cp, mate: info.mate, bestMove: info.pv[0] ?? null, pv: info.pv }
        return
      }
      const best = parseBestMove(line)
      if (best === undefined) return
      const result: EngineEval = this.last
        ? { ...this.last, bestMove: best ?? this.last.bestMove }
        : { depth: 0, cp: null, mate: 0, bestMove: best, pv: [] }
      this.current = null
      job.resolve(result)
      void this.pump()
    }
    this.worker.postMessage(`position fen ${job.fen}`)
    this.worker.postMessage(`go depth ${job.depth}`)
  }

  terminate() {
    this.worker.terminate()
  }
}

let shared: Engine | null = null
/** Lazily created engine shared by the whole app. */
export function getEngine(): Engine {
  shared ??= new Engine()
  return shared
}
