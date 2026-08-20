// Tiny scripted playthrough of the daily puzzle, to eyeball-verify the
// engine end-to-end — mirrors the pipeline scripts' habit of printing a
// console summary of what happened.
//
// Usage: npm run build && node dist/examples/cli-demo.js

import {
  advance,
  buildShareString,
  canAdvance,
  dailyRng,
  getDisplayLetters,
  initGame,
  isComplete,
  loadDailyPool,
  pickDailyChain,
  submitGuess,
  useHint,
} from '../node';

function main(): void {
  const dateStr = '2026-08-13';
  const dailyChains = loadDailyPool();
  const chain = pickDailyChain(dailyChains, dateStr);

  console.log(`Daily puzzle for ${dateStr}: ${chain.rungCount} rungs`);
  console.log(`(chosen deterministically from ${dailyChains.length} rung-7 chains)\n`);

  // Each rung gets its own independently-seeded RNG (see dailyRng), so the
  // scramble at any given rung is the same for every player regardless of
  // how the rest of their session played out.
  let state = initGame(chain, dailyRng(dateStr, 0));

  while (true) {
    const rungIndex = state.currentRungIndex;
    const rung = state.chain.rungs[rungIndex]!;
    const scrambled = getDisplayLetters(state).join('');
    console.log(`Rung ${rungIndex + 1}/${state.chain.rungCount}  [${scrambled}]`);

    // Demonstrate a wrong guess and a duplicate guess on the very first rung.
    if (rungIndex === 0) {
      const wrong = submitGuess(state, 'zzz');
      console.log(`  guess "zzz"              -> ${wrong.outcome}`);
    }

    const answer = rung.words[0]!;
    const correct = submitGuess(state, answer);
    state = correct.state;
    console.log(`  guess "${answer}"${' '.repeat(Math.max(0, 22 - answer.length))} -> ${correct.outcome}`);

    // Once a last-rung guess completes the game, further guesses are
    // rejected outright rather than reported as "alreadyFound" — skip the
    // repeat-guess demo in that case so the log doesn't misread as a bug.
    if (!isComplete(state)) {
      const dupe = submitGuess(state, answer);
      console.log(`  guess "${answer}" again${' '.repeat(Math.max(0, 16 - answer.length))} -> ${dupe.outcome}`);
    }

    // Demonstrate a hint on rung 2 specifically.
    if (rungIndex === 1) {
      state = useHint(state, dailyRng(dateStr, rungIndex));
      console.log(`  used a hint -> locked letters: ${getDisplayLetters(state).join('')}`);
    }

    // A correct guess at the chain's last rung completes the game right
    // away (see submitGuess) — nothing left to advance into.
    if (isComplete(state)) {
      break;
    }

    if (!canAdvance(state)) {
      throw new Error('Expected to be able to advance after a correct guess');
    }
    const { state: advanced, insertedIndex } = advance(state, dailyRng(dateStr, rungIndex + 1));
    state = advanced;
    console.log(`  advanced -> new letter landed at index ${insertedIndex}`);
  }

  console.log(`\nComplete! Reached ${state.progressByRung.length} rungs.`);
  console.log(`Share string:\n  ${buildShareString(state)}`);
}

main();
