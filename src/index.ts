export type {
  AcceptedWordsFile,
  AdvanceResult,
  Chain,
  FreeplayProgress,
  GameState,
  GameStatus,
  GuessOutcome,
  ProgressiveAnagramsFile,
  Rng,
  Rung,
  RungCountFile,
  RungProgress,
  SubmitGuessResult,
} from './types';

export { hashString, mulberry32, defaultRng } from './rng';
export { scrambleLetters, shuffleString, insertLetterAvoidingSolution, lockNextPosition } from './scramble';
export { rungCountForLevel, pickFreeplayChain, dailyRng, pickDailyChain } from './chainSelection';
export {
  initGame,
  submitGuess,
  canAdvance,
  advance,
  useHint,
  isComplete,
  getDisplayLetters,
  setCurrentOrder,
} from './gameEngine';
export { buildShareString } from './shareScore';
export { initialFreeplayProgress, recordCompletion } from './freeplayProgress';

// Note: `loaders.ts` (fs-based) is intentionally NOT re-exported here — this
// barrel has no `fs` dependency so it's safe to import from a browser
// front-end. Node-side code (the CLI demo, future scripts) should import
// from './node' instead, which re-exports everything here plus the loaders.
