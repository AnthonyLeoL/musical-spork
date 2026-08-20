import { useEffect } from "react";
import type { PuzzleController } from "../game/types";
import { LetterRack } from "./LetterRack";
import { ShareButton } from "./ShareButton";

const FEEDBACK_TEXT: Record<string, string> = {
  correct: "Nice! ✓",
  alreadyFound: "Already found that one",
  incorrect: "Not quite — try another arrangement",
};

export function PuzzleBoard(controller: PuzzleController) {
  const {
    loading,
    error,
    label,
    tiles,
    rungNumber,
    rungCount,
    foundWords,
    targetWordCount,
    bonusWordsFound,
    hintsUsedThisRung,
    canAdvance,
    isComplete,
    shareString,
    onReorder,
    onCheck,
    checkFeedback,
    onHint,
    onAdvance,
    onNextPuzzle,
  } = controller;

  // Enter checks the current arrangement — the explicit action requested
  // alongside the Check button; nothing is checked automatically on drag.
  useEffect(() => {
    if (loading || error || isComplete) return;
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === "Enter") onCheck();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [loading, error, isComplete, onCheck]);

  if (loading) {
    return <p className="status-text">Loading puzzle…</p>;
  }

  if (error) {
    return <p className="status-text status-text--error">{error}</p>;
  }

  const foundAnyWord = foundWords.length > 0;
  // How far through this rung's *curated* target words the player is, 0–1 —
  // drives the tiles' gradual shift toward gold in LetterRack (1 of 5 target
  // words found = 20% of the way there). Purely a flavor signal now, not a
  // completion ceiling: submitGuess accepts any real dictionary word for the
  // rung, so foundWords.length can exceed targetWordCount once a bonus word
  // is found too — clamp so the tint doesn't try to go past fully gold.
  const rungProgress = targetWordCount > 0 ? Math.min(1, foundWords.length / targetWordCount) : 0;
  // "(bonus)" marker for a found word that isn't one of the puzzle's curated
  // targets — a real word the pool happened to be missing (see CLAUDE.md's
  // two-list design), found via the dictionary-wide acceptance check rather
  // than the intended answer list.
  const foundWordsDisplay = foundWords
    .map((w) => (bonusWordsFound.includes(w) ? `${w} (bonus)` : w))
    .join(", ");

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
          <p className="status-text">
            You reached the last rung — no more letters fit.
          </p>
          <div className="share-box">{shareString}</div>
          <div className="controls-row">
            <ShareButton shareString={shareString} />
            {onNextPuzzle && (
              <button
                type="button"
                className="button button--primary"
                onClick={onNextPuzzle}
              >
                Next puzzle
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="rack-scroller">
            <LetterRack
              tiles={tiles}
              onReorder={onReorder}
              progress={rungProgress}
              justFound={checkFeedback === "correct"}
            />
          </div>

          <p
            className={`feedback-text ${checkFeedback ? `feedback-text--${checkFeedback}` : ""}`}
          >
            {checkFeedback
              ? FEEDBACK_TEXT[checkFeedback]
              : foundAnyWord
                ? `Found ${foundWords.length} word${foundWords.length === 1 ? "" : "s"} at this rung. Add a letter to continue, or keep searching for more.`
                : "Drag the letters, then check your word"}
          </p>

          {foundAnyWord && (
            <p className="found-words__list">Found: {foundWordsDisplay}</p>
          )}

          <div className="controls-row">
            <div className="controls-row__group">
              <button
                type="button"
                className="button button--secondary"
                onClick={onHint}
              >
                Hint
                {hintsUsedThisRung > 0 ? ` (${hintsUsedThisRung} used)` : ""}
              </button>
              <button
                type="button"
                className="button button--primary"
                onClick={onCheck}
              >
                Check word
              </button>
            </div>
            <div className="controls-row__end">
              <button
                type="button"
                className={`button ${foundAnyWord ? "button--primary button--attention" : ""}`}
                onClick={onAdvance}
                disabled={!canAdvance}
              >
                Add letter
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
