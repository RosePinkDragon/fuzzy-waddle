#!/usr/bin/env node
/**
 * Fetches word-research sources politely (#73): Wikipedia intro extracts (20
 * titles per request) and Wikidata labels, aliases and sitelinks (50 IDs per
 * request), one request at a time with a delay, backing off on 429 and 5xx.
 *
 *   npm run words:sources -- Diwali "Holi" Q10434
 *   npm run words:sources -- titles.txt --show
 *   npm run words:sources -- Diwali --refresh
 *
 * Each source is saved to .cache/word-sources/ (git-ignored) with its URL,
 * revision ID and fetch time, and later runs reuse it unless --refresh is
 * given. A title that can't be fetched is listed as "not fetched" with the
 * reason; nothing is filled in for it. Exits 1 when anything wasn't fetched.
 *
 * All the logic lives in scripts/lib/wordSources.js. This file only reads
 * arguments and files, writes the cache and prints the report.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { collectSources, parseArgs, parseTitles, cacheFileName, formatReport, USAGE } = require('./lib/wordSources');

const CACHE_DIR = path.join(__dirname, '..', '.cache', 'word-sources');

const hash = (text) => crypto.createHash('sha1').update(text).digest('hex').slice(0, 10);
const fileFor = (kind, key) => path.join(CACHE_DIR, kind, cacheFileName(key, hash));

const cache = {
  read(kind, key) {
    try {
      return JSON.parse(fs.readFileSync(fileFor(kind, key), 'utf8'));
    } catch {
      return null; // missing or damaged: fetch it again
    }
  },
  write(kind, key, entry) {
    const file = fileFor(kind, key);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(entry, null, 2)}\n`);
    return file;
  },
};

/** An input that is a readable file contributes its lines; anything else is a title or Q-id. */
function readInputs(inputs) {
  const lines = [];
  for (const input of inputs) {
    if (fs.existsSync(input) && fs.statSync(input).isFile()) lines.push(...fs.readFileSync(input, 'utf8').split(/\r?\n/));
    else lines.push(input);
  }
  return lines;
}

async function main(argv) {
  const opts = parseArgs(argv);
  if (opts.help) {
    console.log(USAGE);
    return 0;
  }
  const { titles, ids } = parseTitles(readInputs(opts.inputs));
  if (titles.length === 0 && ids.length === 0) throw new Error(`No titles found.\n${USAGE}`);
  const outcome = await collectSources(
    { titles, ids, refresh: opts.refresh, wikidata: opts.wikidata },
    {
      fetch: globalThis.fetch,
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      now: () => Date.now(),
      cache,
      delayMs: opts.delayMs,
      log: (line) => console.error(line),
    },
  );
  console.log(formatReport(outcome, { pathOf: (kind, key) => path.relative(process.cwd(), fileFor(kind, key)), show: opts.show }));
  return outcome.notFetched.length > 0 ? 1 : 0;
}

if (require.main === module) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (err) => {
      console.error(err.message);
      process.exitCode = 1;
    },
  );
}

module.exports = { main, readInputs, fileFor };
