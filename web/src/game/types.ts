import type { GuessOutcome } from 'anagram-game-engine';
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
  /** Persists a drag-finished tile order — does NOT check it (see onCheck). */
  onReorder: (tiles: Tile[]) => void;
  /** Checks the current tile order against the rung's valid words — the explicit
   * button/Enter action; nothing is checked automatically while dragging. */
  onCheck: () => void;
  /** Result of the most recent onCheck call, for a brief UI reaction; clears itself. */
  checkFeedback: GuessOutcome | null;
  onHint: () => void;
  onAdvance: () => void;
  /** Freeplay only: start a new puzzle after completing one. */
  onNextPuzzle?: () => void;
}
