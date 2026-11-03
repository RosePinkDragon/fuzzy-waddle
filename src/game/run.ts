/**
 * Run state for an endless run. Everything here is pure: each action takes a
 * state and returns a new one, so screens can hold it in a reducer and tests
 * can drive it directly.
 */
import { MILESTONE_REWARD, START_POWER_UPS } from './config';
import { isGuessable, isSolved, lettersOf } from './answer';
import { rulesFor } from './difficulty';
import { ladder as defaultLadder, type Ladder } from './milestones';
import type { Club, Difficulty, ThemeId, Word } from './types';

export interface WordPlay {
  word: Word;
  /** Correct letters, in the order found (guessed or revealed). */
  correct: string[];
  /** Wrong guesses, in order. Their keys stay locked even after an undo. */
  wrong: string[];
  /** Wrong guesses whose life was given back by the undo power-up. */
  undone: string[];
  /** Letters taken off the keyboard by the remove power-up. */
  removed: string[];
  /** Letters revealed by the reveal power-up (also in `correct`). */
  revealed: string[];
  /** Uses of the extra-clue power-up on this word. */
  cluesRevealed: number;
  isBoss: boolean;
}

export type RunStatus =
  /** Waiting for the next word to be drawn. */
  | 'ready'
  | 'playing'
  /** Word solved; the next one loads after a short pause. */
  | 'solved'
  /** Boss round cleared; showing the milestone screen. */
  | 'milestone'
  /** Out of lives. */
  | 'over';

export interface RunState {
  theme: ThemeId;
  difficulty: Difficulty;
  hits: number;
  livesLost: number;
  powerUps: number[];
  current: WordPlay | null;
  status: RunStatus;
  /** The club entered by the last boss round (set on 'milestone'). */
  lastClub: Club | null;
}

export function startRun(
  theme: ThemeId,
  difficulty: Difficulty,
  powerUps: readonly number[] = START_POWER_UPS,
): RunState {
  return {
    theme,
    difficulty,
    hits: 0,
    livesLost: 0,
    powerUps: [...powerUps],
    current: null,
    status: 'ready',
    lastClub: null,
  };
}

export function maxLives(run: Pick<RunState, 'difficulty'>): number {
  return rulesFor(run.difficulty).lives;
}

export function livesLeft(run: Pick<RunState, 'difficulty' | 'livesLost'>): number {
  return Math.max(0, maxLives(run) - run.livesLost);
}

/** Whether the next word should be a boss round. */
export function nextIsBoss(run: RunState, ladder: Ladder = defaultLadder): boolean {
  return ladder.isBossWord(run.hits);
}

export function beginWord(run: RunState, word: Word, isBoss: boolean): RunState {
  if (run.status === 'over') return run;
  return {
    ...run,
    status: 'playing',
    lastClub: null,
    current: {
      word,
      correct: [],
      wrong: [],
      undone: [],
      removed: [],
      revealed: [],
      cluesRevealed: 0,
      isBoss,
    },
  };
}

export type GuessResult = 'correct' | 'wrong' | 'ignored';

/** Letters that can no longer be pressed on the keyboard. */
export function lockedLetters(play: WordPlay): Set<string> {
  return new Set([...play.correct, ...play.wrong, ...play.removed]);
}

/** Applies a solved word: +1 hit, and on a boss round refill lives and give the reward. */
export function settleIfSolved(run: RunState, ladder: Ladder = defaultLadder): RunState {
  const play = run.current;
  if (!play || run.status !== 'playing' || !isSolved(play.word.answer, play.correct)) return run;
  const hits = run.hits + 1;
  if (play.isBoss) {
    const powerUps = [...run.powerUps];
    powerUps[MILESTONE_REWARD.slot] += MILESTONE_REWARD.amount;
    return { ...run, hits, livesLost: 0, powerUps, status: 'milestone', lastClub: ladder.reached(hits) };
  }
  return { ...run, hits, status: 'solved' };
}

export function guess(
  run: RunState,
  letter: string,
  ladder: Ladder = defaultLadder,
): { run: RunState; result: GuessResult } {
  const play = run.current;
  const l = letter.toUpperCase();
  if (!play || run.status !== 'playing' || !isGuessable(l) || lockedLetters(play).has(l)) {
    return { run, result: 'ignored' };
  }
  if (lettersOf(play.word.answer).has(l)) {
    const next = { ...run, current: { ...play, correct: [...play.correct, l] } };
    return { run: settleIfSolved(next, ladder), result: 'correct' };
  }
  const livesLost = run.livesLost + 1;
  const next: RunState = {
    ...run,
    livesLost,
    current: { ...play, wrong: [...play.wrong, l] },
  };
  if (livesLeft(next) <= 0) next.status = 'over';
  return { run: next, result: 'wrong' };
}

/** After the milestone screen, get ready for the next word. */
export function continueRun(run: RunState): RunState {
  if (run.status !== 'milestone' && run.status !== 'solved') return run;
  return { ...run, status: 'ready' };
}
