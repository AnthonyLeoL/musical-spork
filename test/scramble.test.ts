import { describe, expect, it } from 'vitest';
import { scrambleLetters } from '../src/scramble';
import { mulberry32 } from '../src/rng';
import { fakeRng } from './testRng';

function sortedChars(s: string): string {
  return s.split('').sort().join('');
}

describe('scrambleLetters', () => {
  it('returns a permutation of the input letters', () => {
    const result = scrambleLetters('carts', mulberry32(1));
    expect(sortedChars(result)).toBe(sortedChars('carts'));
    expect(result.length).toBe('carts'.length);
  });

  it('is deterministic for a given seed', () => {
    const a = scrambleLetters('carts', mulberry32(42));
    const b = scrambleLetters('carts', mulberry32(42));
    expect(a).toBe(b);
  });

  it('re-rolls when the shuffle lands on an avoided word', () => {
    // First shuffle (rng -> 0) swaps positions [1,0]: "ab" -> "ba", which is avoided.
    // Second shuffle (rng -> 0.99) swaps positions [1,1] (no-op): stays "ab".
    const rng = fakeRng([0, 0.99]);
    const result = scrambleLetters('ab', rng, ['ba']);
    expect(result).toBe('ab');
  });

  it('gives up after bounded retries rather than looping forever', () => {
    // Every call returns 0, so shuffleOnce always swaps to "ba" — avoiding it
    // is impossible, but the function must still return rather than hang.
    const rng = () => 0;
    const result = scrambleLetters('ab', rng, ['ba']);
    expect(sortedChars(result)).toBe('ab');
  });
});
