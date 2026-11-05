/**
 * The only way the app reads and changes a saved run. A plain-TypeScript layer
 * over the shared `runStore`, with no React in it, so hooks stay thin and the
 * behaviour is tested directly.
 *
 * - **Opens once per controller.** `start()` is idempotent, and `dispose()` only
 *   stops timers: it never throws away an in-flight result. A StrictMode mount,
 *   unmount and remount therefore can't open (and draw or migrate) twice.
 * - **Runs actions in order.** Each action is sent with the document the previous
 *   one returned, so two quick taps don't share a revision and come back `stale`.
 *   An action made for one run is dropped if the run has changed by the time it runs.
 * - **Handles `stale` once.** The rest of the queue is dropped, the slot is
 *   `open`ed once and its run adopted. A dropped action is never retried.
 * - **Continues a solved word exactly once.** One timer per `runId:revision` queues
 *   `continue`; the store's revision check rejects any duplicate.
 * - **Leave and return.** Leaving stops the solved timer. Returning re-opens once
 *   (extra return events are merged into it), which picks up a run another tab
 *   moved on, then re-arms the timer.
 *
 * Challenges never come here (see `hooks/useChallenge`).
 */
import { DIFFICULTY_ORDER, SOLVED_PAUSE_MS } from '@/game/config';
import type { PowerUpEffect, PowerUpSlot } from '@/game/powerUps';
import type { GuessResult } from '@/game/run';
import { betterBest, type BestScore, type SlotDoc } from '@/game/runSnapshot';
import { isNewBest, type MigrationInfo, type SessionAction } from '@/game/runSession';
import type { Difficulty, ThemeId } from '@/game/types';

import { runStore, type ActResult, type OpenOutcome, type RecoveryReason, type RunStore, type SlotView, type UnsavedCause } from './runStore';

// ---------- recovery registry ----------

/** Corrupt or unsupported data the player hasn't been told about yet. */
export interface RecoveryEntry {
  theme: ThemeId;
  difficulty: Difficulty;
  reason: RecoveryReason;
  /** The best that survived, if any. */
  best: BestScore | null;
}

const slotKey = (theme: ThemeId, difficulty: Difficulty) => `${theme}:${difficulty}`;
const pending = new Map<string, RecoveryEntry>();
const shown = new Set<string>();

/** Remembers that a slot's data was replaced, unless its notice was already shown this session. */
export function noteRecovery(entry: RecoveryEntry): void {
  const key = slotKey(entry.theme, entry.difficulty);
  if (!shown.has(key)) pending.set(key, entry);
}

/** True once the recovery notice for a slot has been shown this session. */
export function recoveryShown(theme: ThemeId, difficulty: Difficulty): boolean {
  return shown.has(slotKey(theme, difficulty));
}

/** Records that the player has seen (or dismissed) the notice for a slot. */
export function markRecoveryShown(theme: ThemeId, difficulty: Difficulty): void {
  const key = slotKey(theme, difficulty);
  shown.add(key);
  pending.delete(key);
}

/** Notices still waiting for a theme, in difficulty order. */
export function pendingRecoveries(theme: ThemeId): RecoveryEntry[] {
  return DIFFICULTY_ORDER.flatMap((d) => pending.get(slotKey(theme, d)) ?? []);
}

/** Forgets every notice and what was shown. For tests. */
export function resetRecoveryRegistry(): void {
  pending.clear();
  shown.clear();
}

// ---------- controller ----------

export type RunPhase = 'loading' | 'ready' | 'empty' | 'recoveryPending';

export interface RunNotice {
  kind: 'wordReplaced';
  migration: MigrationInfo;
}

/** What the UI renders from. A new object after every change. */
export interface RunSnapshot {
  phase: RunPhase;
  doc: SlotDoc | null;
  /** False after any write or read that didn't reach storage, true again after the next successful write. */
  saved: boolean;
  notice: RunNotice | null;
  /** True when this run beat the best it started with. */
  isNewBest: boolean;
}

export interface RunControllerOptions {
  store?: RunStore;
  pauseMs?: number;
}

export interface RunController {
  getSnapshot(): RunSnapshot;
  subscribe(listener: () => void): () => void;
  /** Opens the slot, once. Resolves when the first open has been adopted. */
  start(): Promise<void>;
  /** Stops timers. Safe to follow with `start()` (a remount). */
  dispose(): void;
  /** The app went away: stop the solved timer. */
  leave(): void;
  /** The app came back: re-open once and adopt the result. Repeated calls share one open. */
  return(): Promise<void>;
  press(letter: string): Promise<GuessResult | null>;
  usePower(slot: PowerUpSlot): Promise<PowerUpEffect | null>;
  /** From the milestone screen: draw the next word. */
  keepPlaying(): Promise<void>;
  /** From a finished run: start a new one. */
  restart(): Promise<void>;
  dismissNotice(): void;
}

const INITIAL: RunSnapshot = { phase: 'loading', doc: null, saved: true, notice: null, isNewBest: false };

export function createRunController(
  theme: ThemeId,
  difficulty: Difficulty,
  { store = runStore, pauseMs = SOLVED_PAUSE_MS }: RunControllerOptions = {},
): RunController {
  let snapshot: RunSnapshot = INITIAL;
  const listeners = new Set<() => void>();

  let startPromise: Promise<void> | null = null;
  let disposed = false;
  let away = false;
  let returning: Promise<void> | null = null;
  let tail: Promise<unknown> = Promise.resolve();
  /** Bumped on `stale`: actions queued before it are dropped. */
  let epoch = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let timerKey: string | null = null;

  function update(next: Partial<RunSnapshot>): void {
    const merged = { ...snapshot, ...next };
    merged.isNewBest = merged.doc ? isNewBest(merged.doc) : false;
    snapshot = merged;
    listeners.forEach((l) => l());
  }

  /** Runs `job` after every earlier job. */
  function enqueue<T>(job: () => Promise<T>): Promise<T> {
    const run = tail.then(job, job);
    tail = run.catch(() => undefined);
    return run;
  }

  function clearTimer(): void {
    if (timer) clearTimeout(timer);
    timer = null;
    timerKey = null;
  }

  /** Arms one timer for a solved document; the same `runId:revision` never gets a second. */
  function armSolved(): void {
    const doc = snapshot.doc;
    if (disposed || away || snapshot.phase !== 'ready' || !doc || doc.terminal || doc.run.status !== 'solved') {
      clearTimer();
      return;
    }
    const key = `${doc.runId}:${doc.revision}`;
    if (timerKey === key) return;
    clearTimer();
    timerKey = key;
    timer = setTimeout(() => {
      timer = null;
      void act({ type: 'continue' }, (d) => d.run.status === 'solved' && `${d.runId}:${d.revision}` === key);
    }, pauseMs);
  }

  function adopt(out: OpenOutcome): void {
    if (out.kind === 'empty') {
      update({ phase: 'empty', doc: null, saved: true });
      clearTimer();
      return;
    }
    let phase: RunPhase = 'ready';
    let saved = true;
    let migration: MigrationInfo | undefined;
    let recovery: RecoveryReason | undefined;
    if (out.kind === 'saved') migration = out.migration;
    else if (out.kind === 'recovered') recovery = out.reason;
    else if (out.kind === 'unsaved') {
      saved = false;
      migration = out.migration;
      recovery = out.recovery;
    } else saved = out.saved;
    if (recovery && !recoveryShown(theme, difficulty)) {
      noteRecovery({ theme, difficulty, reason: recovery, best: out.doc.best });
      phase = 'recoveryPending';
    }
    update({ phase, doc: out.doc, saved, ...(migration ? { notice: { kind: 'wordReplaced', migration } } : {}) });
    armSolved();
  }

  /** Opens the slot and adopts the result. Call it from inside a queued job. */
  async function openAndAdopt(): Promise<void> {
    adopt(await store.open(theme, difficulty));
  }

  /**
   * Queues an action for the run that is current now. It is dropped if the run changed, if the
   * queue was dropped by a `stale`, or if `allowed` no longer holds for the document it would act on.
   */
  function act<R = null>(
    action: SessionAction,
    allowed: (doc: SlotDoc) => boolean,
    pick?: (result: Extract<ActResult, { kind: 'saved' | 'unsaved' }>) => R,
  ): Promise<R | null> {
    const forRun = snapshot.doc?.runId;
    const forEpoch = epoch;
    return enqueue(async (): Promise<R | null> => {
      const doc = snapshot.doc;
      if (forEpoch !== epoch || snapshot.phase !== 'ready' || !doc || doc.runId !== forRun || !allowed(doc)) return null;
      const result = await store.act(theme, difficulty, { runId: doc.runId, revision: doc.revision }, action);
      if (result.kind === 'saved' || result.kind === 'unsaved') {
        update({ doc: result.doc, saved: result.kind === 'saved' });
        armSolved();
        return pick ? pick(result) : null;
      }
      if (result.kind === 'stale') {
        // Someone else moved the run on. Drop what was queued behind this and adopt the stored run, once.
        epoch += 1;
        clearTimer();
        await openAndAdopt();
      }
      return null;
    });
  }

  const controller: RunController = {
    getSnapshot: () => snapshot,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    start() {
      disposed = false;
      if (startPromise) {
        armSolved();
        return startPromise;
      }
      startPromise = enqueue(async () => {
        const view = await store.inspect(theme, difficulty);
        if (view.kind === 'unreadable' && view.reason !== 'unavailable' && !recoveryShown(theme, difficulty)) {
          // Replacing bad data silently would hide that a run ended: show the notice first.
          noteRecovery({ theme, difficulty, reason: view.reason, best: view.best });
          update({ phase: 'recoveryPending', doc: null, saved: true });
          return;
        }
        await openAndAdopt();
      });
      return startPromise;
    },

    dispose() {
      disposed = true;
      clearTimer();
    },

    leave() {
      away = true;
      clearTimer();
    },

    return() {
      away = false;
      if (!startPromise) return Promise.resolve();
      if (snapshot.phase === 'loading') return startPromise;
      // Bad data waits for its notice: re-opening here would replace it silently.
      if (snapshot.phase === 'recoveryPending' && !snapshot.doc) return Promise.resolve();
      if (returning) return returning;
      const run = enqueue(async () => {
        away = false;
        await openAndAdopt();
      }).finally(() => {
        if (returning === run) returning = null;
      });
      returning = run;
      return run;
    },

    press: (letter) => act({ type: 'guess', letter }, (d) => !d.terminal && d.run.status === 'playing', (r) => r.guess ?? null),

    usePower: (slot) => act({ type: 'power', slot }, (d) => !d.terminal && d.run.status === 'playing', (r) => r.effect ?? null),

    async keepPlaying() {
      await act({ type: 'continue' }, (d) => !d.terminal && d.run.status === 'milestone');
    },

    async restart() {
      await act({ type: 'newRun' }, (d) => !!d.terminal);
    },

    dismissNotice() {
      if (snapshot.notice) update({ notice: null });
    },
  };
  return controller;
}

// ---------- picker helpers ----------

/** How one difficulty card on the picker should look. */
export type SlotCard =
  /** A run in progress that can be resumed. `unsaved` is set when it only exists in memory. */
  | { kind: 'saved'; doc: SlotDoc; unsaved: UnsavedCause | null }
  /** Nothing to resume: never played, or the last run ended (`terminalRunId`). Tapping starts a run. */
  | { kind: 'fresh'; best: BestScore | null; terminalRunId: string | null }
  /** Bad data was found; show the recovery notice. `best` is what survived. */
  | { kind: 'recovery'; reason: RecoveryReason; best: BestScore | null }
  /** Storage couldn't be read. */
  | { kind: 'unavailable'; best: BestScore | null };

export function cardOf(view: SlotView): SlotCard {
  switch (view.kind) {
    case 'resumable':
      return { kind: 'saved', doc: view.doc, unsaved: view.unsaved };
    case 'terminal':
      return { kind: 'fresh', best: view.doc.best, terminalRunId: view.doc.runId };
    case 'none':
      return { kind: 'fresh', best: view.best, terminalRunId: null };
    case 'unreadable':
      return view.reason === 'unavailable'
        ? { kind: 'unavailable', best: view.best }
        : { kind: 'recovery', reason: view.reason, best: view.best };
  }
}

/** Reads every difficulty of a theme without drawing or writing anything. */
export async function inspectSlots(theme: ThemeId, store: RunStore = runStore): Promise<Record<Difficulty, SlotCard>> {
  const views = await Promise.all(DIFFICULTY_ORDER.map((d) => store.inspect(theme, d)));
  return Object.fromEntries(DIFFICULTY_ORDER.map((d, i) => [d, cardOf(views[i])])) as Record<Difficulty, SlotCard>;
}

/** The best a slot holds. A zero-only legacy best is already null here. */
export function bestOf(view: SlotView): BestScore | null {
  return view.kind === 'resumable' || view.kind === 'terminal' ? view.doc.best : view.best;
}

/** The best across all difficulties of a theme (for home). */
export async function bestForTheme(theme: ThemeId, store: RunStore = runStore): Promise<BestScore | null> {
  const views = await Promise.all(DIFFICULTY_ORDER.map((d) => store.inspect(theme, d)));
  return views.reduce<BestScore | null>((a, v) => betterBest(a, bestOf(v)), null);
}

/**
 * Starts a new run on a slot the player saw as `seenRunId` (the run they chose to end, or the finished
 * one). It acts only if the stored run is still that run, so a second tap, or a run another tab started,
 * never ends a run the player didn't confirm. `'changed'` means nothing was written: look again.
 */
export async function startNewRun(
  theme: ThemeId,
  difficulty: Difficulty,
  seenRunId: string,
  store: RunStore = runStore,
): Promise<'started' | 'changed'> {
  const out = await store.open(theme, difficulty);
  if (out.kind === 'empty' || out.doc.runId !== seenRunId) return 'changed';
  const result = await store.act(theme, difficulty, { runId: out.doc.runId, revision: out.doc.revision }, { type: 'newRun' });
  return result.kind === 'saved' || result.kind === 'unsaved' ? 'started' : 'changed';
}
