// build_accepted_words.js
//
// Reads `dictionary.txt` and `progressive_anagrams.json` and builds an anagram
// index in the same `{ key: string[] }` shape as anagrams.json, but sourced
// from the *full* Scrabble dictionary rather than the pool-curated
// word_bank.txt. This is the "accepted words" half of the two-list design
// (see CLAUDE.md): a rung's `words` (from anagrams.json, ultimately from
// word_bank.txt) stays the curated, common-word *target* list used to build,
// scramble, and hint puzzles — but a player's guess should be accepted
// whenever it's *any* valid dictionary word for the rung's letters, not only
// one of the curated ones. E.g. "tare" is a real anagram of "rate"/"tear"
// (key "aert") that never made the ~20k-word pool, and was being rejected
// outright before this file existed — same story for "crates" and "slag".
//
// Restricted to only the keys that actually occur as some chain's rung in
// `progressive_anagrams.json` — those are the only keys a player could ever
// see in a game, so there's no reason to ship an index for the ~100k+ other
// keys the full dictionary produces. Output: `accepted_words.json`.
//
// Usage: node build_accepted_words.js

const fs = require('fs');
const path = require('path');

const DICTIONARY_FILE = path.join(__dirname, 'dictionary.txt');
const ANAGRAMS_FILE = path.join(__dirname, 'anagrams.json');
const PROGRESSIVE_ANAGRAMS_FILE = path.join(__dirname, 'progressive_anagrams.json');
const OUTPUT_FILE = path.join(__dirname, 'accepted_words.json');

function readLines(filePath) {
  return fs
    .readFileSync(filePath, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function sortLetters(word) {
  return word.toLowerCase().split('').sort().join('');
}

// Every key that appears as some rung across every chain — the full set of
// keys a player could ever actually encounter in a game.
function readRelevantKeys() {
  const { chains } = JSON.parse(fs.readFileSync(PROGRESSIVE_ANAGRAMS_FILE, 'utf8'));
  const keys = new Set();
  for (const chain of chains) {
    for (const rung of chain.rungs) {
      keys.add(rung.key);
    }
  }
  return keys;
}

function main() {
  const dictionaryWords = readLines(DICTIONARY_FILE);
  const anagrams = JSON.parse(fs.readFileSync(ANAGRAMS_FILE, 'utf8'));
  const relevantKeys = readRelevantKeys();

  const accepted = {};
  for (const word of dictionaryWords) {
    if (word.length <= 2) continue; // matches build_word_bank.js's own cutoff
    const key = sortLetters(word);
    if (!relevantKeys.has(key)) continue; // not a key any chain ever uses
    const lower = word.toLowerCase();
    if (!accepted[key]) {
      accepted[key] = [];
    }
    if (!accepted[key].includes(lower)) {
      accepted[key].push(lower);
    }
  }

  // Every relevant key was put in a chain by having a curated word_bank.txt
  // word in the first place, and every word_bank.txt word is itself a
  // dictionary.txt word (build_word_bank.js's own intersection) — so every
  // relevant key should come back out here too. If one doesn't, dictionary.txt
  // and progressive_anagrams.json have drifted out of sync with each other.
  const missingKeys = [...relevantKeys].filter((key) => !accepted[key]);
  if (missingKeys.length > 0) {
    console.warn(
      `WARNING: ${missingKeys.length} relevant key(s) matched no dictionary word ` +
        `(e.g. "${missingKeys[0]}") — dictionary.txt may be out of sync with ` +
        `progressive_anagrams.json / anagrams.json.`
    );
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(accepted, null, 2) + '\n', 'utf8');

  const keys = Object.keys(accepted);
  const totalAcceptedWords = keys.reduce((sum, key) => sum + accepted[key].length, 0);
  let bonusWordCount = 0;
  for (const key of keys) {
    const curated = new Set(anagrams[key] || []);
    bonusWordCount += accepted[key].filter((word) => !curated.has(word)).length;
  }

  console.log(`Dictionary words processed:   ${dictionaryWords.length}`);
  console.log(`Relevant keys (from chains):  ${relevantKeys.size}`);
  console.log(`Keys written:                 ${keys.length}`);
  console.log(`Total accepted words:         ${totalAcceptedWords}`);
  console.log(`Bonus words (accepted, not in the curated pool): ${bonusWordCount}`);
  console.log(`Written to:                   ${OUTPUT_FILE}`);
}

main();
