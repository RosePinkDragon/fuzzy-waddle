import { LIVES_MARKS } from '../config';
import { poolDifficulties, rulesFor, visibleClues } from '../difficulty';
import type { Difficulty } from '../types';

describe('difficulty rules', () => {
  it.each<[Difficulty, number, number]>([
    ['easy', 9, 0],
    ['medium', 7, 2],
    ['hard', 5, 4],
  ])('%s has %i lives and %i pre-locked marks', (d, lives, locked) => {
    expect(rulesFor(d).lives).toBe(lives);
    expect(rulesFor(d).locked).toBe(locked);
    expect(lives + locked).toBe(LIVES_MARKS);
  });

  it('uses the right word pools', () => {
    expect(poolDifficulties('easy')).toEqual(['easy']);
    expect(poolDifficulties('medium')).toEqual(['easy', 'medium']);
    expect(poolDifficulties('hard')).toEqual(['medium', 'hard']);
  });

  it('Easy shows chips and the clue line; the extra clue is unlocked by slot 2', () => {
    expect(visibleClues('easy', 0)).toEqual({ chips: true, clue: true, extraClue: false, locked: ['extraClue'] });
    expect(visibleClues('easy', 1)).toMatchObject({ extraClue: true, locked: [] });
  });

  it('Medium shows the clue line only', () => {
    expect(visibleClues('medium', 0)).toEqual({ chips: false, clue: true, extraClue: false, locked: ['extraClue'] });
  });

  it('Hard locks the clue; slot 2 unlocks the clue first, then the extra clue', () => {
    expect(visibleClues('hard', 0)).toEqual({ chips: false, clue: false, extraClue: false, locked: ['clue', 'extraClue'] });
    expect(visibleClues('hard', 1)).toMatchObject({ clue: true, extraClue: false, locked: ['extraClue'] });
    expect(visibleClues('hard', 2)).toMatchObject({ clue: true, extraClue: true, locked: [] });
  });
});
