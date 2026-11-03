#!/usr/bin/env node
/**
 * Word bank report, run by `npm run words:check` after the word bank tests
 * (src/data/words/__tests__/wordBank.test.ts) pass. It prints:
 *   - easy, medium and hard counts per category, flagging any tier under 5
 *   - answers that appear in more than one category
 *   - every entry still marked draft, waiting for the owner's approval
 *
 *   node scripts/words-report.js
 *
 * Exits with 1 when a tier is thin or an answer repeats across categories.
 * It can't judge facts, Hinglish or cultural accuracy: a person still reviews those.
 */
const fs = require('fs');
const path = require('path');

const DIR = path.resolve(__dirname, '../src/data/words');
const TIERS = ['easy', 'medium', 'hard'];
const MIN_PER_TIER = 5;

const banks = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .sort()
  .map((f) => ({ category: path.basename(f, '.json'), words: JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) }));

let problems = 0;

console.log('Words per tier');
for (const { category, words } of banks) {
  const counts = TIERS.map((t) => [t, words.filter((w) => w.difficulty === t).length]);
  const thin = counts.filter(([, n]) => n < MIN_PER_TIER).map(([t]) => t);
  problems += thin.length;
  const row = counts.map(([t, n]) => `${t} ${n}`).join(', ');
  console.log(`  ${thin.length ? 'THIN' : 'ok  '} ${category.padEnd(8)} ${row}${thin.length ? `  (under ${MIN_PER_TIER}: ${thin.join(', ')})` : ''}`);
}

const byAnswer = new Map();
for (const { words } of banks) for (const w of words) byAnswer.set(w.answer, [...(byAnswer.get(w.answer) || []), w.id]);
const repeats = [...byAnswer].filter(([, ids]) => new Set(ids.map((id) => id.split('-')[0])).size > 1);
problems += repeats.length;
console.log('\nAnswers in more than one category');
if (!repeats.length) console.log('  none');
for (const [answer, ids] of repeats) console.log(`  REPEAT ${answer}: ${ids.join(', ')}`);

console.log('\nWaiting for approval (status: draft)');
let drafts = 0;
for (const { category, words } of banks) {
  const ids = words.filter((w) => w.status === 'draft').map((w) => w.id);
  drafts += ids.length;
  if (ids.length === words.length) console.log(`  ${category}: all ${ids.length}`);
  else if (ids.length) console.log(`  ${category} (${ids.length}): ${ids.join(', ')}`);
}
if (!drafts) console.log('  none');

console.log('\nThis check can\'t judge facts, Hinglish or cultural accuracy. A person still reviews those.');
process.exit(problems ? 1 : 0);
