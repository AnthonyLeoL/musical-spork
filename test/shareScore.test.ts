import { describe, expect, it } from 'vitest';
import { buildShareString } from '../src/shareScore';
import type { Chain, GameState } from '../src/types';

const CHAIN: Chain = {
  rungCount: 3,
  rungs: [
    { key: 'art', length: 3, words: ['art', 'rat', 'tar'], addedLetter: null },
    { key: 'acrt', length: 4, words: ['cart'], addedLetter: 'c' },
    { key: 'aacrt', length: 5, words: ['carat'], addedLetter: 'a' },
  ],
};

function stateWith(progressByRung: GameState['progressByRung']): GameState {
  return { chain: CHAIN, currentRungIndex: progressByRung.length - 1, progressByRung, status: 'in-progress' };
}

describe('buildShareString', () => {
  it('joins each rung\'s scramble with " -> "', () => {
    const state = stateWith([
      { foundWords: ['rat'], hintsUsed: 0, scramble: 'tar' },
      { foundWords: ['cart'], hintsUsed: 0, scramble: 'tarc' },
    ]);
    expect(buildShareString(state)).toBe('tar -> tarc');
  });

  it('prefixes a rung with "(hint)" if it used any hints', () => {
    const state = stateWith([
      { foundWords: ['rat'], hintsUsed: 0, scramble: 'tar' },
      { foundWords: ['cart'], hintsUsed: 1, scramble: 'tarc' },
      { foundWords: ['carat'], hintsUsed: 2, scramble: 'taarc' },
    ]);
    expect(buildShareString(state)).toBe('tar -> (hint)tarc -> (hint)taarc');
  });

  it('handles a single-rung game', () => {
    const state = stateWith([{ foundWords: ['rat'], hintsUsed: 0, scramble: 'tar' }]);
    expect(buildShareString(state)).toBe('tar');
  });
});
