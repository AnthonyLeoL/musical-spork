// Fetches the pipeline's pre-built JSON pool files (served as static assets
// from public/data/, symlinked to the repo-root files so nothing is
// duplicated on disk) and caches each one in memory for the session — a
// rung-count file is only ever fetched once, even across daily + freeplay.

import type { AcceptedWordsFile, Chain, RungCountFile } from 'anagram-game-engine';

const cache = new Map<number, Promise<RungCountFile>>();
let acceptedWordsCache: Promise<AcceptedWordsFile> | null = null;

async function fetchRungCountFile(rungCount: number): Promise<RungCountFile> {
  // BASE_URL (Vite's `base` config) rather than a hardcoded leading slash —
  // on GitHub Pages this app is served from /musical-spork/, not the domain
  // root, so an absolute `/data/...` path 404s there.
  const response = await fetch(`${import.meta.env.BASE_URL}data/progressive_anagrams_${rungCount}.json`);
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

/** The daily pool is always the rung-7 chains. */
export async function loadDailyPool(): Promise<Chain[]> {
  const file = await loadRungCountFile(7);
  return file.chains;
}

/** Loads (and caches, once per session — shared by daily + freeplay) the
 * dictionary-wide acceptance index `submitGuess` checks a guess against
 * whenever it isn't one of the current rung's curated `words`. */
export function loadAcceptedWords(): Promise<AcceptedWordsFile> {
  if (!acceptedWordsCache) {
    acceptedWordsCache = fetch(`${import.meta.env.BASE_URL}data/accepted_words.json`).then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load accepted-words data: ${response.status}`);
      }
      return response.json() as Promise<AcceptedWordsFile>;
    });
  }
  return acceptedWordsCache;
}
