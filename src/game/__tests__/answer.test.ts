import { answerProblem, displayAnswer, isSolved, lettersOf, normalizeAnswer, tokenize } from '../answer';
import { Ladder } from '../milestones';
import { beginWord, guess, startRun } from '../run';
import { word } from './helpers';

describe('answers and auto-reveal', () => {
  it('only counts A-Z as guessable letters', () => {
    expect([...lettersOf('3 IDIOTS')].sort()).toEqual(['D', 'I', 'O', 'S', 'T']);
    expect([...lettersOf("LORD'S")].sort()).toEqual(['D', 'L', 'O', 'R', 'S']);
  });

  it('reveals spaces, digits and punctuation automatically', () => {
    const words = tokenize('3 IDIOTS');
    expect(words).toHaveLength(2);
    expect(words[0]).toEqual([{ ch: '3', auto: true }]);
    expect(words[1].every((t) => !t.auto)).toBe(true);
    expect(tokenize("LORD'S")[0].map((t) => t.auto)).toEqual([false, false, false, false, true, false]);
    expect(tokenize('BARFI!')[0].at(-1)).toEqual({ ch: '!', auto: true });
  });

  it('is solved once every letter is found, ignoring non-letters', () => {
    expect(isSolved('3 IDIOTS', ['I', 'D', 'O', 'T'])).toBe(false);
    expect(isSolved('3 IDIOTS', ['I', 'D', 'O', 'T', 'S'])).toBe(true);
    expect(isSolved('BARFI!', 'BARFI'.split(''))).toBe(true);
  });

  it('solves a word with digits through normal guesses', () => {
    const ladder = new Ladder([
      { crore: 50, hits: 10 },
      { crore: 100, hits: 20 },
    ]);
    let run = beginWord(startRun('filmy', 'easy'), word('3 IDIOTS'), false);
    for (const l of 'IDOTS') run = guess(run, l, ladder).run;
    expect(run.status).toBe('solved');
  });

  it('checks canonical spelling', () => {
    expect(normalizeAnswer('  kuch  kuch hota hai ')).toBe('KUCH KUCH HOTA HAI');
    expect(answerProblem('KUCH KUCH HOTA HAI')).toBeNull();
    expect(answerProblem('Kuch Kuch')).not.toBeNull();
    expect(answerProblem('KUCH  KUCH')).not.toBeNull();
    expect(answerProblem('123')).not.toBeNull();
  });

  it('formats answers for sentences', () => {
    expect(displayAnswer('KUCH KUCH HOTA HAI')).toBe('Kuch Kuch Hota Hai');
    expect(displayAnswer('GATEWAY OF INDIA')).toBe('Gateway of India');
    expect(displayAnswer('3 IDIOTS')).toBe('3 Idiots');
    expect(displayAnswer('PK')).toBe('PK');
    expect(displayAnswer('MUNNA BHAI MBBS')).toBe('Munna Bhai MBBS');
    expect(displayAnswer('IPL', 'IPL')).toBe('IPL');
  });
});
