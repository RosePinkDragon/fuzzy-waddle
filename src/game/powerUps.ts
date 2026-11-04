/**
 * The four power-up slots do the same thing in every theme; only the name and
 * icon change (see the theme config).
 *   0 reveal a letter · 1 extra clue · 2 undo a wrong guess · 3 remove wrong letters
 */
import { ALPHABET, lettersOf } from './answer';
import { visibleClues } from './difficulty';
import { defaultGameConfig, type GameConfig } from './gameConfig';
import { ladder as defaultLadder, type Ladder } from './milestones';
import { pick, sample } from './rng';
import { lockedLetters, settleIfSolved, type RunState, type WordPlay } from './run';
import type { Rng } from './types';

export type PowerUpSlot = 0 | 1 | 2 | 3;
export const REVEAL: PowerUpSlot = 0;
export const EXTRA_CLUE: PowerUpSlot = 1;
export const UNDO: PowerUpSlot = 2;
export const REMOVE: PowerUpSlot = 3;

function hiddenLetters(play: WordPlay): string[] {
  const found = new Set(play.correct);
  return [...lettersOf(play.word.answer)].filter((l) => !found.has(l));
}

function removableLetters(play: WordPlay): string[] {
  const inAnswer = lettersOf(play.word.answer);
  const locked = lockedLetters(play);
  return ALPHABET.filter((l) => !inAnswer.has(l) && !locked.has(l));
}

function undoableGuess(play: WordPlay): string | undefined {
  return [...play.wrong].reverse().find((l) => !play.undone.includes(l));
}

/** Whether a slot would do something right now (ignores the count). */
export function canApply(run: RunState, slot: PowerUpSlot): boolean {
  const play = run.current;
  if (!play || run.status !== 'playing') return false;
  switch (slot) {
    case REVEAL:
      return hiddenLetters(play).length > 0;
    case EXTRA_CLUE:
      return visibleClues(run.difficulty, play.cluesRevealed).locked.length > 0;
    case UNDO:
      return run.livesLost > 0 && undoableGuess(play) !== undefined;
    case REMOVE:
      return removableLetters(play).length > 0;
    default:
      return false;
  }
}

/** Whether the button is usable: has charges and would do something. */
export function canUse(run: RunState, slot: PowerUpSlot): boolean {
  return (run.powerUps[slot] ?? 0) > 0 && canApply(run, slot);
}

export type PowerUpEffect =
  | { slot: 0; letter: string }
  | { slot: 1; unlocked: 'clue' | 'extraClue' }
  | { slot: 2; letter: string }
  | { slot: 3; letters: string[] };

export function applyPowerUp(
  run: RunState,
  slot: PowerUpSlot,
  rng: Rng,
  ladder: Ladder = defaultLadder,
  config: GameConfig = defaultGameConfig,
): { run: RunState; effect: PowerUpEffect | null } {
  if (!canUse(run, slot)) return { run, effect: null };
  const play = run.current!;
  const powerUps = [...run.powerUps];
  powerUps[slot] -= 1;
  const spent = { ...run, powerUps };

  switch (slot) {
    case REVEAL: {
      const letter = pick(hiddenLetters(play), rng);
      const next = {
        ...spent,
        current: { ...play, correct: [...play.correct, letter], revealed: [...play.revealed, letter] },
      };
      return { run: settleIfSolved(next, ladder, config), effect: { slot: 0, letter } };
    }
    case EXTRA_CLUE: {
      const unlocked = visibleClues(run.difficulty, play.cluesRevealed).locked[0];
      return {
        run: { ...spent, current: { ...play, cluesRevealed: play.cluesRevealed + 1 } },
        effect: { slot: 1, unlocked },
      };
    }
    case UNDO: {
      const letter = undoableGuess(play)!;
      return {
        run: { ...spent, livesLost: run.livesLost - 1, current: { ...play, undone: [...play.undone, letter] } },
        effect: { slot: 2, letter },
      };
    }
    case REMOVE: {
      const letters = sample(removableLetters(play), config.removeWrongCount, rng).sort();
      return {
        run: { ...spent, current: { ...play, removed: [...play.removed, ...letters] } },
        effect: { slot: 3, letters },
      };
    }
    default:
      return { run, effect: null };
  }
}
