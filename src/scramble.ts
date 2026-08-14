import type { Rng } from './types';

const MAX_RESHUFFLE_ATTEMPTS = 20;

/** Fisher–Yates shuffle of a string's characters using an injected RNG. */
export function shuffleString(letters: string, rng: Rng): string {
  const chars = letters.split('');
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = chars[i]!;
    chars[i] = chars[j]!;
    chars[j] = tmp;
  }
  return chars.join('');
}

function reverseString(s: string): string {
  return s.split('').reverse().join('');
}

function samePositionMatches(a: string, b: string): number {
  let count = 0;
  for (let i = 0; i < a.length && i < b.length; i++) {
    if (a[i] === b[i]) count++;
  }
  return count;
}

/**
 * How many same-position letter matches against a target word (or its
 * reverse) still count as "not close" — 0 for short words, since even one
 * correctly-placed letter reads as a giveaway; a little slack for longer
 * words so bounded retries can still usually find something. Tunable.
 */
function maxAllowedMatches(length: number): number {
  return length <= 4 ? 0 : Math.floor(length / 4);
}

/** True if `candidate` reads as basically `word` or basically `word` backwards. */
function isTooCloseToWord(candidate: string, word: string): boolean {
  const reversed = reverseString(word);
  const threshold = maxAllowedMatches(word.length);
  return (
    candidate === word ||
    candidate === reversed ||
    samePositionMatches(candidate, word) > threshold ||
    samePositionMatches(candidate, reversed) > threshold
  );
}

/** True if `candidate` is exactly one of `words` (case-insensitive) — a stricter, cheaper
 * check than `isTooCloseToWord`, used where "not literally the answer" is all that's needed. */
function isExactMatch(candidate: string, words: string[]): boolean {
  const lower = candidate.toLowerCase();
  return words.some((w) => w.toLowerCase() === lower);
}

/**
 * Scrambles `letters` (a rung's full anagram key) into an arrangement that
 * doesn't read as one of `targetWords` or any of their reversals — see
 * `isTooCloseToWord`. Re-rolls a bounded number of times when the shuffle is
 * too close.
 *
 * That "not close" preference is a soft one, though — for a rung whose full
 * anagram group covers most or all of its own permutations (e.g. "art" /
 * "rat" / "tar" between them account for every reasonably-distinct
 * 3-letter arrangement of those letters), *every* shuffle can end up too
 * close to something, and falling back to "whatever the last attempt was"
 * risks literally handing back one of the answers. So the fallback here is
 * tiered: first prefer an attempt that's merely not an exact answer (much
 * easier to satisfy) over one that's simply the most recent attempt. Only
 * when every single attempt was itself an exact answer (a truly unavoidable
 * multiset — e.g. a 2-letter set, which only has two arrangements: the word
 * and its exact reverse) does this give up and return the last attempt.
 */
export function scrambleLetters(letters: string, rng: Rng, targetWords: string[] = []): string {
  const attempts: string[] = [];
  for (let i = 0; i < MAX_RESHUFFLE_ATTEMPTS; i++) {
    const candidate = shuffleString(letters, rng);
    if (!targetWords.some((word) => isTooCloseToWord(candidate, word))) {
      return candidate;
    }
    attempts.push(candidate);
  }
  const notLiterallyAnAnswer = attempts.find((candidate) => !isExactMatch(candidate, targetWords));
  return notLiterallyAnAnswer ?? attempts[attempts.length - 1]!;
}

/**
 * Inserts `letter` into `currentOrder` at a random position that doesn't
 * spell one of `avoidWords` outright. Used when advancing to a new rung so
 * the player's own arrangement carries forward as-is — only the newly
 * added letter's position is random — instead of rescrambling everything.
 * Bounded retries; if every position happens to spell a valid word
 * (pathological/tiny cases), the last attempt is returned anyway.
 */
export function insertLetterAvoidingSolution(
  currentOrder: string,
  letter: string,
  rng: Rng,
  avoidWords: string[],
): { result: string; index: number } {
  const positionCount = currentOrder.length + 1;
  const attemptCap = Math.max(positionCount, MAX_RESHUFFLE_ATTEMPTS);
  let result = currentOrder + letter;
  let index = currentOrder.length;

  for (let attempt = 0; attempt < attemptCap; attempt++) {
    const candidateIndex = Math.floor(rng() * positionCount);
    const candidate = currentOrder.slice(0, candidateIndex) + letter + currentOrder.slice(candidateIndex);
    result = candidate;
    index = candidateIndex;
    if (!isExactMatch(candidate, avoidWords)) {
      return { result, index };
    }
  }
  return { result, index }; // fallback: every position spelled a valid word
}

/**
 * Locks `anchorWord`'s letter at the newly-hinted position (`lockedCount -
 * 1`) within `currentOrder`, and reshuffles the rest of the still-unlocked
 * letters — so a hint reveals exactly one more correct letter without
 * leaving the remaining letters in whatever order they happened to already
 * be in (which could itself already spell the answer). Bounded retries,
 * same fallback policy as the other arrangement helpers above.
 */
export function lockNextPosition(
  currentOrder: string,
  anchorWord: string,
  lockedCount: number,
  rng: Rng,
  avoidWords: string[],
): string {
  const previouslyLocked = lockedCount - 1;
  const targetLetter = anchorWord[previouslyLocked]!;
  const prefix = currentOrder.slice(0, previouslyLocked) + targetLetter;

  const pool = currentOrder.slice(previouslyLocked).split('');
  const targetIdx = pool.indexOf(targetLetter);
  if (targetIdx !== -1) {
    pool.splice(targetIdx, 1);
  }
  const poolString = pool.join('');

  let suffix = shuffleString(poolString, rng);
  let result = prefix + suffix;
  let attempts = 1;
  while (isExactMatch(result, avoidWords) && attempts < MAX_RESHUFFLE_ATTEMPTS) {
    suffix = shuffleString(poolString, rng);
    result = prefix + suffix;
    attempts++;
  }
  return result;
}
