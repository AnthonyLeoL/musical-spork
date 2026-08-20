import { getDisplayLetters, type GameState } from 'anagram-game-engine';

export interface Tile {
  /** Stable identity — preserved across reorders and across a correct guess (no rescramble),
   * so React never remounts a tile it doesn't need to. Only regenerated on a full rebuild
   * (new rung via buildTiles, or a hint). */
  id: string;
  letter: string;
  /** Locked tiles sit at the start of the row (see the engine's hint-locking contract: locked
   * positions are always the prefix [0, hintsUsed)) and can't be dragged. */
  locked: boolean;
  /** True only for a tile freshly inserted by `insertTile` (a letter just added via advance) —
   * triggers its one-time "fly in" mount animation. Never set on a full rebuild. */
  entering?: boolean;
  /** 0-based index of the rung this letter was introduced at (0 = one of the starting rung's
   * own letters, 1 = the letter added on top of it, etc.) — LetterRack colors each tile by this,
   * so the player can see at a glance how far through the chain they've come. Since letters
   * within a rung are an unordered multiset, this only tracks *which rung a letter came from*,
   * not a specific physical tile's provenance across a full rebuild — see `deriveRungIndices`. */
  rungIndex: number;
}

function makeTileId(): string {
  return `t${Math.random().toString(36).slice(2)}`;
}

/** For each of `getDisplayLetters(state)`'s positions (in order), which rung introduced that
 * letter — 0 for one of the starting rung's own letters, 1 for the letter `advance` added on
 * top of it, and so on up to `state.currentRungIndex`. Built from the chain's own rungs (each
 * rung after the first contributes exactly its one `addedLetter`), not from any prior tile
 * array, so it works equally well for a from-scratch rebuild (initial load, a resumed save) or
 * a mid-session one (a hint). Matches letters against this "bag" one-for-one; when a letter
 * repeats across rungs (rare) which specific occurrence gets which tag is arbitrary — the two
 * are visually identical letters, so it doesn't matter which is "the" rung-0 one. */
function deriveRungIndices(state: GameState): number[] {
  const rungs = state.chain.rungs;
  const bag: { letter: string; rungIndex: number }[] = rungs[0]!.key
    .split('')
    .map((letter) => ({ letter, rungIndex: 0 }));
  for (let i = 1; i <= state.currentRungIndex; i++) {
    bag.push({ letter: rungs[i]!.addedLetter!, rungIndex: i });
  }
  return getDisplayLetters(state).map((letter) => {
    const idx = bag.findIndex((entry) => entry.letter === letter);
    // Shouldn't happen — the bag is built from the same letters
    // getDisplayLetters draws from — but don't let a mismatch throw.
    if (idx === -1) return state.currentRungIndex;
    return bag.splice(idx, 1)[0]!.rungIndex;
  });
}

/** Rebuilds the tile row for the current rung from scratch, from the engine's current
 * arrangement. Used for the initial load and after a hint (which reshuffles the unlocked
 * letters — see the engine's lockNextPosition) — not after a correct guess or an advance,
 * which both intentionally preserve tile identity instead (see setCurrentOrder / insertTile). */
export function buildTiles(state: GameState): Tile[] {
  const letters = getDisplayLetters(state);
  const lockedCount = state.progressByRung[state.currentRungIndex]?.hintsUsed ?? 0;
  const rungIndices = deriveRungIndices(state);
  return letters.map((letter, i) => ({
    id: makeTileId(),
    letter,
    locked: i < lockedCount,
    rungIndex: rungIndices[i]!,
  }));
}

export function tilesToGuess(tiles: Tile[]): string {
  return tiles.map((t) => t.letter).join('');
}

/** Clears every tile's `locked` flag, preserving identity (id/letter/entering) otherwise — so
 * unlocking never triggers a remount or moves anything. Used wherever the engine's own
 * `hintsUsed` (the current lock count) just reset to 0: after a correct guess (a lock only ever
 * anchors toward one specific word, so it's released once *a* word is found — see submitGuess)
 * and when carrying tiles into a freshly-inserted rung (see insertTile). */
export function unlockTiles(tiles: Tile[]): Tile[] {
  return tiles.map((t) => (t.locked ? { ...t, locked: false } : t));
}

/** Inserts a freshly-added letter into an existing tile row at `index`, preserving every other
 * tile's identity (id, and thus rungIndex) so React only mounts the one new tile — that's what
 * lets the "fly in" animation target just the new letter instead of the whole row. `rungIndex`
 * is the new rung's index (the caller's `next.currentRungIndex` after `advance`), tagging just
 * this one inserted tile with where it came from.
 *
 * Also unlocks every carried-over tile: this only ever runs on a rung transition (advance), and
 * the engine always resets `hintsUsed` to 0 for the new rung — so nothing inherited from the
 * previous rung's hints should still read (or behave) as locked. */
export function insertTile(prevTiles: Tile[], letter: string, index: number, rungIndex: number): Tile[] {
  const unlocked = unlockTiles(prevTiles);
  const fresh: Tile = { id: makeTileId(), letter, locked: false, entering: true, rungIndex };
  return [...unlocked.slice(0, index), fresh, ...unlocked.slice(index)];
}
