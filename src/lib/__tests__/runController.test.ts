import { ALPHABET, lettersOf } from '@/game/answer';
import { seededRng } from '@/game/rng';
import { parseDoc, type SlotDoc } from '@/game/runSnapshot';
import type { Difficulty, ThemeId, Word } from '@/game/types';
import { bankContent, BANK_WORDS } from '@/game/__tests__/helpers';

import { subscribeLifecycle, type LifecycleEnv } from '../device';
import {
  bestForTheme,
  bestOf,
  createRunController,
  inspectSlots,
  markRecoveryShown,
  pendingRecoveries,
  resetRecoveryRegistry,
  startNewRun,
  tapRecoveryCard,
  type RunController,
} from '../runController';
import { createRunStore, type RawStorage, type RunStore } from '../runStore';
import { keys, type RawRead } from '../storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// A short ladder: the second word is the first boss round.
beforeAll(() => {
  process.env.EXPO_PUBLIC_TEST_LADDER = '1';
});
afterAll(() => {
  delete process.env.EXPO_PUBLIC_TEST_LADDER;
});
beforeEach(() => {
  jest.useFakeTimers();
  resetRecoveryRegistry();
});
afterEach(() => {
  jest.useRealTimers();
});

const PAUSE = 1100;

/** In-memory storage that can fail reads and writes. */
class FakeStorage implements RawStorage {
  data = new Map<string, string>();
  unreadable = new Set<string>();
  failWrites = false;
  writes: string[] = [];

  async read(key: string): Promise<RawRead> {
    if (this.unreadable.has(key)) return { ok: false };
    return { ok: true, raw: this.data.get(key) ?? null };
  }

  async write(key: string, raw: string): Promise<boolean> {
    if (this.failWrites) return false;
    this.data.set(key, raw);
    this.writes.push(key);
    return true;
  }
}

interface Calls {
  open: number;
  inspect: number;
  /** `<action>:<result kind>` for every act that reached the store. */
  act: string[];
}

/** Counts what reaches a store. */
function spied(store: RunStore): { store: RunStore; calls: Calls } {
  const calls: Calls = { open: 0, inspect: 0, act: [] };
  return {
    calls,
    store: {
      inspect: (t, d) => {
        calls.inspect += 1;
        return store.inspect(t, d);
      },
      open: (t, d) => {
        calls.open += 1;
        return store.open(t, d);
      },
      act: async (t, d, seen, action) => {
        const result = await store.act(t, d, seen, action);
        calls.act.push(`${action.type}:${result.kind}`);
        return result;
      },
    },
  };
}

let ids = 0;
function makeStore(storage: FakeStorage, words: Word[] = BANK_WORDS, seed = 1): RunStore {
  return createRunStore({ storage, rng: seededRng(seed), content: bankContent(words), newRunId: () => `run-${seed}-${(ids += 1)}` });
}

function make(storage: FakeStorage, options: { words?: Word[]; seed?: number; theme?: ThemeId; difficulty?: Difficulty } = {}) {
  const { store, calls } = spied(makeStore(storage, options.words, options.seed));
  const controller = createRunController(options.theme ?? 'filmy', options.difficulty ?? 'easy', { store, pauseMs: PAUSE });
  return { controller, calls, store };
}

const docOf = (c: RunController): SlotDoc => {
  const doc = c.getSnapshot().doc;
  if (!doc) throw new Error('no doc');
  return doc;
};
const stored = (storage: FakeStorage, theme: ThemeId = 'filmy', difficulty: Difficulty = 'easy'): SlotDoc => {
  const r = parseDoc(storage.data.get(keys.run(theme, difficulty))!, theme, difficulty);
  if (!r.ok) throw new Error(`stored doc invalid: ${r.detail}`);
  return r.doc;
};
const answerOf = (c: RunController) => docOf(c).run.current!.word.answer;
const rightLetters = (c: RunController) => [...lettersOf(answerOf(c))];
const wrongLetters = (c: RunController) => ALPHABET.filter((l) => !lettersOf(answerOf(c)).has(l));

async function solve(c: RunController): Promise<void> {
  for (const letter of rightLetters(c)) await c.press(letter);
}
async function lose(c: RunController): Promise<void> {
  for (const letter of wrongLetters(c)) await c.press(letter);
}
const wait = (ms: number) => jest.advanceTimersByTimeAsync(ms);

describe('opening once per controller', () => {
  it('start, start, dispose, start gives one open, one draw and an unchanged revision', async () => {
    const storage = new FakeStorage();
    const { controller, calls } = make(storage);
    expect(controller.getSnapshot().phase).toBe('loading');
    await controller.start();
    await controller.start();
    controller.dispose();
    await controller.start();
    expect(calls.open).toBe(1);
    expect(calls.inspect).toBe(1);
    const snap = controller.getSnapshot();
    expect(snap).toMatchObject({ phase: 'ready', saved: true, notice: null, isNewBest: false });
    expect(snap.doc).toMatchObject({ revision: 0, bag: { remaining: expect.any(Array) } });
    expect(snap.doc!.bag.remaining).toHaveLength(9);
    expect(storage.writes).toHaveLength(1);
  });

  it('gives a new snapshot object on every change and tells subscribers', async () => {
    const { controller } = make(new FakeStorage());
    const seen: object[] = [controller.getSnapshot()];
    const unsubscribe = controller.subscribe(() => seen.push(controller.getSnapshot()));
    await controller.start();
    await controller.press(wrongLetters(controller)[0]);
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen.length).toBeGreaterThanOrEqual(3);
    unsubscribe();
    const count = seen.length;
    await controller.press(wrongLetters(controller)[0]);
    expect(seen).toHaveLength(count);
  });

  it('a new controller and store on the same storage resume the very same run', async () => {
    const storage = new FakeStorage();
    const a = make(storage);
    await a.controller.start();
    await a.controller.press(wrongLetters(a.controller)[0]);
    await a.controller.usePower(0);
    await a.controller.usePower(1);
    await a.controller.usePower(3);
    await a.controller.usePower(2);
    const before = docOf(a.controller);
    expect(before.run.current!.revealed.length).toBeGreaterThan(0);
    expect(before.run.current!.cluesRevealed).toBeGreaterThan(0);
    expect(before.run.current!.removed.length).toBeGreaterThan(0);

    const b = make(storage, { seed: 9 });
    await b.controller.start();
    expect(docOf(b.controller)).toEqual(before);
    expect(docOf(b.controller).bag).toEqual(before.bag);
    expect(storage.writes).toHaveLength(6); // open and five actions, no second draw
  });
});

describe('queued actions', () => {
  it('applies five presses made without waiting in order, with no stale', async () => {
    const { controller, calls } = make(new FakeStorage());
    await controller.start();
    const start = docOf(controller).revision;
    const letters = [...rightLetters(controller).slice(0, 2), ...wrongLetters(controller).slice(0, 3)];
    await Promise.all(letters.map((l) => controller.press(l)));
    expect(docOf(controller).revision).toBe(start + 5);
    expect(calls.act).toEqual(Array(5).fill('guess:saved'));
    expect(calls.open).toBe(1);
    const play = docOf(controller).run.current!;
    expect(play.correct).toEqual(letters.slice(0, 2));
    expect(play.wrong).toEqual(letters.slice(2));
  });

  it('returns the guess and the effect so the screen can react', async () => {
    const { controller } = make(new FakeStorage());
    await controller.start();
    expect(await controller.press(wrongLetters(controller)[0])).toBe('wrong');
    expect(await controller.press(rightLetters(controller)[0])).toBe('correct');
    expect(await controller.usePower(0)).toMatchObject({ slot: 0 });
  });

  it('drops a press that arrives for a word that is already solved', async () => {
    const { controller, calls } = make(new FakeStorage());
    await controller.start();
    const letters = rightLetters(controller);
    await Promise.all([...letters, wrongLetters(controller)[0]].map((l) => controller.press(l)));
    expect(docOf(controller).run.status).toBe('solved');
    expect(docOf(controller).run.livesLost).toBe(0);
    expect(calls.act).toHaveLength(letters.length);
  });
});

describe('the solved pause', () => {
  it('continues once after the pause and draws one word', async () => {
    const storage = new FakeStorage();
    const { controller, calls } = make(storage);
    await controller.start();
    await solve(controller);
    const solved = docOf(controller);
    expect(solved.run).toMatchObject({ status: 'solved', hits: 1 });
    await wait(PAUSE - 1);
    expect(docOf(controller).run.status).toBe('solved');
    await wait(1);
    expect(docOf(controller).run).toMatchObject({ status: 'playing', hits: 1 });
    expect(docOf(controller).revision).toBe(solved.revision + 1);
    await wait(10 * PAUSE);
    expect(docOf(controller).revision).toBe(solved.revision + 1);
    expect(calls.act.filter((a) => a.startsWith('continue'))).toEqual(['continue:saved']);
    expect(stored(storage).bag.remaining).toHaveLength(8);
  });

  it('dispose mid-pause stops the timer; a new controller continues once with one draw', async () => {
    const storage = new FakeStorage();
    const a = make(storage);
    await a.controller.start();
    await solve(a.controller);
    a.controller.dispose();
    await wait(5 * PAUSE);
    expect(stored(storage).run.status).toBe('solved');

    const b = make(storage, { seed: 2 });
    await b.controller.start();
    expect(docOf(b.controller).run.status).toBe('solved');
    await wait(PAUSE);
    expect(docOf(b.controller).run).toMatchObject({ status: 'playing', hits: 1 });
    await wait(5 * PAUSE);
    expect(stored(storage).bag.remaining).toHaveLength(8);
    expect(b.calls.act).toEqual(['continue:saved']);
  });

  it('the same controller after dispose and start still continues exactly once', async () => {
    const { controller, calls } = make(new FakeStorage());
    await controller.start();
    await solve(controller);
    controller.dispose();
    await controller.start();
    await wait(5 * PAUSE);
    expect(docOf(controller).run.status).toBe('playing');
    expect(calls.act.filter((a) => a.startsWith('continue'))).toEqual(['continue:saved']);
  });
});

describe('the solved timer', () => {
  it('is armed once per solved document: a repeated start does not restart the pause', async () => {
    const { controller } = make(new FakeStorage());
    await controller.start();
    await solve(controller);
    await wait(PAUSE - 100);
    await controller.start();
    await wait(100);
    expect(docOf(controller).run.status).toBe('playing');
  });
});

describe('leaving and returning', () => {
  it('leave mid-pause stops the timer; two return events give one open and one continue', async () => {
    const { controller, calls } = make(new FakeStorage());
    await controller.start();
    await solve(controller);
    controller.leave();
    await wait(5 * PAUSE);
    expect(docOf(controller).run.status).toBe('solved');
    expect(calls.open).toBe(1);

    const first = controller.return();
    const second = controller.return();
    await Promise.all([first, second]);
    expect(first).toBe(second);
    expect(calls.open).toBe(2);
    expect(docOf(controller).run.status).toBe('solved');
    await wait(PAUSE);
    expect(docOf(controller).run.status).toBe('playing');
    expect(calls.act.filter((a) => a.startsWith('continue'))).toEqual(['continue:saved']);
    await wait(5 * PAUSE);
    expect(calls.open).toBe(2);
  });

  it('a leave that comes right after a return keeps the solved timer stopped', async () => {
    const { controller, calls } = make(new FakeStorage());
    await controller.start();
    await solve(controller);
    controller.leave();
    const back = controller.return();
    controller.leave(); // hidden again before the re-open ran
    await back;
    await wait(5 * PAUSE);
    expect(docOf(controller).run.status).toBe('solved');
    expect(calls.act.filter((a) => a.startsWith('continue'))).toEqual([]);
    await controller.return();
    await wait(PAUSE);
    expect(docOf(controller).run.status).toBe('playing');
  });

  it('a return after a fresh leave opens again instead of sharing an earlier open', async () => {
    const { controller, calls } = make(new FakeStorage());
    await controller.start();
    controller.leave();
    const first = controller.return();
    controller.leave();
    const second = controller.return();
    expect(second).not.toBe(first);
    await Promise.all([first, second]);
    expect(calls.open).toBe(3);
  });

  it('a return picks up a run another tab moved on', async () => {
    const storage = new FakeStorage();
    const a = make(storage);
    await a.controller.start();
    const other = makeStore(storage, BANK_WORDS, 5);
    const theirs = await other.open('filmy', 'easy');
    if (theirs.kind === 'empty') throw new Error('empty');
    const moved = await other.act('filmy', 'easy', theirs.doc, { type: 'power', slot: 0 });
    if (moved.kind !== 'saved') throw new Error('not saved');
    a.controller.leave();
    await a.controller.return();
    expect(docOf(a.controller)).toEqual(moved.doc);
  });

  it('an app that is already hidden when the lifecycle starts leaves at once; the next return re-opens exactly once', async () => {
    const { controller, calls } = make(new FakeStorage());
    await controller.start();
    await solve(controller);
    let listener: ((state: string) => void) | null = null;
    const env: LifecycleEnv = {
      kind: 'native',
      appState: {
        currentState: 'background',
        addEventListener: (_type, l) => {
          listener = l;
          return { remove: () => undefined };
        },
      },
    };
    const handlers = { onLeave: () => controller.leave(), onReturn: () => void controller.return() };
    // The effect runs twice (a re-run while still hidden): the timer stays stopped both times.
    subscribeLifecycle(handlers, env)();
    subscribeLifecycle(handlers, env);
    await wait(5 * PAUSE);
    expect(docOf(controller).run.status).toBe('solved');
    expect(calls.act.filter((a) => a.startsWith('continue'))).toEqual([]);

    listener!('active');
    listener!('active');
    await wait(0);
    expect(calls.open).toBe(2);
    await wait(PAUSE);
    expect(docOf(controller).run.status).toBe('playing');
    expect(calls.act.filter((a) => a.startsWith('continue'))).toEqual(['continue:saved']);
  });

  it('a return before the first open finishes shares it instead of opening again', async () => {
    const { controller, calls } = make(new FakeStorage());
    const started = controller.start();
    await controller.return();
    await started;
    expect(calls.open).toBe(1);
  });
});

describe('boss rounds, milestones and the end of a run', () => {
  it('a boss solve reloaded gives one milestone, one refill and one reward; keep playing twice draws once', async () => {
    const storage = new FakeStorage();
    const a = make(storage);
    await a.controller.start();
    await solve(a.controller);
    await wait(PAUSE);
    expect(docOf(a.controller).run.current!.isBoss).toBe(true);
    const rewardBefore = docOf(a.controller).run.powerUps[0];
    await a.controller.press(wrongLetters(a.controller)[0]);
    expect(docOf(a.controller).run.livesLost).toBe(1);
    await solve(a.controller);
    expect(docOf(a.controller).run).toMatchObject({ status: 'milestone', hits: 2, livesLost: 0 });
    const milestone = docOf(a.controller);
    expect(milestone.run.powerUps[0]).toBe(rewardBefore + 1);

    for (const seed of [3, 4]) {
      const again = make(storage, { seed });
      await again.controller.start();
      expect(docOf(again.controller)).toEqual(milestone);
      expect(docOf(again.controller).run.powerUps[0]).toBe(rewardBefore + 1);
      await wait(5 * PAUSE); // a milestone does not continue by itself
      expect(docOf(again.controller).run.status).toBe('milestone');
    }

    const b = make(storage, { seed: 6 });
    await b.controller.start();
    await Promise.all([b.controller.keepPlaying(), b.controller.keepPlaying()]);
    expect(docOf(b.controller).run.status).toBe('playing');
    expect(docOf(b.controller).revision).toBe(milestone.revision + 1);
    expect(b.calls.act).toEqual(['continue:saved']);
    expect(stored(storage).bag.remaining).toHaveLength(milestone.bag.remaining.length - 1);
  });

  it('keepPlaying does nothing outside a milestone', async () => {
    const { controller, calls } = make(new FakeStorage());
    await controller.start();
    await controller.keepPlaying();
    expect(calls.act).toEqual([]);
  });

  it('a final wrong guess ends the run once and settles the best once', async () => {
    const storage = new FakeStorage();
    const { controller } = make(storage);
    await controller.start();
    await solve(controller);
    await wait(PAUSE);
    await lose(controller);
    const end = docOf(controller);
    expect(end.run.status).toBe('over');
    expect(end.terminal).toMatchObject({ reason: 'lost', hits: 1 });
    expect(end.best).toEqual({ hits: 1, club: null });
    expect(controller.getSnapshot().isNewBest).toBe(true);
    expect(stored(storage)).toEqual(end);
  });

  it('a boss round lost on the last life is a terminal run, not a milestone', async () => {
    const { controller } = make(new FakeStorage());
    await controller.start();
    await solve(controller);
    await wait(PAUSE);
    expect(docOf(controller).run.current!.isBoss).toBe(true);
    await lose(controller);
    expect(docOf(controller).terminal).toMatchObject({ reason: 'lost', hits: 1, club: null });
  });

  it('reloading a terminal run never gives playing, and a press there is ignored', async () => {
    const storage = new FakeStorage();
    const a = make(storage);
    await a.controller.start();
    await lose(a.controller);
    const end = docOf(a.controller);

    const b = make(storage, { seed: 2 });
    await b.controller.start();
    expect(docOf(b.controller)).toEqual(end);
    expect(b.controller.getSnapshot().phase).toBe('ready');
    const writes = storage.writes.length;
    expect(await b.controller.press('A')).toBeNull();
    expect(await b.controller.usePower(0)).toBeNull();
    await b.controller.keepPlaying();
    await wait(5 * PAUSE);
    expect(docOf(b.controller)).toEqual(end);
    expect(storage.writes).toHaveLength(writes);
  });

  it('restart twice gives one new run, and only restart leaves a terminal run', async () => {
    const storage = new FakeStorage();
    const { controller, calls } = make(storage);
    await controller.start();
    await solve(controller);
    await wait(PAUSE);
    await lose(controller);
    const end = docOf(controller);
    await controller.restart();
    await controller.restart();
    const fresh = docOf(controller);
    expect(fresh.runId).not.toBe(end.runId);
    expect(fresh.run).toMatchObject({ status: 'playing', hits: 0 });
    expect(fresh.best).toEqual({ hits: 1, club: null });
    expect(fresh.bestAtStart).toEqual({ hits: 1, club: null });
    expect(calls.act.filter((a) => a.startsWith('newRun'))).toEqual(['newRun:saved']);
    expect(controller.getSnapshot().isNewBest).toBe(false);
  });

  it('restart does nothing while the run is still going', async () => {
    const { controller, calls } = make(new FakeStorage());
    await controller.start();
    await controller.restart();
    expect(calls.act).toEqual([]);
  });
});

describe('stale results', () => {
  it('lead to one open that adopts the other run, dropping what was queued behind', async () => {
    const storage = new FakeStorage();
    const a = make(storage);
    await a.controller.start();
    const other = makeStore(storage, BANK_WORDS, 7);
    const theirs = await other.open('filmy', 'easy');
    if (theirs.kind === 'empty') throw new Error('empty');
    const ended = await other.act('filmy', 'easy', theirs.doc, { type: 'abandon' });
    if (ended.kind !== 'saved') throw new Error('not saved');

    const letters = wrongLetters(a.controller).slice(0, 4);
    const results = await Promise.all(letters.map((l) => a.controller.press(l)));
    expect(results).toEqual([null, null, null, null]);
    expect(a.calls.act).toEqual(['guess:stale']);
    expect(a.calls.open).toBe(2);
    expect(docOf(a.controller)).toEqual(ended.doc);
    expect(a.controller.getSnapshot().phase).toBe('ready');

    // The adopted run is usable: a restart works and nothing loops back to stale.
    await a.controller.restart();
    expect(a.calls.act).toEqual(['guess:stale', 'newRun:saved']);
    expect(a.calls.open).toBe(2);
  });
});

describe('stale on the same run', () => {
  it('another tab moving the same run on drops the queued presses instead of replaying them', async () => {
    const storage = new FakeStorage();
    const a = make(storage);
    await a.controller.start();
    const other = makeStore(storage, BANK_WORDS, 7);
    const theirs = await other.open('filmy', 'easy');
    if (theirs.kind === 'empty') throw new Error('empty');
    const moved = await other.act('filmy', 'easy', theirs.doc, { type: 'power', slot: 0 });
    if (moved.kind !== 'saved') throw new Error('not saved');

    const letters = wrongLetters(a.controller).slice(0, 3);
    const results = await Promise.all(letters.map((l) => a.controller.press(l)));
    expect(results).toEqual([null, null, null]);
    expect(a.calls.act).toEqual(['guess:stale']);
    expect(a.calls.open).toBe(2);
    expect(docOf(a.controller)).toEqual(moved.doc);
    expect(docOf(a.controller).run.current!.wrong).toEqual([]);
  });

  it('maps an empty result (the pool emptied mid-run) to the empty phase and stops the timer', async () => {
    const words = [...BANK_WORDS];
    const storage = new FakeStorage();
    const { store, calls } = spied(makeStore(storage, words));
    const controller = createRunController('filmy', 'easy', { store, pauseMs: PAUSE });
    await controller.start();
    await solve(controller);
    words.length = 0;
    await wait(PAUSE);
    expect(controller.getSnapshot()).toMatchObject({ phase: 'empty', doc: null });
    expect(calls.act.filter((a) => a.startsWith('continue'))).toEqual(['continue:empty']);
    await wait(5 * PAUSE);
    expect(calls.act.filter((a) => a.startsWith('continue'))).toEqual(['continue:empty']);
  });
});

describe('what is saved', () => {
  it('reports unsaved after a failed write and saved again after the next successful one', async () => {
    const storage = new FakeStorage();
    storage.failWrites = true;
    const { controller } = make(storage);
    await controller.start();
    expect(controller.getSnapshot().saved).toBe(false);
    await controller.press(wrongLetters(controller)[0]);
    expect(controller.getSnapshot().saved).toBe(false);
    expect(docOf(controller).run.livesLost).toBe(1);
    storage.failWrites = false;
    await controller.press(wrongLetters(controller)[1]);
    expect(controller.getSnapshot().saved).toBe(true);
    expect(stored(storage).run.livesLost).toBe(2);
  });

  it('a read failure plays unsaved and a re-open does not reroll the word', async () => {
    const storage = new FakeStorage();
    storage.unreadable.add(keys.run('filmy', 'easy'));
    const { controller, calls } = make(storage);
    await controller.start();
    expect(controller.getSnapshot().saved).toBe(false);
    const first = docOf(controller);
    controller.leave();
    await controller.return();
    expect(calls.open).toBe(2);
    expect(docOf(controller)).toEqual(first);
    expect(controller.getSnapshot().saved).toBe(false);
    expect(storage.writes).toHaveLength(0);
  });

  it('a run that ends while unsaved still says so', async () => {
    const storage = new FakeStorage();
    storage.failWrites = true;
    const { controller } = make(storage);
    await controller.start();
    await lose(controller);
    expect(docOf(controller).terminal).not.toBeNull();
    expect(controller.getSnapshot().saved).toBe(false);
  });
});

describe('changed word content', () => {
  it('shows one wordReplaced notice with refunds; a return gives no second one; dismiss clears it', async () => {
    const storage = new FakeStorage();
    const a = make(storage);
    await a.controller.start();
    await a.controller.usePower(0);
    await a.controller.usePower(1);
    const id = docOf(a.controller).run.current!.word.id;

    const b = make(storage, { words: BANK_WORDS.filter((w) => w.id !== id), seed: 2 });
    await b.controller.start();
    const notice = b.controller.getSnapshot().notice;
    expect(notice).toMatchObject({ kind: 'wordReplaced', migration: { replacedWordId: id, refunds: { reveal: 1, clue: 1, remove: 0 } } });
    expect(docOf(b.controller).run.current!.word.id).not.toBe(id);

    b.controller.leave();
    await b.controller.return();
    expect(b.controller.getSnapshot().notice).toBe(notice);
    b.controller.dismissNotice();
    expect(b.controller.getSnapshot().notice).toBeNull();
    b.controller.leave();
    await b.controller.return();
    expect(b.controller.getSnapshot().notice).toBeNull();
    expect(b.controller.getSnapshot().phase).toBe('ready');
  });

  it('drops the notice when the adopted run is a different one', async () => {
    const storage = new FakeStorage();
    const a = make(storage);
    await a.controller.start();
    await a.controller.usePower(0);
    const id = docOf(a.controller).run.current!.word.id;
    const b = make(storage, { words: BANK_WORDS.filter((w) => w.id !== id), seed: 2 });
    await b.controller.start();
    expect(b.controller.getSnapshot().notice).not.toBeNull();

    // Another tab ends this run and starts a new one.
    const other = makeStore(storage, BANK_WORDS.filter((w) => w.id !== id), 8);
    const theirs = await other.open('filmy', 'easy');
    if (theirs.kind === 'empty') throw new Error('empty');
    const fresh = await other.act('filmy', 'easy', theirs.doc, { type: 'newRun' });
    if (fresh.kind !== 'saved') throw new Error('not saved');
    b.controller.leave();
    await b.controller.return();
    expect(docOf(b.controller).runId).toBe(fresh.doc.runId);
    expect(b.controller.getSnapshot().notice).toBeNull();
  });

  it('clears the notice when an action succeeds on a different run, and keeps it on the same run', async () => {
    const storage = new FakeStorage();
    const a = make(storage);
    await a.controller.start();
    await a.controller.usePower(0);
    const id = docOf(a.controller).run.current!.word.id;
    const b = make(storage, { words: BANK_WORDS.filter((w) => w.id !== id), seed: 2 });
    await b.controller.start();
    const notice = b.controller.getSnapshot().notice;
    expect(notice).not.toBeNull();

    await b.controller.press(wrongLetters(b.controller)[0]);
    expect(b.controller.getSnapshot().notice).toBe(notice); // same run: kept

    await lose(b.controller);
    expect(docOf(b.controller).terminal).not.toBeNull();
    expect(b.controller.getSnapshot().notice).toBe(notice); // finished, not replaced yet
    const before = docOf(b.controller).runId;
    await b.controller.restart();
    expect(docOf(b.controller).runId).not.toBe(before);
    expect(b.controller.getSnapshot().notice).toBeNull();
  });

  it('has an empty phase when the pool has no word', async () => {
    const { controller } = make(new FakeStorage(), { words: [] });
    await controller.start();
    expect(controller.getSnapshot()).toMatchObject({ phase: 'empty', doc: null });
  });
});

describe('recovery', () => {
  const unsupported = JSON.stringify({ schema: 999 });

  it('waits on recoveryPending until the notice has been shown, then opens and recovers', async () => {
    const storage = new FakeStorage();
    storage.data.set(keys.run('filmy', 'easy'), unsupported);
    const a = make(storage);
    await a.controller.start();
    expect(a.controller.getSnapshot()).toMatchObject({ phase: 'recoveryPending', doc: null });
    expect(a.calls.open).toBe(0);
    expect(storage.data.get(keys.run('filmy', 'easy'))).toBe(unsupported);
    expect(pendingRecoveries('filmy')).toEqual([{ theme: 'filmy', difficulty: 'easy', reason: 'unsupported', best: null }]);
    a.controller.leave();
    await a.controller.return();
    expect(a.calls.open).toBe(0);

    markRecoveryShown('filmy', 'easy');
    expect(pendingRecoveries('filmy')).toEqual([]);
    const b = make(storage, { seed: 2 });
    await b.controller.start();
    expect(b.controller.getSnapshot()).toMatchObject({ phase: 'ready', saved: true });
    expect(b.calls.open).toBe(1);
    expect(stored(storage).run.hits).toBe(0);
  });

  it('records a recovery found by open (not by inspect) and goes to recoveryPending with the new run kept', async () => {
    const storage = new FakeStorage();
    storage.data.set(keys.run('filmy', 'easy'), unsupported);
    const real = makeStore(storage);
    const blind: RunStore = { ...real, inspect: async () => ({ kind: 'none', best: null }) };
    const controller = createRunController('filmy', 'easy', { store: blind, pauseMs: PAUSE });
    await controller.start();
    expect(controller.getSnapshot().phase).toBe('recoveryPending');
    expect(controller.getSnapshot().doc).not.toBeNull();
    expect(pendingRecoveries('filmy')).toHaveLength(1);
  });

  it('a return does not clear recoveryPending while the notice is waiting', async () => {
    const storage = new FakeStorage();
    storage.data.set(keys.run('filmy', 'easy'), unsupported);
    const real = makeStore(storage);
    const { store, calls } = spied({ ...real, inspect: async () => ({ kind: 'none', best: null }) });
    const controller = createRunController('filmy', 'easy', { store, pauseMs: PAUSE });
    await controller.start();
    const doc = docOf(controller);
    controller.leave();
    await controller.return();
    expect(controller.getSnapshot().phase).toBe('recoveryPending');
    expect(docOf(controller)).toEqual(doc);
    expect(calls.open).toBe(1);
    expect(pendingRecoveries('filmy')).toHaveLength(1);
  });

  it('an open that adopts a slot with a waiting notice stays on recoveryPending', async () => {
    const storage = new FakeStorage();
    storage.data.set(keys.run('filmy', 'easy'), unsupported);
    const first = make(storage);
    await first.controller.start(); // records the notice; nothing opened
    expect(pendingRecoveries('filmy')).toHaveLength(1);
    // A later controller finds a fresh run (another route replaced the data), but the notice is still unseen.
    await makeStore(storage, BANK_WORDS, 3).open('filmy', 'easy');
    const second = make(storage, { seed: 4 });
    await second.controller.start();
    expect(second.controller.getSnapshot()).toMatchObject({ phase: 'recoveryPending' });
    markRecoveryShown('filmy', 'easy');
    const third = make(storage, { seed: 5 });
    await third.controller.start();
    expect(third.controller.getSnapshot().phase).toBe('ready');
  });

  it('a first tap on an unshown recovery card shows the notice; the second navigates and opens as recovered', async () => {
    const storage = new FakeStorage();
    storage.data.set(keys.run('filmy', 'easy'), unsupported);
    const first = make(storage);
    await first.controller.start();
    expect(pendingRecoveries('filmy')).toHaveLength(1);

    expect(tapRecoveryCard('filmy', 'easy')).toBe('show notice');
    expect(pendingRecoveries('filmy')).toEqual([]);
    expect(tapRecoveryCard('filmy', 'easy')).toBe('navigate');

    // The route then opens the slot: it recovers once and is ready, with no new notice to bounce to.
    const route = make(storage, { seed: 2 });
    await route.controller.start();
    expect(route.controller.getSnapshot()).toMatchObject({ phase: 'ready', saved: true });
    expect(route.calls.open).toBe(1);
    expect(pendingRecoveries('filmy')).toEqual([]);
  });

  it('a card whose notice was already shown navigates on the first tap', () => {
    markRecoveryShown('filmy', 'easy');
    expect(tapRecoveryCard('filmy', 'easy')).toBe('navigate');
    expect(tapRecoveryCard('filmy', 'hard')).toBe('show notice'); // another slot is unaffected
  });

  it('does not hold back a slot that is only unavailable', async () => {
    const storage = new FakeStorage();
    storage.unreadable.add(keys.run('filmy', 'easy'));
    const { controller } = make(storage);
    await controller.start();
    expect(controller.getSnapshot()).toMatchObject({ phase: 'ready', saved: false });
    expect(pendingRecoveries('filmy')).toEqual([]);
  });
});

describe('picker helpers', () => {
  async function opened(storage: FakeStorage, seed = 1) {
    const store = makeStore(storage, BANK_WORDS, seed);
    const out = await store.open('filmy', 'easy');
    if (out.kind === 'empty') throw new Error('empty');
    return { store, doc: out.doc };
  }

  it('startNewRun with the run the player saw makes one newRun and settles the best', async () => {
    const storage = new FakeStorage();
    const { store, doc } = await opened(storage);
    const a = make(storage, { seed: 2 });
    await a.controller.start();
    await solve(a.controller);
    const solved = docOf(a.controller);
    a.controller.dispose();

    expect(await startNewRun('filmy', 'easy', solved.runId, store)).toBe('started');
    const fresh = stored(storage);
    expect(fresh.runId).not.toBe(doc.runId);
    expect(fresh.run).toMatchObject({ status: 'playing', hits: 0 });
    expect(fresh.best).toEqual({ hits: 1, club: null });
  });

  it('a mismatch writes nothing', async () => {
    const storage = new FakeStorage();
    const { store, doc } = await opened(storage);
    const writes = storage.writes.length;
    expect(await startNewRun('filmy', 'easy', 'some-other-run', store)).toBe('changed');
    expect(storage.writes).toHaveLength(writes);
    expect(stored(storage)).toEqual(doc);
  });

  it('a terminal slot starts a new run from its own run id, and a double call makes one', async () => {
    const storage = new FakeStorage();
    const a = make(storage);
    await a.controller.start();
    await lose(a.controller);
    const end = docOf(a.controller);
    const store = makeStore(storage, BANK_WORDS, 4);
    const [first, second] = await Promise.all([
      startNewRun('filmy', 'easy', end.runId, store),
      startNewRun('filmy', 'easy', end.runId, store),
    ]);
    expect([first, second].sort()).toEqual(['changed', 'started']);
    expect(stored(storage).runId).not.toBe(end.runId);
    expect(stored(storage).revision).toBe(end.revision + 1);
  });

  it('startNewRun on a slot that turned out corrupt records the notice and sends no newRun', async () => {
    const storage = new FakeStorage();
    storage.data.set(keys.run('filmy', 'easy'), JSON.stringify({ schema: 999 }));
    const { store, calls } = spied(makeStore(storage));
    expect(await startNewRun('filmy', 'easy', 'seen-before', store)).toBe('changed');
    expect(calls.act).toEqual([]);
    expect(pendingRecoveries('filmy')).toEqual([{ theme: 'filmy', difficulty: 'easy', reason: 'unsupported', best: null }]);
    expect(stored(storage).revision).toBe(0);
  });

  it('an empty pool is reported as changed', async () => {
    const store = makeStore(new FakeStorage(), []);
    expect(await startNewRun('filmy', 'easy', 'x', store)).toBe('changed');
  });

  it('inspectSlots maps every view, including NOT SAVED and unavailable', async () => {
    const storage = new FakeStorage();
    const { store, doc } = await opened(storage);
    const medium = await store.open('filmy', 'medium');
    if (medium.kind === 'empty') throw new Error('empty');
    const ended = await store.act('filmy', 'medium', medium.doc, { type: 'abandon' });
    if (ended.kind !== 'saved') throw new Error('not saved');
    storage.data.set(keys.run('filmy', 'hard'), JSON.stringify({ schema: 999 }));

    const cards = await inspectSlots('filmy', makeStore(storage, BANK_WORDS, 3));
    expect(cards.easy).toEqual({ kind: 'saved', doc, unsaved: null });
    expect(cards.medium).toEqual({ kind: 'fresh', best: null, terminalRunId: medium.doc.runId });
    expect(cards.hard).toEqual({ kind: 'recovery', reason: 'unsupported', best: null });

    const never = await inspectSlots('cricket', makeStore(storage, BANK_WORDS, 3));
    expect(never.easy).toEqual({ kind: 'fresh', best: null, terminalRunId: null });

    storage.unreadable.add(keys.run('filmy', 'hard'));
    const blocked = await inspectSlots('filmy', makeStore(storage, BANK_WORDS, 3));
    expect(blocked.hard).toEqual({ kind: 'unavailable', best: null });
  });

  it('inspectSlots reports a run that only exists in memory as unsaved, and a finished one the same way', async () => {
    const storage = new FakeStorage();
    storage.failWrites = true;
    const store = makeStore(storage);
    await store.open('filmy', 'easy');
    const cards = await inspectSlots('filmy', store);
    expect(cards.easy).toMatchObject({ kind: 'saved', unsaved: 'write-failed' });
    const view = await store.inspect('filmy', 'easy');
    expect(view).toMatchObject({ kind: 'resumable', unsaved: 'write-failed' });
  });

  it('bestOf and bestForTheme read the store: a document, a legacy best, unreadable data, and zero-only as null', async () => {
    const storage = new FakeStorage();
    storage.data.set(keys.best('filmy', 'easy'), JSON.stringify({ hits: 8, club: 50 }));
    storage.data.set(keys.best('filmy', 'medium'), JSON.stringify({ hits: 0, club: null }));
    storage.data.set(keys.best('filmy', 'hard'), 'not json');
    const store = makeStore(storage);
    expect(bestOf(await store.inspect('filmy', 'easy'))).toEqual({ hits: 8, club: 50 });
    expect(bestOf(await store.inspect('filmy', 'medium'))).toBeNull();
    expect(bestOf(await store.inspect('filmy', 'hard'))).toBeNull();
    expect(await bestForTheme('filmy', store)).toEqual({ hits: 8, club: 50 });
    expect(await bestForTheme('khana', store)).toBeNull();

    // Once a document holds the best, that is what home shows.
    const a = make(storage, { difficulty: 'medium' });
    await a.controller.start();
    await solve(a.controller);
    await a.controller.press('Z');
    const ended = await store.open('filmy', 'medium');
    if (ended.kind === 'empty') throw new Error('empty');
    await store.act('filmy', 'medium', ended.doc, { type: 'abandon' });
    expect(bestOf(await store.inspect('filmy', 'medium'))).toEqual({ hits: 1, club: null });
    expect(await bestForTheme('filmy', store)).toEqual({ hits: 8, club: 50 });
  });
});

describe('subscribeLifecycle', () => {
  function native(currentState?: string) {
    let listener: ((state: string) => void) | null = null;
    const remove = jest.fn(() => {
      listener = null;
    });
    const env: LifecycleEnv = {
      kind: 'native',
      appState: {
        currentState,
        addEventListener: (_type, l) => {
          listener = l;
          return { remove };
        },
      },
    };
    return { env, emit: (s: string) => listener?.(s), remove, attached: () => listener !== null };
  }

  function web() {
    const handlers = new Map<string, Set<(e: unknown) => void>>();
    const target = {
      addEventListener: (type: string, l: (e: unknown) => void) => {
        if (!handlers.has(type)) handlers.set(type, new Set());
        handlers.get(type)!.add(l);
      },
      removeEventListener: (type: string, l: (e: unknown) => void) => {
        handlers.get(type)?.delete(l);
      },
    };
    const document = { ...target, visibilityState: 'visible' };
    const env: LifecycleEnv = { kind: 'web', document, window: target };
    const fire = (type: string, event: unknown = {}) => handlers.get(type)?.forEach((l) => l(event));
    const count = () => [...handlers.values()].reduce((n, s) => n + s.size, 0);
    return { env, document, fire, count };
  }

  it('native: background leaves, active after a leave returns, inactive is ignored', () => {
    const n = native();
    const log: string[] = [];
    subscribeLifecycle({ onLeave: () => log.push('leave'), onReturn: () => log.push('return') }, n.env);
    n.emit('active'); // no prior leave
    n.emit('inactive');
    n.emit('background');
    n.emit('background');
    n.emit('inactive');
    n.emit('active');
    n.emit('active');
    expect(log).toEqual(['leave', 'return']);
  });

  it('native: unsubscribe removes the listener', () => {
    const n = native();
    const off = subscribeLifecycle({ onLeave: jest.fn(), onReturn: jest.fn() }, n.env);
    expect(n.attached()).toBe(true);
    off();
    expect(n.remove).toHaveBeenCalledTimes(1);
    expect(n.attached()).toBe(false);
  });

  it('web: hidden and pagehide leave once; visible and a persisted pageshow return once', () => {
    const w = web();
    const log: string[] = [];
    subscribeLifecycle({ onLeave: () => log.push('leave'), onReturn: () => log.push('return') }, w.env);
    w.fire('pageshow', { persisted: false }); // first load
    w.fire('visibilitychange'); // visible, no prior leave
    w.document.visibilityState = 'hidden';
    w.fire('visibilitychange');
    w.fire('pagehide');
    w.fire('pageshow', { persisted: false });
    w.document.visibilityState = 'visible';
    w.fire('visibilitychange');
    w.fire('pageshow', { persisted: true });
    w.fire('visibilitychange');
    expect(log).toEqual(['leave', 'return']);

    w.fire('pagehide');
    w.fire('pageshow', { persisted: true }); // a bfcache restore
    expect(log).toEqual(['leave', 'return', 'leave', 'return']);
  });

  it('native: an app that is already in the background leaves at once, then returns once', () => {
    const n = native('background');
    const log: string[] = [];
    subscribeLifecycle({ onLeave: () => log.push('leave'), onReturn: () => log.push('return') }, n.env);
    expect(log).toEqual(['leave']);
    n.emit('background'); // already away
    n.emit('active');
    n.emit('active');
    expect(log).toEqual(['leave', 'return']);
  });

  it('native: active or inactive at the start is not a leave', () => {
    for (const state of ['active', 'inactive', undefined]) {
      const n = native(state);
      const onLeave = jest.fn();
      subscribeLifecycle({ onLeave, onReturn: jest.fn() }, n.env);
      expect(onLeave).not.toHaveBeenCalled();
    }
  });

  it('web: a page that is already hidden leaves at once, then returns once', () => {
    const w = web();
    w.document.visibilityState = 'hidden';
    const log: string[] = [];
    subscribeLifecycle({ onLeave: () => log.push('leave'), onReturn: () => log.push('return') }, w.env);
    expect(log).toEqual(['leave']);
    w.fire('pagehide');
    w.document.visibilityState = 'visible';
    w.fire('visibilitychange');
    w.fire('visibilitychange');
    expect(log).toEqual(['leave', 'return']);
  });

  it('web: a visible page does not leave at the start', () => {
    const w = web();
    const onLeave = jest.fn();
    subscribeLifecycle({ onLeave, onReturn: jest.fn() }, w.env);
    expect(onLeave).not.toHaveBeenCalled();
  });

  it('web: unsubscribe removes every listener', () => {
    const w = web();
    const off = subscribeLifecycle({ onLeave: jest.fn(), onReturn: jest.fn() }, w.env);
    expect(w.count()).toBe(3);
    off();
    expect(w.count()).toBe(0);
  });
});

describe('the store reports unsaved on inspect', () => {
  it('is null for a saved run and a finished one', async () => {
    const storage = new FakeStorage();
    const store = makeStore(storage);
    const out = await store.open('filmy', 'easy');
    if (out.kind === 'empty') throw new Error('empty');
    expect(await store.inspect('filmy', 'easy')).toEqual({ kind: 'resumable', doc: out.doc, unsaved: null });
    const ended = await store.act('filmy', 'easy', out.doc, { type: 'abandon' });
    if (ended.kind !== 'saved') throw new Error('not saved');
    expect(await store.inspect('filmy', 'easy')).toEqual({ kind: 'terminal', doc: ended.doc, unsaved: null });
  });
});
