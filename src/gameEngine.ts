import { insertLetterAvoidingSolution, lockNextPosition, scrambleLetters } from './scramble';
import type { AdvanceResult, Chain, GameState, Rng, Rung, RungProgress, SubmitGuessResult } from './types';

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

function sortedChars(s: string): string {
  return s.split('').sort().join('');
}

/**
 * The word a hint lock (and the locked-prefix check in `setCurrentOrder`)
 * anchors toward: the first of the rung's words *not* already in
 * `progress.foundWords`. Plain `rung.words[0]` would keep pointing at an
 * already-found word once it's been guessed, making a hint at a multi-word
 * rung useless (or actively misleading) for finding the remaining ones.
 * Falls back to `rung.words[0]` if every word has already been found (hints
 * shouldn't normally be requested at that point, but this keeps the helper
 * total).
 */
function hintAnchorWord(rung: Rung, progress: RungProgress): string {
  return rung.words.find((word) => !progress.foundWords.includes(word)) ?? rung.words[0]!;
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
    progressByRung: [
      { foundWords: [], hintsUsed: 0, hintsUsedTotal: 0, scramble, currentOrder: scramble },
    ],
    status: 'in-progress',
  };
}

/**
 * Checks `guess` against the current rung's valid words (case-insensitive).
 * A correct, not-yet-found word is recorded (this is CLAUDE.md's "continue to
 * anagram to find other words" option at a rung with 2+ valid words).
 * Doesn't touch `currentOrder` — finding a word leaves the tiles exactly as
 * the player arranged them, it doesn't rescramble anything.
 *
 * `acceptedWords` — the current rung's entry in `accepted_words.json` (see
 * `AcceptedWordsFile`) — is checked as a fallback whenever `guess` isn't one
 * of the curated `rung.words`. `rung.words` stays the puzzle's *intended*
 * target list (still what scrambling/hints/the share string are built
 * around); `acceptedWords` is the broader "any real dictionary word for
 * these letters" list, so a legitimate word the curated pool happens to be
 * missing (e.g. "tare" alongside "rate"/"tear") is still accepted rather
 * than rejected outright. Omit it (or pass `undefined`) to check only
 * `rung.words`, e.g. in tests that don't care about the broader dictionary.
 *
 * It does release any hint lock (`hintsUsed` resets to 0, though
 * `hintsUsedTotal` — what the share string reports — doesn't): a lock only
 * ever anchors toward one specific word (`rung.words[0]`), so once the
 * player has found *a* word, keeping it locked would only get in the way of
 * searching for any other valid words this rung might have.
 *
 * Finding a word at the chain's *last* rung completes the game immediately:
 * there's no further letter that can be added, so there's nothing to wait
 * on the player to manually advance into (see `advance`'s doc for the
 * defensive fallback on this same transition).
 */
export function submitGuess(
  state: GameState,
  guess: string,
  acceptedWords?: string[],
): SubmitGuessResult {
  if (state.status === 'complete') {
    return { state, outcome: 'incorrect' };
  }

  const rung = currentRung(state);
  const normalized = guess.trim().toLowerCase();
  const canonical =
    rung.words.find((w) => w.toLowerCase() === normalized) ??
    acceptedWords?.find((w) => w.toLowerCase() === normalized);

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
    hintsUsed: 0,
  };
  const progressByRung = [...state.progressByRung];
  progressByRung[state.currentRungIndex] = updatedProgress;

  const isLastRung = state.currentRungIndex === state.chain.rungs.length - 1;
  const status = isLastRung ? 'complete' : state.status;

  return { state: { ...state, progressByRung, status }, outcome: 'correct' };
}

/** True once the current rung has at least one found word and the game isn't already complete. */
export function canAdvance(state: GameState): boolean {
  return state.status === 'in-progress' && currentProgress(state).foundWords.length > 0;
}

export function isComplete(state: GameState): boolean {
  return state.status === 'complete';
}

/**
 * Moves to the next rung by inserting its added letter into the *current*
 * rung's live arrangement (`currentOrder`) at a random position that isn't
 * the new rung's answer — the player's own tile order carries forward
 * as-is, only the new letter is placed randomly (see
 * `insertLetterAvoidingSolution`). `insertedIndex` on the result tells a
 * caller exactly where that new tile landed, for animating it in.
 *
 * If the current rung is already the chain's last rung (no letter can
 * extend it further — see `build_progressive_anagrams.js`'s termination
 * logic), the game ends instead: `status` becomes `'complete'`,
 * `currentRungIndex` stays put, and `insertedIndex` is `null`. In practice
 * `submitGuess` already completes the game the moment a word is found at
 * the last rung, so this is a defensive fallback rather than the normal path.
 */
export function advance(state: GameState, rng: Rng): AdvanceResult {
  if (!canAdvance(state)) {
    throw new Error('Cannot advance: current rung has no found word yet');
  }

  const isLastRung = state.currentRungIndex === state.chain.rungs.length - 1;
  if (isLastRung) {
    return { state: { ...state, status: 'complete' }, insertedIndex: null };
  }

  const nextIndex = state.currentRungIndex + 1;
  const nextRung = state.chain.rungs[nextIndex]!;
  const currentOrderNow = currentProgress(state).currentOrder;
  const { result: inserted, index } = insertLetterAvoidingSolution(
    currentOrderNow,
    nextRung.addedLetter!,
    rng,
    nextRung.words,
  );
  const nextProgress: RungProgress = {
    foundWords: [],
    hintsUsed: 0,
    hintsUsedTotal: 0,
    scramble: inserted,
    currentOrder: inserted,
  };

  return {
    state: {
      ...state,
      currentRungIndex: nextIndex,
      progressByRung: [...state.progressByRung, nextProgress],
    },
    insertedIndex: index,
  };
}

/**
 * Locks one more letter position (left-to-right over the rung's anchor
 * word — the first of `rung.words` not already in `foundWords`, see
 * `hintAnchorWord`) at the current rung, reshuffling the still-unlocked
 * letters so revealing one doesn't leave the rest already spelling the
 * answer (see `lockNextPosition`). A no-op once every position is already
 * locked, or once the game is complete. Also bumps `hintsUsedTotal` — unlike
 * `hintsUsed`, that count survives a later correct-guess lock release, so a
 * hint still shows up in the share string even after its lock is gone.
 */
export function useHint(state: GameState, rng: Rng): GameState {
  if (state.status === 'complete') {
    return state;
  }

  const rung = currentRung(state);
  const progress = currentProgress(state);
  const anchorWord = hintAnchorWord(rung, progress);
  const hintsUsed = Math.min(progress.hintsUsed + 1, anchorWord.length);

  if (hintsUsed === progress.hintsUsed) {
    return state; // already fully locked
  }

  const currentOrder = lockNextPosition(progress.currentOrder, anchorWord, hintsUsed, rng, rung.words);
  const progressByRung = [...state.progressByRung];
  progressByRung[state.currentRungIndex] = {
    ...progress,
    hintsUsed,
    hintsUsedTotal: progress.hintsUsedTotal + 1,
    currentOrder,
  };

  return { ...state, progressByRung };
}

/** Read-only view of the current rung's live arrangement, one character per tile. */
export function getDisplayLetters(state: GameState): string[] {
  return currentProgress(state).currentOrder.split('');
}

/**
 * Overwrites the current rung's live arrangement — call this whenever the
 * player finishes dragging tiles into a new order, independent of whether
 * they've checked it yet (checking is `submitGuess`; this just persists
 * where the tiles visually are). Rejects an order that would move a locked
 * (hinted) letter or that isn't a permutation of this rung's letters.
 */
export function setCurrentOrder(state: GameState, order: string): GameState {
  const rung = currentRung(state);
  const progress = currentProgress(state);
  const anchorWord = hintAnchorWord(rung, progress);
  const lockedCount = progress.hintsUsed;

  if (order.length !== rung.key.length) {
    throw new Error(`setCurrentOrder: expected ${rung.key.length} letters, got ${order.length}`);
  }
  if (order.slice(0, lockedCount) !== anchorWord.slice(0, lockedCount)) {
    throw new Error('setCurrentOrder: cannot move a locked letter');
  }
  if (sortedChars(order) !== sortedChars(rung.key)) {
    throw new Error("setCurrentOrder: order is not a permutation of this rung's letters");
  }

  const progressByRung = [...state.progressByRung];
  progressByRung[state.currentRungIndex] = { ...progress, currentOrder: order };
  return { ...state, progressByRung };
}
