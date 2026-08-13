import type { Rng } from './types';

/**
 * djb2 string hash → unsigned 32-bit int. Used to turn a date string (or any
 * other string key) into a deterministic seed, so the same input always
 * produces the same derived RNG/index.
 */
export function hashString(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  // >>> 0 coerces to an unsigned 32-bit integer.
  return hash >>> 0;
}

/**
 * mulberry32 — small, fast, deterministic PRNG. Given the same seed it
 * always produces the same sequence, which is what makes the daily puzzle's
 * chain pick *and* scrambles reproducible for every player on a given day.
 */
export function mulberry32(seed: number): Rng {
  let state = seed >>> 0;
  return function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Default RNG for callers that don't care about determinism (e.g. ad-hoc freeplay). */
export function defaultRng(): Rng {
  return Math.random;
}
