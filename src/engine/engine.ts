import { parseBestMove, parseInfo, type EngineEval, type InfoLine } from './uci'

const ENGINE_URL = `${import.meta.env.BASE_URL}stockfish/stockfish-19-lite-single.js`

export interface AnalyseOptions {
  /** Number of best lines to return (UCI MultiPV). Default 1. */
  multiPv?: number
  /** Restrict the search to these moves (UCI), e.g. to score the move actually played. */
  searchMoves?: string[]
}

/** One principal variation; score from the side to move's point of view. */
export type PvLine = Omit<InfoLine, 'multipv'> & { multipv: number }

interface Job {
  fen: string
  depth: number
  opts: AnalyseOptions
  resolve: (lines: PvLine[]) => void
  reject: (err: Error) => void
}

/**
 * Stockfish running in a Web Worker (lite, single-thread WASM), driven over UCI.
 * Jobs are queued and processed one at a time.
 */
export class Engine {
  private worker: Worker
  private ready: Promise<void>
  private queue: Job[] = []
  private current: Job | null = null
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
    const readyok = this.waitFor((l) => l === 'readyok')
    this.worker.postMessage('isready')
    await readyok
  }

  /** Best lines of a position at a fixed depth (sorted best first). */
  analyse(fen: string, depth: number, opts: AnalyseOptions = {}): Promise<PvLine[]> {
    return new Promise((resolve, reject) => {
      this.queue.push({ fen, depth, opts, resolve, reject })
      void this.pump()
    })
  }

  /** Single best line (MultiPV 1), as used by game analysis. */
  async evaluate(fen: string, depth: number): Promise<EngineEval> {
    const [best] = await this.analyse(fen, depth)
    if (!best) return { depth: 0, cp: null, mate: 0, bestMove: null, pv: [] }
    return { depth: best.depth, cp: best.cp, mate: best.mate, bestMove: best.pv[0] ?? null, pv: best.pv }
  }

  private async pump() {
    if (this.current) return
    await this.ready
    if (this.current) return
    const job = this.queue.shift()
    if (!job) return
    this.current = job
    const lines = new Map<number, PvLine>()
    this.onLine = (line) => {
      const info = parseInfo(line)
      if (info) {
        // Bound scores are provisional (aspiration window): wait for the exact one.
        if (/ (lower|upper)bound/.test(line)) return
        // Keep the latest complete line for each MultiPV slot.
        if (info.pv.length) lines.set(info.multipv, info)
        return
      }
      if (parseBestMove(line) === undefined) return
      this.current = null
      job.resolve([...lines.values()].sort((a, b) => a.multipv - b.multipv))
      void this.pump()
    }
    this.worker.postMessage(`setoption name MultiPV value ${job.opts.multiPv ?? 1}`)
    this.worker.postMessage(`position fen ${job.fen}`)
    const search = job.opts.searchMoves?.length ? ` searchmoves ${job.opts.searchMoves.join(' ')}` : ''
    this.worker.postMessage(`go depth ${job.depth}${search}`)
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
