// build_anagrams_only.js
//
// Reads `anagrams.json` and keeps only the keys that map to 2 or more
// words (i.e. actual anagram groups, excluding words with no anagram in
// the word bank). Written to `anagrams_only.json`.
//
// Usage: node build_anagrams_only.js

const fs = require('fs');
const path = require('path');

const INPUT_FILE = path.join(__dirname, 'anagrams.json');
const OUTPUT_FILE = path.join(__dirname, 'anagrams_only.json');

function main() {
  const anagrams = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));

  const anagramsOnly = {};
  for (const [key, words] of Object.entries(anagrams)) {
    if (words.length > 1) {
      anagramsOnly[key] = words;
    }
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(anagramsOnly, null, 2) + '\n', 'utf8');

  const totalKeys = Object.keys(anagrams).length;
  const keptKeys = Object.keys(anagramsOnly).length;

  console.log(`Total keys:        ${totalKeys}`);
  console.log(`Keys with 2+ words: ${keptKeys}`);
  console.log(`Written to:        ${OUTPUT_FILE}`);
}

main();
