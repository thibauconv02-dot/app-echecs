import { useMemo, useState, type CSSProperties } from 'react'
import { Chessboard, type Arrow, type PieceRenderObject } from 'react-chessboard'
import { Chess, type Square } from 'chess.js'

/** Lichess-like green & cream board (not Chess.com graphics). */
export const BOARD_COLORS = {
  light: '#eeeed2',
  dark: '#86a666',
  lastMove: 'rgba(205, 210, 106, 0.75)',
  selected: 'rgba(20, 85, 30, 0.5)',
  bestMoveArrow: 'rgba(0, 110, 200, 0.75)',
}

const PIECE_CODES = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP']

/** cburnett pieces by Colin M.L. Burnett (CC BY-SA 3.0), served from /public. */
const cburnettPieces: PieceRenderObject = Object.fromEntries(
  PIECE_CODES.map((code) => [
    code,
    () => (
      <img
        src={`${import.meta.env.BASE_URL}pieces/cburnett/${code}.svg`}
        alt={code}
        draggable={false}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    ),
  ]),
)

export interface BoardMove {
  from: string
  to: string
  promotion?: string
}

interface BoardProps {
  fen: string
  orientation?: 'white' | 'black'
  /** Called with a candidate move; return true if it was accepted. Omit for a read-only board. */
  onMove?: (move: BoardMove) => boolean
  lastMove?: { from: string; to: string } | null
  arrows?: Arrow[]
  width?: number
}

export function Board({ fen, orientation = 'white', onMove, lastMove, arrows = [], width = 560 }: BoardProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const interactive = Boolean(onMove)

  const chess = useMemo(() => new Chess(fen), [fen])

  const targets = useMemo(() => {
    if (!selected) return [] as string[]
    return chess.moves({ square: selected as Square, verbose: true }).map((m) => m.to)
  }, [chess, selected])

  function tryMove(from: string, to: string): boolean {
    if (!onMove) return false
    const legal = chess.moves({ square: from as Square, verbose: true }).find((m) => m.to === to)
    if (!legal) return false
    // Promotion: always to a queen for now (underpromotion is very rare at this level).
    const ok = onMove({ from, to, promotion: legal.promotion ? 'q' : undefined })
    if (ok) setSelected(null)
    return ok
  }

  function isOwnPiece(square: string): boolean {
    const piece = chess.get(square as Square)
    return Boolean(piece && piece.color === chess.turn())
  }

  function handleSquareClick({ square }: { square: string }) {
    if (!interactive) return
    if (selected && selected !== square && tryMove(selected, square)) return
    if (selected === square) setSelected(null)
    else setSelected(isOwnPiece(square) ? square : null)
  }

  const squareStyles: Record<string, CSSProperties> = {}
  if (lastMove) {
    squareStyles[lastMove.from] = { backgroundColor: BOARD_COLORS.lastMove }
    squareStyles[lastMove.to] = { backgroundColor: BOARD_COLORS.lastMove }
  }
  if (selected) squareStyles[selected] = { backgroundColor: BOARD_COLORS.selected }
  for (const t of targets) {
    const capture = Boolean(chess.get(t as Square))
    squareStyles[t] = {
      ...squareStyles[t],
      backgroundImage: capture
        ? 'radial-gradient(transparent 0%, transparent 79%, rgba(20,85,0,0.35) 80%)'
        : 'radial-gradient(rgba(20,85,30,0.35) 19%, transparent 20%)',
    }
  }

  return (
    <div style={{ width, height: width }} data-testid="board">
      <Chessboard
        options={{
          id: 'main-board',
          position: fen,
          boardOrientation: orientation,
          pieces: cburnettPieces,
          lightSquareStyle: { backgroundColor: BOARD_COLORS.light },
          darkSquareStyle: { backgroundColor: BOARD_COLORS.dark },
          lightSquareNotationStyle: { color: BOARD_COLORS.dark },
          darkSquareNotationStyle: { color: BOARD_COLORS.light },
          showNotation: true,
          squareStyles,
          arrows,
          allowDrawingArrows: true,
          clearArrowsOnPositionChange: true,
          allowDragging: interactive,
          animationDurationInMs: 150,
          canDragPiece: ({ square }) => interactive && square !== null && isOwnPiece(square),
          onPieceDrag: ({ square }) => setSelected(square),
          onPieceDrop: ({ sourceSquare, targetSquare }) => {
            if (!targetSquare || sourceSquare === targetSquare) return false
            const ok = tryMove(sourceSquare, targetSquare)
            if (!ok) setSelected(null)
            return ok
          },
          onSquareClick: handleSquareClick,
        }}
      />
    </div>
  )
}
