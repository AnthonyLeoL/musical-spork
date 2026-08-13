// build_word_bank.js
//
// Reads `top_english_words_mixed_50000.txt` (pool of common words) and keeps
// only the words that also appear in `dictionary.txt` (a Scrabble dictionary
// used for validation — chosen because it excludes proper nouns) and are
// longer than 2 letters (1-2 letter words can't form meaningful anagram
// puzzles). Matches are written, one per line, to `word_bank.txt`.
//
// Usage: node build_word_bank.js

const fs = require('fs');
const path = require('path');

const POOL_FILE = path.join(__dirname, 'top_english_words_mixed_50000.txt');
const DICTIONARY_FILE = path.join(__dirname, 'dictionary.txt');
const OUTPUT_FILE = path.join(__dirname, 'word_bank.txt');

function readLines(filePath) {
  return fs
    .readFileSync(filePath, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function main() {
  const poolWords = readLines(POOL_FILE);
  const dictionaryWords = readLines(DICTIONARY_FILE);

  // Set lookup for O(1) validation checks.
  const dictionary = new Set(dictionaryWords.map((w) => w.toLowerCase()));

  const wordBank = poolWords.filter(
    (word) => word.length > 2 && dictionary.has(word.toLowerCase())
  );

  fs.writeFileSync(OUTPUT_FILE, wordBank.join('\n') + '\n', 'utf8');

  const droppedShort = poolWords.filter((word) => word.length <= 2).length;

  console.log(`Pool words:        ${poolWords.length}`);
  console.log(`Dictionary size:   ${dictionaryWords.length}`);
  console.log(`Dropped (1-2 ltr): ${droppedShort}`);
  console.log(`Word bank size:    ${wordBank.length}`);
  console.log(`Written to:        ${OUTPUT_FILE}`);
}

main();
