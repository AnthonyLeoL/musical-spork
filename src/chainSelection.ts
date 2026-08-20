import { hashString, mulberry32 } from './rng';
import type { Chain, Rng, RungCountFile } from './types';

export const MIN_RUNG_COUNT = 3;
export const MAX_RUNG_COUNT = 9;

/** Every 2 completed puzzles, difficulty steps up by one rung count, capped at 9.
 * Tunable — retune by changing this one constant. */
const LEVELS_PER_RUNG_COUNT_STEP = 2;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Maps a freeplay level (1-based) to a rung count, starting short and
 * growing — CLAUDE.md's "start with short words and short rungs, and
 * gradually increase in both as users play". Every chain's rung 0 is a
 * 3-letter word by construction, so a low rung count already implies short
 * words throughout — no separate "word length" knob is needed.
 */
export function rungCountForLevel(level: number): number {
  const steps = Math.floor((Math.max(level, 1) - 1) / LEVELS_PER_RUNG_COUNT_STEP);
  return clamp(MIN_RUNG_COUNT + steps, MIN_RUNG_COUNT, MAX_RUNG_COUNT);
}

/** Uniform-random pick from a rung-count pool (a parsed `progressive_anagrams_N.json`). */
export function pickFreeplayChain(file: RungCountFile, rng: Rng): Chain {
  if (file.chains.length === 0) {
    throw new Error(`RungCountFile for rungCount ${file.rungCount} has no chains`);
  }
  const index = Math.floor(rng() * file.chains.length);
  return file.chains[Math.min(index, file.chains.length - 1)]!;
}

/**
 * Derives a per-day seed from a `YYYY-MM-DD` UTC date string so every player
 * on the same day gets the same daily chain and the same scrambled letters
 * (see `dailyRng`) — which is what makes comparing share strings meaningful.
 */
function seedForDate(dateStr: string): number {
  return hashString(dateStr);
}

/**
 * Seeded RNG for a given day, one instance per rung (`rungIndex` is the
 * chain's 0-based rung index being scrambled). Deriving each rung's seed
 * independently — rather than sharing one continuous RNG stream across the
 * whole game — means a player resuming a saved daily game after a reload
 * still lands on the exact same scramble at every rung as everyone else,
 * with no dependency on how much of the RNG stream they'd already consumed
 * before reloading.
 */
export function dailyRng(dateStr: string, rungIndex: number): Rng {
  return mulberry32(hashString(`${dateStr}#rung${rungIndex}`));
}

/**
 * Deterministically picks that day's chain from the daily pool (currently the
 * rung-7 pool, `progressive_anagrams_7.json`'s `chains` — see dataClient.ts's
 * `loadDailyPool`). Same `dateStr` always yields the same chain; this
 * function itself is agnostic to which rung count the pool is.
 */
export function pickDailyChain(chains: Chain[], dateStr: string): Chain {
  if (chains.length === 0) {
    throw new Error('the daily chain pool is empty');
  }
  const rng = mulberry32(seedForDate(dateStr));
  const index = Math.floor(rng() * chains.length);
  return chains[Math.min(index, chains.length - 1)]!;
}
