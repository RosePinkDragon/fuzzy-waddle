/**
 * The game-economy rules as one typed, injectable object. `defaultGameConfig`
 * is built from `config.ts`, which stays the only place the live numbers are
 * written. The live app never passes a config, so it always plays the defaults.
 * The balance simulator passes its own (see #46).
 *
 * Config reaches the rules the way `ladder` does: an optional last argument that
 * defaults to `defaultGameConfig`. Pass a matching ladder and config together
 * (`ladderFor(config)`, `config`), because `Ladder` grows lazily and is built
 * once.
 *
 * This module must not import `run` or `powerUps`, because they import it.
 */
import {
  BOSS_CANDIDATES,
  CLUB_LADDER,
  DIFFICULTY_ORDER,
  DIFFICULTY_RULES,
  LADDER_EXTENSION,
  MILESTONE_REWARD,
  REMOVE_WRONG_COUNT,
  START_POWER_UPS,
} from './config';
import { Ladder, type LadderExtension, type Rung } from './milestones';
import type { Difficulty } from './types';

export interface GameConfig {
  /** Lives at the start of a run and after a milestone refill, by difficulty. */
  readonly lives: Readonly<Record<Difficulty, number>>;
  /** Ladder rungs. Hits are run totals. */
  readonly ladder: readonly Rung[];
  /** How the ladder continues after its last rung. */
  readonly ladderExtension: LadderExtension;
  /** Power-up counts a run starts with, one per slot. */
  readonly startPowerUps: readonly number[];
  /** What clearing a boss round gives: `amount` more of power-up `slot` (0-based). */
  readonly milestoneReward: { readonly slot: number; readonly amount: number };
  /** How many wrong letters the Remove power-up takes off the keyboard. */
  readonly removeWrongCount: number;
  /** A boss word is picked from this many of the hardest words left in the bag. */
  readonly bossCandidates: number;
}

/** What a partial config (for example `proposed.json`) may hold. */
export interface GameConfigOverride {
  lives?: Partial<Record<Difficulty, number>>;
  ladder?: readonly Rung[];
  ladderExtension?: Partial<LadderExtension>;
  startPowerUps?: readonly number[];
  milestoneReward?: Partial<GameConfig['milestoneReward']>;
  removeWrongCount?: number;
  bossCandidates?: number;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

function buildDefault(): GameConfig {
  const lives = {} as Record<Difficulty, number>;
  for (const d of DIFFICULTY_ORDER) lives[d] = DIFFICULTY_RULES[d].lives;
  return {
    lives,
    // Always the real ladder, never TEST_CLUB_LADDER: a baseline must not pick up a build-time switch.
    ladder: CLUB_LADDER.map((r) => ({ crore: r.crore, hits: r.hits })),
    ladderExtension: {
      gapGrowth: LADDER_EXTENSION.gapGrowth,
      croreSteps: [...LADDER_EXTENSION.croreSteps],
      croreEvery: LADDER_EXTENSION.croreEvery,
    },
    startPowerUps: [...START_POWER_UPS],
    milestoneReward: { slot: MILESTONE_REWARD.slot, amount: MILESTONE_REWARD.amount },
    removeWrongCount: REMOVE_WRONG_COUNT,
    bossCandidates: BOSS_CANDIDATES,
  };
}

/** The live rules. Frozen, so one simulated run can't change what the next one reads. */
export const defaultGameConfig: GameConfig = deepFreeze(buildDefault());

/** The ladder for a config. Pass it together with the same config to `guess` and `applyPowerUp`. */
export function ladderFor(config: GameConfig = defaultGameConfig): Ladder {
  return new Ladder(config.ladder, config.ladderExtension);
}

/**
 * Applies an override onto a base config and returns new objects.
 * Objects (`lives`, `ladderExtension`, `milestoneReward`) merge one level deep;
 * arrays and scalars replace. Only known keys are read, and nothing is mutated.
 * It doesn't validate: use `validateGameConfig` for untrusted input.
 */
export function mergeGameConfig(base: GameConfig, override: GameConfigOverride = {}): GameConfig {
  const lives = {} as Record<Difficulty, number>;
  for (const d of DIFFICULTY_ORDER) lives[d] = override.lives?.[d] ?? base.lives[d];
  const ext = override.ladderExtension;
  const reward = override.milestoneReward;
  return {
    lives,
    ladder: (override.ladder ?? base.ladder).map((r) => ({ crore: r.crore, hits: r.hits })),
    ladderExtension: {
      gapGrowth: ext?.gapGrowth ?? base.ladderExtension.gapGrowth,
      croreSteps: [...(ext?.croreSteps ?? base.ladderExtension.croreSteps)],
      croreEvery: ext?.croreEvery ?? base.ladderExtension.croreEvery,
    },
    startPowerUps: [...(override.startPowerUps ?? base.startPowerUps)],
    milestoneReward: {
      slot: reward?.slot ?? base.milestoneReward.slot,
      amount: reward?.amount ?? base.milestoneReward.amount,
    },
    removeWrongCount: override.removeWrongCount ?? base.removeWrongCount,
    bossCandidates: override.bossCandidates ?? base.bossCandidates,
  };
}
