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
}

function makeTileId(): string {
  return `t${Math.random().toString(36).slice(2)}`;
}

/** Rebuilds the tile row for the current rung from scratch, from the engine's current
 * arrangement. Used for the initial load and after a hint (which reshuffles the unlocked
 * letters — see the engine's lockNextPosition) — not after a correct guess or an advance,
 * which both intentionally preserve tile identity instead (see setCurrentOrder / insertTile). */
export function buildTiles(state: GameState): Tile[] {
  const letters = getDisplayLetters(state);
  const lockedCount = state.progressByRung[state.currentRungIndex]?.hintsUsed ?? 0;
  return letters.map((letter, i) => ({
    id: makeTileId(),
    letter,
    locked: i < lockedCount,
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
 * tile's identity (id) so React only mounts the one new tile — that's what lets the "fly in"
 * animation target just the new letter instead of the whole row.
 *
 * Also unlocks every carried-over tile: this only ever runs on a rung transition (advance), and
 * the engine always resets `hintsUsed` to 0 for the new rung — so nothing inherited from the
 * previous rung's hints should still read (or behave) as locked. */
export function insertTile(prevTiles: Tile[], letter: string, index: number): Tile[] {
  const unlocked = unlockTiles(prevTiles);
  const fresh: Tile = { id: makeTileId(), letter, locked: false, entering: true };
  return [...unlocked.slice(0, index), fresh, ...unlocked.slice(index)];
}
