import { useEffect, useRef, useState } from 'react';
import {
  advance,
  buildShareString,
  canAdvance as engineCanAdvance,
  defaultRng,
  initialFreeplayProgress,
  isComplete as engineIsComplete,
  initGame,
  pickFreeplayChain,
  recordCompletion,
  rungCountForLevel,
  submitGuess,
  useHint as engineUseHint,
  type FreeplayProgress,
  type GameState,
} from 'anagram-game-engine';
import { loadRungCountFile } from '../data/dataClient';
import {
  clearFreeplayGame,
  loadFreeplayGame,
  loadFreeplayProgress,
  saveFreeplayGame,
  saveFreeplayProgress,
} from '../data/storage';
import { buildTiles, tilesToGuess, type Tile } from './tiles';
import type { PuzzleController } from './types';

async function pickNewChain(progress: FreeplayProgress): Promise<GameState> {
  const rungCount = rungCountForLevel(progress.level);
  const file = await loadRungCountFile(rungCount);
  const chain = pickFreeplayChain(file, defaultRng());
  return initGame(chain, defaultRng());
}

export function useFreeplayPuzzle(): PuzzleController {
  const stateRef = useRef<GameState | null>(null);
  const progressRef = useRef<FreeplayProgress>(initialFreeplayProgress());
  const [state, setState] = useState<GameState | null>(null);
  const [progress, setProgress] = useState<FreeplayProgress>(progressRef.current);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function commitState(next: GameState): void {
    stateRef.current = next;
    setState(next);
    setTiles(buildTiles(next));
    saveFreeplayGame(next);
  }

  function commitProgress(next: FreeplayProgress): void {
    progressRef.current = next;
    setProgress(next);
    saveFreeplayProgress(next);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const savedProgress = loadFreeplayProgress() ?? initialFreeplayProgress();
        progressRef.current = savedProgress;
        if (!cancelled) setProgress(savedProgress);

        const savedGame = loadFreeplayGame();
        if (savedGame) {
          if (!cancelled) commitState(savedGame);
          return;
        }
        const fresh = await pickNewChain(savedProgress);
        if (!cancelled) commitState(fresh);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load freeplay puzzle');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  function onReorder(newTiles: Tile[]): void {
    setTiles(newTiles);
    const current = stateRef.current;
    if (!current || current.status !== 'in-progress') return;
    const guess = tilesToGuess(newTiles);
    const result = submitGuess(current, guess);
    if (result.outcome === 'correct') {
      commitState(result.state);
    }
  }

  function onHint(): void {
    const current = stateRef.current;
    if (!current) return;
    commitState(engineUseHint(current));
  }

  function onAdvance(): void {
    const current = stateRef.current;
    if (!current || !engineCanAdvance(current)) return;
    const next = advance(current, defaultRng());
    commitState(next);
    if (engineIsComplete(next)) {
      commitProgress(recordCompletion(progressRef.current, next.chain));
    }
  }

  async function onNextPuzzle(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      clearFreeplayGame();
      const fresh = await pickNewChain(progressRef.current);
      commitState(fresh);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load the next puzzle');
    } finally {
      setLoading(false);
    }
  }

  const currentProgress = state?.progressByRung[state.currentRungIndex];
  const currentRung = state?.chain.rungs[state.currentRungIndex];

  return {
    loading,
    error,
    label: state ? `Freeplay — Level ${progress.level} — ${state.chain.rungCount} rungs` : 'Freeplay',
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
    onNextPuzzle,
  };
}
