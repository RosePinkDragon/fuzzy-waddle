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
  LIVES_MARKS,
  MILESTONE_REWARD,
  POWER_UP_SLOTS,
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

export type GameConfigResult = { ok: true; config: GameConfig } | { ok: false; errors: string[] };

function show(value: unknown): string {
  if (typeof value === 'number') return String(value);
  if (value === undefined) return 'undefined';
  if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') return typeof value;
  const text = JSON.stringify(value);
  return text.length > 40 ? `${text.slice(0, 37)}...` : text;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

const has = (obj: Record<string, unknown>, key: string) => Object.prototype.hasOwnProperty.call(obj, key);

/**
 * Checks untrusted input (for example parsed JSON) as a partial config, merges it
 * onto `defaultGameConfig` and returns the full config, or every problem found.
 * Each error starts with the path of the bad value. Only own, known keys are read.
 */
export function validateGameConfig(input: unknown): GameConfigResult {
  const errors: string[] = [];

  const int = (path: string, value: unknown, min: number, max?: number): value is number => {
    if (Number.isSafeInteger(value) && (value as number) >= min && (max === undefined || (value as number) <= max)) {
      return true;
    }
    const range = max === undefined ? `an integer of at least ${min}` : `an integer from ${min} to ${max}`;
    errors.push(`${path}: must be ${range} (got ${show(value)})`);
    return false;
  };

  /** Returns the object when plain, and reports unknown keys. */
  const object = (path: string, value: unknown, known: readonly string[]): Record<string, unknown> | null => {
    if (!isPlainObject(value)) {
      errors.push(`${path}: must be an object (got ${show(value)})`);
      return null;
    }
    for (const key of Object.keys(value)) {
      if (!known.includes(key)) errors.push(`${path === 'config' ? key : `${path}.${key}`}: unknown setting`);
    }
    return value;
  };

  const array = (path: string, value: unknown): value is unknown[] => {
    if (Array.isArray(value)) return true;
    errors.push(`${path}: must be a list (got ${show(value)})`);
    return false;
  };

  const strictlyIncreasing = (path: string, values: unknown[], min: number) => {
    let prev: number | undefined;
    values.forEach((v, i) => {
      if (!int(`${path}[${i}]`, v, min)) {
        prev = undefined;
        return;
      }
      if (prev !== undefined && v <= prev) {
        errors.push(`${path}[${i}]: must be greater than ${path}[${i - 1}] (${prev}) (got ${v})`);
      }
      prev = v;
    });
  };

  const root = object('config', input, [
    'lives',
    'ladder',
    'ladderExtension',
    'startPowerUps',
    'milestoneReward',
    'removeWrongCount',
    'bossCandidates',
  ]);
  if (!root) return { ok: false, errors };

  if (has(root, 'lives')) {
    const lives = object('lives', root.lives, DIFFICULTY_ORDER);
    if (lives) for (const d of DIFFICULTY_ORDER) if (has(lives, d)) int(`lives.${d}`, lives[d], 1, LIVES_MARKS);
  }

  if (has(root, 'ladder') && array('ladder', root.ladder)) {
    const rungs = root.ladder;
    if (rungs.length < 2) errors.push(`ladder: needs at least 2 rungs (got ${rungs.length})`);
    const hits: unknown[] = [];
    const crore: unknown[] = [];
    rungs.forEach((rung, i) => {
      const r = object(`ladder[${i}]`, rung, ['crore', 'hits']);
      hits.push(r ? r.hits : undefined);
      crore.push(r ? r.crore : undefined);
    });
    if (rungs.every(isPlainObject)) {
      strictlyIncreasing('ladder.hits', hits, 1);
      strictlyIncreasing('ladder.crore', crore, 1);
    }
  }

  if (has(root, 'ladderExtension')) {
    const ext = object('ladderExtension', root.ladderExtension, ['gapGrowth', 'croreSteps', 'croreEvery']);
    if (ext) {
      if (has(ext, 'gapGrowth')) int('ladderExtension.gapGrowth', ext.gapGrowth, 0);
      if (has(ext, 'croreEvery')) int('ladderExtension.croreEvery', ext.croreEvery, 1);
      if (has(ext, 'croreSteps') && array('ladderExtension.croreSteps', ext.croreSteps)) {
        strictlyIncreasing('ladderExtension.croreSteps', ext.croreSteps, 1);
      }
    }
  }

  if (has(root, 'startPowerUps') && array('startPowerUps', root.startPowerUps)) {
    if (root.startPowerUps.length !== POWER_UP_SLOTS) {
      errors.push(`startPowerUps: must have exactly ${POWER_UP_SLOTS} counts (got ${root.startPowerUps.length})`);
    }
    root.startPowerUps.forEach((n, i) => int(`startPowerUps[${i}]`, n, 0));
  }

  if (has(root, 'milestoneReward')) {
    const reward = object('milestoneReward', root.milestoneReward, ['slot', 'amount']);
    if (reward) {
      if (has(reward, 'slot')) int('milestoneReward.slot', reward.slot, 0, POWER_UP_SLOTS - 1);
      if (has(reward, 'amount')) int('milestoneReward.amount', reward.amount, 0);
    }
  }

  if (has(root, 'removeWrongCount')) int('removeWrongCount', root.removeWrongCount, 1);
  if (has(root, 'bossCandidates')) int('bossCandidates', root.bossCandidates, 1);

  if (errors.length) return { ok: false, errors };
  return { ok: true, config: mergeGameConfig(defaultGameConfig, root as GameConfigOverride) };
}
