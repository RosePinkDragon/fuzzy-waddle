/**
 * Saves and restores runs: one authoritative document per theme + difficulty
 * (see `game/runSnapshot`), changed only through `game/runSession`.
 *
 * - Every operation on a slot runs one at a time, in the order it was asked.
 * - A change is one write of the whole document. Until that write completes the
 *   saved state is still the previous complete document, so a restart sees a
 *   consistent run, bag and best.
 * - Callers say which run and revision they acted on. A stale caller (an old
 *   run, a repeated or delayed action) gets `stale` and changes nothing.
 * - Nothing is hidden: every result says whether it is saved, was recovered
 *   from bad data, is unsaved, is a finished run or has no words to play.
 *
 * Challenges never come here: they play one word with no run, bag or best.
 * Legacy bag/best keys are read only to seed a slot that has no document yet.
 */
import { poolFor, wordById } from '@/data/words';
import { defaultRng } from '@/game/rng';
import {
  betterBest,
  parseDoc,
  readBag,
  readBest,
  serializeDoc,
  type BestScore,
  type SlotDoc,
} from '@/game/runSnapshot';
import { reconcileContent, reduce, startDoc, type MigrationInfo, type SessionAction, type SessionEnv } from '@/game/runSession';
import { emptyBag, type BagState } from '@/game/shuffleBag';
import type { PowerUpEffect } from '@/game/powerUps';
import type { GuessResult } from '@/game/run';
import type { Difficulty, ThemeId } from '@/game/types';

import { keys, readRaw, writeRaw, type RawRead } from './storage';

export interface RawStorage {
  read(key: string): Promise<RawRead>;
  write(key: string, raw: string): Promise<boolean>;
}

export type RecoveryReason = 'corrupt' | 'unsupported';
/** Why a result isn't saved: storage couldn't be read safely, or the write failed. */
export type UnsavedCause = 'read-failed' | 'write-failed';

export type OpenOutcome =
  /** A durable, resumable run. */
  | { kind: 'saved'; doc: SlotDoc; source: 'resumed' | 'started' | 'migrated'; migration?: MigrationInfo }
  /** The saved data was bad; a fresh run replaced it and is durably saved. */
  | { kind: 'recovered'; doc: SlotDoc; reason: RecoveryReason }
  /** Playable, but not saved. Show progress-loss feedback and never claim it is saved. */
  | { kind: 'unsaved'; doc: SlotDoc; cause: UnsavedCause; recovery?: RecoveryReason; migration?: MigrationInfo }
  /** The run is over (lost or abandoned). It never resumes; start a New run. */
  | { kind: 'terminal'; doc: SlotDoc; saved: boolean }
  /** No word to play (empty pool). Nothing was written. */
  | { kind: 'empty'; best: BestScore | null };

export type ActResult =
  | { kind: 'saved'; doc: SlotDoc; guess?: GuessResult; effect?: PowerUpEffect }
  | { kind: 'unsaved'; doc: SlotDoc; cause: UnsavedCause; guess?: GuessResult; effect?: PowerUpEffect }
  | { kind: 'ignored'; doc: SlotDoc }
  | { kind: 'empty'; doc: SlotDoc }
  /** The caller acted on an old run or revision. `doc` is the current one, if any. */
  | { kind: 'stale'; doc: SlotDoc | null };

export type SlotView =
  | { kind: 'none'; best: BestScore | null }
  | { kind: 'resumable'; doc: SlotDoc }
  | { kind: 'terminal'; doc: SlotDoc }
  /** Saved data that can't be used; opening replaces it with a fresh run. */
  | { kind: 'unreadable'; reason: RecoveryReason | 'unavailable'; best: BestScore | null };

export interface RunStoreOptions {
  storage?: RawStorage;
  rng?: SessionEnv['rng'];
  content?: SessionEnv['content'];
  newRunId?: () => string;
}

export interface RunStore {
  /** Reads a slot without drawing or writing anything (for the picker). */
  inspect(theme: ThemeId, difficulty: Difficulty): Promise<SlotView>;
  /** Resumes the saved run, or starts one, migrating or recovering as needed. */
  open(theme: ThemeId, difficulty: Difficulty): Promise<OpenOutcome>;
  /** Applies an action to the run the caller last saw. */
  act(
    theme: ThemeId,
    difficulty: Difficulty,
    seen: Pick<SlotDoc, 'runId' | 'revision'>,
    action: SessionAction,
  ): Promise<ActResult>;
}

interface Slot {
  tail: Promise<unknown>;
  /** The latest document this store committed or tried to commit. */
  doc: SlotDoc | null;
  /** Set while `doc` is ahead of storage. */
  unsaved: UnsavedCause | null;
  /** A required read failed, so writing could overwrite what couldn't be read. */
  blocked: boolean;
}

type Loaded =
  | { kind: 'doc'; doc: SlotDoc }
  | {
      kind: 'nothing';
      best: BestScore | null;
      bag: BagState;
      /** At least one read failed: don't write over data we couldn't see. */
      blocked: boolean;
      recovery: RecoveryReason | null;
    };

const defaultStorage: RawStorage = { read: readRaw, write: writeRaw };

export function createRunStore(options: RunStoreOptions = {}): RunStore {
  const storage = options.storage ?? defaultStorage;
  const env: SessionEnv = {
    rng: options.rng ?? defaultRng,
    content: options.content ?? { pool: poolFor, byId: wordById },
    newRunId: options.newRunId ?? (() => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`),
  };
  const slots = new Map<string, Slot>();

  function slotFor(theme: ThemeId, difficulty: Difficulty): Slot {
    const id = `${theme}:${difficulty}`;
    let slot = slots.get(id);
    if (!slot) {
      slot = { tail: Promise.resolve(), doc: null, unsaved: null, blocked: false };
      slots.set(id, slot);
    }
    return slot;
  }

  /** Runs `job` after every earlier operation on the slot has finished. */
  function enqueue<T>(slot: Slot, job: () => Promise<T>): Promise<T> {
    const run = slot.tail.then(job, job);
    slot.tail = run.catch(() => undefined);
    return run;
  }

  async function load(theme: ThemeId, difficulty: Difficulty): Promise<Loaded> {
    const canonical = await storage.read(keys.run(theme, difficulty));
    let recovery: RecoveryReason | null = null;
    let salvage: { best: BestScore | null; bag: BagState | null } = { best: null, bag: null };
    if (canonical.ok && canonical.raw !== null) {
      const parsed = parseDoc(canonical.raw, theme, difficulty);
      if (parsed.ok) return { kind: 'doc', doc: parsed.doc };
      recovery = parsed.reason;
      salvage = parsed.salvage;
    }
    // Nothing usable in the canonical slot: seed from what survives, never from a guess.
    let blocked = !canonical.ok;
    const legacyBest = await storage.read(keys.best(theme, difficulty));
    const legacyBag = await storage.read(keys.bag(theme, difficulty));
    blocked = blocked || !legacyBest.ok || !legacyBag.ok;
    let best = salvage.best;
    if (legacyBest.ok && legacyBest.raw !== null) {
      const parsed = safeJson(legacyBest.raw);
      const read = parsed.ok ? readBest(parsed.value) : { ok: false as const };
      if (read.ok) best = betterBest(best, read.best);
    }
    let bag = salvage.bag;
    if (!bag && legacyBag.ok && legacyBag.raw !== null) {
      const parsed = safeJson(legacyBag.raw);
      bag = parsed.ok ? readBag(parsed.value) : null;
    }
    return { kind: 'nothing', best, bag: bag ?? emptyBag(), blocked, recovery };
  }

  /** Writes a whole document. Records whether storage is ahead of or behind the in-memory one. */
  async function commit(slot: Slot, theme: ThemeId, difficulty: Difficulty, doc: SlotDoc): Promise<UnsavedCause | null> {
    let cause: UnsavedCause | null = null;
    if (slot.blocked) cause = 'read-failed';
    else if (!(await storage.write(keys.run(theme, difficulty), serializeDoc(doc)))) cause = 'write-failed';
    slot.doc = doc;
    slot.unsaved = cause;
    return cause;
  }

  const store: RunStore = {
    inspect(theme, difficulty) {
      const slot = slotFor(theme, difficulty);
      return enqueue(slot, async (): Promise<SlotView> => {
        const loaded = slot.unsaved && slot.doc ? ({ kind: 'doc', doc: slot.doc } as const) : await load(theme, difficulty);
        if (loaded.kind === 'doc') {
          return loaded.doc.terminal ? { kind: 'terminal', doc: loaded.doc } : { kind: 'resumable', doc: loaded.doc };
        }
        if (loaded.recovery) return { kind: 'unreadable', reason: loaded.recovery, best: loaded.best };
        return loaded.blocked ? { kind: 'unreadable', reason: 'unavailable', best: loaded.best } : { kind: 'none', best: loaded.best };
      });
    },

    open(theme, difficulty) {
      const slot = slotFor(theme, difficulty);
      return enqueue(slot, async (): Promise<OpenOutcome> => {
        // A document that never reached storage stays authoritative, so reopening can't reroll it.
        const loaded = slot.unsaved && slot.doc ? ({ kind: 'doc', doc: slot.doc } as const) : await load(theme, difficulty);

        if (loaded.kind === 'doc') {
          const { doc } = loaded;
          if (!slot.unsaved) slot.blocked = false;
          if (doc.terminal) {
            slot.doc = doc;
            return { kind: 'terminal', doc, saved: !slot.unsaved };
          }
          const rec = reconcileContent(doc, env);
          if (rec.kind === 'empty') return { kind: 'empty', best: doc.best };
          if (rec.kind === 'same') {
            slot.doc = rec.doc;
            return slot.unsaved
              ? { kind: 'unsaved', doc: rec.doc, cause: slot.unsaved }
              : { kind: 'saved', doc: rec.doc, source: 'resumed' };
          }
          const cause = await commit(slot, theme, difficulty, rec.doc);
          return cause
            ? { kind: 'unsaved', doc: rec.doc, cause, migration: rec.migration }
            : { kind: 'saved', doc: rec.doc, source: 'migrated', migration: rec.migration };
        }

        slot.blocked = loaded.blocked;
        const fresh = startDoc(theme, difficulty, { bag: loaded.bag, best: loaded.best }, env);
        if (!fresh) return { kind: 'empty', best: loaded.best };
        const cause = await commit(slot, theme, difficulty, fresh);
        if (cause) return { kind: 'unsaved', doc: fresh, cause, ...(loaded.recovery ? { recovery: loaded.recovery } : {}) };
        return loaded.recovery
          ? { kind: 'recovered', doc: fresh, reason: loaded.recovery }
          : { kind: 'saved', doc: fresh, source: 'started' };
      });
    },

    act(theme, difficulty, seen, action) {
      const slot = slotFor(theme, difficulty);
      return enqueue(slot, async (): Promise<ActResult> => {
        let current = slot.doc;
        if (!current) {
          const loaded = await load(theme, difficulty);
          if (loaded.kind === 'doc') current = loaded.doc;
        }
        if (!current || current.runId !== seen.runId || current.revision !== seen.revision) {
          return { kind: 'stale', doc: current };
        }
        const reduction = reduce(current, action, env);
        if (reduction.kind !== 'changed') return reduction;
        const cause = await commit(slot, theme, difficulty, reduction.doc);
        const extra = { ...(reduction.guess ? { guess: reduction.guess } : {}), ...(reduction.effect ? { effect: reduction.effect } : {}) };
        return cause ? { kind: 'unsaved', doc: reduction.doc, cause, ...extra } : { kind: 'saved', doc: reduction.doc, ...extra };
      });
    },
  };
  return store;
}

function safeJson(raw: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false };
  }
}
