import { winPercent, type Score } from '../lib/winPercent'

/** Convert a side-to-move evaluation into White's win% and a display label from White's view. */
export function whiteView(score: Score | null, whiteToMove: boolean): { whiteWin: number; label: string } | null {
  if (!score || (score.cp === null && score.mate === null)) return null
  const w = winPercent(score)
  const whiteWin = whiteToMove ? w : 100 - w
  const sign = whiteToMove ? 1 : -1
  let label: string
  if (score.mate !== null) label = score.mate === 0 ? '#' : `M${Math.abs(score.mate)}`
  else {
    const v = (sign * (score.cp ?? 0)) / 100
    label = `${v > 0 ? '+' : ''}${v.toFixed(1)}`
  }
  return { whiteWin, label }
}

/** Vertical bar: White's share = White's win%. */
export function EvalBar({ view, orientation, height }: { view: { whiteWin: number; label: string } | null; orientation: 'white' | 'black'; height: number }) {
  const whiteWin = view?.whiteWin ?? 50
  const whiteOnBottom = orientation === 'white'
  const whiteAhead = whiteWin >= 50
  return (
    <div className="eval-bar" style={{ height, flexDirection: whiteOnBottom ? 'column-reverse' : 'column' }} data-testid="eval-bar">
      <div className="eval-white" style={{ height: `${whiteWin}%` }} />
      <span className={`eval-label ${whiteAhead ? 'on-white' : 'on-black'}`} style={whiteAhead === whiteOnBottom ? { bottom: 4 } : { top: 4 }}>
        {view?.label ?? '…'}
      </span>
    </div>
  )
}
