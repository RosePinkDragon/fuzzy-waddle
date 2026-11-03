import type { Difficulty, Word } from '../types';

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
