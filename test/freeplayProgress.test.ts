import { describe, expect, it } from 'vitest';
import { initialFreeplayProgress, recordCompletion } from '../src/freeplayProgress';
import type { Chain } from '../src/types';

function makeChain(rungCount: number): Chain {
  return { rungCount, rungs: [] };
}

describe('freeplayProgress', () => {
  it('starts at level 1 with nothing completed', () => {
    expect(initialFreeplayProgress()).toEqual({
      level: 1,
      puzzlesCompleted: 0,
      longestChainCompleted: 0,
    });
  });

  it('increments level and puzzlesCompleted on completion', () => {
    const progress = recordCompletion(initialFreeplayProgress(), makeChain(3));
    expect(progress.level).toBe(2);
    expect(progress.puzzlesCompleted).toBe(1);
    expect(progress.longestChainCompleted).toBe(3);
  });

  it('tracks the longest chain completed across multiple completions', () => {
    let progress = initialFreeplayProgress();
    progress = recordCompletion(progress, makeChain(5));
    progress = recordCompletion(progress, makeChain(3)); // shorter — shouldn't lower the record
    expect(progress.longestChainCompleted).toBe(5);
    expect(progress.puzzlesCompleted).toBe(2);
    expect(progress.level).toBe(3);
  });
});
