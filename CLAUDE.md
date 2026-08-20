# Anagram Finder Game

This repo has three layers: a word/data pipeline (plain Node scripts building the puzzle
datasets), a pure TypeScript game engine consuming that data, and a Vite + React web UI playing
the engine — deployed live to GitHub Pages on every push to `main`.

## Conventions

- Plain Node.js scripts, **CommonJS** (`require('fs')`, `require('path')`), **no dependencies**.
- Each script is self-contained: reads input file(s), writes one output file, and prints a
  console summary of what it did (counts in, counts out, output path).
- Each script has a single `main()` function invoked at the bottom, run directly via
  `node <script>.js` — no CLI args, no build tooling.
- Anagram "keys" are always a word's letters lowercased and sorted alphabetically (e.g. `"the"`
  → `"eht"`). Two words are anagrams of each other iff they share a key. Keys double as
  letter-multisets, so duplicate letters (e.g. `"add"`) are handled automatically — no special
  casing needed anywhere in the pipeline.
- Output JSON is pretty-printed (`JSON.stringify(obj, null, 2) + '\n'`), even where that makes
  files large — these are checked-in/inspectable artifacts, not runtime-optimized formats.

### Improvements

- switch to https://github.com/mhollingshead/open-dictionary data set to be able to show word definitions

## Pipeline (run in this order) reference only

### files already generated, no need to run

```
top_english_words_mixed_50000.txt ─┐
                                    ├─> build_word_bank.js ─────────> word_bank.txt
dictionary.txt ─────────────────────┘
                                                │
                                                v
                                       build_anagrams.js ──────────> anagrams.json
                                                │
                        ┌───────────────────────┼───────────────────────┐
                        v                                               v
              build_anagrams_only.js                      build_progressive_anagrams.js
                        │                                               │
                        v                                               v
              anagrams_only.json                          progressive_anagrams.json
                                                                        │
                                                                        v
                                                     split_progressive_anagrams.js
                                                                        │
                                                                        v
                                                progressive_anagrams_{3..9}.json
```

`build_accepted_words.js` is a second, separate consumer of two of the outputs above — it isn't
part of the main chain, it just reads the results:

```
dictionary.txt ─────────────────────┐
                                     ├─> build_accepted_words.js ──> accepted_words.json
progressive_anagrams.json ──────────┘
```

### Input files

- **`top_english_words_mixed_50000.txt`** — pool of ~20,000 common typed words (one per line),
  lowercase, unfiltered. This is the _candidate_ word list — the raw material.
- **`dictionary.txt`** — a Scrabble dictionary (178,690 words, uppercase), used as both a
  _validator_ (via `build_word_bank.js`) and, directly, as the source of truth for
  `build_accepted_words.js` (see below). Chosen deliberately over a broader wordlist (an earlier
  `words_alpha.txt`, no longer used by any script but still present in the repo) because Scrabble
  dictionaries exclude proper nouns by convention — this is how "Rome", "Paris", etc. get filtered
  out without needing a dedicated proper-noun blocklist. It's not a perfect filter: words that are
  _both_ common dictionary words and names (e.g. "dan", "wen") still pass through, and
  dictionary words that happen to be profanity (e.g. "shit") aren't filtered either. No decision
  has been made yet on whether to address either of those with an explicit blocklist — and note
  that `build_accepted_words.js` widens dictionary.txt's reach into actual gameplay (a profane
  dictionary word is now something `submitGuess` can accept, not just something that could
  already have been a curated target), so that decision matters a bit more than it used to.

### Scripts (in run order)

1. **`build_word_bank.js`** — keeps only pool words that (a) appear in `dictionary.txt` and
   (b) are longer than 2 letters (1-2 letter words can't form interesting anagram puzzles).
   Output: `word_bank.txt` (15,142 words, one per line).

2. **`build_anagrams.js`** — groups `word_bank.txt` words by anagram key. Output: `anagrams.json`,
   `{ key: string[] }`, 14,220 keys (most map to a single word with no anagram partner).

3. **`build_anagrams_only.js`** — filters `anagrams.json` down to keys with 2+ words (i.e. actual
   anagram groups). Output: `anagrams_only.json`, same shape, 789 keys.

4. **`build_progressive_anagrams.js`** — the core "game feature" script. Finds every
   **progressive anagram chain**: start at a 3-letter word, add one letter at a time, where each
   resulting letter-set is still a valid word (per `anagrams.json` — a rung only needs _one_
   valid word, not an anagram pair). Enumerates every such chain with 3+ rungs via a memoized
   DFS over the letter-addition DAG (`pathsFrom`), so shared sub-chains reachable from multiple
   predecessors aren't recomputed. Output: `progressive_anagrams.json` (~46MB), shape:

   ```json
   {
     "chains": [
       {
         "rungCount": 3,
         "rungs": [
           {
             "key": "art",
             "length": 3,
             "words": ["art", "rat", "tar"],
             "addedLetter": null
           },
           {
             "key": "acrt",
             "length": 4,
             "words": ["cart"],
             "addedLetter": "c"
           },
           {
             "key": "aacrt",
             "length": 5,
             "words": ["carat"],
             "addedLetter": "a"
           }
         ]
       }
     ],
     "meta": {
       "totalChains": 46875,
       "longestChainRungCount": 9,
       "longestChainCount": 431,
       "exampleLongestChain": {
         /* ... */
       }
     }
   }
   ```

   Current numbers: 470 possible 3-letter starting points, 404 of them lead somewhere, 46,875
   total qualifying chains, longest chains are 9 rungs (431 chains tie for that max — e.g.
   `ace → acne/cane → crane → trance → certain → creation/reaction → container → containers →
constrained`).

5. **`split_progressive_anagrams.js`** — splits `progressive_anagrams.json`'s `chains` array by
   `rungCount` into `progressive_anagrams_3.json` through `progressive_anagrams_9.json`
   (shape: `{ rungCount, count, chains: [...] }`), so the game can load puzzles of a specific
   length/difficulty without pulling in the full 46,875-chain, 45MB pool.

6. **`build_accepted_words.js`** — the "accepted words" half of a two-list design: `word_bank.txt`
   (and everything downstream of it — `anagrams.json`, every rung's `words`) is deliberately
   pool-curated to keep puzzle *targets* common and guessable, but that same curation was
   causing real, ordinary words to be rejected as guesses outright — playtesters ran into "crates",
   "slag", and "tare" all failing to be accepted, purely because none of the three made the
   ~20,000-word pool (all three *are* valid `dictionary.txt` words). Rather than chase a better
   pool dataset (any frequency-list cutoff will always have some next word sitting just below the
   line — that's structural, not a data-quality bug to fix away), this script builds a second,
   separate index sourced from the *full* dictionary — restricted to only the keys that actually
   occur as some chain's rung in `progressive_anagrams.json` (5,551 of them, vs. 100,000+ if every
   dictionary key were kept) — for `submitGuess` to check a guess against whenever it isn't one of
   the rung's curated `words`. Output: `accepted_words.json`, same `{ key: string[] }` shape as
   `anagrams.json`. Current numbers: 10,291 total accepted words across those 5,551 keys, 3,925 of
   which are "bonus" words — valid finds the curated pool alone would've rejected. See the game
   engine section below for how `submitGuess` actually uses this.

### To rebuild everything from scratch

```
node build_word_bank.js
node build_anagrams.js
node build_anagrams_only.js
node build_progressive_anagrams.js
node split_progressive_anagrams.js
node build_accepted_words.js
```

Each step's output is checked in, so this only needs re-running if an input file or an earlier
script changes.

## Game engine (TypeScript)

`src/` holds a pure, stateless TypeScript game engine consuming the pipeline's JSON output —
`initGame`/`submitGuess`/`advance`/`useHint`/`getDisplayLetters`/`isComplete`/`setCurrentOrder`
drive one playthrough; `chainSelection.ts` picks the daily (date-seeded, same chain+scrambles for
every player) and freeplay (level → rung count, starts at 3 and grows) chains; `shareScore.ts`
builds the `rung -> rung -> ...` share string with `(hint)` markers. The engine never touches
storage — callers persist whatever `GameState`/`FreeplayProgress` they're handed back. The
browser-safe barrel is `src/index.ts` (no `fs`); `src/loaders.ts` (fs-based) is only re-exported
from `src/node.ts`, which Node-side code (the CLI demo) imports instead — this split is what lets
the browser UI below import the engine directly with no bundling issues.

`submitGuess(state, guess, acceptedWords?)` takes an optional third argument — the current rung's
entry from `accepted_words.json` (`loaders.ts`'s `loadAcceptedWords`, or the browser's own fetch of
the same file, see Web UI below) — checked as a fallback whenever `guess` isn't one of the rung's
curated `words`. This is the "two-list" fix for the pipeline's `crates`/`slag`/`tare` gap (see
`build_accepted_words.js` above): `rung.words` stays the puzzle's intended, pool-curated *target*
list (still exactly what scrambling, hint-anchoring, and the share string are built around), while
`acceptedWords` is the broader "any real dictionary word for these letters" list, so a legitimate
word the curated pool happens to be missing is still accepted rather than rejected outright. A find
via `acceptedWords` lands in `foundWords` exactly like a curated one — nothing downstream needs to
know or care which list it came from, except the web UI's own bookkeeping (see below) that tags it
as a "bonus" find for display. The parameter is optional and defaults to checking `rung.words`
alone, so existing callers/tests that don't pass it keep the exact pre-existing behavior.

Each `RungProgress` tracks two separate letter strings, and mixing them up is the easiest way to
reintroduce a bug this design specifically avoids:

- **`scramble`** — fixed at rung-entry, never touched again. Exists only for `buildShareString`.
- **`currentOrder`** — the _live_ arrangement, and the actual source of truth for what
  `getDisplayLetters` returns. It deliberately does **not** reset to `scramble` after a correct
  guess or a hint — the player's own arrangement carries forward:
  - `submitGuess` never touches `currentOrder` — finding a word leaves the tiles exactly as arranged.
  - `advance` doesn't rescramble the next rung; it inserts the new rung's added letter into the
    _current_ `currentOrder` at a random position that isn't the answer (`insertLetterAvoidingSolution`),
    and returns `{ state, insertedIndex }` so a caller can animate just that one new tile.
  - `useHint` now takes an `rng` — locking one more letter also reshuffles the still-unlocked
    remainder (`lockNextPosition`), so revealing one correct letter can't leave the rest already
    spelling the answer by coincidence.
  - `setCurrentOrder` is the only way anything else (a drag reorder) can overwrite `currentOrder`;
    it rejects moving a locked letter or a non-permutation.

`hintsUsed` (current lock count) and `hintsUsedTotal` (cumulative, for scoring) are deliberately
two different fields, not one — `submitGuess` resets `hintsUsed` to 0 on a correct guess (never
`hintsUsedTotal`). A hint lock anchors toward `hintAnchorWord(rung, progress)` — the first of
`rung.words` _not already in `foundWords`_ (falling back to `rung.words[0]` once every word has
been found) — not blindly `rung.words[0]`; at a rung with 2+ valid words, anchoring toward an
already-found word would make a hint useless (or actively misleading) once that word is done, and
keeping a lock toward it after finding it would leave the player unable to ever spell any of the
_other_ words (they might not share that letter in that position at all) — releasing it (and
re-anchoring to whichever word is still unfound) is what makes "continue to find other words"
(CLAUDE.md's option A) actually usable. `setCurrentOrder`'s locked-letter check uses the same
`hintAnchorWord` so it validates drags against whichever word the active lock is actually aimed
at. `buildShareString` reads `hintsUsedTotal`, so a hint still shows in the score even once its lock
is gone.

`scrambleLetters` (the _starting_-rung scramble) has a tiered fallback that's easy to
under-appreciate and re-break: its "not close to the word or its reverse" preference is
deliberately soft, because for a rung whose full anagram group covers most/all of its own
permutations (e.g. "art"/"rat"/"tar" between them cover every reasonably-distinct 3-letter
arrangement), **every** shuffle can end up "too close" to something, and naively falling back to
"whatever the last attempt was" risks literally handing back one of the answers — i.e. the
starting letters would already spell a valid word. So when the strict preference can't be
satisfied within budget, it falls back to the weaker-but-load-bearing guarantee instead: not
_literally_ one of the answers. Verified with a 200-seed stress test in `scramble.test.ts` against
exactly the "art"/"rat"/"tar" case. `insertLetterAvoidingSolution` (every letter-add) and
`lockNextPosition` (every hint) don't have this problem — they only ever checked exact-match in
the first place, so there was nothing to make soft.

- A correct guess at the chain's **last** rung completes the game immediately from inside
  `submitGuess` — there's no rung left to advance into, so there's nothing to wait on a manual
  "next" click for. `advance`'s own last-rung-completes branch still exists as a defensive
  fallback, but shouldn't normally be reached.

This is the one part of the repo with real tooling: `package.json` (TypeScript + Vitest as
devDependencies, no runtime deps), `tsconfig.json`, `test/` (Vitest, mirrors `src/`), and
`src/examples/cli-demo.ts` (a scripted playthrough — `npm run demo`). The pipeline `.js` scripts
above are untouched and still run directly via plain `node`.

```
npm install
npm run build   # tsc -> dist/
npm test        # vitest run
npm run demo    # scripted daily-puzzle playthrough, printed to console
```

## Web UI

`web/` is a Vite + React + TypeScript app (npm workspace, linked to the root package as
`anagram-game-engine`) that plays the engine — Daily and Freeplay tabs, drag-to-reorder letter
tiles (Pointer Events, no DnD library), an explicit Check-word action (button or Enter — nothing
is auto-checked while dragging), a Hint button, and a Share-score button that copies
`buildShareString`'s output to the clipboard. `web/src/game/use{Daily,Freeplay}Puzzle.ts` are the
two hooks that wire the stateless engine to React state + `localStorage` (`web/src/data/storage.ts`)
— this is the concrete "caller persists whatever state it gets back" side of the engine's
stateless contract. `web/src/data/dataClient.ts` fetches the pool JSON as static assets from
`web/public/data/` (symlinked to the repo-root files, so nothing is duplicated on disk) and caches
each rung-count file in memory per session. `loadAcceptedWords` fetches `accepted_words.json` the
same way, cached once for the whole session (unlike the rung-count files, it isn't keyed by
anything — one fetch covers every key across both Daily and Freeplay). Each hook loads it in its
initial effect into an `acceptedWordsRef`, and `onCheck` passes `acceptedWordsRef.current[rung.key]`
as `submitGuess`'s third argument — see the game engine section above for what that unlocks. Until
that fetch resolves, the ref is `{}`, so an early guess is simply checked against `rung.words`
alone rather than throwing or blocking; in practice the fetch is fast enough this is never
noticeable.

Because `submitGuess` can now accept words outside the curated `rung.words`, the UI no longer shows
a "found N / M words" counter — there's no longer a fixed `M` to count against once any real
dictionary word can be found. Each hook instead exposes `targetWordCount` (`rung.words.length`,
kept only to drive `LetterRack`'s gold-tint animation — a flavor signal, not a displayed ceiling)
and `bonusWordsFound` (the subset of `foundWords` not in `rung.words`), and `PuzzleBoard` renders an
uncapped "Found: word, word (bonus), …" list instead. The Check-word button is correspondingly
never disabled anymore (it used to disable once `rung.words` was exhausted) — a bonus word might
still be waiting to be found even after every curated target has been.

Daily puzzles are seeded per-rung (`dailyRng(dateStr, rungIndex)`, not one continuous RNG stream)
specifically so a page reload mid-game still lands on the same scramble everyone else sees at that
rung. Freeplay has no such determinism requirement and uses `Math.random`. (One honest gap in
that fairness story: since `advance` now inserts a letter into the _player's own_ `currentOrder`
rather than generating an independent scramble, two players who drag rung _N_'s tiles into
different arrangements — or find a different valid word where a rung has several — will see
different letter arrangements from rung _N+1_ onward, even with the same date seed. The very
first rung's scramble is still identical for everyone; nothing beyond that was ever load-bearing
for gameplay, only for the share-string "vibe", so this wasn't worth re-engineering around.)

`web/src/game/tiles.ts`'s `Tile.id` is what makes the animations work, not any CSS trick — tile
identity is deliberately preserved (same id) across a correct guess and across most of an advance,
and deliberately _not_ preserved across a hint or a fresh rung load:

- **Found a word**: `tiles` isn't rebuilt at all (point 5 above, same idea at the UI layer) — the
  same tile objects just stay on screen.
- **Added a letter**: `insertTile` splices exactly _one new_ tile object into the existing tile
  array at the engine's returned `insertedIndex`; every other tile keeps its id. React only mounts
  the new one, so only it plays the CSS "fly in" keyframe (`.letter-tile--entering`) — the rest
  smoothly slide over (via the `left` transition every tile already has) to make room.
- **Hint / fresh rung**: `buildTiles` regenerates the whole row with fresh ids — a plain reset,
  no entrance animation, since nothing was asked for there beyond hint's correctness guarantee.

`LetterRack.tsx` positions every tile with an absolutely-positioned, animated `left` rather than
relying on flex reordering — while dragging, every _other_ tile's target slot is computed as if
the dragged tile had been removed from the sequence, then a gap is reopened wherever the pointer
currently is (`visualSlot` in that file), which is what produces the "the rest group together, then
part again around the hover point" effect; the dragged tile itself just follows the pointer with a
scale/shadow bump. The actual array order is only finalized on drop.

On narrow screens, `LetterRack` measures its scrolling ancestor (`.rack-scroller`) via a
`useLayoutEffect` + `ResizeObserver` (a layout effect so the first measurement lands before paint
— otherwise a phone would flash full-size, overflowing tiles for one frame before shrinking) and
shrinks tile size, gap, and font proportionally to fit all tiles in the available width, down to
a `MIN_TILE_SIZE` floor. Past that floor — an 11-letter rung (the longest any chain reaches) on
the narrowest phones — `.rack-scroller`'s horizontal scroll is the last-resort fallback rather
than squashing letters into illegibility. `styles.css`'s `@media (max-width: 480px)` block also
takes `.puzzle-board` full-bleed (negative-margined out through `.app`'s own padding) so the rack
gets every spare pixel before that floor is ever hit.

```
npm install        # from repo root — installs both the engine and web/ (npm workspaces)
cd web && npm run dev      # dev server
cd web && npm run build    # type-check + production build
```

## Deployment

The web UI is deployed to GitHub Pages on every push to `main` via
`.github/workflows/deploy.yml`: `npm ci` (workspaces install both the root engine package and
`web/` in one pass), `npm run build --workspace=web`, then `actions/upload-pages-artifact` +
`actions/deploy-pages`. `web/vite.config.ts` sets `base` to `/musical-spork/` (this repo's GitHub
Pages project-site path) only for `command === 'build'` — the dev server still serves from `/`
for a normal localhost workflow. Anything in the app that builds a fetch path from scratch has to
respect that same prefix rather than assuming domain-root — `dataClient.ts` fetches the pool JSON
via `import.meta.env.BASE_URL` for exactly this reason; an absolute `/data/...` path works locally
but 404s under the `/musical-spork/` prefix.

## Not yet done / open questions

- Profanity filtering was raised but never decided on (dictionary words like "shit" that are
  valid Scrabble words still pass through the pipeline untouched).
- `words_alpha.txt` is mentioned as an unused leftover from an earlier iteration but is no longer
  present in the repo — this note is stale.
- The web UI has no visual design pass — plain functional styling, meant to be replaced. (Narrow-
  screen/mobile layout has had two rounds of dedicated fixes — see `LetterRack.tsx`'s
  shrink-then-scroll behavior above — but that's a usability fix, not a design pass.)
- No automated browser/e2e test coverage for the web app yet (no chromium-cli/Playwright in this
  environment when it was built); the engine underneath has full unit coverage, but the UI itself
  was only verified via type-check + production build + manual dev-server checks.

# Game details

user is given three letters to anagram. Once the user has succesfully anagrammed the letters into
a valid word, they can then
A: continue to anagram to find other words (if they exist) or
B: progress and add a new letter - then repeat.
Repeats until the user has gotten to the last "rung" of the anagram (that is, there are no more
letters that can be added to create a new valid word)

there will be two sections, a "daily" play, which uses a new rungcount 9 progressive anagram.
And a freeplay.
Free play should start with short words and shortnrungs, and gradually increase in both as users play. Progress and scores should be saved locally.
Users should be able to share their daily "score" (score for now just copy pastes the scrambled words in order. e.g. "art" -> "sart"->"ysrart")

User's should also be able to hit a HINT button that will lock a letter in it's correct position. subsequant hints should lock more letters in the correct position. Hints should also show in the users score.
