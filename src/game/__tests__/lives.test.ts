import { lifeMarks } from '../difficulty';
import { Ladder } from '../milestones';
import { beginWord, continueRun, guess, livesLeft, maxLives, startRun } from '../run';
import { word } from './helpers';

const ladder = new Ladder([
  { crore: 50, hits: 2 },
  { crore: 100, hits: 4 },
]);

describe('lives', () => {
  it('starts each difficulty with the right number of lives', () => {
    expect(maxLives(startRun('filmy', 'easy'))).toBe(9);
    expect(maxLives(startRun('filmy', 'medium'))).toBe(7);
    expect(maxLives(startRun('filmy', 'hard'))).toBe(5);
  });

  it('always draws nine marks: locked first, then used, then live', () => {
    expect(lifeMarks('easy', 0)).toEqual(Array(9).fill('live'));
    expect(lifeMarks('medium', 3)).toEqual([
      'locked', 'locked', 'used', 'used', 'used', 'live', 'live', 'live', 'live',
    ]);
    expect(lifeMarks('hard', 5)).toEqual([...Array(4).fill('locked'), ...Array(5).fill('used')]);
    expect(lifeMarks('hard', 99).filter((m) => m === 'used')).toHaveLength(5);
  });

  it('loses a life per wrong guess and ignores repeats', () => {
    let run = beginWord(startRun('filmy', 'easy'), word('DON'), false);
    run = guess(run, 'z', ladder).run;
    expect(livesLeft(run)).toBe(8);
    const again = guess(run, 'Z', ladder);
    expect(again.result).toBe('ignored');
    expect(livesLeft(again.run)).toBe(8);
  });

  it('carries lives over from word to word', () => {
    let run = beginWord(startRun('filmy', 'easy'), word('DON'), false);
    for (const l of ['X', 'Q', 'D', 'O', 'N']) run = guess(run, l, ladder).run;
    expect(run.status).toBe('solved');
    expect(run.hits).toBe(1);
    run = beginWord(continueRun(run), word('PK'), false);
    expect(livesLeft(run)).toBe(7);
  });

  it('ends the run when lives hit 0', () => {
    let run = beginWord(startRun('filmy', 'hard'), word('DON'), false);
    for (const l of 'ABCEF') run = guess(run, l, ladder).run;
    expect(livesLeft(run)).toBe(0);
    expect(run.status).toBe('over');
    expect(guess(run, 'D', ladder).result).toBe('ignored');
  });

  it('ends the run when a boss round is lost', () => {
    let run = { ...startRun('filmy', 'hard'), hits: 1 };
    run = beginWord(run, word('DON'), true);
    for (const l of 'ABCEF') run = guess(run, l, ladder).run;
    expect(run.status).toBe('over');
    expect(run.hits).toBe(1);
  });

  it('refills lives to the difficulty maximum after a boss round', () => {
    let run = { ...startRun('filmy', 'medium'), hits: 1, livesLost: 4 };
    run = beginWord(run, word('PK'), true);
    run = guess(run, 'P', ladder).run;
    run = guess(run, 'K', ladder).run;
    expect(run.status).toBe('milestone');
    expect(run.livesLost).toBe(0);
    expect(livesLeft(run)).toBe(7);
    expect(run.lastClub?.crore).toBe(50);
  });
});
