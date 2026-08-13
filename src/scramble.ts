import type { Rng } from './types';

const MAX_RESHUFFLE_ATTEMPTS = 10;

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

/**
 * Scrambles `letters` (a rung's full anagram key) so it doesn't visibly hand
 * the player one of the rung's answer words. Re-rolls a bounded number of
 * times if the shuffle happens to land on a real answer verbatim — for
 * letter sets with very few distinct arrangements (or where every
 * arrangement is a valid word) this can legitimately exhaust its retries,
 * in which case the last shuffle is returned as-is rather than looping
 * forever.
 */
export function scrambleLetters(letters: string, rng: Rng, avoidWords: string[] = []): string {
  const avoid = new Set(avoidWords.map((w) => w.toLowerCase()));
  let result = shuffleOnce(letters, rng);
  let attempts = 1;
  while (avoid.has(result.toLowerCase()) && attempts < MAX_RESHUFFLE_ATTEMPTS) {
    result = shuffleOnce(letters, rng);
    attempts++;
  }
  return result;
}
