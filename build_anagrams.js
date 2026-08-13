// build_anagrams.js
//
// Reads `word_bank.txt` and groups words by their sorted letters (the
// "anagram key"). Each key maps to an array of every word bank word that
// shares that letter arrangement. Written to `anagrams.json`.
//
// Usage: node build_anagrams.js

const fs = require('fs');
const path = require('path');

const WORD_BANK_FILE = path.join(__dirname, 'word_bank.txt');
const OUTPUT_FILE = path.join(__dirname, 'anagrams.json');

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

function main() {
  const words = readLines(WORD_BANK_FILE);

  const anagrams = {};
  for (const word of words) {
    const key = sortLetters(word);
    if (!anagrams[key]) {
      anagrams[key] = [];
    }
    // Word bank shouldn't have duplicates, but guard just in case.
    if (!anagrams[key].includes(word)) {
      anagrams[key].push(word);
    }
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(anagrams, null, 2) + '\n', 'utf8');

  const keys = Object.keys(anagrams);
  const groupsWithAnagrams = keys.filter((key) => anagrams[key].length > 1).length;

  console.log(`Words processed:        ${words.length}`);
  console.log(`Unique keys:             ${keys.length}`);
  console.log(`Keys with 2+ words:      ${groupsWithAnagrams}`);
  console.log(`Written to:              ${OUTPUT_FILE}`);
}

main();
