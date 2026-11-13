// Copies the Stockfish lite single-thread build (JS worker + WASM) into public/stockfish/.
// The JS file is itself the Web Worker and loads the .wasm sitting next to it.
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'node_modules', 'stockfish', 'bin')
const dest = join(root, 'public', 'stockfish')
mkdirSync(dest, { recursive: true })
for (const f of ['stockfish-19-lite-single.js', 'stockfish-19-lite-single.wasm']) copyFileSync(join(src, f), join(dest, f))
console.log('Stockfish copied to public/stockfish/')
