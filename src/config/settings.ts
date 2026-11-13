/** User-tunable defaults. Classification thresholds live in ./classification.ts. */
export const CHESSCOM_USERNAME = 'anakinskywalker25'

export type TimeClass = 'rapid' | 'blitz' | 'bullet' | 'daily'
export const DEFAULT_TIME_CLASS: TimeClass | 'all' = 'rapid'
