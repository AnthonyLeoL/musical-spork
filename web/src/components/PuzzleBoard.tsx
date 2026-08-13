import type { PuzzleController } from '../game/types';
import { LetterRack } from './LetterRack';
import { ShareButton } from './ShareButton';

export function PuzzleBoard(controller: PuzzleController) {
  const {
    loading,
    error,
    label,
    tiles,
    rungNumber,
    rungCount,
    foundWords,
    wordsAtRung,
    hintsUsedThisRung,
    canAdvance,
    isComplete,
    shareString,
    onReorder,
    onHint,
    onAdvance,
    onNextPuzzle,
  } = controller;

  if (loading) {
    return <p className="status-text">Loading puzzle…</p>;
  }

  if (error) {
    return <p className="status-text status-text--error">{error}</p>;
  }

  return (
    <div className="puzzle-board">
      <div className="puzzle-header">
        <span className="puzzle-label">{label}</span>
        <span className="puzzle-rung">
          Rung {rungNumber} / {rungCount}
        </span>
      </div>

      {isComplete ? (
        <div className="complete-panel">
          <p className="complete-heading">🎉 Puzzle complete!</p>
          <p className="status-text">You reached the last rung — no more letters fit.</p>
          <div className="share-box">{shareString}</div>
          <div className="controls-row">
            <ShareButton shareString={shareString} />
            {onNextPuzzle && (
              <button type="button" className="button" onClick={onNextPuzzle}>
                Next puzzle
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <LetterRack tiles={tiles} onReorder={onReorder} />

          <p className="found-words">
            {wordsAtRung > 1
              ? `Found ${foundWords.length} / ${wordsAtRung} word${wordsAtRung === 1 ? '' : 's'} at this rung`
              : foundWords.length > 0
                ? 'Word found — add a letter to continue'
                : 'Drag the letters to form a word'}
            {foundWords.length > 0 && (
              <span className="found-words__list"> ({foundWords.join(', ')})</span>
            )}
          </p>

          <div className="controls-row">
            <button type="button" className="button button--secondary" onClick={onHint}>
              Hint{hintsUsedThisRung > 0 ? ` (${hintsUsedThisRung} used)` : ''}
            </button>
            <button type="button" className="button" onClick={onAdvance} disabled={!canAdvance}>
              Add a letter
            </button>
          </div>
        </>
      )}
    </div>
  );
}
