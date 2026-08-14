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
  setCurrentOrder,
  submitGuess,
  useHint as engineUseHint,
  type FreeplayProgress,
  type GameState,
  type GuessOutcome,
} from 'anagram-game-engine';
import { loadRungCountFile } from '../data/dataClient';
import {
  clearFreeplayGame,
  loadFreeplayGame,
  loadFreeplayProgress,
  saveFreeplayGame,
  saveFreeplayProgress,
} from '../data/storage';
import { buildTiles, insertTile, tilesToGuess, unlockTiles, type Tile } from './tiles';
import type { PuzzleController } from './types';

const FEEDBACK_DURATION_MS = 1200;

async function pickNewChain(progress: FreeplayProgress): Promise<GameState> {
  const rungCount = rungCountForLevel(progress.level);
  const file = await loadRungCountFile(rungCount);
  const chain = pickFreeplayChain(file, defaultRng());
  return initGame(chain, defaultRng());
}

export function useFreeplayPuzzle(): PuzzleController {
  const stateRef = useRef<GameState | null>(null);
  const tilesRef = useRef<Tile[]>([]);
  const progressRef = useRef<FreeplayProgress>(initialFreeplayProgress());
  const [state, setState] = useState<GameState | null>(null);
  const [progress, setProgress] = useState<FreeplayProgress>(progressRef.current);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkFeedback, setCheckFeedback] = useState<GuessOutcome | null>(null);

  function persistState(next: GameState): void {
    stateRef.current = next;
    setState(next);
    saveFreeplayGame(next);
  }

  function persistProgress(next: FreeplayProgress): void {
    progressRef.current = next;
    setProgress(next);
    saveFreeplayProgress(next);
  }

  function setTilesAndRef(next: Tile[]): void {
    tilesRef.current = next;
    setTiles(next);
  }

  function flashFeedback(outcome: GuessOutcome): void {
    setCheckFeedback(outcome);
    setTimeout(() => setCheckFeedback(null), FEEDBACK_DURATION_MS);
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
          if (!cancelled) {
            persistState(savedGame);
            setTilesAndRef(buildTiles(savedGame));
          }
          return;
        }
        const fresh = await pickNewChain(savedProgress);
        if (!cancelled) {
          persistState(fresh);
          setTilesAndRef(buildTiles(fresh));
        }
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
    setTilesAndRef(newTiles);
    const current = stateRef.current;
    if (!current || current.status !== 'in-progress') return;
    try {
      persistState(setCurrentOrder(current, tilesToGuess(newTiles)));
    } catch {
      // Shouldn't happen — the rack never lets a locked tile move.
    }
  }

  function onCheck(): void {
    const current = stateRef.current;
    if (!current || current.status !== 'in-progress') return;
    const result = submitGuess(current, tilesToGuess(tilesRef.current));
    flashFeedback(result.outcome);
    if (result.outcome === 'correct') {
      // Deliberately don't rebuild `tiles` — the player's own arrangement
      // (which just spelled the word) stays on screen as-is. Do release any
      // hint lock, though (the engine already reset hintsUsed to 0 — this
      // just brings the tile row's `locked` flags in line with that, same
      // idea as insertTile, without touching identity/order).
      persistState(result.state);
      setTilesAndRef(unlockTiles(tilesRef.current));
      if (engineIsComplete(result.state)) {
        persistProgress(recordCompletion(progressRef.current, result.state.chain));
      }
    }
  }

  function onHint(): void {
    const current = stateRef.current;
    if (!current) return;
    const next = engineUseHint(current, defaultRng());
    persistState(next);
    setTilesAndRef(buildTiles(next));
  }

  function onAdvance(): void {
    const current = stateRef.current;
    if (!current || !engineCanAdvance(current)) return;
    const { state: next, insertedIndex } = advance(current, defaultRng());
    persistState(next);
    if (insertedIndex !== null) {
      const rung = next.chain.rungs[next.currentRungIndex]!;
      setTilesAndRef(insertTile(tilesRef.current, rung.addedLetter!, insertedIndex));
    } else {
      setTilesAndRef(buildTiles(next));
    }
  }

  async function onNextPuzzle(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      clearFreeplayGame();
      const fresh = await pickNewChain(progressRef.current);
      persistState(fresh);
      setTilesAndRef(buildTiles(fresh));
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
    hintsUsedThisRung: currentProgress?.hintsUsedTotal ?? 0,
    canAdvance: state ? engineCanAdvance(state) : false,
    isComplete: state ? engineIsComplete(state) : false,
    shareString: state ? buildShareString(state) : '',
    onReorder,
    onCheck,
    checkFeedback,
    onHint,
    onAdvance,
    onNextPuzzle,
  };
}
