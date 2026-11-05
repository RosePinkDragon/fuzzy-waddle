/**
 * The saved-run reducer: every durable change to a `SlotDoc` as a pure function.
 * A transition returns the whole next document (run, bag, best and terminal
 * outcome together), so persisting it is one write and replaying a stale one
 * is rejected by the store before it gets here.
 *
 * Actions run under the rules the document carries (`doc.rules`), not the live
 * config, so a run started before a balance change finishes under the old rules.
 *
 * Pure TypeScript: randomness, ids and the word bank are injected.
 */
import { applyPowerUp, EXTRA_CLUE, REMOVE, REVEAL, type PowerUpEffect, type PowerUpSlot } from './powerUps';
import {
  RULES_VERSION,
  SCHEMA_VERSION,
  currentRules,
  ladderOf,
  settleBest,
  type BestScore,
  type SlotDoc,
  type TerminalInfo,
} from './runSnapshot';
import { beginWord, continueRun, guess, startRun, type GuessResult, type RunState } from './run';
import { drawBoss, drawNext, type BagState } from './shuffleBag';
import type { Difficulty, Rng, ThemeId, Word } from './types';

/** The word bank, as the session needs it. `data/words` provides the real one. */
export interface Content {
  /** Words a run draws from, for the given word tiers. */
  pool(theme: ThemeId, difficulty: Difficulty, tiers: readonly Difficulty[]): Word[];
  byId(id: string): Word | undefined;
}

export interface SessionEnv {
  rng: Rng;
  content: Content;
  newRunId(): string;
}

export type SessionAction =
  | { type: 'guess'; letter: string }
  | { type: 'power'; slot: PowerUpSlot }
  /** After a solve or the milestone screen: draw the next word. */
  | { type: 'continue' }
  /** Give up the run: settles its best and ends it. */
  | { type: 'abandon' }
  /** Abandon any run in progress and start a fresh one, in one step. */
  | { type: 'newRun' };

export type Reduction =
  | { kind: 'changed'; doc: SlotDoc; guess?: GuessResult; effect?: PowerUpEffect }
  /** Nothing to do (wrong stage, locked letter, terminal run). The document is returned as it was. */
  | { kind: 'ignored'; doc: SlotDoc }
  /** A word was needed and the pool has none. The document is returned as it was. */
  | { kind: 'empty'; doc: SlotDoc };

export interface MigrationInfo {
  replacedWordId: string;
  wordId: string;
  cause: 'missing' | 'answer-changed' | 'out-of-pool';
  /** Power-up uses given back because their benefit left with the old word. */
  refunds: { reveal: number; clue: number; remove: number };
}

const clubOf = (doc: Pick<SlotDoc, 'rules'>, hits: number): number | null => ladderOf(doc.rules).reached(hits)?.crore ?? null;

/** True when the run ended with more hits than the best it started with. */
export function isNewBest(doc: Pick<SlotDoc, 'run' | 'bestAtStart'>): boolean {
  return doc.run.hits > 0 && doc.run.hits > (doc.bestAtStart?.hits ?? 0);
}

/** Draws the next word under the saved rules and starts it. Null when the pool is empty. */
function drawInto(
  run: RunState,
  bag: BagState,
  rules: SlotDoc['rules'],
  env: SessionEnv,
  boss: boolean,
): { run: RunState; bag: BagState } | null {
  const pool = env.content.pool(run.theme, run.difficulty, rules.pool);
  if (!pool.length) return null;
  const drawn = boss
    ? drawBoss(bag, pool, env.rng, rules.config.bossCandidates)
    : drawNext(bag, pool.map((w) => w.id), env.rng);
  const word = pool.find((w) => w.id === drawn.id)!;
  return { run: beginWord(run, word, boss), bag: drawn.bag };
}

/**
 * A new document with a freshly drawn first word, under the live rules.
 * `bag` and `best` are what carries between runs. Null when the pool is empty.
 */
export function startDoc(
  theme: ThemeId,
  difficulty: Difficulty,
  seed: { bag: BagState; best: BestScore | null; revision?: number },
  env: SessionEnv,
): SlotDoc | null {
  const rules = currentRules(difficulty);
  const run = startRun(theme, difficulty, rules.config.startPowerUps);
  const drawn = drawInto(run, seed.bag, rules, env, ladderOf(rules).isBossWord(0));
  if (!drawn) return null;
  return {
    schema: SCHEMA_VERSION,
    rulesVersion: RULES_VERSION,
    theme,
    difficulty,
    runId: env.newRunId(),
    revision: seed.revision ?? 0,
    rules,
    run: drawn.run,
    bag: drawn.bag,
    best: seed.best,
    bestAtStart: seed.best,
    terminal: null,
  };
}

function end(doc: SlotDoc, reason: TerminalInfo['reason'], run: RunState): SlotDoc {
  const club = clubOf(doc, run.hits);
  return {
    ...doc,
    revision: doc.revision + 1,
    run,
    best: settleBest(doc.best, run.hits, club),
    terminal: { reason, hits: run.hits, club },
  };
}

/** Applies one action. A terminal document accepts only `newRun`. */
export function reduce(doc: SlotDoc, action: SessionAction, env: SessionEnv): Reduction {
  const ignored: Reduction = { kind: 'ignored', doc };
  const { run, rules } = doc;
  const ladder = ladderOf(rules);

  if (action.type === 'newRun') {
    const settled = doc.terminal ? doc.best : settleBest(doc.best, run.hits, clubOf(doc, run.hits));
    const next = startDoc(doc.theme, doc.difficulty, { bag: doc.bag, best: settled, revision: doc.revision + 1 }, env);
    return next ? { kind: 'changed', doc: next } : { kind: 'empty', doc };
  }
  if (doc.terminal) return ignored;

  switch (action.type) {
    case 'guess': {
      const r = guess(run, action.letter, ladder, rules.config);
      if (r.result === 'ignored') return ignored;
      if (r.run.status === 'over') return { kind: 'changed', doc: end(doc, 'lost', r.run), guess: r.result };
      return { kind: 'changed', doc: { ...doc, revision: doc.revision + 1, run: r.run }, guess: r.result };
    }
    case 'power': {
      const r = applyPowerUp(run, action.slot, env.rng, ladder, rules.config, rules.clues);
      if (!r.effect) return ignored;
      return { kind: 'changed', doc: { ...doc, revision: doc.revision + 1, run: r.run }, effect: r.effect };
    }
    case 'continue': {
      if (run.status !== 'solved' && run.status !== 'milestone') return ignored;
      const ready = continueRun(run);
      const drawn = drawInto(ready, doc.bag, rules, env, ladder.isBossWord(ready.hits));
      if (!drawn) return { kind: 'empty', doc };
      return { kind: 'changed', doc: { ...doc, revision: doc.revision + 1, run: drawn.run, bag: drawn.bag } };
    }
    case 'abandon':
      return { kind: 'changed', doc: end(doc, 'abandoned', run) };
    default:
      return ignored;
  }
}

/**
 * Checks the playable word against the current word bank when a saved run is
 * opened. A word that is gone, out of the pool or has a new answer is replaced
 * once (same boss status, same bag rules), with exact refunds for the reveal,
 * clue and remove uses whose benefit left with it. Undo stays spent, because
 * its restored life remains. Earned hits, lives, club and charges are kept.
 *
 * Solved, milestone and finished stages are history of an outcome that was
 * already earned, so they are never replayed, refunded or redrawn here.
 */
export function reconcileContent(
  doc: SlotDoc,
  env: SessionEnv,
): { kind: 'same'; doc: SlotDoc } | { kind: 'migrated'; doc: SlotDoc; migration: MigrationInfo } | { kind: 'empty'; doc: SlotDoc } {
  const play = doc.run.current;
  if (doc.terminal || doc.run.status !== 'playing' || !play) return { kind: 'same', doc };
  const fresh = env.content.byId(play.word.id);
  const pool = env.content.pool(doc.theme, doc.difficulty, doc.rules.pool);
  const inPool = pool.some((w) => w.id === play.word.id);
  const cause: MigrationInfo['cause'] | null = !fresh
    ? 'missing'
    : fresh.answer !== play.word.answer
      ? 'answer-changed'
      : !inPool
        ? 'out-of-pool'
        : null;
  if (!cause) {
    // Same word: pick up edited clue text, keep every effect.
    return { kind: 'same', doc: { ...doc, run: { ...doc.run, current: { ...play, word: fresh! } } } };
  }
  const drawn = drawInto(doc.run, doc.bag, doc.rules, env, play.isBoss);
  if (!drawn) return { kind: 'empty', doc };
  const refunds = {
    reveal: play.revealed.length,
    clue: play.cluesRevealed,
    remove: Math.ceil(play.removed.length / doc.rules.config.removeWrongCount),
  };
  const powerUps = [...doc.run.powerUps];
  powerUps[REVEAL] += refunds.reveal;
  powerUps[EXTRA_CLUE] += refunds.clue;
  powerUps[REMOVE] += refunds.remove;
  return {
    kind: 'migrated',
    doc: { ...doc, revision: doc.revision + 1, run: { ...drawn.run, powerUps }, bag: drawn.bag },
    migration: { replacedWordId: play.word.id, wordId: drawn.run.current!.word.id, cause, refunds },
  };
}
