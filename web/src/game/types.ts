import type { Tile } from './tiles';

/** Shared shape both the daily and freeplay hooks return, so <PuzzleBoard>
 * doesn't need to know which mode it's rendering. */
export interface PuzzleController {
  loading: boolean;
  error: string | null;
  /** Short subtitle, e.g. "Daily — 9 rungs" or "Freeplay — Level 3 — 5 rungs". */
  label: string;
  tiles: Tile[];
  rungNumber: number; // 1-based, for display
  rungCount: number;
  foundWords: string[];
  wordsAtRung: number; // total valid words for this rung (may be > foundWords.length)
  hintsUsedThisRung: number;
  canAdvance: boolean;
  isComplete: boolean;
  shareString: string;
  onReorder: (tiles: Tile[]) => void;
  onHint: () => void;
  onAdvance: () => void;
  /** Freeplay only: start a new puzzle after completing one. */
  onNextPuzzle?: () => void;
}
