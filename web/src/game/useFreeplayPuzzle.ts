import { useEffect, useRef, useState } from 'react';
import {
  advance,
  buildShareString,
  canAdvance as engineCanAdvance,
  defaultRng,
  initialFreeplayProgress,
  isComplete as engineIsComplete,
  initGame,
  MIN_RUNG_COUNT,
  pickFreeplayChain,
  recordCompletion,
  rungCountForLevel,
  setCurrentOrder,
  submitGuess,
  useHint as engineUseHint,
  type AcceptedWordsFile,
  type FreeplayProgress,
  type GameState,
  type GuessOutcome,
} from 'anagram-game-engine';
import { loadAcceptedWords, loadRungCountFile } from '../data/dataClient';
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

/** Loads a fresh freeplay chain at a specific rung count — the level-derived one (normal
 * progression) or an explicitly-chosen, already-unlocked one (see onSelectRungCount). */
async function loadFreeplayChain(rungCount: number): Promise<GameState> {
  const file = await loadRungCountFile(rungCount);
  const chain = pickFreeplayChain(file, defaultRng());
  return initGame(chain, defaultRng());
}

export function useFreeplayPuzzle(): PuzzleController {
  const stateRef = useRef<GameState | null>(null);
  const tilesRef = useRef<Tile[]>([]);
  const progressRef = useRef<FreeplayProgress>(initialFreeplayProgress());
  // Loaded once per session (see useDailyPuzzle's identical ref) — onCheck
  // falls back to [] until this resolves.
  const acceptedWordsRef = useRef<AcceptedWordsFile>({});
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
        // Needed either way (a resumed save still needs it for the next
        // onCheck), so load it up front rather than duplicating this call.
        loadAcceptedWords().then((words) => {
          if (!cancelled) acceptedWordsRef.current = words;
        });

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
        const fresh = await loadFreeplayChain(rungCountForLevel(savedProgress.level));
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
    const rung = current.chain.rungs[current.currentRungIndex]!;
    const acceptedWords = acceptedWordsRef.current[rung.key];
    const result = submitGuess(current, tilesToGuess(tilesRef.current), acceptedWords);
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
        // Only advance level/puzzlesCompleted when this was the player's normal, level-derived
        // puzzle. A deliberately-replayed shorter length (see onSelectRungCount) doesn't count —
        // it's a practice replay, not progress — which this comparison detects for free, with
        // no separate "is this a replay" flag to keep in sync: replaying at exactly the player's
        // current level-derived rung count (i.e. no shorter length was actually available to
        // pick) is indistinguishable from — and correctly counts the same as — a normal puzzle.
        const levelRungCount = rungCountForLevel(progressRef.current.level);
        if (result.state.chain.rungCount === levelRungCount) {
          persistProgress(recordCompletion(progressRef.current, result.state.chain));
        }
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
      setTilesAndRef(insertTile(tilesRef.current, rung.addedLetter!, insertedIndex, next.currentRungIndex));
    } else {
      setTilesAndRef(buildTiles(next));
    }
  }

  async function startPuzzle(rungCount: number): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      clearFreeplayGame();
      const fresh = await loadFreeplayChain(rungCount);
      persistState(fresh);
      setTilesAndRef(buildTiles(fresh));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load the next puzzle');
    } finally {
      setLoading(false);
    }
  }

  function onNextPuzzle(): Promise<void> {
    return startPuzzle(rungCountForLevel(progressRef.current.level));
  }

  /** Starts a fresh puzzle at an explicit, already-unlocked rung count (see `unlockedRungCounts`
   * below), bypassing the level-derived one — the "pick any length up to what I've unlocked"
   * menu. See the onCheck completion branch above for how this interacts with level progress. */
  function onSelectRungCount(rungCount: number): Promise<void> {
    return startPuzzle(rungCount);
  }

  const currentProgress = state?.progressByRung[state.currentRungIndex];
  const currentRung = state?.chain.rungs[state.currentRungIndex];
  const foundWords = currentProgress?.foundWords ?? [];
  const bonusWordsFound = currentRung ? foundWords.filter((w) => !currentRung.words.includes(w)) : [];
  // Every rung count the player has reached via normal level progression so far — 3 up to
  // whatever rungCountForLevel(progress.level) currently is — for the "pick a shorter length"
  // menu below.
  const unlockedRungCounts = Array.from(
    { length: rungCountForLevel(progress.level) - MIN_RUNG_COUNT + 1 },
    (_, i) => MIN_RUNG_COUNT + i,
  );

  return {
    loading,
    error,
    label: state ? `Freeplay — Level ${progress.level} — ${state.chain.rungCount} rungs` : 'Freeplay',
    tiles,
    rungNumber: (state?.currentRungIndex ?? 0) + 1,
    rungCount: state?.chain.rungCount ?? 0,
    foundWords,
    targetWordCount: currentRung?.words.length ?? 0,
    bonusWordsFound,
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
    unlockedRungCounts,
    onSelectRungCount,
  };
}
