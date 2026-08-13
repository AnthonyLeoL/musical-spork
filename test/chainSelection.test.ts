import { describe, expect, it } from 'vitest';
import {
  dailyRng,
  pickDailyChain,
  pickFreeplayChain,
  rungCountForLevel,
} from '../src/chainSelection';
import { hashString } from '../src/rng';
import type { Chain, RungCountFile } from '../src/types';

function makeChain(rungCount: number, startKey: string): Chain {
  return {
    rungCount,
    rungs: Array.from({ length: rungCount }, (_, i) => ({
      key: `${startKey}${i}`,
      length: startKey.length + i,
      words: [`${startKey}${i}`],
      addedLetter: i === 0 ? null : 'x',
    })),
  };
}

describe('rungCountForLevel', () => {
  it('starts at 3 and never goes below it', () => {
    expect(rungCountForLevel(1)).toBe(3);
    expect(rungCountForLevel(0)).toBe(3);
    expect(rungCountForLevel(-5)).toBe(3);
  });

  it('steps up every 2 levels and caps at 9', () => {
    expect(rungCountForLevel(2)).toBe(3);
    expect(rungCountForLevel(3)).toBe(4);
    expect(rungCountForLevel(4)).toBe(4);
    expect(rungCountForLevel(5)).toBe(5);
    expect(rungCountForLevel(13)).toBe(9);
    expect(rungCountForLevel(100)).toBe(9);
  });

  it('is monotonically non-decreasing', () => {
    let prev = rungCountForLevel(1);
    for (let level = 2; level <= 50; level++) {
      const current = rungCountForLevel(level);
      expect(current).toBeGreaterThanOrEqual(prev);
      prev = current;
    }
  });
});

describe('pickFreeplayChain', () => {
  it('picks a chain that exists in the pool', () => {
    const file: RungCountFile = {
      rungCount: 3,
      count: 3,
      chains: [makeChain(3, 'aaa'), makeChain(3, 'bbb'), makeChain(3, 'ccc')],
    };
    const picked = pickFreeplayChain(file, () => 0.5);
    expect(file.chains).toContain(picked);
  });

  it('throws on an empty pool', () => {
    const file: RungCountFile = { rungCount: 3, count: 0, chains: [] };
    expect(() => pickFreeplayChain(file, () => 0)).toThrow();
  });
});

describe('daily selection', () => {
  const chains9 = Array.from({ length: 431 }, (_, i) => makeChain(9, `c${i}`));

  it('picks the same chain for the same date', () => {
    const a = pickDailyChain(chains9, '2026-08-13');
    const b = pickDailyChain(chains9, '2026-08-13');
    expect(a).toBe(b);
  });

  it('picks a chain that exists in the pool', () => {
    const picked = pickDailyChain(chains9, '2026-08-13');
    expect(chains9).toContain(picked);
  });

  it('dailyRng produces the same sequence for the same date', () => {
    const rngA = dailyRng('2026-08-13');
    const seqA = [rngA(), rngA()];
    const rngB = dailyRng('2026-08-13');
    const seqB = [rngB(), rngB()];
    expect(seqB).toEqual(seqA);
  });
});

describe('hashString', () => {
  it('is deterministic', () => {
    expect(hashString('2026-08-13')).toBe(hashString('2026-08-13'));
  });

  it('differs for different inputs (spot check, not a formal guarantee)', () => {
    expect(hashString('2026-08-13')).not.toBe(hashString('2026-08-14'));
  });
});
