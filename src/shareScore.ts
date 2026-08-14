import type { GameState } from './types';

/**
 * Builds the shareable score string: each rung reached so far contributes
 * its scrambled letters, joined by " -> ", prefixed with "(hint)" if any
 * hint was used on that rung. E.g. `art -> (hint)tarc -> (hint)carts`.
 *
 * Reads `hintsUsedTotal`, not `hintsUsed` — a hint's *lock* releases as soon
 * as the player finds a word (see submitGuess), but it should still count
 * against the score even after that.
 */
export function buildShareString(state: GameState): string {
  return state.progressByRung
    .map((progress) => `${progress.hintsUsedTotal > 0 ? '(hint)' : ''}${progress.scramble}`)
    .join(' -> ');
}
