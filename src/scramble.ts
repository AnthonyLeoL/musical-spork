import type { Rng } from './types';

const MAX_RESHUFFLE_ATTEMPTS = 20;

/** Fisher–Yates shuffle of a string's characters using an injected RNG. */
function shuffleOnce(letters: string, rng: Rng): string {
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

/**
 * Scrambles `letters` (a rung's full anagram key) into an arrangement that
 * doesn't read as one of `targetWords` or any of their reversals — see
 * `isTooCloseToWord`. Re-rolls a bounded number of times when the shuffle is
 * too close; for very small letter multisets (e.g. a 2-letter set, which
 * only has two arrangements — the word and its exact reverse) avoiding both
 * is impossible, so this returns the last attempt anyway rather than
 * looping forever — best-effort, as requested.
 */
export function scrambleLetters(letters: string, rng: Rng, targetWords: string[] = []): string {
  let result = shuffleOnce(letters, rng);
  let attempts = 1;
  while (
    targetWords.some((word) => isTooCloseToWord(result, word)) &&
    attempts < MAX_RESHUFFLE_ATTEMPTS
  ) {
    result = shuffleOnce(letters, rng);
    attempts++;
  }
  return result;
}
