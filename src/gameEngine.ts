import { scrambleLetters } from './scramble';
import type { Chain, GameState, Rng, RungProgress, SubmitGuessResult } from './types';

function currentRung(state: GameState) {
  const rung = state.chain.rungs[state.currentRungIndex];
  if (!rung) {
    throw new Error(`GameState has no rung at index ${state.currentRungIndex}`);
  }
  return rung;
}

function currentProgress(state: GameState): RungProgress {
  const progress = state.progressByRung[state.currentRungIndex];
  if (!progress) {
    throw new Error(`GameState has no progress recorded for rung ${state.currentRungIndex}`);
  }
  return progress;
}

/** Starts a fresh playthrough of `chain`: scrambles rung 0 and seeds its progress record. */
export function initGame(chain: Chain, rng: Rng): GameState {
  const firstRung = chain.rungs[0];
  if (!firstRung) {
    throw new Error('Chain has no rungs');
  }
  const scramble = scrambleLetters(firstRung.key, rng, firstRung.words);
  return {
    chain,
    currentRungIndex: 0,
    progressByRung: [{ foundWords: [], hintsUsed: 0, scramble }],
    status: 'in-progress',
  };
}

/**
 * Checks `guess` against the current rung's valid words (case-insensitive).
 * A correct, not-yet-found word is recorded (this is CLAUDE.md's "continue to
 * anagram to find other words" option at a rung with 2+ valid words).
 */
export function submitGuess(state: GameState, guess: string): SubmitGuessResult {
  if (state.status === 'complete') {
    return { state, outcome: 'incorrect' };
  }

  const rung = currentRung(state);
  const normalized = guess.trim().toLowerCase();
  const canonical = rung.words.find((w) => w.toLowerCase() === normalized);

  if (!canonical) {
    return { state, outcome: 'incorrect' };
  }

  const progress = currentProgress(state);
  if (progress.foundWords.includes(canonical)) {
    return { state, outcome: 'alreadyFound' };
  }

  const updatedProgress: RungProgress = {
    ...progress,
    foundWords: [...progress.foundWords, canonical],
  };
  const progressByRung = [...state.progressByRung];
  progressByRung[state.currentRungIndex] = updatedProgress;

  return { state: { ...state, progressByRung }, outcome: 'correct' };
}

/** True once the current rung has at least one found word and the game isn't already complete. */
export function canAdvance(state: GameState): boolean {
  return state.status === 'in-progress' && currentProgress(state).foundWords.length > 0;
}

export function isComplete(state: GameState): boolean {
  return state.status === 'complete';
}

/**
 * Moves to the next rung, scrambling its full letter set. If the current
 * rung is already the chain's last rung (no letter can extend it further —
 * see `build_progressive_anagrams.js`'s termination logic), the game ends
 * instead: `status` becomes `'complete'` and `currentRungIndex` stays put.
 */
export function advance(state: GameState, rng: Rng): GameState {
  if (!canAdvance(state)) {
    throw new Error('Cannot advance: current rung has no found word yet');
  }

  const isLastRung = state.currentRungIndex === state.chain.rungs.length - 1;
  if (isLastRung) {
    return { ...state, status: 'complete' };
  }

  const nextIndex = state.currentRungIndex + 1;
  const nextRung = state.chain.rungs[nextIndex]!;
  const scramble = scrambleLetters(nextRung.key, rng, nextRung.words);
  const nextProgress: RungProgress = { foundWords: [], hintsUsed: 0, scramble };

  return {
    ...state,
    currentRungIndex: nextIndex,
    progressByRung: [...state.progressByRung, nextProgress],
  };
}

/**
 * Locks one more letter position (left-to-right over the rung's anchor word,
 * `rung.words[0]`) at the current rung. A no-op once every position is
 * already locked, or once the game is complete.
 */
export function useHint(state: GameState): GameState {
  if (state.status === 'complete') {
    return state;
  }

  const rung = currentRung(state);
  const progress = currentProgress(state);
  const anchorWord = rung.words[0]!;
  const hintsUsed = Math.min(progress.hintsUsed + 1, anchorWord.length);

  if (hintsUsed === progress.hintsUsed) {
    return state; // already fully locked
  }

  const progressByRung = [...state.progressByRung];
  progressByRung[state.currentRungIndex] = { ...progress, hintsUsed };

  return { ...state, progressByRung };
}

/**
 * Derived, read-only view of what the player should see for the current
 * rung: locked positions (per `hintsUsed`, left-to-right over the anchor
 * word `rung.words[0]`) show the correct letter, unlocked positions show the
 * rung's stored scramble with the locked letters removed (relative order
 * otherwise preserved, so the display doesn't jitter as hints are used).
 */
export function getDisplayLetters(state: GameState): string[] {
  const rung = currentRung(state);
  const progress = currentProgress(state);
  const anchorWord = rung.words[0]!;
  const lockedCount = Math.min(progress.hintsUsed, anchorWord.length);

  const remaining = progress.scramble.split('');
  const result = new Array<string>(anchorWord.length);

  for (let i = 0; i < lockedCount; i++) {
    const letter = anchorWord[i]!;
    result[i] = letter;
    const idx = remaining.indexOf(letter);
    if (idx !== -1) {
      remaining.splice(idx, 1);
    }
  }

  let ri = 0;
  for (let i = lockedCount; i < anchorWord.length; i++) {
    result[i] = remaining[ri]!;
    ri++;
  }

  return result;
}
