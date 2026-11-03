/**
 * Game tuning lives here so it can change without touching logic or screens.
 * Values come from BRIEF.md section 3.
 */
import type { Difficulty, DifficultyRules } from './types';

/** The lives sign always shows this many marks; pre-locked ones are drawn faint. */
export const LIVES_MARKS = 9;

export const DIFFICULTY_ORDER: Difficulty[] = ['easy', 'medium', 'hard'];

export const DIFFICULTY_RULES: Record<Difficulty, DifficultyRules> = {
  easy: {
    lives: 9,
    locked: 0,
    showChips: true,
    shownClues: ['clue'],
    hiddenClues: ['extraClue'],
    pool: ['easy'],
  },
  medium: {
    lives: 7,
    locked: 2,
    showChips: false,
    shownClues: ['clue'],
    hiddenClues: ['extraClue'],
    pool: ['easy', 'medium'],
  },
  hard: {
    lives: 5,
    locked: 4,
    showChips: false,
    shownClues: [],
    hiddenClues: ['clue', 'extraClue'],
    pool: ['medium', 'hard'],
  },
};

/** Power-up slots: 0 reveal a letter, 1 extra clue, 2 undo a wrong guess, 3 remove wrong letters. */
export const POWER_UP_SLOTS = 4;
export const START_POWER_UPS: readonly number[] = [2, 1, 1, 1];
/** Clearing a boss round gives this many of the slot-1 (index 0) power-up. */
export const MILESTONE_REWARD = { slot: 0, amount: 1 } as const;
/** How many wrong letters the slot-4 power-up removes. */
export const REMOVE_WRONG_COUNT = 3;

/** The club ladder. Hits are totals for the run. */
export const CLUB_LADDER: readonly { crore: number; hits: number }[] = [
  { crore: 50, hits: 10 },
  { crore: 100, hits: 20 },
  { crore: 200, hits: 35 },
  { crore: 500, hits: 55 },
  { crore: 1000, hits: 80 },
];

/**
 * How the ladder continues after its last rung: each gap in hits grows by
 * `gapGrowth`; crore amounts follow `croreSteps`, then go up by `croreEvery`.
 * With the defaults: 1500 Cr at 110, 2000 at 145, 3000 at 185, 4000 at 230...
 */
export const LADDER_EXTENSION = {
  gapGrowth: 5,
  croreSteps: [1500, 2000],
  croreEvery: 1000,
} as const;

/**
 * Test-only ladder used when EXPO_PUBLIC_TEST_LADDER=1 at build time, so a
 * milestone can be reached in a couple of words during manual or browser tests.
 */
export const TEST_CLUB_LADDER: readonly { crore: number; hits: number }[] = [
  { crore: 50, hits: 2 },
  { crore: 100, hits: 4 },
  { crore: 200, hits: 7 },
  { crore: 500, hits: 11 },
  { crore: 1000, hits: 16 },
];

/** A boss word is picked at random from this many of the longest/hardest words left in the bag. */
export const BOSS_CANDIDATES = 3;

/** Progress bars show one segment per hit, up to this many; bigger gaps are drawn proportionally. */
export const MAX_PROGRESS_SEGMENTS = 20;

/**
 * Every word is still a draft in v1. Flip this to false once the word bank is
 * reviewed so only `approved` entries are played.
 */
export const INCLUDE_DRAFT_WORDS = true;

/** Pause on a solved word before the next one loads (ms). */
export const SOLVED_PAUSE_MS = 1100;

/** How long the last tile flop plays before the result screen replaces the board. */
export const FLOP_DELAY_MS = 900;
