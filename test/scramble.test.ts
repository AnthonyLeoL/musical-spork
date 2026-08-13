import { describe, expect, it } from 'vitest';
import { scrambleLetters } from '../src/scramble';
import { mulberry32 } from '../src/rng';

function sortedChars(s: string): string {
  return s.split('').sort().join('');
}

function reverseString(s: string): string {
  return s.split('').reverse().join('');
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

  it('avoids the exact word and its exact reverse when enough arrangements exist', () => {
    const word = 'sprint'; // 6 distinct letters -> plenty of arrangements to retry into
    for (let seed = 1; seed <= 30; seed++) {
      const result = scrambleLetters(word, mulberry32(seed), [word]);
      expect(result).not.toBe(word);
      expect(result).not.toBe(reverseString(word));
    }
  });

  it('falls back to the last attempt when avoidance is impossible (2-letter set)', () => {
    // Only two arrangements exist for a 2-letter set: the word itself and its
    // exact reverse — both are "too close" by definition, so there's no
    // escaping it. rng always 0 -> shuffleOnce always swaps to "ba".
    const result = scrambleLetters('ab', () => 0, ['ba']);
    expect(result).toBe('ba');
  });
});
