import { answerProblem, lettersOf } from '@/game/answer';
import { DIFFICULTY_ORDER } from '@/game/config';
import { layoutTiles } from '@/game/tileLayout';
import type { ThemeId } from '@/game/types';

import { ALL_WORDS, CATEGORY_IDS, RAW_BANKS, poolFor, wordById } from '..';

const MAX_CLUE = 90;
// Longest single word that still fits at the 26px minimum on a 360px-wide phone.
const MAX_WORD_LETTERS = 11;

describe('word bank', () => {
  it('has about 30 entries per category', () => {
    for (const c of CATEGORY_IDS) expect(RAW_BANKS[c].length).toBeGreaterThanOrEqual(28);
  });

  it('has unique, opaque IDs in the category-NNN format', () => {
    const ids = ALL_WORDS.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const w of ALL_WORDS) {
      expect(w.id).toMatch(new RegExp(`^${w.category}-\\d{3}$`));
      expect(wordById(w.id)).toBe(w);
    }
  });

  it.each(ALL_WORDS.map((w) => [w.id, w] as const))('%s is well formed', (_id, w) => {
    expect(answerProblem(w.answer)).toBeNull();
    expect(['easy', 'medium', 'hard']).toContain(w.difficulty);
    expect(['draft', 'approved']).toContain(w.status);
    expect(Array.isArray(w.chips)).toBe(true);
    expect(w.chips.length).toBeLessThanOrEqual(2);
    for (const chip of w.chips) expect(chip.length).toBeLessThanOrEqual(20);
    expect(w.clue.trim().length).toBeGreaterThan(5);
    expect(w.extraClue.trim().length).toBeGreaterThan(5);
    expect(w.clue.length).toBeLessThanOrEqual(MAX_CLUE);
    expect(w.extraClue.length).toBeLessThanOrEqual(MAX_CLUE);
    if (w.display !== undefined) expect(w.display.toUpperCase()).toBe(w.answer);
  });

  it.each(ALL_WORDS.map((w) => [w.id, w] as const))('%s does not give the answer away in its clues', (_id, w) => {
    const answerWords = w.answer.split(' ').filter((p) => p.replace(/[^A-Z]/g, '').length >= 4);
    for (const text of [w.clue, w.extraClue, ...w.chips]) {
      const tokens = new Set(text.toUpperCase().split(/[^A-Z0-9']+/));
      for (const a of answerWords) expect(tokens.has(a)).toBe(false);
    }
  });

  it.each(ALL_WORDS.map((w) => [w.id, w] as const))('%s fits on a phone', (_id, w) => {
    for (const part of w.answer.split(' ')) expect(part.length).toBeLessThanOrEqual(MAX_WORD_LETTERS);
    const layout = layoutTiles(w.answer, { maxWidth: 366, maxLines: 3 });
    expect(layout.fits).toBe(true);
    expect(layout.size).toBeGreaterThanOrEqual(28);
    expect(lettersOf(w.answer).size).toBeGreaterThan(0);
  });

  it('has no duplicate answers within a category', () => {
    for (const c of CATEGORY_IDS) {
      const answers = RAW_BANKS[c].map((w) => w.answer);
      expect(new Set(answers).size).toBe(answers.length);
    }
  });

  it('has no answer in more than one category', () => {
    const seen = new Map<string, string>();
    const conflicts: string[] = [];
    for (const w of ALL_WORDS) {
      const other = seen.get(w.answer);
      if (other !== undefined && other !== w.category) conflicts.push(`${w.answer}: ${other} and ${w.category} (${w.id})`);
      seen.set(w.answer, w.category);
    }
    expect(conflicts).toEqual([]);
  });

  it('gives every theme and difficulty a decent pool', () => {
    const themes: ThemeId[] = [...CATEGORY_IDS, 'masala'];
    for (const t of themes) {
      for (const d of DIFFICULTY_ORDER) expect(poolFor(t, d).length).toBeGreaterThanOrEqual(12);
    }
  });

  it('Masala Mix draws from every category', () => {
    const cats = new Set(poolFor('masala', 'easy').map((w) => w.category));
    expect(cats.size).toBe(CATEGORY_IDS.length);
  });
});
