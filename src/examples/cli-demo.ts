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
  const chains9 = loadDailyPool();
  const chain = pickDailyChain(chains9, dateStr);

  console.log(`Daily puzzle for ${dateStr}: ${chain.rungCount} rungs`);
  console.log(`(chosen deterministically from ${chains9.length} rung-9 chains)\n`);

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

    const dupe = submitGuess(state, answer);
    console.log(`  guess "${answer}" again${' '.repeat(Math.max(0, 16 - answer.length))} -> ${dupe.outcome}`);

    // Demonstrate a hint on rung 2 specifically.
    if (rungIndex === 1) {
      state = useHint(state);
      console.log(`  used a hint -> locked letters: ${getDisplayLetters(state).join('')}`);
    }

    if (!canAdvance(state)) {
      throw new Error('Expected to be able to advance after a correct guess');
    }
    state = advance(state, dailyRng(dateStr, rungIndex + 1));

    if (isComplete(state)) {
      break;
    }
  }

  console.log(`\nComplete! Reached ${state.progressByRung.length} rungs.`);
  console.log(`Share string:\n  ${buildShareString(state)}`);
}

main();
