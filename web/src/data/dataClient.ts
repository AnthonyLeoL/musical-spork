// Fetches the pipeline's pre-built JSON pool files (served as static assets
// from public/data/, symlinked to the repo-root files so nothing is
// duplicated on disk) and caches each one in memory for the session — a
// rung-count file is only ever fetched once, even across daily + freeplay.

import type { Chain, RungCountFile } from 'anagram-game-engine';

const cache = new Map<number, Promise<RungCountFile>>();

async function fetchRungCountFile(rungCount: number): Promise<RungCountFile> {
  const response = await fetch(`/data/progressive_anagrams_${rungCount}.json`);
  if (!response.ok) {
    throw new Error(`Failed to load puzzle data for rung count ${rungCount}: ${response.status}`);
  }
  return (await response.json()) as RungCountFile;
}

/** Loads (and caches) the pool of chains for a given rung count. */
export function loadRungCountFile(rungCount: number): Promise<RungCountFile> {
  let pending = cache.get(rungCount);
  if (!pending) {
    pending = fetchRungCountFile(rungCount);
    cache.set(rungCount, pending);
  }
  return pending;
}

/** The daily pool is always the rung-9 chains. */
export async function loadDailyPool(): Promise<Chain[]> {
  const file = await loadRungCountFile(9);
  return file.chains;
}
