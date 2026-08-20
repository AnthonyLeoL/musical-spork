import type { GuessOutcome } from 'anagram-game-engine';
import type { Tile } from './tiles';

/** Shared shape both the daily and freeplay hooks return, so <PuzzleBoard>
 * doesn't need to know which mode it's rendering. */
export interface PuzzleController {
  loading: boolean;
  error: string | null;
  /** Short subtitle, e.g. "Daily — 7 rungs" or "Freeplay — Level 3 — 5 rungs". */
  label: string;
  tiles: Tile[];
  rungNumber: number; // 1-based, for display
  rungCount: number;
  /** Every word found at the current rung so far, in the order found —
   * both curated (`targetWordCount`) and bonus (`bonusWordsFound`) finds,
   * since submitGuess now accepts any dictionary word for the rung's
   * letters, not only the puzzle's intended target words (see CLAUDE.md's
   * two-list design). Uncapped — there's no longer a fixed "N of M" ceiling
   * to display, since a rung's true acceptable-word count isn't known
   * upfront the way the curated one is. */
  foundWords: string[];
  /** How many of `foundWords` are curated `rung.words` (the puzzle's intended
   * targets), used only to drive the LetterRack gold-tint animation — not
   * displayed as a target count in the UI, since bonus words mean there's no
   * longer a fixed ceiling to display as "N of M". */
  targetWordCount: number;
  /** Subset of `foundWords` that are valid dictionary words for this rung but
   * weren't in the curated `rung.words` target list — real finds the pool
   * happened to be missing (e.g. "tare" alongside "rate"/"tear"). */
  bonusWordsFound: string[];
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
  /** Freeplay only: every rung count unlocked so far via normal level progression (3 up to
   * rungCountForLevel(progress.level)) — the options for the "pick a shorter length" menu. */
  unlockedRungCounts?: number[];
  /** Freeplay only: abandons the current puzzle and starts a fresh one at an explicit,
   * already-unlocked rung count, bypassing the level-derived one. Completing a puzzle started
   * this way at anything shorter than the level-derived rung count is a practice replay — it
   * doesn't advance level/puzzlesCompleted (see useFreeplayPuzzle's onCheck). */
  onSelectRungCount?: (rungCount: number) => void;
}
