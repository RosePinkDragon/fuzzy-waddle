/**
 * The run loop. It plays whole runs through the real rules (via `BoundRules`) and
 * records what happened. Nothing here reads an unseeded random source or the clock: every
 * choice comes from one of three seeded streams per run.
 */
import { continueRun, type RunState } from '@/game/run';
import { seededRng } from '@/game/rng';
import { emptyBag, type BagState } from '@/game/shuffleBag';
import type { Rng, ThemeId, Difficulty } from '@/game/types';
import type { PowerUpSlot } from '@/game/powerUps';

import type { Player, Policy } from './players';
import { drawWord, type BoundRules, type PoolInfo } from './rules';

export type BagMode = 'carry' | 'reset';
export type Outcome = 'lost' | 'capped';

/** Stream salts. Each run gets one stream of each kind, derived from the seed and run index. */
export const STREAM = { draw: 1, effect: 2, player: 3 } as const;

/** A pure integer hash of its parts (FNV-1a style), used to derive independent seeds. */
export function mixSeed(...parts: number[]): number {
  let h = 0x811c9dc5;
  for (const part of parts) {
    h = Math.imul(h ^ (part >>> 0), 0x01000193) >>> 0;
    h ^= h >>> 15;
    h = Math.imul(h, 0x85ebca6b) >>> 0;
    h ^= h >>> 13;
  }
  return h >>> 0;
}

export interface PowerUpUse {
  slot: PowerUpSlot;
  wordIndex: number;
  /** Ladder position of the interval the word was played in. */
  interval: number;
  boss: boolean;
  livesBefore: number;
  /** Remove only: how many letters were actually taken off. */
  removed?: number;
}

export interface BossRecord {
  /** The club this boss word would enter. */
  club: number;
  wordIndex: number;
  livesLeft: number;
  stock: number[];
  won: boolean;
  /** Words in the bag when the boss was drawn. */
  bagSize: number;
}

export interface RunRecord {
  runIndex: number;
  outcome: Outcome;
  hits: number;
  /** Words played, counting the one that was lost. */
  words: number;
  wordIds: string[];
  /** Clubs entered (0 before the first). */
  clubs: number;
  /** Wrong guesses by ladder interval (0 is before the first club). */
  misses: number[];
  bosses: BossRecord[];
  uses: PowerUpUse[];
  /** Words that had already been played earlier in the same run. */
  repeats: number;
}

export interface BatchOptions {
  rules: BoundRules;
  theme: ThemeId;
  difficulty: Difficulty;
  runs: number;
  seed: number;
  cap: number;
  bags: BagMode;
  player: Player;
  policy: Policy;
  /** The word pool. The CLI passes `poolFor(theme, difficulty)`. */
  pool: PoolInfo;
}

export interface BatchResult {
  options: BatchOptions;
  records: RunRecord[];
}

const MAX_STEPS_PER_WORD = 200;

export interface RunOptions extends Omit<BatchOptions, 'runs' | 'seed' | 'bags'> {
  runIndex: number;
  seed: number;
  bag: BagState;
}

/** Plays one run. Returns the record and the bag as it ends. */
export function simulateRun(o: RunOptions): { record: RunRecord; bag: BagState } {
  const { rules, pool, player, policy } = o;
  const drawRng = seededRng(mixSeed(o.seed, o.runIndex, STREAM.draw));
  const effectRng = seededRng(mixSeed(o.seed, o.runIndex, STREAM.effect));
  const playerSeed = mixSeed(o.seed, o.runIndex, STREAM.player);

  let run: RunState = rules.startRun(o.theme, o.difficulty);
  let bag = o.bag;
  const misses: number[] = [];
  const bosses: BossRecord[] = [];
  const uses: PowerUpUse[] = [];
  const wordIds: string[] = [];
  const seen = new Set<string>();
  let repeats = 0;
  let words = 0;

  while (run.status !== 'over' && words < o.cap) {
    const drawn = drawWord(rules, run, bag, pool, drawRng);
    run = drawn.run;
    bag = drawn.bag;
    const play = run.current!;
    const wordIndex = words;
    words += 1;
    wordIds.push(play.word.id);
    if (seen.has(play.word.id)) repeats += 1;
    seen.add(play.word.id);

    const interval = rules.ladder.next(run.hits).index;
    while (misses.length <= interval) misses.push(0);
    let boss: BossRecord | null = null;
    if (drawn.boss) {
      boss = {
        club: interval,
        wordIndex,
        livesLeft: rules.livesLeft(run),
        stock: [...run.powerUps],
        won: false,
        bagSize: drawn.bossBagSize!,
      };
      bosses.push(boss);
    }

    const playerRng: Rng = seededRng(mixSeed(playerSeed, wordIndex));
    for (let step = 0; run.status === 'playing'; step += 1) {
      if (step > MAX_STEPS_PER_WORD) throw new Error(`Word ${play.word.id} did not finish in ${MAX_STEPS_PER_WORD} steps`);
      const slot = policy.choose(run, rules);
      if (slot !== null) {
        const livesBefore = rules.livesLeft(run);
        const used = rules.applyPowerUp(run, slot, effectRng);
        if (!used.effect) throw new Error(`Policy ${policy.name} chose slot ${slot}, which could not be used`);
        run = used.run;
        uses.push({
          slot,
          wordIndex,
          interval,
          boss: drawn.boss,
          livesBefore,
          ...(used.effect.slot === 3 ? { removed: used.effect.letters.length } : {}),
        });
        if (run.status !== 'playing') break;
      }
      const letter = player.choose(run, playerRng);
      const result = rules.guess(run, letter);
      if (result.result === 'ignored') throw new Error(`Player ${player.name} chose ${letter}, which could not be pressed`);
      if (result.result === 'wrong') misses[interval] += 1;
      run = result.run;
    }

    if (boss && run.status !== 'over') boss.won = true;
    if (run.status === 'solved' || run.status === 'milestone') run = continueRun(run);
  }

  const record: RunRecord = {
    runIndex: o.runIndex,
    outcome: run.status === 'over' ? 'lost' : 'capped',
    hits: run.hits,
    words,
    wordIds,
    clubs: (rules.ladder.reached(run.hits)?.index ?? -1) + 1,
    misses,
    bosses,
    uses,
    repeats,
  };
  return { record, bag };
}

/** Plays `runs` runs. In `carry` mode one bag runs through the whole batch; in `reset` mode each run starts empty. */
export function simulateBatch(options: BatchOptions): BatchResult {
  const records: RunRecord[] = [];
  let bag = emptyBag();
  for (let runIndex = 0; runIndex < options.runs; runIndex += 1) {
    const out = simulateRun({
      rules: options.rules,
      theme: options.theme,
      difficulty: options.difficulty,
      cap: options.cap,
      player: options.player,
      policy: options.policy,
      pool: options.pool,
      seed: options.seed,
      runIndex,
      bag: options.bags === 'carry' ? bag : emptyBag(),
    });
    bag = out.bag;
    records.push(out.record);
  }
  return { options, records };
}
