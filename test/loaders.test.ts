import { describe, expect, it } from 'vitest';
import { loadAcceptedWords, loadDailyPool, loadRungCountFile } from '../src/loaders';

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

  it('loadAcceptedWords covers every rung key with a superset of rung.words', () => {
    const accepted = loadAcceptedWords();
    const file = loadRungCountFile(3);
    for (const chain of file.chains.slice(0, 50)) {
      for (const rung of chain.rungs) {
        expect(accepted[rung.key]).toBeDefined();
        for (const word of rung.words) {
          expect(accepted[rung.key]).toContain(word);
        }
      }
    }
  });

  it('loadAcceptedWords accepts a real dictionary word missing from the curated pool', () => {
    // "tare" is a real anagram of "rate"/"tear" (key "aert") that never made
    // the pool-curated word_bank.txt — the exact playtester-reported bug
    // build_accepted_words.js exists to fix.
    const accepted = loadAcceptedWords();
    expect(accepted['aert']).toContain('tare');
  });
});
