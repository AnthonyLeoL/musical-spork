import { useFreeplayPuzzle } from '../game/useFreeplayPuzzle';
import { PuzzleBoard } from './PuzzleBoard';

export function FreeplayTab() {
  const controller = useFreeplayPuzzle();
  return <PuzzleBoard {...controller} />;
}
