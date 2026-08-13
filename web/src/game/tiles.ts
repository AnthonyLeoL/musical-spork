import { getDisplayLetters, type GameState } from 'anagram-game-engine';

export interface Tile {
  /** Stable identity across reorders within a rung — regenerated whenever
   * the rung or its hint count changes (see buildTiles). */
  id: string;
  letter: string;
  /** Locked tiles sit at the start of the row (see the engine's hint-locking
   * contract: locked positions are always the prefix [0, hintsUsed)) and
   * can't be dragged. */
  locked: boolean;
}

/** Rebuilds the tile row for the current rung from the engine's derived
 * display letters. Called fresh whenever the rung index or hint count
 * changes — any in-progress manual arrangement is intentionally discarded,
 * so a hint always shows the newly-locked letter immediately. */
export function buildTiles(state: GameState): Tile[] {
  const letters = getDisplayLetters(state);
  const lockedCount = state.progressByRung[state.currentRungIndex]?.hintsUsed ?? 0;
  return letters.map((letter, i) => ({
    id: `${state.currentRungIndex}-${i}-${letter}`,
    letter,
    locked: i < lockedCount,
  }));
}

export function tilesToGuess(tiles: Tile[]): string {
  return tiles.map((t) => t.letter).join('');
}
