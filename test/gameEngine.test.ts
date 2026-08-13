import { beforeEach, describe, expect, it } from 'vitest';
import {
  advance,
  canAdvance,
  getDisplayLetters,
  initGame,
  isComplete,
  submitGuess,
  useHint,
} from '../src/gameEngine';
import { mulberry32 } from '../src/rng';
import type { Chain, GameState } from '../src/types';

const CHAIN: Chain = {
  rungCount: 3,
  rungs: [
    { key: 'art', length: 3, words: ['art', 'rat', 'tar'], addedLetter: null },
    { key: 'acrt', length: 4, words: ['cart'], addedLetter: 'c' },
    { key: 'aacrt', length: 5, words: ['carat'], addedLetter: 'a' },
  ],
};

function sortedChars(s: string): string {
  return s.split('').sort().join('');
}

describe('initGame', () => {
  it('seeds rung 0 in-progress with a scrambled key and no found words', () => {
    const state = initGame(CHAIN, mulberry32(1));
    expect(state.currentRungIndex).toBe(0);
    expect(state.status).toBe('in-progress');
    expect(state.progressByRung).toHaveLength(1);
    expect(state.progressByRung[0]!.foundWords).toEqual([]);
    expect(state.progressByRung[0]!.hintsUsed).toBe(0);
    expect(sortedChars(state.progressByRung[0]!.scramble)).toBe(sortedChars('art'));
  });
});

describe('submitGuess', () => {
  let state: GameState;
  beforeEach(() => {
    state = initGame(CHAIN, mulberry32(1));
  });

  it('accepts a valid word and records it', () => {
    const result = submitGuess(state, 'rat');
    expect(result.outcome).toBe('correct');
    expect(result.state.progressByRung[0]!.foundWords).toEqual(['rat']);
  });

  it('is case-insensitive', () => {
    const result = submitGuess(state, 'RAT');
    expect(result.outcome).toBe('correct');
    expect(result.state.progressByRung[0]!.foundWords).toEqual(['rat']);
  });

  it('flags a repeat guess as alreadyFound without duplicating it', () => {
    const first = submitGuess(state, 'rat');
    const second = submitGuess(first.state, 'rat');
    expect(second.outcome).toBe('alreadyFound');
    expect(second.state.progressByRung[0]!.foundWords).toEqual(['rat']);
  });

  it('rejects a word that is not valid for the rung', () => {
    const result = submitGuess(state, 'zzz');
    expect(result.outcome).toBe('incorrect');
    expect(result.state.progressByRung[0]!.foundWords).toEqual([]);
  });

  it('lets the player find multiple words at the same rung', () => {
    const first = submitGuess(state, 'rat');
    const second = submitGuess(first.state, 'tar');
    expect(second.outcome).toBe('correct');
    expect(second.state.progressByRung[0]!.foundWords).toEqual(['rat', 'tar']);
  });
});

describe('canAdvance / advance', () => {
  it('cannot advance before finding a word at the current rung', () => {
    const state = initGame(CHAIN, mulberry32(1));
    expect(canAdvance(state)).toBe(false);
    expect(() => advance(state, mulberry32(2))).toThrow();
  });

  it('advances to the next rung after a correct guess', () => {
    let state = initGame(CHAIN, mulberry32(1));
    state = submitGuess(state, 'rat').state;
    expect(canAdvance(state)).toBe(true);

    state = advance(state, mulberry32(2));
    expect(state.currentRungIndex).toBe(1);
    expect(state.progressByRung).toHaveLength(2);
    expect(state.progressByRung[1]!.foundWords).toEqual([]);
    expect(sortedChars(state.progressByRung[1]!.scramble)).toBe(sortedChars('acrt'));
    expect(state.status).toBe('in-progress');
  });

  it('completes the game when advancing past the last rung', () => {
    let state = initGame(CHAIN, mulberry32(1));
    state = submitGuess(state, 'rat').state;
    state = advance(state, mulberry32(2));
    state = submitGuess(state, 'cart').state;
    state = advance(state, mulberry32(3));
    expect(state.currentRungIndex).toBe(2);

    state = submitGuess(state, 'carat').state;
    expect(canAdvance(state)).toBe(true);
    state = advance(state, mulberry32(4));

    expect(isComplete(state)).toBe(true);
    expect(state.currentRungIndex).toBe(2); // stays on the last rung
    expect(state.progressByRung).toHaveLength(3);
  });
});

describe('useHint / getDisplayLetters', () => {
  it('reveals no locked letters before any hint', () => {
    const state = initGame(CHAIN, mulberry32(1));
    const display = getDisplayLetters(state).join('');
    expect(sortedChars(display)).toBe(sortedChars('art'));
  });

  it('locks one more position (left-to-right over words[0]) per hint', () => {
    let state = initGame(CHAIN, mulberry32(1));
    state = useHint(state);
    expect(state.progressByRung[0]!.hintsUsed).toBe(1);
    let display = getDisplayLetters(state);
    expect(display[0]).toBe('art'[0]);

    state = useHint(state);
    display = getDisplayLetters(state);
    expect(display[0]).toBe('art'[0]);
    expect(display[1]).toBe('art'[1]);
  });

  it('caps at the anchor word length and stops changing state', () => {
    let state = initGame(CHAIN, mulberry32(1));
    for (let i = 0; i < 10; i++) {
      state = useHint(state);
    }
    expect(state.progressByRung[0]!.hintsUsed).toBe('art'.length);
    expect(getDisplayLetters(state).join('')).toBe('art');
  });
});
