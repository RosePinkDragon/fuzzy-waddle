import { START_POWER_UPS } from '../config';
import { Ladder } from '../milestones';
import { EXTRA_CLUE, REMOVE, REVEAL, UNDO, applyPowerUp, canUse } from '../powerUps';
import { seededRng } from '../rng';
import { beginWord, guess, livesLeft, startRun, type RunState } from '../run';
import { word } from './helpers';

const ladder = new Ladder([
  { crore: 50, hits: 10 },
  { crore: 100, hits: 20 },
]);
const rng = seededRng(42);

function playing(answer = 'KUCH KUCH HOTA HAI', difficulty: RunState['difficulty'] = 'easy', isBoss = false) {
  return beginWord(startRun('filmy', difficulty), word(answer), isBoss);
}

describe('power-ups', () => {
  it('starts each run with 2 of slot 1 and 1 of the others', () => {
    expect(START_POWER_UPS).toEqual([2, 1, 1, 1]);
    expect(startRun('khana', 'easy').powerUps).toEqual([2, 1, 1, 1]);
  });

  it('slot 1 reveals a hidden letter and spends a charge', () => {
    const run = playing();
    const { run: after, effect } = applyPowerUp(run, REVEAL, rng, ladder);
    expect(effect?.slot).toBe(0);
    const letter = (effect as { letter: string }).letter;
    expect('KUCHOTAI').toContain(letter);
    expect(after.current!.correct).toContain(letter);
    expect(after.powerUps[REVEAL]).toBe(1);
    expect(livesLeft(after)).toBe(9);
  });

  it('slot 1 can finish the word, which counts as a hit', () => {
    let run = playing('PK');
    run = guess(run, 'P', ladder).run;
    run = applyPowerUp(run, REVEAL, rng, ladder).run;
    expect(run.status).toBe('solved');
    expect(run.hits).toBe(1);
  });

  it('slot 2 unlocks the next clue and is disabled when nothing is left', () => {
    let run = playing('DON', 'hard');
    run = { ...run, powerUps: [0, 5, 0, 0] };
    const first = applyPowerUp(run, EXTRA_CLUE, rng, ladder);
    expect(first.effect).toEqual({ slot: 1, unlocked: 'clue' });
    const second = applyPowerUp(first.run, EXTRA_CLUE, rng, ladder);
    expect(second.effect).toEqual({ slot: 1, unlocked: 'extraClue' });
    expect(canUse(second.run, EXTRA_CLUE)).toBe(false);
    expect(second.run.powerUps[EXTRA_CLUE]).toBe(3);
  });

  it('slot 3 gives back the life from the last wrong guess but keeps the key locked', () => {
    let run = playing('DON');
    expect(canUse(run, UNDO)).toBe(false);
    run = guess(run, 'X', ladder).run;
    run = guess(run, 'Z', ladder).run;
    expect(livesLeft(run)).toBe(7);
    const { run: after, effect } = applyPowerUp(run, UNDO, rng, ladder);
    expect(effect).toEqual({ slot: 2, letter: 'Z' });
    expect(livesLeft(after)).toBe(8);
    expect(after.current!.wrong).toContain('Z');
    expect(guess(after, 'Z', ladder).result).toBe('ignored');
    expect(after.powerUps[UNDO]).toBe(0);
  });

  it('slot 4 removes 3 letters that are not in the answer', () => {
    const run = playing('DON');
    const { run: after, effect } = applyPowerUp(run, REMOVE, rng, ladder);
    const letters = (effect as { letters: string[] }).letters;
    expect(letters).toHaveLength(3);
    for (const l of letters) expect('DON').not.toContain(l);
    expect(after.current!.removed).toEqual(letters);
    expect(guess(after, letters[0], ladder).result).toBe('ignored');
    expect(livesLeft(after)).toBe(9);
  });

  it('does nothing without charges', () => {
    const run = { ...playing(), powerUps: [0, 0, 0, 0] };
    for (const slot of [REVEAL, EXTRA_CLUE, UNDO, REMOVE]) {
      expect(canUse(run, slot)).toBe(false);
      expect(applyPowerUp(run, slot, rng, ladder).run).toBe(run);
    }
  });

  it('cannot be used once the run is over', () => {
    let run = playing('DON', 'hard');
    for (const l of 'ABCEF') run = guess(run, l, ladder).run;
    expect(run.status).toBe('over');
    expect(canUse(run, REVEAL)).toBe(false);
    expect(canUse(run, UNDO)).toBe(false);
  });

  it('a cleared boss round gives +1 of slot 1', () => {
    let run = { ...startRun('filmy', 'easy'), hits: 9 };
    run = beginWord(run, word('PK'), true);
    run = guess(run, 'P', ladder).run;
    run = guess(run, 'K', ladder).run;
    expect(run.status).toBe('milestone');
    expect(run.powerUps).toEqual([3, 1, 1, 1]);
  });
});
