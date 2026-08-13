// split_progressive_anagrams.js
//
// Reads `progressive_anagrams.json` and splits its `chains` array into one
// file per rung count (e.g. `progressive_anagrams_3.json` holds every chain
// with rungCount === 3, `progressive_anagrams_4.json` holds rungCount === 4,
// and so on). Makes it easy to pull puzzles of a specific difficulty/length
// without loading the full 46,875-chain pool.
//
// Usage: node split_progressive_anagrams.js

const fs = require('fs');
const path = require('path');

const INPUT_FILE = path.join(__dirname, 'progressive_anagrams.json');

function outputFileFor(rungCount) {
  return path.join(__dirname, `progressive_anagrams_${rungCount}.json`);
}

function main() {
  const { chains } = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));

  const chainsByRungCount = new Map();
  for (const chain of chains) {
    if (!chainsByRungCount.has(chain.rungCount)) {
      chainsByRungCount.set(chain.rungCount, []);
    }
    chainsByRungCount.get(chain.rungCount).push(chain);
  }

  const rungCounts = [...chainsByRungCount.keys()].sort((a, b) => a - b);

  console.log(`Total chains loaded: ${chains.length}`);
  for (const rungCount of rungCounts) {
    const chainsForCount = chainsByRungCount.get(rungCount);
    const output = { rungCount, count: chainsForCount.length, chains: chainsForCount };
    const outputFile = outputFileFor(rungCount);
    fs.writeFileSync(outputFile, JSON.stringify(output, null, 2) + '\n', 'utf8');
    console.log(`  rungCount ${rungCount}: ${chainsForCount.length} chains -> ${outputFile}`);
  }
}

main();
