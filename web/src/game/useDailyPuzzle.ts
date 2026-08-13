import { useEffect, useMemo, useRef, useState } from 'react';
import {
  advance,
  buildShareString,
  canAdvance as engineCanAdvance,
  dailyRng,
  isComplete as engineIsComplete,
  initGame,
  pickDailyChain,
  submitGuess,
  useHint as engineUseHint,
  type GameState,
} from 'anagram-game-engine';
import { loadDailyPool } from '../data/dataClient';
import { loadDailyGame, saveDailyGame } from '../data/storage';
import { todayUtcDateString } from './date';
import { buildTiles, tilesToGuess, type Tile } from './tiles';
import type { PuzzleController } from './types';

export function useDailyPuzzle(): PuzzleController {
  const dateStr = useMemo(() => todayUtcDateString(), []);
  const stateRef = useRef<GameState | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function commit(next: GameState): void {
    stateRef.current = next;
    setState(next);
    setTiles(buildTiles(next));
    saveDailyGame(dateStr, next);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const saved = loadDailyGame(dateStr);
        if (saved) {
          if (!cancelled) commit(saved);
          return;
        }
        const chains9 = await loadDailyPool();
        const chain = pickDailyChain(chains9, dateStr);
        const fresh = initGame(chain, dailyRng(dateStr, 0));
        if (!cancelled) commit(fresh);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load daily puzzle');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // dateStr is stable for the lifetime of this component (computed once).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onReorder(newTiles: Tile[]): void {
    setTiles(newTiles);
    const current = stateRef.current;
    if (!current || current.status !== 'in-progress') return;
    const guess = tilesToGuess(newTiles);
    const result = submitGuess(current, guess);
    if (result.outcome === 'correct') {
      commit(result.state);
    }
  }

  function onHint(): void {
    const current = stateRef.current;
    if (!current) return;
    commit(engineUseHint(current));
  }

  function onAdvance(): void {
    const current = stateRef.current;
    if (!current || !engineCanAdvance(current)) return;
    const rng = dailyRng(dateStr, current.currentRungIndex + 1);
    commit(advance(current, rng));
  }

  const currentProgress = state?.progressByRung[state.currentRungIndex];
  const currentRung = state?.chain.rungs[state.currentRungIndex];

  return {
    loading,
    error,
    label: state ? `Daily — ${state.chain.rungCount} rungs` : 'Daily',
    tiles,
    rungNumber: (state?.currentRungIndex ?? 0) + 1,
    rungCount: state?.chain.rungCount ?? 0,
    foundWords: currentProgress?.foundWords ?? [],
    wordsAtRung: currentRung?.words.length ?? 0,
    hintsUsedThisRung: currentProgress?.hintsUsed ?? 0,
    canAdvance: state ? engineCanAdvance(state) : false,
    isComplete: state ? engineIsComplete(state) : false,
    shareString: state ? buildShareString(state) : '',
    onReorder,
    onHint,
    onAdvance,
  };
}
