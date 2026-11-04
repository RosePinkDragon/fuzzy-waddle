/**
 * Simulated players and power-up policies. These are ASSUMPTIONS about how
 * someone might play, not data about real players. Every number here is printed
 * in the report header.
 */
import { ALPHABET, lettersOf } from '@/game/answer';
import { visibleClues } from '@/game/difficulty';
import { canUse, EXTRA_CLUE, REMOVE, REVEAL, UNDO, type PowerUpSlot } from '@/game/powerUps';
import { lockedLetters, type RunState } from '@/game/run';
import type { Difficulty, Rng, Word } from '@/game/types';

import type { BoundRules } from './rules';

/** A player picks the next letter to press. `rng` is the player's own stream, re-derived for each word. */
export interface Player {
  readonly name: string;
  /** Lines for the report header. */
  readonly describe: readonly string[];
  choose(run: RunState, rng: Rng): string;
}

export interface PresetParams {
  /** Chance, per guess, of picking a letter that is in the answer, by the word's own tier. */
  readonly insight: Readonly<Record<Difficulty, number>>;
  /** Added to the chance for each clue level on screen (`clue` and `extraClue`; chips are ignored). */
  readonly clueBonus: number;
}

/** Provisional assumptions. The game designer may recalibrate them. */
export const PRESETS: Readonly<Record<'casual' | 'skilled', PresetParams>> = {
  casual: { insight: { easy: 0.3, medium: 0.2, hard: 0.1 }, clueBonus: 0.1 },
  skilled: { insight: { easy: 0.6, medium: 0.45, hard: 0.3 }, clueBonus: 0.15 },
};

export type PresetName = keyof typeof PRESETS;
export const PRESET_NAMES = Object.keys(PRESETS) as PresetName[];

/**
 * A to Z ranked by how many answers in the pool contain the letter, most first.
 * Ties go in alphabetical order.
 */
export function letterOrder(pool: readonly Word[]): string[] {
  const count = new Map<string, number>(ALPHABET.map((l) => [l, 0]));
  for (const w of pool) for (const l of lettersOf(w.answer)) count.set(l, (count.get(l) ?? 0) + 1);
  return [...ALPHABET].sort((a, b) => count.get(b)! - count.get(a)! || (a < b ? -1 : 1));
}

function hiddenLetters(run: RunState): string[] {
  const play = run.current!;
  const found = new Set(play.correct);
  return [...lettersOf(play.word.answer)].filter((l) => !found.has(l)).sort();
}

/** The chance of guessing a letter that is in the answer, for the word on screen. */
export function insightChance(run: RunState, params: PresetParams): number {
  const play = run.current!;
  const clues = visibleClues(run.difficulty, play.cluesRevealed);
  const levels = (clues.clue ? 1 : 0) + (clues.extraClue ? 1 : 0);
  return Math.min(1, params.insight[play.word.difficulty] + params.clueBonus * levels);
}

/**
 * The letter-level guesser. It rolls once per guess. Under the insight chance it
 * guesses the first letter of the answer still hidden, in letter order. Otherwise it
 * guesses the first letter it can still press, in letter order.
 */
export function presetPlayer(name: PresetName, order: readonly string[]): Player {
  return playerFromParams(name, PRESETS[name], order);
}

/** A letter-level player with any parameters (the presets use this; tests do too). */
export function playerFromParams(name: string, params: PresetParams, order: readonly string[]): Player {
  return {
    name,
    describe: [
      `insight (easy ${params.insight.easy}, medium ${params.insight.medium}, hard ${params.insight.hard}): chance per guess of a letter that is in the answer, by the word's tier`,
      `clueBonus ${params.clueBonus}: added for each clue level on screen (clue, extraClue; chips ignored)`,
      'one roll per guess: under the chance it guesses the first hidden letter in letter order, else the first letter still pressable',
      `letter order: ${order.join('')}`,
    ],
    choose(run, rng) {
      const locked = lockedLetters(run.current!);
      const roll = rng();
      if (roll < insightChance(run, params)) {
        const hidden = new Set(hiddenLetters(run));
        const found = order.find((l) => hidden.has(l));
        if (found) return found;
      }
      const free = order.find((l) => !locked.has(l));
      if (!free) throw new Error('No letter left to guess');
      return free;
    },
  };
}

export type ScriptedName = 'perfect' | 'oneMiss';

/** Scripted players for golden tests. */
export function scriptedPlayer(name: ScriptedName): Player {
  const solve = (run: RunState) => hiddenLetters(run)[0];
  if (name === 'perfect') {
    return { name, describe: ['scripted: always guesses a letter that is in the answer'], choose: solve };
  }
  return {
    name,
    describe: ['scripted: one wrong guess first on every word, then always right'],
    choose(run) {
      const play = run.current!;
      if (play.correct.length === 0 && play.wrong.length === 0) {
        const inAnswer = lettersOf(play.word.answer);
        const locked = lockedLetters(play);
        const miss = ALPHABET.find((l) => !inAnswer.has(l) && !locked.has(l));
        if (miss) return miss;
      }
      return solve(run);
    },
  };
}

/** Decides the next power-up to use (checked before every guess), or none. The first match wins. */
export interface Policy {
  readonly name: 'none' | 'greedy' | 'save-for-boss';
  /** Exact trigger rules, for the report header. */
  readonly triggers: readonly string[];
  choose(run: RunState, rules: BoundRules): PowerUpSlot | null;
}

const GREEDY_TRIGGERS = [
  '1. Undo whenever it can be used (right after a miss)',
  '2. On the last life (rules.livesLeft == 1): Reveal, or Remove if Reveal cannot be used',
  '3. Extra Clue whenever a clue level is still locked',
];

function greedy(run: RunState, rules: BoundRules): PowerUpSlot | null {
  if (canUse(run, UNDO)) return UNDO;
  if (rules.livesLeft(run) === 1) {
    if (canUse(run, REVEAL)) return REVEAL;
    if (canUse(run, REMOVE)) return REMOVE;
  }
  if (canUse(run, EXTRA_CLUE)) return EXTRA_CLUE;
  return null;
}

export const POLICIES: Readonly<Record<Policy['name'], Policy>> = {
  none: { name: 'none', triggers: ['never uses a power-up'], choose: () => null },
  greedy: { name: 'greedy', triggers: GREEDY_TRIGGERS, choose: greedy },
  'save-for-boss': {
    name: 'save-for-boss',
    triggers: [
      'On a boss word: the greedy rules',
      'On other words, only when rules.livesLeft == 1: Undo, or Reveal if Undo cannot be used',
      'On other words it never uses Remove or Extra Clue',
    ],
    choose(run, rules) {
      if (run.current!.isBoss) return greedy(run, rules);
      if (rules.livesLeft(run) !== 1) return null;
      if (canUse(run, UNDO)) return UNDO;
      if (canUse(run, REVEAL)) return REVEAL;
      return null;
    },
  },
};

export const POLICY_NAMES = Object.keys(POLICIES) as Policy['name'][];
