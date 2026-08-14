import { describe, expect, it } from 'vitest';
import { buildShareString } from '../src/shareScore';
import type { Chain, GameState, RungProgress } from '../src/types';

const CHAIN: Chain = {
  rungCount: 3,
  rungs: [
    { key: 'art', length: 3, words: ['art', 'rat', 'tar'], addedLetter: null },
    { key: 'acrt', length: 4, words: ['cart'], addedLetter: 'c' },
    { key: 'aacrt', length: 5, words: ['carat'], addedLetter: 'a' },
  ],
};

// buildShareString only reads `scramble` and `hintsUsedTotal` — `currentOrder` and `hintsUsed`
// (the *current* lock count, separate from the cumulative total — see gameEngine.ts) are
// irrelevant here but required by the type, so they're just defaulted for these fixtures.
function progress(p: { foundWords: string[]; hintsUsedTotal: number; scramble: string }): RungProgress {
  return { ...p, hintsUsed: p.hintsUsedTotal, currentOrder: p.scramble };
}

function stateWith(progressByRung: GameState['progressByRung']): GameState {
  return { chain: CHAIN, currentRungIndex: progressByRung.length - 1, progressByRung, status: 'in-progress' };
}

describe('buildShareString', () => {
  it('joins each rung\'s scramble with " -> "', () => {
    const state = stateWith([
      progress({ foundWords: ['rat'], hintsUsedTotal: 0, scramble: 'tar' }),
      progress({ foundWords: ['cart'], hintsUsedTotal: 0, scramble: 'tarc' }),
    ]);
    expect(buildShareString(state)).toBe('tar -> tarc');
  });

  it('prefixes a rung with "(hint)" if it used any hints', () => {
    const state = stateWith([
      progress({ foundWords: ['rat'], hintsUsedTotal: 0, scramble: 'tar' }),
      progress({ foundWords: ['cart'], hintsUsedTotal: 1, scramble: 'tarc' }),
      progress({ foundWords: ['carat'], hintsUsedTotal: 2, scramble: 'taarc' }),
    ]);
    expect(buildShareString(state)).toBe('tar -> (hint)tarc -> (hint)taarc');
  });

  it('handles a single-rung game', () => {
    const state = stateWith([progress({ foundWords: ['rat'], hintsUsedTotal: 0, scramble: 'tar' })]);
    expect(buildShareString(state)).toBe('tar');
  });

  it('still shows "(hint)" after a hint\'s lock has been released by a correct guess', () => {
    // hintsUsed (the current lock count) is back to 0, but hintsUsedTotal —
    // what buildShareString actually reads — remembers the hint was used.
    const state = stateWith([
      { foundWords: ['cart'], hintsUsed: 0, hintsUsedTotal: 1, scramble: 'tarc', currentOrder: 'tarc' },
    ]);
    expect(buildShareString(state)).toBe('(hint)tarc');
  });
});
