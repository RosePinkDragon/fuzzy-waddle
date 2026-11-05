import { DIFFICULTY_RULES, LIVES_MARKS } from './config';
import type { ClueLevel, Difficulty, DifficultyRules } from './types';

export function rulesFor(difficulty: Difficulty): DifficultyRules {
  return DIFFICULTY_RULES[difficulty];
}

export type LifeMark = 'locked' | 'used' | 'live';

/**
 * The nine marks on the lives sign, left to right: pre-locked marks first,
 * then lives lost, then lives left.
 */
export function lifeMarks(difficulty: Difficulty, livesLost: number): LifeMark[] {
  const { lives, locked } = rulesFor(difficulty);
  const used = Math.min(Math.max(livesLost, 0), lives);
  return Array.from({ length: LIVES_MARKS }, (_, i) => {
    if (i < locked) return 'locked';
    if (i < locked + used) return 'used';
    return 'live';
  });
}

export interface VisibleClues {
  chips: boolean;
  clue: boolean;
  extraClue: boolean;
  /** Clue levels still locked behind the slot-2 power-up. */
  locked: ClueLevel[];
}

/** The clue levels a saved run was started with (see `ClueRules` in `sessionRules`). */
export type ClueSettings = Pick<DifficultyRules, 'shownClues' | 'hiddenClues'>;

/**
 * Which clues show for a difficulty after `revealed` uses of the slot-2 power-up.
 * A saved run passes the clue settings it was started with; everything else reads the live ones.
 */
export function visibleClues(difficulty: Difficulty, revealed: number, clues: ClueSettings = rulesFor(difficulty)): VisibleClues {
  const unlocked = clues.hiddenClues.slice(0, Math.max(0, revealed));
  const shown = new Set<ClueLevel>([...clues.shownClues, ...unlocked]);
  return {
    chips: rulesFor(difficulty).showChips,
    clue: shown.has('clue'),
    extraClue: shown.has('extraClue'),
    locked: clues.hiddenClues.slice(unlocked.length),
  };
}

/** Word difficulties a run of this difficulty draws from. */
export function poolDifficulties(difficulty: Difficulty): Difficulty[] {
  return rulesFor(difficulty).pool;
}
