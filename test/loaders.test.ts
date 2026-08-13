import { describe, expect, it } from 'vitest';
import { loadDailyPool, loadRungCountFile } from '../src/loaders';

// Sanity-checks against the real on-disk data (counts verified by direct
// inspection of the generated files — see CLAUDE.md / the pipeline scripts).
describe('loaders (real data)', () => {
  it('loads the rung-9 file with the expected shape and count', () => {
    const file = loadRungCountFile(9);
    expect(file.rungCount).toBe(9);
    expect(file.count).toBe(431);
    expect(file.chains).toHaveLength(431);
    expect(file.chains[0]!.rungCount).toBe(9);
    expect(file.chains[0]!.rungs).toHaveLength(9);
  });

  it('loads the rung-3 file with the expected count', () => {
    const file = loadRungCountFile(3);
    expect(file.rungCount).toBe(3);
    expect(file.count).toBe(1702);
    expect(file.chains).toHaveLength(1702);
  });

  it('loadDailyPool matches the rung-9 file\'s chains', () => {
    const pool = loadDailyPool();
    expect(pool).toHaveLength(431);
  });

  it('every rung has at least one word and a valid addedLetter shape', () => {
    const file = loadRungCountFile(3);
    for (const chain of file.chains.slice(0, 50)) {
      chain.rungs.forEach((rung, i) => {
        expect(rung.words.length).toBeGreaterThan(0);
        if (i === 0) {
          expect(rung.addedLetter).toBeNull();
        } else {
          expect(typeof rung.addedLetter).toBe('string');
        }
      });
    }
  });
});
