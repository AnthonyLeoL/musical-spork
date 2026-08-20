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

/**
 * Shape of `accepted_words.json` — every dictionary word (not just the
 * pool-curated `rung.words`) for each key that occurs as some chain's rung,
 * built by `build_accepted_words.js`. `rung.words` stays the curated
 * *target* list a puzzle was designed around (scrambling, hints, share
 * string); this is the separate, broader *acceptance* list `submitGuess`
 * checks a guess against, so a real word missing from the curated pool
 * (e.g. "tare", "crates", "slag") is still accepted rather than rejected.
 * Keyed and shaped identically to `anagrams.json`, just sourced from the
 * full dictionary and restricted to keys that actually occur in a chain.
 */
export type AcceptedWordsFile = Record<string, string[]>;

/** Injectable random source, `() => number` in [0, 1) — same contract as `Math.random`. */
export type Rng = () => number;

/** Per-rung play record, kept for the lifetime of a game so the share string can replay history. */
export interface RungProgress {
  /** Subset of the rung's `words`, in the order the player found them. */
  foundWords: string[];
  /** How many letters are *currently* locked (always a prefix over whichever of `rung.words` a
   * hint is currently anchored to — the first not-yet-found word, see `hintAnchorWord`). Reset
   * to 0 by a correct guess — a lock only ever anchors toward one specific word, so it's released
   * once that word is found, letting the player freely search for any other valid words at this
   * rung instead of staying stuck mid-way through spelling the word the hint was aimed at. */
  hintsUsed: number;
  /** Cumulative hints ever used at this rung, never reset — unlike `hintsUsed`, this is what
   * `buildShareString` reports, so a hint still shows up in the score even after its lock has
   * since been released by a correct guess. */
  hintsUsedTotal: number;
  /** The letter arrangement shown to the player when they first reached this rung — fixed at
   * rung-entry, used only for `buildShareString`. Unlike `currentOrder`, never mutated afterward. */
  scramble: string;
  /** The rung's *live* letter arrangement — what's actually displayed right now. Starts equal
   * to `scramble`, then evolves as the player drags tiles (`setCurrentOrder`) or uses a hint
   * (`useHint`). Deliberately never reset to `scramble` — finding a word or adding a letter
   * carries the player's own arrangement forward instead of rescrambling it. */
  currentOrder: string;
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

export interface AdvanceResult {
  state: GameState;
  /** Index of the newly-added letter within the new rung's arrangement
   * (`getDisplayLetters(result.state)`) — a caller can use this to animate
   * just that tile in. `null` when this call completed the game instead of
   * opening a new rung (nothing to animate). */
  insertedIndex: number | null;
}

/** Freeplay-only progress, persisted by the caller (this engine never touches storage). */
export interface FreeplayProgress {
  level: number;
  puzzlesCompleted: number;
  longestChainCompleted: number;
}
