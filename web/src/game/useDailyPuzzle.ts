import { useEffect, useMemo, useRef, useState } from 'react';
import {
  advance,
  buildShareString,
  canAdvance as engineCanAdvance,
  dailyRng,
  defaultRng,
  isComplete as engineIsComplete,
  initGame,
  pickDailyChain,
  setCurrentOrder,
  submitGuess,
  useHint as engineUseHint,
  type AcceptedWordsFile,
  type GameState,
  type GuessOutcome,
} from 'anagram-game-engine';
import { loadAcceptedWords, loadDailyPool } from '../data/dataClient';
import { loadDailyGame, saveDailyGame } from '../data/storage';
import { todayUtcDateString } from './date';
import { buildTiles, insertTile, tilesToGuess, unlockTiles, type Tile } from './tiles';
import type { PuzzleController } from './types';

const FEEDBACK_DURATION_MS = 1200;

export function useDailyPuzzle(): PuzzleController {
  const dateStr = useMemo(() => todayUtcDateString(), []);
  const stateRef = useRef<GameState | null>(null);
  const tilesRef = useRef<Tile[]>([]);
  // Loaded once per session, alongside the puzzle pool — populated after the
  // initial load effect resolves; `onCheck` falls back to [] until then, so
  // a guess made before it's ready is just checked against rung.words only.
  const acceptedWordsRef = useRef<AcceptedWordsFile>({});
  const [state, setState] = useState<GameState | null>(null);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkFeedback, setCheckFeedback] = useState<GuessOutcome | null>(null);

  function persist(next: GameState): void {
    stateRef.current = next;
    setState(next);
    saveDailyGame(dateStr, next);
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
        // onCheck), so load it up front rather than duplicating this call
        // in both branches below.
        loadAcceptedWords().then((words) => {
          if (!cancelled) acceptedWordsRef.current = words;
        });

        const saved = loadDailyGame(dateStr);
        if (saved) {
          if (!cancelled) {
            persist(saved);
            setTilesAndRef(buildTiles(saved));
          }
          return;
        }
        const dailyChains = await loadDailyPool();
        const chain = pickDailyChain(dailyChains, dateStr);
        const fresh = initGame(chain, dailyRng(dateStr, 0));
        if (!cancelled) {
          persist(fresh);
          setTilesAndRef(buildTiles(fresh));
        }
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
    setTilesAndRef(newTiles);
    const current = stateRef.current;
    if (!current || current.status !== 'in-progress') return;
    try {
      persist(setCurrentOrder(current, tilesToGuess(newTiles)));
    } catch {
      // Shouldn't happen — the rack never lets a locked tile move — but
      // don't let a defensive throw break the drag interaction.
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
      persist(result.state);
      setTilesAndRef(unlockTiles(tilesRef.current));
    }
  }

  function onHint(): void {
    const current = stateRef.current;
    if (!current) return;
    // Hints only affect this player's own local view — the share string is
    // built from each rung's *initial* scramble, unaffected by later hints
    // — so there's no cross-player-fairness reason for this to be seeded.
    const next = engineUseHint(current, defaultRng());
    persist(next);
    setTilesAndRef(buildTiles(next));
  }

  function onAdvance(): void {
    const current = stateRef.current;
    if (!current || !engineCanAdvance(current)) return;
    const rng = dailyRng(dateStr, current.currentRungIndex + 1);
    const { state: next, insertedIndex } = advance(current, rng);
    persist(next);
    if (insertedIndex !== null) {
      const rung = next.chain.rungs[next.currentRungIndex]!;
      setTilesAndRef(insertTile(tilesRef.current, rung.addedLetter!, insertedIndex, next.currentRungIndex));
    } else {
      setTilesAndRef(buildTiles(next));
    }
  }

  const currentProgress = state?.progressByRung[state.currentRungIndex];
  const currentRung = state?.chain.rungs[state.currentRungIndex];
  const foundWords = currentProgress?.foundWords ?? [];
  const bonusWordsFound = currentRung ? foundWords.filter((w) => !currentRung.words.includes(w)) : [];

  return {
    loading,
    error,
    label: state ? `Daily — ${state.chain.rungCount} rungs` : 'Daily',
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
  };
}
