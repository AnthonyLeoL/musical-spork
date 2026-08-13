import type { GameState } from './types';

/**
 * Builds the shareable score string: each rung reached so far contributes
 * its scrambled letters, joined by " -> ", prefixed with "(hint)" if any
 * hint was used on that rung. E.g. `art -> (hint)tarc -> (hint)carts`.
 */
export function buildShareString(state: GameState): string {
  return state.progressByRung
    .map((progress) => `${progress.hintsUsed > 0 ? '(hint)' : ''}${progress.scramble}`)
    .join(' -> ');
}
