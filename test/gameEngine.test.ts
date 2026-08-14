import { beforeEach, describe, expect, it } from 'vitest';
import {
  advance,
  canAdvance,
  getDisplayLetters,
  initGame,
  isComplete,
  setCurrentOrder,
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
    expect(state.progressByRung[0]!.currentOrder).toBe(state.progressByRung[0]!.scramble);
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

  it('does not touch currentOrder on a correct guess (no rescramble)', () => {
    const before = state.progressByRung[0]!.currentOrder;
    const result = submitGuess(state, 'rat');
    expect(result.state.progressByRung[0]!.currentOrder).toBe(before);
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

  it('does not complete the game at a non-last rung', () => {
    const result = submitGuess(state, 'rat');
    expect(isComplete(result.state)).toBe(false);
  });

  it('releases a hint lock on a correct guess, but keeps the cumulative hint count', () => {
    let s = initGame(CHAIN, mulberry32(1));
    s = useHint(s, mulberry32(10)); // locks position 0 to 'a' (words[0] === 'art')
    expect(s.progressByRung[0]!.hintsUsed).toBe(1);

    const result = submitGuess(s, 'art');
    expect(result.outcome).toBe('correct');
    expect(result.state.progressByRung[0]!.hintsUsed).toBe(0); // lock released
    expect(result.state.progressByRung[0]!.hintsUsedTotal).toBe(1); // still counts for scoring
  });

  it('lets the player rearrange into a different valid word after a hint lock is released', () => {
    // Locking position 0 to 'a' (from words[0] === 'art') would normally
    // block ever spelling "rat" or "tar" (both start with a different
    // letter) — finding *a* word should release that lock so the player
    // can still go hunt for the others.
    let s = initGame(CHAIN, mulberry32(1));
    s = useHint(s, mulberry32(10));
    expect(() => setCurrentOrder(s, 'tar')).toThrow(); // still locked pre-guess

    s = submitGuess(s, 'art').state;
    const rearranged = setCurrentOrder(s, 'tar'); // no longer locked
    expect(rearranged.progressByRung[0]!.currentOrder).toBe('tar');
    expect(submitGuess(rearranged, 'tar').outcome).toBe('correct');
  });

  it('completes the game immediately when a word is found at the last rung', () => {
    let s = initGame(CHAIN, mulberry32(1));
    s = submitGuess(s, 'rat').state;
    s = advance(s, mulberry32(2)).state;
    s = submitGuess(s, 'cart').state;
    s = advance(s, mulberry32(3)).state;
    expect(s.currentRungIndex).toBe(2); // last rung

    const result = submitGuess(s, 'carat');
    expect(result.outcome).toBe('correct');
    expect(isComplete(result.state)).toBe(true);
    expect(result.state.currentRungIndex).toBe(2); // stays put, no rung to advance into
  });
});

describe('canAdvance / advance', () => {
  it('cannot advance before finding a word at the current rung', () => {
    const state = initGame(CHAIN, mulberry32(1));
    expect(canAdvance(state)).toBe(false);
    expect(() => advance(state, mulberry32(2))).toThrow();
  });

  it('advances to the next rung, carrying the current arrangement forward', () => {
    let state = initGame(CHAIN, mulberry32(1));
    const prevOrder = state.progressByRung[0]!.currentOrder;
    state = submitGuess(state, 'rat').state;
    expect(canAdvance(state)).toBe(true);

    const { state: next, insertedIndex } = advance(state, mulberry32(2));
    expect(next.currentRungIndex).toBe(1);
    expect(next.progressByRung).toHaveLength(2);
    expect(next.progressByRung[1]!.foundWords).toEqual([]);
    expect(next.status).toBe('in-progress');

    // The new arrangement is exactly the previous one plus the added
    // letter inserted at insertedIndex — nothing else rescrambled.
    const newOrder = next.progressByRung[1]!.currentOrder;
    expect(insertedIndex).not.toBeNull();
    const withoutInserted = newOrder.slice(0, insertedIndex!) + newOrder.slice(insertedIndex! + 1);
    expect(withoutInserted).toBe(prevOrder);
    expect(newOrder[insertedIndex!]).toBe('c'); // acrt's addedLetter
    expect(sortedChars(newOrder)).toBe(sortedChars('acrt'));
  });

  it("doesn't insert the new letter at a position that spells the next rung's answer", () => {
    // acrt's only word is "cart" — the new letter 'c' must not land exactly
    // where it would spell "cart" verbatim from "art".
    let state = initGame(CHAIN, mulberry32(1));
    state = setCurrentOrder(state, 'art'); // pin a known starting arrangement
    state = submitGuess(state, 'rat').state; // 'rat' is still a valid word for key 'art'
    const { state: next } = advance(state, mulberry32(2));
    expect(next.progressByRung[1]!.currentOrder).not.toBe('cart');
  });

  it('completes the game when advance is (defensively) called already-past the last rung', () => {
    // submitGuess already completes the game at the last rung; this covers
    // advance's own defensive fallback for that same transition.
    let state = initGame(CHAIN, mulberry32(1));
    state = submitGuess(state, 'rat').state;
    state = advance(state, mulberry32(2)).state;
    state = submitGuess(state, 'cart').state;
    state = advance(state, mulberry32(3)).state;
    // Force back to in-progress to exercise advance()'s own last-rung path directly.
    const atLastRungInProgress: GameState = { ...state, status: 'in-progress' };
    const forced = { ...atLastRungInProgress, progressByRung: [...atLastRungInProgress.progressByRung] };
    forced.progressByRung[2] = { ...forced.progressByRung[2]!, foundWords: ['carat'] };

    const { state: result, insertedIndex } = advance(forced, mulberry32(4));
    expect(isComplete(result)).toBe(true);
    expect(result.currentRungIndex).toBe(2);
    expect(insertedIndex).toBeNull();
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
    state = useHint(state, mulberry32(10));
    expect(state.progressByRung[0]!.hintsUsed).toBe(1);
    let display = getDisplayLetters(state);
    expect(display[0]).toBe('art'[0]);

    state = useHint(state, mulberry32(11));
    display = getDisplayLetters(state);
    expect(display[0]).toBe('art'[0]);
    expect(display[1]).toBe('art'[1]);
  });

  it('still contains exactly the rung\'s letters after a hint (no letters lost/duplicated)', () => {
    let state = initGame(CHAIN, mulberry32(1));
    state = useHint(state, mulberry32(10));
    expect(sortedChars(getDisplayLetters(state).join(''))).toBe(sortedChars('art'));
  });

  it('caps at the anchor word length and stops changing state', () => {
    let state = initGame(CHAIN, mulberry32(1));
    for (let i = 0; i < 10; i++) {
      state = useHint(state, mulberry32(10 + i));
    }
    expect(state.progressByRung[0]!.hintsUsed).toBe('art'.length);
    expect(getDisplayLetters(state).join('')).toBe('art');
  });

  it('keeps incrementing hintsUsedTotal across a lock-release cycle', () => {
    let state = initGame(CHAIN, mulberry32(1));
    state = useHint(state, mulberry32(10)); // hintsUsed 1, hintsUsedTotal 1
    state = submitGuess(state, 'art').state; // releases the lock, hintsUsed -> 0
    expect(state.progressByRung[0]!.hintsUsed).toBe(0);
    expect(state.progressByRung[0]!.hintsUsedTotal).toBe(1);

    state = useHint(state, mulberry32(11)); // hints again after the release
    expect(state.progressByRung[0]!.hintsUsed).toBe(1);
    expect(state.progressByRung[0]!.hintsUsedTotal).toBe(2);
  });

  it('anchors to the first not-yet-found word, not always words[0]', () => {
    // CHAIN's rung 0 has 3 words: ['art', 'rat', 'tar']. Once 'art' (words[0])
    // is found, a hint should no longer point at it — pointing at an
    // already-found word would be useless for the words still left to find.
    let state = initGame(CHAIN, mulberry32(1));
    state = submitGuess(state, 'art').state;
    expect(state.progressByRung[0]!.foundWords).toEqual(['art']);

    state = useHint(state, mulberry32(10));
    expect(state.progressByRung[0]!.hintsUsed).toBe(1);
    expect(getDisplayLetters(state)[0]).toBe('rat'[0]); // anchored to 'rat', not 'art'
  });

  it('re-anchors again once the second word is also found', () => {
    let state = initGame(CHAIN, mulberry32(1));
    state = submitGuess(state, 'art').state;
    state = submitGuess(state, 'rat').state;
    expect(state.progressByRung[0]!.foundWords).toEqual(['art', 'rat']);

    state = useHint(state, mulberry32(10));
    expect(getDisplayLetters(state)[0]).toBe('tar'[0]); // only 'tar' left unfound
  });

  it('does not leave the display fully solved before every letter is hinted', () => {
    // "sprint" has 6 distinct letters — plenty of room to avoid accidentally
    // being fully correct with 1-4 hints used (5th/6th hint necessarily
    // completes it, since there's nothing left to shuffle).
    const rung = { key: 'sprint', length: 6, words: ['sprint'], addedLetter: null };
    const chain: Chain = { rungCount: 1, rungs: [rung] };
    let state = initGame(chain, mulberry32(3));
    for (let hints = 1; hints <= 4; hints++) {
      state = useHint(state, mulberry32(100 + hints));
      expect(state.progressByRung[0]!.currentOrder).not.toBe('sprint');
    }
  });
});

describe('setCurrentOrder', () => {
  it('overwrites the current rung\'s live arrangement', () => {
    const state = initGame(CHAIN, mulberry32(1));
    const next = setCurrentOrder(state, 'tar');
    expect(next.progressByRung[0]!.currentOrder).toBe('tar');
  });

  it('rejects an order with the wrong length', () => {
    const state = initGame(CHAIN, mulberry32(1));
    expect(() => setCurrentOrder(state, 'ta')).toThrow();
  });

  it('rejects an order that is not a permutation of the rung\'s letters', () => {
    const state = initGame(CHAIN, mulberry32(1));
    expect(() => setCurrentOrder(state, 'xyz')).toThrow();
  });

  it('rejects moving a locked (hinted) letter', () => {
    let state = initGame(CHAIN, mulberry32(1));
    state = useHint(state, mulberry32(10)); // locks position 0 to 'a'
    expect(() => setCurrentOrder(state, 'tar')).toThrow(); // 't' != 'a' at position 0
  });

  it('checks the locked letter against the current hint anchor, not always words[0]', () => {
    let state = initGame(CHAIN, mulberry32(1));
    state = submitGuess(state, 'art').state; // 'art' found; anchor moves to 'rat'
    state = useHint(state, mulberry32(10)); // locks position 0 to 'r' (from 'rat')

    expect(() => setCurrentOrder(state, 'art')).toThrow(); // 'a' != 'r' at position 0
    expect(() => setCurrentOrder(state, 'rta')).not.toThrow(); // 'r' at position 0 is fine
  });
});
