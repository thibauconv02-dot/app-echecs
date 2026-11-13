/**
 * Single source of truth for analysis settings and classification thresholds.
 * Losses are expressed in win-percentage points (0–100) from the mover's point of view.
 */
export const ANALYSIS_DEPTH = 16

export const THRESHOLDS = {
  /** Best: Stockfish's move, or a loss ≤ this. */
  bestMaxLoss: 2,
  /** Good ("Jouable"): loss strictly below this. */
  goodMaxLoss: 10,
  /** Mistake ("Erreur"): loss from goodMaxLoss up to and including this; above = blunder ("Gaffe"). */
  mistakeMaxLoss: 25,
}

/** Lichess win% coefficient. */
export const WIN_COEFFICIENT = 0.00368208

export const CATEGORY_INFO = {
  theory: { label: 'Théorie', color: '#a88865' },
  best: { label: 'Meilleur', color: '#5c9a2e' },
  good: { label: 'Jouable', color: '#8fb8d8' },
  mistake: { label: 'Erreur', color: '#e69a28' },
  blunder: { label: 'Gaffe', color: '#d03a2c' },
} as const
