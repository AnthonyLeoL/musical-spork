import type { Chain, FreeplayProgress } from './types';

export function initialFreeplayProgress(): FreeplayProgress {
  return { level: 1, puzzlesCompleted: 0, longestChainCompleted: 0 };
}

/**
 * Pure update for when a player finishes a chain (reaches its last rung).
 * The caller owns persisting the result — this engine never touches storage.
 */
export function recordCompletion(progress: FreeplayProgress, chain: Chain): FreeplayProgress {
  return {
    level: progress.level + 1,
    puzzlesCompleted: progress.puzzlesCompleted + 1,
    longestChainCompleted: Math.max(progress.longestChainCompleted, chain.rungCount),
  };
}
