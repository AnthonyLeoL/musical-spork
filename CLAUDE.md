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

## Not yet done / open questions

- No game/front-end exists yet — this repo is data-pipeline only.
- No `package.json` — nothing to install, scripts run directly with `node`.
- Profanity filtering was raised but never decided on (dictionary words like "shit" that are
  valid Scrabble words still pass through the pipeline untouched).
- `words_alpha.txt` is an unused leftover from an earlier iteration (before switching to
  `dictionary.txt` for proper-noun filtering) — safe to ignore or delete, nothing reads it.
