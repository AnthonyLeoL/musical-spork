// Node-only convenience readers for the pipeline's output JSON files. Kept
// separate from the rest of src/ so the actual game engine has no `fs`
// dependency and stays portable to a browser front-end later — only this
// module would need a replacement (e.g. `fetch`) there.

import * as fs from 'fs';
import * as path from 'path';
import type { Chain, ProgressiveAnagramsFile, RungCountFile } from './types';

// dist/loaders.js sits one level below the repo root (dist/ mirrors src/),
// same as this file's own source location — one `..` reaches the repo root
// either way.
const REPO_ROOT = path.join(__dirname, '..');

export type SplitRungCount = 3 | 4 | 5 | 6 | 7 | 8 | 9;

function readJsonFile<T>(filename: string): T {
  const filePath = path.join(REPO_ROOT, filename);
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

/** Reads `progressive_anagrams_{rungCount}.json`. */
export function loadRungCountFile(rungCount: SplitRungCount): RungCountFile {
  return readJsonFile<RungCountFile>(`progressive_anagrams_${rungCount}.json`);
}

/** Reads `progressive_anagrams_9.json`'s chains — the daily puzzle pool. */
export function loadDailyPool(): Chain[] {
  return loadRungCountFile(9).chains;
}

/** Reads the full, unsplit `progressive_anagrams.json` (~45MB) — rarely needed directly;
 * prefer `loadRungCountFile` for a specific difficulty. */
export function loadFullPool(): ProgressiveAnagramsFile {
  return readJsonFile<ProgressiveAnagramsFile>('progressive_anagrams.json');
}
