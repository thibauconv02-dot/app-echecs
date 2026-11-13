/**
 * Move sounds, synthesised with the Web Audio API (no audio files, no licensing issue).
 * A short filtered noise burst + a low thump gives a "wooden piece" click.
 */
export type MoveSound = 'move' | 'capture' | 'check'

const STORAGE_KEY = 'sound.enabled'
let ctx: AudioContext | null = null
let enabled = readEnabled()
const listeners = new Set<() => void>()

function readEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off'
  } catch {
    return true
  }
}

export function isSoundEnabled(): boolean {
  return enabled
}

export function setSoundEnabled(on: boolean) {
  enabled = on
  try {
    localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off')
  } catch {
    /* private mode: setting just won't persist */
  }
  listeners.forEach((fn) => fn())
}

export function subscribeSound(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null
  ctx ??= new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function click(ac: AudioContext, at: number, gain: number, freq: number) {
  // Noise burst through a band-pass filter: the "tock" of wood.
  const length = Math.floor(ac.sampleRate * 0.06)
  const buffer = ac.createBuffer(1, length, ac.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 4)
  const noise = ac.createBufferSource()
  noise.buffer = buffer
  const band = ac.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = freq
  band.Q.value = 1.2
  const g = ac.createGain()
  g.gain.value = gain
  noise.connect(band).connect(g).connect(ac.destination)
  noise.start(at)

  // Low thump: the piece landing on the board.
  const osc = ac.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(190, at)
  osc.frequency.exponentialRampToValueAtTime(90, at + 0.08)
  const og = ac.createGain()
  og.gain.setValueAtTime(gain * 0.6, at)
  og.gain.exponentialRampToValueAtTime(0.001, at + 0.09)
  osc.connect(og).connect(ac.destination)
  osc.start(at)
  osc.stop(at + 0.1)
}

function ping(ac: AudioContext, at: number) {
  const osc = ac.createOscillator()
  osc.type = 'triangle'
  osc.frequency.value = 880
  const g = ac.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(0.12, at + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.25)
  osc.connect(g).connect(ac.destination)
  osc.start(at)
  osc.stop(at + 0.3)
}

export function playMoveSound(kind: MoveSound) {
  if (!enabled) return
  const ac = audio()
  if (!ac) return
  const t = ac.currentTime + 0.005
  if (kind === 'capture') {
    click(ac, t, 0.9, 1400)
    click(ac, t + 0.045, 0.7, 1000)
  } else {
    click(ac, t, 0.7, 1800)
    if (kind === 'check') ping(ac, t + 0.04)
  }
}

/**
 * Which sound fits the change between two positions, or null when it is not a single move
 * (initial display, jump to another position, new puzzle…).
 */
export function soundForChange(prevFen: string, nextFen: string, inCheck: boolean): MoveSound | null {
  const a = expandBoard(prevFen)
  const b = expandBoard(nextFen)
  let changed = 0
  for (let i = 0; i < 64; i++) if (a[i] !== b[i]) changed++
  // A move changes 2 squares (3 en passant, 4 castling); more means a jump.
  if (changed < 2 || changed > 4) return null
  const count = (s: string) => s.replace(/\./g, '').length
  if (inCheck) return 'check'
  return count(b) < count(a) ? 'capture' : 'move'
}

function expandBoard(fen: string): string {
  return fen
    .split(' ')[0]
    .replace(/\//g, '')
    .replace(/\d/g, (d) => '.'.repeat(Number(d)))
}
