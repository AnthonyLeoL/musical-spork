import type { Rng } from '../src/types';

/** Rng that replays a fixed sequence of values — for tests that need exact control
 * over shuffle outcomes. Throws if called more times than it has values for. */
export function fakeRng(values: number[]): Rng {
  let i = 0;
  return () => {
    if (i >= values.length) {
      throw new Error(`fakeRng exhausted after ${values.length} calls`);
    }
    return values[i++]!;
  };
}
