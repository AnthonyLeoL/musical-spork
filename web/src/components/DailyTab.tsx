import { useDailyPuzzle } from '../game/useDailyPuzzle';
import { PuzzleBoard } from './PuzzleBoard';

export function DailyTab() {
  const controller = useDailyPuzzle();
  return <PuzzleBoard {...controller} />;
}
