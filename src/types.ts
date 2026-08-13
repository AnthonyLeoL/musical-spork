// Types mirroring the on-disk JSON produced by the data pipeline
// (build_progressive_anagrams.js / split_progressive_anagrams.js), plus the
// engine's own game-state shapes. See CLAUDE.md for the pipeline that
// produces the raw data these types describe.

/** A single rung of a progressive anagram chain, as stored in the JSON pool files. */
export interface Rung {
  /** Letters of this rung's word(s), lowercased and sorted (the anagram key). */
  key: string;
  /** Number of letters in `key` — equal to `key.length`, kept explicit in the data. */
  length: number;
  /** Every valid dictionary word for this letter set. Always at least one. */
  words: string[];
  /** The letter added to the previous rung's key to reach this one. `null` only on rung 0. */
  addedLetter: string | null;
}

/** A full progressive anagram chain: a 3-letter start, +1 letter per rung, to a dead end. */
export interface Chain {
  rungCount: number;
  rungs: Rung[];
}

/** Shape of `progressive_anagrams_{3..9}.json`. */
export interface RungCountFile {
  rungCount: number;
  count: number;
  chains: Chain[];
}

/** Shape of `progressive_anagrams.json`. */
export interface ProgressiveAnagramsFile {
  chains: Chain[];
  meta: {
    totalChains: number;
    totalStartingKeys: number;
    startingKeysWithChains: number;
    longestChainRungCount: number;
    longestChainCount: number;
    exampleLongestChain: Chain | null;
  };
}

/** Injectable random source, `() => number` in [0, 1) — same contract as `Math.random`. */
export type Rng = () => number;

/** Per-rung play record, kept for the lifetime of a game so the share string can replay history. */
export interface RungProgress {
  /** Subset of the rung's `words`, in the order the player found them. */
  foundWords: string[];
  /** Number of hints used on this rung so far. */
  hintsUsed: number;
  /** The letter arrangement shown to the player when they first reached this rung. */
  scramble: string;
}

export type GameStatus = 'in-progress' | 'complete';

/** Full state of one puzzle playthrough (daily or freeplay). Immutable — every engine
 * function returns a new GameState rather than mutating the one it was given. */
export interface GameState {
  chain: Chain;
  currentRungIndex: number;
  /** One entry per rung reached so far; `progressByRung.length === currentRungIndex + 1`. */
  progressByRung: RungProgress[];
  status: GameStatus;
}

export type GuessOutcome = 'correct' | 'alreadyFound' | 'incorrect';

export interface SubmitGuessResult {
  state: GameState;
  outcome: GuessOutcome;
}

/** Freeplay-only progress, persisted by the caller (this engine never touches storage). */
export interface FreeplayProgress {
  level: number;
  puzzlesCompleted: number;
  longestChainCompleted: number;
}
