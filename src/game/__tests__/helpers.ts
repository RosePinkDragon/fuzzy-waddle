import { seededRng } from '../rng';
import type { Content, SessionEnv } from '../runSession';
import type { Difficulty, ThemeId, Word } from '../types';

export function word(answer: string, difficulty: Difficulty = 'easy', id = answer.toLowerCase().replace(/\W+/g, '-')): Word {
  return {
    id,
    answer,
    difficulty,
    chips: ['1998', 'Romance'],
    clue: 'A clue',
    extraClue: 'An extra clue',
    status: 'draft',
    category: 'filmy',
  };
}

// ---- saved-run fixtures (runSession, runStore) ----

const BANK: [string, string, Difficulty][] = [
  ['don', 'DON', 'easy'],
  ['roja', 'ROJA', 'easy'],
  ['sholay', 'SHOLAY', 'easy'],
  ['dilwale', 'DILWALE', 'easy'],
  ['anari', 'ANARI', 'easy'],
  ['bhoot', 'BHOOT', 'easy'],
  ['koi-mil-gaya', 'KOI MIL GAYA', 'easy'],
  ['don-2', 'DON 2', 'easy'],
  ['raaz', 'RAAZ', 'easy'],
  ['golmaal', 'GOLMAAL', 'easy'],
  ['jab-we-met', 'JAB WE MET', 'medium'],
  ['pk', 'PK', 'medium'],
  ['lagaan', 'LAGAAN', 'hard'],
  ['devdas', 'DEVDAS', 'hard'],
];

export const BANK_WORDS: Word[] = BANK.map(([id, answer, difficulty]) => word(answer, difficulty, id));

/** A fixed word bank. `words` can be swapped to simulate word bank edits. */
export function bankContent(words: Word[] = BANK_WORDS): Content {
  return {
    pool: (_theme: ThemeId, _d: Difficulty, tiers) => words.filter((w) => tiers.includes(w.difficulty)),
    byId: (id) => words.find((w) => w.id === id),
  };
}

export function testEnv(seed = 1, words: Word[] = BANK_WORDS): SessionEnv {
  let n = 0;
  return { rng: seededRng(seed), content: bankContent(words), newRunId: () => `run-${(n += 1)}` };
}
