import { BOSS_CANDIDATES } from './config';
import { lettersOf } from './answer';
import { shuffle, pick } from './rng';
import type { Rng, Word } from './types';

/**
 * One bag per theme + difficulty. The bag holds the word IDs not yet played in
 * the current cycle, so nothing repeats until the whole pool has been used.
 * It is plain data so it can be saved between runs.
 */
export interface BagState {
  remaining: string[];
  /** Last word drawn, so a refilled bag does not start with it again. */
  last?: string;
}

export const emptyBag = (): BagState => ({ remaining: [] });

/** A fresh shuffled cycle of the pool, never starting with `avoid` when there is a choice. */
export function refill(poolIds: readonly string[], rng: Rng, avoid?: string): string[] {
  const order = shuffle(poolIds, rng);
  if (avoid && order.length > 1 && order[0] === avoid) {
    const swap = 1 + Math.floor(rng() * (order.length - 1));
    [order[0], order[swap]] = [order[swap], order[0]];
  }
  return order;
}

/** Drops IDs that are no longer in the pool (word bank edits) and refills when empty. */
function usable(bag: BagState, poolIds: readonly string[], rng: Rng): string[] {
  const inPool = new Set(poolIds);
  const remaining = bag.remaining.filter((id) => inPool.has(id));
  return remaining.length ? remaining : refill(poolIds, rng, bag.last);
}

/** Draws the next word ID. */
export function drawNext(bag: BagState, poolIds: readonly string[], rng: Rng): { id: string; bag: BagState } {
  if (!poolIds.length) throw new Error('Cannot draw from an empty pool');
  const remaining = usable(bag, poolIds, rng);
  const [id, ...rest] = remaining;
  return { id, bag: { remaining: rest, last: id } };
}

const DIFFICULTY_RANK = { easy: 0, medium: 1, hard: 2 } as const;

/** Higher means a better boss round: harder first, then more distinct letters, then longer. */
export function bossScore(word: Word): number {
  const letters = word.answer.replace(/[^A-Z]/g, '').length;
  return DIFFICULTY_RANK[word.difficulty] * 1000 + lettersOf(word.answer).size * 20 + letters;
}

/**
 * Draws a boss-round word: one of the hardest/longest words still in the bag,
 * picked at random from the top few so bosses are not predictable.
 */
export function drawBoss(
  bag: BagState,
  pool: readonly Word[],
  rng: Rng,
  candidates = BOSS_CANDIDATES,
): { id: string; bag: BagState } {
  if (!pool.length) throw new Error('Cannot draw from an empty pool');
  const byId = new Map(pool.map((w) => [w.id, w]));
  const remaining = usable(bag, [...byId.keys()], rng);
  const ranked = remaining
    .map((id) => byId.get(id)!)
    .sort((a, b) => bossScore(b) - bossScore(a))
    .slice(0, Math.max(1, candidates));
  const chosen = pick(ranked, rng).id;
  return { id: chosen, bag: { remaining: remaining.filter((id) => id !== chosen), last: chosen } };
}
