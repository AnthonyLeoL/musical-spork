// Small localStorage wrapper. The engine itself is stateless (see
// CLAUDE.md / src/gameEngine.ts) — this is the "caller persists whatever
// state it gets back" side of that contract, kept in one place so the game
// hooks don't sprinkle try/catch JSON parsing everywhere.

import type { FreeplayProgress, GameState } from 'anagram-game-engine';

const FREEPLAY_PROGRESS_KEY = 'anagram.freeplay.progress';
const FREEPLAY_GAME_KEY = 'anagram.freeplay.game';
const DAILY_GAME_KEY_PREFIX = 'anagram.daily.game.'; // + dateStr

function load<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null; // corrupt/unavailable storage shouldn't crash the game
  }
}

function save<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // best-effort — a full/unavailable localStorage just means progress
    // won't persist across reloads, not a reason to break the game.
  }
}

function clear(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function loadFreeplayProgress(): FreeplayProgress | null {
  return load<FreeplayProgress>(FREEPLAY_PROGRESS_KEY);
}

export function saveFreeplayProgress(progress: FreeplayProgress): void {
  save(FREEPLAY_PROGRESS_KEY, progress);
}

export function loadFreeplayGame(): GameState | null {
  return load<GameState>(FREEPLAY_GAME_KEY);
}

export function saveFreeplayGame(state: GameState): void {
  save(FREEPLAY_GAME_KEY, state);
}

export function clearFreeplayGame(): void {
  clear(FREEPLAY_GAME_KEY);
}

export function loadDailyGame(dateStr: string): GameState | null {
  return load<GameState>(DAILY_GAME_KEY_PREFIX + dateStr);
}

export function saveDailyGame(dateStr: string, state: GameState): void {
  save(DAILY_GAME_KEY_PREFIX + dateStr, state);
}
