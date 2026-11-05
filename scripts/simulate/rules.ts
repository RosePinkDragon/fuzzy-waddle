/**
 * The only simulator module that calls a game rule taking a config or a ladder.
 * Everything else (players, policies, the run loop, the report) gets a
 * `BoundRules` and cannot reach the live defaults by leaving an argument out.
 * `scripts/simulate/__tests__/simulate.test.ts` scans the other files to keep it so.
 */
import { applyPowerUp, type PowerUpEffect, type PowerUpSlot } from '@/game/powerUps';
import { beginWord, guess, livesLeft, maxLives, nextIsBoss, startRun, type GuessResult, type RunState } from '@/game/run';
import { validateGameConfig, ladderFor, type GameConfig } from '@/game/gameConfig';
import type { Ladder } from '@/game/milestones';
import { drawBoss, drawNext, type BagState } from '@/game/shuffleBag';
import type { Difficulty, Rng, ThemeId, Word } from '@/game/types';

export type LoadedConfig = { ok: true; config: GameConfig } | { ok: false; errors: string[] };

/** Freezes an object tree. `mergeGameConfig` returns unfrozen objects, and one run must not change what the next reads. */
export function freezeConfig<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(freezeConfig);
  }
  return value;
}

const NOT_BUILT_HINT =
  'Only these settings can be simulated: lives, ladder, ladderExtension, startPowerUps, milestoneReward, ' +
  'removeWrongCount, bossCandidates. #31 stage pools and #33 earned recovery are not built yet, so they cannot be simulated.';

/** Validates parsed JSON with the game's own validator and freezes the result. Errors get a hint about what can be simulated. */
export function loadConfig(json: unknown): LoadedConfig {
  const result = validateGameConfig(json);
  if (!result.ok) {
    const unknown = result.errors.some((e) => e.endsWith('unknown setting'));
    return { ok: false, errors: unknown ? [...result.errors, NOT_BUILT_HINT] : result.errors };
  }
  return { ok: true, config: freezeConfig(result.config) };
}

/** The rule functions with one config and its ladder already applied. */
export interface BoundRules {
  readonly config: GameConfig;
  readonly ladder: Ladder;
  startRun(theme: ThemeId, difficulty: Difficulty): RunState;
  nextIsBoss(run: RunState): boolean;
  drawBoss(bag: BagState, pool: readonly Word[], rng: Rng): { id: string; bag: BagState };
  drawNext(bag: BagState, poolIds: readonly string[], rng: Rng): { id: string; bag: BagState };
  guess(run: RunState, letter: string): { run: RunState; result: GuessResult };
  applyPowerUp(run: RunState, slot: PowerUpSlot, rng: Rng): { run: RunState; effect: PowerUpEffect | null };
  maxLives(run: RunState): number;
  livesLeft(run: RunState): number;
}

export function bindRules(config: GameConfig): BoundRules {
  const ladder = ladderFor(config);
  return {
    config,
    ladder,
    startRun: (theme, difficulty) => startRun(theme, difficulty, config.startPowerUps),
    nextIsBoss: (run) => nextIsBoss(run, ladder),
    drawBoss: (bag, pool, rng) => drawBoss(bag, pool, rng, config.bossCandidates),
    drawNext: (bag, poolIds, rng) => drawNext(bag, poolIds, rng),
    guess: (run, letter) => guess(run, letter, ladder, config),
    applyPowerUp: (run, slot, rng) => applyPowerUp(run, slot, rng, ladder, config),
    maxLives: (run) => maxLives(run, config),
    livesLeft: (run) => livesLeft(run, config),
  };
}

/** A word pool with the lookups the run loop needs. */
export interface PoolInfo {
  readonly words: readonly Word[];
  readonly ids: readonly string[];
  readonly byId: ReadonlyMap<string, Word>;
}

export function makePool(words: readonly Word[]): PoolInfo {
  return { words, ids: words.map((w) => w.id), byId: new Map(words.map((w) => [w.id, w])) };
}

export interface DrawnWord {
  run: RunState;
  bag: BagState;
  boss: boolean;
  /** Words in the bag when a boss was drawn (the bag left plus the word taken). Only set for boss draws. */
  bossBagSize?: number;
}

/**
 * Draws the next word the way `drawInto` in `src/game/runSession.ts` does (the one draw the
 * saved-run core uses): a boss word when the next hit would enter a club, otherwise the next
 * word in the bag, then `beginWord`. Keep this in step with it; a test fails when it drifts.
 */
export function drawWord(rules: BoundRules, run: RunState, bag: BagState, pool: PoolInfo, rng: Rng): DrawnWord {
  const boss = rules.nextIsBoss(run);
  const drawn = boss ? rules.drawBoss(bag, pool.words, rng) : rules.drawNext(bag, pool.ids, rng);
  const word = pool.byId.get(drawn.id);
  if (!word) throw new Error(`Drew unknown word ${drawn.id}`);
  return {
    run: beginWord(run, word, boss),
    bag: drawn.bag,
    boss,
    bossBagSize: boss ? drawn.bag.remaining.length + 1 : undefined,
  };
}

/** Default word cap: the hits of the first rung past the ladder, plus 10 (120 words today). */
export function defaultCap(rules: BoundRules): number {
  return rules.ladder.clubAt(rules.config.ladder.length).hits + 10;
}

/** FNV-1a of a string, as 8 hex digits. */
export function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** `current`, or the source path plus a hash of the validated config (so edits show up). */
export function configIdentity(source: string | null, config: GameConfig): string {
  return source === null ? 'current' : `${source} (fnv1a ${fnv1a(JSON.stringify(config))})`;
}
