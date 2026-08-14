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
    wordsAtRung,
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

  const allWordsFound = wordsAtRung > 0 && foundWords.length >= wordsAtRung;
  const oneWordFound = foundWords.length === 1;
  // How far through this rung the player is, 0–1 — drives the tiles' gradual
  // shift toward gold in LetterRack (1 of 5 words found = 20% of the way there).
  const rungProgress = wordsAtRung > 0 ? foundWords.length / wordsAtRung : 0;

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
              : allWordsFound
                ? wordsAtRung > 1
                  ? `Found all ${wordsAtRung} words! Add a letter to continue.`
                  : "Found it! Add a letter to continue."
                : wordsAtRung > 1
                  ? `Found ${foundWords.length} / ${wordsAtRung} word${wordsAtRung === 1 ? "" : "s"} at this rung`
                  : "Drag the letters, then check your word"}
          </p>

          {foundWords.length > 0 && (
            <p className="found-words__list">Found: {foundWords.join(", ")}</p>
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
                disabled={allWordsFound}
              >
                Check word
              </button>
            </div>
            <div className="controls-row__end">
              <button
                type="button"
                className={`button ${oneWordFound ? "button--primary" : ""}   ${allWordsFound ? "button--primary button--attention" : ""}`}
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
