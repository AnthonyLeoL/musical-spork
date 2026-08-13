// build_progressive_anagrams.js
//
// Reads `anagrams.json` and finds "progressive anagram chains": sequences
// where you start at a 3-letter word, add one letter at a time, and each
// resulting letter set is still a valid word (e.g. rat -> +s -> arts/rats/star
// -> +y -> stray/trays). Every rung only needs one valid word (not an
// anagram pair) — the point is how long you can keep extending, not whether
// each rung has multiple rearrangements.
//
// All qualifying chains of 3+ rungs are written to `progressive_anagrams.json`
// as a pool of puzzles for the game, along with metadata about the longest
// chain(s) found.
//
// Usage: node build_progressive_anagrams.js

const fs = require('fs');
const path = require('path');

const INPUT_FILE = path.join(__dirname, 'anagrams.json');
const OUTPUT_FILE = path.join(__dirname, 'progressive_anagrams.json');

const MIN_RUNG_COUNT = 3;
const MAX_EXPECTED_CHAINS = 100000;

function readAnagrams() {
  return JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
}

function sortLetters(s) {
  return s.split('').sort().join('');
}

// For every key, try appending each of the 26 lowercase letters and check
// whether the resulting letter set is also a valid key. Different letters
// added to the same key always produce different resulting multisets, so
// there's no need to dedup the edges.
function computeSuccessorEdges(keys, keySet) {
  const edgesByKey = new Map();
  for (const key of keys) {
    const edges = [];
    for (let code = 97; code <= 122; code++) {
      const letter = String.fromCharCode(code);
      const candidate = sortLetters(key + letter);
      if (keySet.has(candidate)) {
        edges.push({ letter, key: candidate });
      }
    }
    edgesByKey.set(key, edges);
  }
  return edgesByKey;
}

// Memoized DFS: all maximal suffix-chains (arrays of keys) starting at `key`.
// Memoized purely by key, not by how it was reached — a key's downstream
// subtree is identical no matter which predecessor led to it, and several
// keys here do have multiple predecessors, which is exactly why this matters.
// Recursion depth is bounded by ~13 (longest key is 15 chars, starts are 3),
// so there's no stack-safety concern.
function pathsFrom(key, edgesByKey, memo) {
  if (memo.has(key)) {
    return memo.get(key);
  }
  const edges = edgesByKey.get(key);
  let result;
  if (edges.length === 0) {
    result = [[key]];
  } else {
    result = [];
    for (const { key: nextKey } of edges) {
      for (const suffix of pathsFrom(nextKey, edgesByKey, memo)) {
        result.push([key, ...suffix]);
      }
    }
  }
  memo.set(key, result);
  return result;
}

function buildChainRecord(chainKeys, anagrams, edgeLetterByPair) {
  const rungs = chainKeys.map((key, i) => {
    const addedLetter =
      i === 0 ? null : edgeLetterByPair.get(`${chainKeys[i - 1]}|${key}`);
    return { key, length: key.length, words: anagrams[key], addedLetter };
  });
  return { rungCount: rungs.length, rungs };
}

function printExampleChain(chain) {
  chain.rungs.forEach((rung, i) => {
    const prefix = i === 0 ? '' : `  +${rung.addedLetter} -> `;
    const indent = '  '.repeat(i);
    console.log(`${indent}${prefix}${rung.words.join(', ')}  [${rung.length}]`);
  });
}

function main() {
  const anagrams = readAnagrams();
  const keys = Object.keys(anagrams);
  const keySet = new Set(keys);

  const edgesByKey = computeSuccessorEdges(keys, keySet);

  const edgeLetterByPair = new Map();
  for (const [fromKey, edges] of edgesByKey) {
    for (const { letter, key: toKey } of edges) {
      edgeLetterByPair.set(`${fromKey}|${toKey}`, letter);
    }
  }

  // Every length-3 key is a valid starting point — word_bank already
  // excludes 1-2 letter words, so there's no shorter valid predecessor.
  const starterKeys = keys.filter((k) => k.length === 3).sort();

  const memo = new Map();
  const chains = [];
  const rungCountHistogram = {};
  let startersWithChain = 0;

  for (const starter of starterKeys) {
    const qualifying = pathsFrom(starter, edgesByKey, memo).filter(
      (chainKeys) => chainKeys.length >= MIN_RUNG_COUNT
    );
    if (qualifying.length > 0) {
      startersWithChain++;
    }
    for (const chainKeys of qualifying) {
      const record = buildChainRecord(chainKeys, anagrams, edgeLetterByPair);
      chains.push(record);
      rungCountHistogram[record.rungCount] =
        (rungCountHistogram[record.rungCount] || 0) + 1;
    }
  }

  if (chains.length > MAX_EXPECTED_CHAINS) {
    console.warn(
      `WARNING: generated ${chains.length} chains, exceeding the expected ` +
        `threshold of ${MAX_EXPECTED_CHAINS}. Writing all of them anyway — ` +
        `consider reviewing the letter-DAG branching factor.`
    );
  }

  const longestChainRungCount = chains.reduce(
    (max, c) => Math.max(max, c.rungCount),
    0
  );
  const longestChains = chains.filter(
    (c) => c.rungCount === longestChainRungCount
  );

  const output = {
    chains,
    meta: {
      totalChains: chains.length,
      totalStartingKeys: starterKeys.length,
      startingKeysWithChains: startersWithChain,
      longestChainRungCount,
      longestChainCount: longestChains.length,
      exampleLongestChain: longestChains[0] || null,
    },
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2) + '\n', 'utf8');

  const histogramStr = Object.keys(rungCountHistogram)
    .sort((a, b) => Number(a) - Number(b))
    .map((k) => `${k}→${rungCountHistogram[k]}`)
    .join('  ');

  console.log(`Anagram keys loaded:         ${keys.length}`);
  console.log(`Starting keys (length 3):    ${starterKeys.length}`);
  console.log(`Starting keys with chains:   ${startersWithChain}`);
  console.log(`Total chains (3+ rungs):     ${chains.length}`);
  console.log(`Longest chain (rungs):       ${longestChainRungCount}`);
  console.log(`Chains tying for longest:    ${longestChains.length}`);
  console.log(`Rung-count breakdown:        ${histogramStr}`);
  console.log(`Written to:                  ${OUTPUT_FILE}`);

  if (longestChains.length > 0) {
    console.log(`\nExample longest chain (${longestChainRungCount} rungs):`);
    printExampleChain(longestChains[0]);
  }
}

main();
