# Anagram Finder Game — Data Pipeline

This repo is currently just the word/data pipeline for an anagram-finder game. There is no
front-end or game engine yet — everything here builds the datasets the game will eventually
consume.

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

### Input files

- **`top_english_words_mixed_50000.txt`** — pool of ~20,000 common typed words (one per line),
  lowercase, unfiltered. This is the _candidate_ word list — the raw material.
- **`dictionary.txt`** — a Scrabble dictionary (178,690 words, uppercase), used purely as a
  _validator_. Chosen deliberately over a broader wordlist (an earlier `words_alpha.txt`, no
  longer used by any script but still present in the repo) because Scrabble dictionaries
  exclude proper nouns by convention — this is how "Rome", "Paris", etc. get filtered out
  without needing a dedicated proper-noun blocklist. It's not a perfect filter: words that are
  _both_ common dictionary words and names (e.g. "dan", "wen") still pass through, and
  dictionary words that happen to be profanity (e.g. "shit") aren't filtered either. No decision
  has been made yet on whether to address either of those with an explicit blocklist.

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

### To rebuild everything from scratch

```
node build_word_bank.js
node build_anagrams.js
node build_anagrams_only.js
node build_progressive_anagrams.js
node split_progressive_anagrams.js
```

Each step's output is checked in, so this only needs re-running if an input file or an earlier
script changes.

## Game engine (TypeScript)

`src/` holds a pure, stateless TypeScript game engine consuming the pipeline's JSON output —
`initGame`/`submitGuess`/`advance`/`useHint`/`getDisplayLetters`/`isComplete` drive one
playthrough; `chainSelection.ts` picks the daily (date-seeded, same chain+scrambles for every
player) and freeplay (level → rung count, starts at 3 and grows) chains; `shareScore.ts` builds
the `rung -> rung -> ...` share string with `(hint)` markers. The engine never touches storage —
callers persist whatever `GameState`/`FreeplayProgress` they're handed back. `src/loaders.ts` is
the only module that touches `fs`, so the rest stays portable to a browser front-end later.

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

## Not yet done / open questions

- No front-end exists yet — the engine above has no UI, just game logic.
- Profanity filtering was raised but never decided on (dictionary words like "shit" that are
  valid Scrabble words still pass through the pipeline untouched).
- `words_alpha.txt` is mentioned as an unused leftover from an earlier iteration but is no longer
  present in the repo — this note is stale.

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
