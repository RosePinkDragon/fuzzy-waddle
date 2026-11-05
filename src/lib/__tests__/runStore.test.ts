import { ALPHABET, lettersOf } from '@/game/answer';
import { seededRng } from '@/game/rng';
import { parseDoc, serializeDoc, type SlotDoc } from '@/game/runSnapshot';
import { isNewBest, type SessionAction } from '@/game/runSession';
import type { Difficulty, ThemeId, Word } from '@/game/types';
import { bankContent, BANK_WORDS } from '@/game/__tests__/helpers';

import { createRunStore, type ActResult, type RawStorage } from '../runStore';
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

/** In-memory storage with switches for failing reads/writes and for parking writes until released. */
class FakeStorage implements RawStorage {
  data = new Map<string, string>();
  unreadable = new Set<string>();
  failWrites = false;
  holdWrites = false;
  writes: string[] = [];
  parked: { key: string; raw: string; done: (ok: boolean) => void }[] = [];

  async read(key: string): Promise<RawRead> {
    if (this.unreadable.has(key)) return { ok: false };
    return { ok: true, raw: this.data.get(key) ?? null };
  }

  write(key: string, raw: string): Promise<boolean> {
    if (this.failWrites) return Promise.resolve(false);
    if (!this.holdWrites) {
      this.data.set(key, raw);
      this.writes.push(key);
      return Promise.resolve(true);
    }
    return new Promise((resolve) => {
      this.parked.push({
        key,
        raw,
        done: (ok) => {
          if (ok) {
            this.data.set(key, raw);
            this.writes.push(key);
          }
          resolve(ok);
        },
      });
    });
  }

  /** Completes the oldest parked write. */
  release(ok = true) {
    const next = this.parked.shift();
    if (!next) throw new Error('no parked write');
    next.done(ok);
  }
}

const flush = async () => {
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
};

function makeStore(storage: FakeStorage, words: Word[] = BANK_WORDS, seed = 1) {
  let n = 0;
  return createRunStore({
    storage,
    rng: seededRng(seed),
    content: bankContent(words),
    newRunId: () => `run-${seed}-${(n += 1)}`,
  });
}

type Store = ReturnType<typeof makeStore>;

const key = keys.run('filmy', 'easy');
const docOf = (out: object): SlotDoc => {
  const doc = (out as { doc?: SlotDoc | null }).doc;
  if (!doc) throw new Error('no doc in the result');
  return doc;
};
const stored = (storage: FakeStorage, theme: ThemeId = 'filmy', difficulty: Difficulty = 'easy'): SlotDoc => {
  const r = parseDoc(storage.data.get(keys.run(theme, difficulty))!, theme, difficulty);
  if (!r.ok) throw new Error(`stored doc invalid: ${r.detail}`);
  return r.doc;
};
const answerOf = (doc: SlotDoc) => doc.run.current!.word.answer;

async function act(store: Store, doc: SlotDoc, action: SessionAction, theme = 'filmy' as const, d = 'easy' as const) {
  return store.act(theme, d, doc, action);
}

async function solve(store: Store, doc: SlotDoc): Promise<SlotDoc> {
  let cur = doc;
  for (const letter of lettersOf(answerOf(doc))) {
    const r = await act(store, cur, { type: 'guess', letter });
    cur = docOf(r);
  }
  return cur;
}

async function lose(store: Store, doc: SlotDoc, lives = 9): Promise<ActResult> {
  let cur = doc;
  let last: ActResult = { kind: 'ignored', doc };
  const wrong = ALPHABET.filter((l) => !lettersOf(answerOf(doc)).has(l) && !doc.run.current!.wrong.includes(l));
  for (const letter of wrong.slice(0, lives)) {
    last = await act(store, cur, { type: 'guess', letter });
    cur = docOf(last);
  }
  return last;
}

describe('saving and resuming', () => {
  it('starts a run, saves it, and resumes the same run on every reload without drawing again', async () => {
    const storage = new FakeStorage();
    const first = await makeStore(storage, BANK_WORDS, 1).open('filmy', 'easy');
    expect(first).toMatchObject({ kind: 'saved', source: 'started' });
    const doc = docOf(first);
    expect(stored(storage)).toEqual(doc);

    for (const seed of [2, 3, 4]) {
      const again = await makeStore(storage, BANK_WORDS, seed).open('filmy', 'easy');
      expect(again).toMatchObject({ kind: 'saved', source: 'resumed' });
      expect(docOf(again)).toEqual(doc);
    }
    expect(storage.writes).toHaveLength(1);
  });

  it('restores guesses, power-up effects and the matching bag after progress', async () => {
    const storage = new FakeStorage();
    const store = makeStore(storage);
    let doc = docOf(await store.open('filmy', 'easy'));
    doc = docOf(await act(store, doc, { type: 'power', slot: 0 }));
    doc = docOf(await act(store, doc, { type: 'power', slot: 3 }));
    doc = docOf(await lose(store, doc, 2));
    doc = docOf(await act(store, doc, { type: 'power', slot: 2 }));
    const resumed = docOf(await makeStore(storage, BANK_WORDS, 9).open('filmy', 'easy'));
    expect(resumed).toEqual(doc);
    expect(resumed.bag).toEqual(doc.bag);
  });

  it('keeps every theme and difficulty independent, and writes only run keys', async () => {
    const storage = new FakeStorage();
    const store = makeStore(storage);
    const a = docOf(await store.open('filmy', 'easy'));
    const b = docOf(await store.open('filmy', 'medium'));
    const c = docOf(await store.open('masala', 'easy'));
    await solve(store, a);
    expect(stored(storage, 'filmy', 'medium')).toEqual(b);
    expect(stored(storage, 'masala', 'easy')).toEqual(c);
    expect(stored(storage).run.hits).toBe(1);
    expect([...storage.data.keys()].sort()).toEqual(
      [keys.run('filmy', 'easy'), keys.run('filmy', 'medium'), keys.run('masala', 'easy')].sort(),
    );
    // Opening one slot never reads or rewrites another slot's document.
    const other = makeStore(storage);
    expect(docOf(await other.open('filmy', 'medium'))).toEqual(b);
  });
});

describe('legacy data', () => {
  it('seeds a new slot from the legacy bag and best, reading a zero-only best as not played', async () => {
    const storage = new FakeStorage();
    storage.data.set(keys.best('filmy', 'easy'), JSON.stringify({ hits: 8, club: 50 }));
    storage.data.set(keys.bag('filmy', 'easy'), JSON.stringify({ remaining: ['don', 'roja'], last: 'raaz' }));
    storage.data.set(keys.best('filmy', 'medium'), JSON.stringify({ hits: 0, club: null }));
    const store = makeStore(storage);
    const doc = docOf(await store.open('filmy', 'easy'));
    expect(doc.best).toEqual({ hits: 8, club: 50 });
    expect(doc.bag.last).toBe(doc.run.current!.word.id);
    expect(['don', 'roja']).toContain(doc.run.current!.word.id);
    const medium = docOf(await store.open('filmy', 'medium'));
    expect(medium.best).toBeNull();
  });

  it('ignores legacy data once a canonical document exists', async () => {
    const storage = new FakeStorage();
    const doc = docOf(await makeStore(storage).open('filmy', 'easy'));
    storage.data.set(keys.best('filmy', 'easy'), JSON.stringify({ hits: 30, club: 100 }));
    expect(docOf(await makeStore(storage, BANK_WORDS, 5).open('filmy', 'easy'))).toEqual(doc);
  });
});

describe('explicit recovery and unsaved outcomes', () => {
  it('returns unsaved, not saved, when the write fails, and does not reroll on reopen', async () => {
    const storage = new FakeStorage();
    storage.failWrites = true;
    const store = makeStore(storage);
    const out = await store.open('filmy', 'easy');
    expect(out).toMatchObject({ kind: 'unsaved', cause: 'write-failed' });
    const doc = docOf(out);
    expect(storage.data.size).toBe(0);
    const again = await store.open('filmy', 'easy');
    expect(again).toMatchObject({ kind: 'unsaved', cause: 'write-failed' });
    expect(docOf(again)).toEqual(doc);

    // Once storage works, the next change saves the whole current document.
    storage.failWrites = false;
    const acted = await act(store, doc, { type: 'power', slot: 0 });
    expect(acted.kind).toBe('saved');
    expect(stored(storage)).toEqual(docOf(acted));
  });

  it('plays unsaved and writes nothing when the canonical read fails', async () => {
    const storage = new FakeStorage();
    storage.unreadable.add(key);
    const store = makeStore(storage);
    const out = await store.open('filmy', 'easy');
    expect(out).toMatchObject({ kind: 'unsaved', cause: 'read-failed' });
    const acted = await act(store, docOf(out), { type: 'power', slot: 0 });
    expect(acted).toMatchObject({ kind: 'unsaved', cause: 'read-failed' });
    expect(storage.writes).toHaveLength(0);
  });

  it('does not write a blank best when a missing run meets an unreadable legacy best', async () => {
    const storage = new FakeStorage();
    storage.data.set(keys.best('filmy', 'easy'), JSON.stringify({ hits: 8, club: 50 }));
    storage.unreadable.add(keys.best('filmy', 'easy'));
    const out = await makeStore(storage).open('filmy', 'easy');
    expect(out.kind).toBe('unsaved');
    expect(storage.writes).toHaveLength(0);
    storage.unreadable.clear();
    expect(docOf(await makeStore(storage).open('filmy', 'easy')).best).toEqual({ hits: 8, club: 50 });
  });

  it('keeps a legacy 8-hit best when malformed canonical JSON meets a temporarily unavailable legacy read', async () => {
    const storage = new FakeStorage();
    storage.data.set(key, '{"schema":1,"broken');
    storage.data.set(keys.best('filmy', 'easy'), JSON.stringify({ hits: 8, club: 50 }));
    storage.unreadable.add(keys.best('filmy', 'easy'));

    const blocked = await makeStore(storage).open('filmy', 'easy');
    expect(blocked).toMatchObject({ kind: 'unsaved', cause: 'read-failed', recovery: 'corrupt' });
    expect(storage.writes).toHaveLength(0);
    expect(storage.data.get(key)).toBe('{"schema":1,"broken'); // nothing authoritative was written

    storage.unreadable.clear();
    const recovered = await makeStore(storage).open('filmy', 'easy');
    expect(recovered).toMatchObject({ kind: 'recovered', reason: 'corrupt' });
    expect(docOf(recovered).best).toEqual({ hits: 8, club: 50 });
    expect(stored(storage).best).toEqual({ hits: 8, club: 50 });
  });

  it('blocks writes for an unreadable legacy bag as well, whatever the recovery reason', async () => {
    const storage = new FakeStorage();
    storage.data.set(key, JSON.stringify({ schema: 7, rulesVersion: 1, best: { hits: 5, club: null } }));
    storage.unreadable.add(keys.bag('filmy', 'easy'));
    const out = await makeStore(storage).open('filmy', 'easy');
    expect(out).toMatchObject({ kind: 'unsaved', cause: 'read-failed', recovery: 'unsupported' });
    expect(storage.writes).toHaveLength(0);
  });

  it('recovers from corrupt data visibly, keeping the best from the legacy key and the bad document', async () => {
    const storage = new FakeStorage();
    const good = docOf(await makeStore(storage).open('filmy', 'easy'));
    const bad = JSON.parse(serializeDoc(good));
    bad.run.livesLost = 99;
    bad.best = { hits: 12, club: 100 };
    storage.data.set(key, JSON.stringify(bad));
    storage.data.set(keys.best('filmy', 'easy'), JSON.stringify({ hits: 8, club: 50 }));
    const out = await makeStore(storage, BANK_WORDS, 7).open('filmy', 'easy');
    expect(out).toMatchObject({ kind: 'recovered', reason: 'corrupt' });
    expect(docOf(out).best).toEqual({ hits: 12, club: 100 });
    expect(docOf(out).run.hits).toBe(0);
    expect(stored(storage).runId).toBe(docOf(out).runId);
  });

  it('reports other schema versions as unsupported', async () => {
    const storage = new FakeStorage();
    storage.data.set(key, JSON.stringify({ schema: 99, rulesVersion: 1 }));
    expect(await makeStore(storage).open('filmy', 'easy')).toMatchObject({ kind: 'recovered', reason: 'unsupported' });
  });

  it('recovers from a persisted internal ready stage instead of loading a stuck run', async () => {
    const storage = new FakeStorage();
    const doc = docOf(await makeStore(storage).open('filmy', 'easy'));
    const other = makeStore(storage, BANK_WORDS, 3);
    await other.open('filmy', 'easy');
    const solved = await solve(other, doc);
    for (const source of [doc, solved]) {
      const copy = JSON.parse(serializeDoc(source));
      copy.run.status = 'ready';
      storage.data.set(key, JSON.stringify(copy));
      const out = await makeStore(storage, BANK_WORDS, 4).open('filmy', 'easy');
      expect(out).toMatchObject({ kind: 'recovered', reason: 'corrupt' });
      expect(docOf(out).run.status).toBe('playing');
    }
  });

  it('inspects a slot without drawing or writing', async () => {
    const storage = new FakeStorage();
    const store = makeStore(storage);
    expect(await store.inspect('filmy', 'easy')).toEqual({ kind: 'none', best: null });
    storage.unreadable.add(key);
    expect(await store.inspect('filmy', 'easy')).toMatchObject({ kind: 'unreadable', reason: 'unavailable' });
    storage.unreadable.clear();
    storage.data.set(key, 'nope');
    expect(await store.inspect('filmy', 'easy')).toMatchObject({ kind: 'unreadable', reason: 'corrupt' });
    expect(storage.writes).toHaveLength(0);
    storage.data.clear();
    const doc = docOf(await store.open('filmy', 'easy'));
    expect(await store.inspect('filmy', 'easy')).toEqual({ kind: 'resumable', doc, unsaved: null });
  });

  it('reports an empty pool without writing or throwing', async () => {
    const storage = new FakeStorage();
    expect(await makeStore(storage, []).open('filmy', 'easy')).toEqual({ kind: 'empty', best: null });
    expect(storage.writes).toHaveLength(0);
  });
});

describe('solve, boss and terminal transitions across restarts', () => {
  it('settles a solve and a boss reward once, however often the screen is reloaded', async () => {
    const storage = new FakeStorage();
    const store = makeStore(storage);
    let doc = docOf(await store.open('filmy', 'easy'));
    doc = await solve(store, doc);
    expect(doc.run).toMatchObject({ status: 'solved', hits: 1 });
    for (let i = 0; i < 3; i += 1) {
      const r = docOf(await makeStore(storage, BANK_WORDS, i + 2).open('filmy', 'easy'));
      expect(r.run).toMatchObject({ status: 'solved', hits: 1 });
    }
    doc = docOf(await act(store, doc, { type: 'continue' }));
    expect(doc.run.current!.isBoss).toBe(true);
    const reveals = doc.run.powerUps[0];
    doc = await solve(store, doc);
    expect(doc.run).toMatchObject({ status: 'milestone', hits: 2 });
    expect(doc.run.powerUps[0]).toBe(reveals + 1);
    for (let i = 0; i < 3; i += 1) {
      const r = docOf(await makeStore(storage, BANK_WORDS, i + 10).open('filmy', 'easy'));
      expect(r.run).toMatchObject({ status: 'milestone', hits: 2 });
      expect(r.run.powerUps[0]).toBe(reveals + 1);
    }
    // Continue twice from the same screen: one draw.
    const next = await act(store, doc, { type: 'continue' });
    const dup = await act(store, doc, { type: 'continue' });
    expect(next.kind).toBe('saved');
    expect(dup.kind).toBe('stale');
    expect(stored(storage).run.status).toBe('playing');
  });

  it('keeps the old run terminal after a final-life loss and never resumes it', async () => {
    const storage = new FakeStorage();
    const store = makeStore(storage);
    let doc = docOf(await store.open('filmy', 'easy'));
    doc = await solve(store, doc);
    doc = docOf(await act(store, doc, { type: 'continue' }));
    const lost = await lose(store, doc);
    expect(lost.kind).toBe('saved');
    const end = docOf(lost);
    expect(end.terminal).toMatchObject({ reason: 'lost', hits: 1 });
    expect(end.best).toEqual({ hits: 1, club: null });
    for (const seed of [2, 3]) {
      const out = await makeStore(storage, BANK_WORDS, seed).open('filmy', 'easy');
      expect(out).toMatchObject({ kind: 'terminal', saved: true });
      expect(docOf(out)).toEqual(end);
    }
    const again = await act(store, end, { type: 'guess', letter: 'A' });
    expect(again.kind).toBe('ignored');
  });

  it('a final loss still pending in storage leaves the restart on the previous complete state', async () => {
    const storage = new FakeStorage();
    const store = makeStore(storage);
    let doc = docOf(await store.open('filmy', 'easy'));
    doc = await solve(store, doc);
    doc = docOf(await act(store, doc, { type: 'continue' }));
    const wrong = ALPHABET.filter((l) => !lettersOf(answerOf(doc)).has(l));
    for (const l of wrong.slice(0, 8)) doc = docOf(await act(store, doc, { type: 'guess', letter: l }));
    const before = stored(storage);
    expect(before.run.livesLost).toBe(8);

    storage.holdWrites = true;
    const pending = act(store, doc, { type: 'guess', letter: wrong[8] });
    await flush();
    const duplicate = act(store, doc, { type: 'guess', letter: wrong[8] }); // queued behind the first, stale
    const abandon = act(store, doc, { type: 'abandon' }); // would overtake with the old identity
    await flush();
    expect(storage.parked).toHaveLength(1);

    // Restart while the write is in flight: the previous completed document, with its old best.
    const midway = await makeStore(storage, BANK_WORDS, 5).open('filmy', 'easy');
    expect(docOf(midway)).toEqual(before);
    expect(docOf(midway).best).toBeNull();
    expect(storage.parked).toHaveLength(1); // resuming read the old document and wrote nothing

    storage.release();
    const done = await pending;
    expect(done.kind).toBe('saved');
    expect(await duplicate).toMatchObject({ kind: 'stale' });
    expect(await abandon).toMatchObject({ kind: 'stale' });
    expect(storage.parked).toHaveLength(0);

    const after = stored(storage);
    expect(after.terminal).toMatchObject({ reason: 'lost', hits: 1 });
    expect(after.best).toEqual({ hits: 1, club: null });
    expect(after.run.status).toBe('over');
    expect(after.bag).toEqual(before.bag);
  });

  it('abandoning and starting a New run are single writes with a consistent run, bag and best', async () => {
    const storage = new FakeStorage();
    const store = makeStore(storage);
    let doc = docOf(await store.open('filmy', 'easy'));
    doc = await solve(store, doc);
    doc = docOf(await act(store, doc, { type: 'continue' }));
    const before = stored(storage);

    storage.holdWrites = true;
    const newRun = act(store, doc, { type: 'newRun' });
    const staleAbandon = act(store, doc, { type: 'abandon' });
    const staleAgain = act(store, doc, { type: 'newRun' });
    await flush();
    expect(storage.parked).toHaveLength(1);
    expect(stored(storage)).toEqual(before); // nothing partial is visible

    storage.release();
    const started = docOf(await newRun);
    expect(await staleAbandon).toMatchObject({ kind: 'stale' });
    expect(await staleAgain).toMatchObject({ kind: 'stale' });
    expect(storage.parked).toHaveLength(0);

    const after = stored(storage);
    expect(after).toEqual(started);
    expect(after.runId).not.toBe(before.runId);
    expect(after.best).toEqual({ hits: 1, club: null }); // the abandoned run settled
    expect(after.bestAtStart).toEqual({ hits: 1, club: null });
    expect(after.run).toMatchObject({ hits: 0, livesLost: 0, status: 'playing', powerUps: [2, 1, 1, 1] });
    expect(after.bag.remaining).not.toContain(after.run.current!.word.id);
    expect(after.bag.last).toBe(after.run.current!.word.id);
    expect(after.terminal).toBeNull();
  });

  it('a failed terminal write leaves the previous document and reports unsaved', async () => {
    const storage = new FakeStorage();
    const store = makeStore(storage);
    let doc = docOf(await store.open('filmy', 'easy'));
    doc = await solve(store, doc);
    const before = stored(storage);
    storage.failWrites = true;
    const out = await act(store, doc, { type: 'abandon' });
    expect(out).toMatchObject({ kind: 'unsaved', cause: 'write-failed' });
    expect(docOf(out).best).toEqual({ hits: 1, club: null });
    expect(stored(storage)).toEqual(before);
    const reopened = await makeStore(storage, BANK_WORDS, 2).open('filmy', 'easy');
    expect(docOf(reopened)).toEqual(before);
  });

  it('rejects a repeated or old action once the run has moved on', async () => {
    const storage = new FakeStorage();
    const store = makeStore(storage);
    const doc = docOf(await store.open('filmy', 'easy'));
    const letter = [...lettersOf(answerOf(doc))][0];
    const first = await act(store, doc, { type: 'guess', letter });
    const replay = await act(store, doc, { type: 'guess', letter });
    expect(first.kind).toBe('saved');
    expect(replay).toMatchObject({ kind: 'stale', doc: docOf(first) });
    const fresh = docOf(await act(store, docOf(first), { type: 'newRun' }));
    expect(await act(store, doc, { type: 'power', slot: 0 })).toMatchObject({ kind: 'stale' });
    expect(stored(storage)).toEqual(fresh);
  });

  it('does not act on a slot this store has not opened, so a removed word cannot stay playable', async () => {
    const storage = new FakeStorage();
    const a = makeStore(storage);
    const doc = docOf(await a.open('filmy', 'easy'));
    const id = doc.run.current!.word.id;
    const letter = [...lettersOf(answerOf(doc))][0];
    const writes = storage.writes.length;

    const b = makeStore(storage, BANK_WORDS.filter((w) => w.id !== id), 3);
    expect(await b.act('filmy', 'easy', doc, { type: 'guess', letter })).toEqual({ kind: 'stale', doc: null });
    expect(storage.writes).toHaveLength(writes);
    expect(stored(storage)).toEqual(doc);

    // Opening reconciles first; the old identity is then stale and the replacement is playable.
    const migrated = docOf(await b.open('filmy', 'easy'));
    expect(migrated.run.current!.word.id).not.toBe(id);
    expect(await b.act('filmy', 'easy', doc, { type: 'guess', letter })).toMatchObject({ kind: 'stale' });
    const next = [...lettersOf(answerOf(migrated))][0];
    expect(await b.act('filmy', 'easy', migrated, { type: 'guess', letter: next })).toMatchObject({ kind: 'saved' });
  });

  it('rejects a stale second store (another tab): it cannot lower a best or revive a finished run', async () => {
    const storage = new FakeStorage();
    const x = makeStore(storage, BANK_WORDS, 1);
    let doc = docOf(await x.open('filmy', 'easy'));
    doc = await solve(x, doc);
    expect(doc.run.hits).toBe(1);

    const y = makeStore(storage, BANK_WORDS, 2);
    const seenByY = docOf(await y.open('filmy', 'easy'));
    expect(seenByY).toEqual(doc);
    const ended = docOf(await y.act('filmy', 'easy', seenByY, { type: 'abandon' }));
    expect(ended.terminal).toMatchObject({ reason: 'abandoned', hits: 1 });
    expect(ended.best).toEqual({ hits: 1, club: null });

    const late = await x.act('filmy', 'easy', doc, { type: 'continue' });
    expect(late).toEqual({ kind: 'stale', doc: ended });
    expect(stored(storage)).toEqual(ended);
    expect(stored(storage).best).toEqual({ hits: 1, club: null });
  });

  it('a stale result leads back to open: it adopts the stored run and a New run saves (no loop)', async () => {
    const storage = new FakeStorage();
    const x = makeStore(storage, BANK_WORDS, 1);
    const y = makeStore(storage, BANK_WORDS, 2);
    const doc = await solve(x, docOf(await x.open('filmy', 'easy')));
    const ended = docOf(await y.act('filmy', 'easy', docOf(await y.open('filmy', 'easy')), { type: 'abandon' }));

    const late = await x.act('filmy', 'easy', doc, { type: 'continue' });
    expect(late).toEqual({ kind: 'stale', doc: ended });
    // Acting on the returned doc must not bounce back with X's old run.
    expect(await x.act('filmy', 'easy', ended, { type: 'newRun' })).toEqual({ kind: 'stale', doc: null });

    expect(await x.open('filmy', 'easy')).toEqual({ kind: 'terminal', doc: ended, saved: true });
    const fresh = await x.act('filmy', 'easy', ended, { type: 'newRun' });
    expect(fresh).toMatchObject({ kind: 'saved' });
    expect(docOf(fresh).runId).not.toBe(ended.runId);
    expect(stored(storage)).toEqual(docOf(fresh));
  });
});

describe('a second store after a failed write', () => {
  /** X and Y hold one run. X's write fails (a power-up, unsaved); then Y solves and abandons it. */
  async function setup() {
    const storage = new FakeStorage();
    const x = makeStore(storage, BANK_WORDS, 1);
    const y = makeStore(storage, BANK_WORDS, 2);
    const opened = docOf(await x.open('filmy', 'easy'));
    expect(docOf(await y.open('filmy', 'easy'))).toEqual(opened);

    storage.failWrites = true;
    const unsaved = await act(x, opened, { type: 'power', slot: 0 });
    expect(unsaved).toMatchObject({ kind: 'unsaved', cause: 'write-failed' });
    storage.failWrites = false;

    const solved = await solve(y, opened);
    const ended = docOf(await act(y, solved, { type: 'abandon' }));
    expect(ended.terminal).toMatchObject({ reason: 'abandoned', hits: 1 });
    expect(ended.best).toEqual({ hits: 1, club: null });
    return { storage, x, ended, ahead: docOf(unsaved) };
  }

  it('act re-reads after a failed write: the other tab\'s best and finished run are kept', async () => {
    const { storage, x, ended, ahead } = await setup();
    const writes = storage.writes.length;
    expect(await act(x, ahead, { type: 'abandon' })).toEqual({ kind: 'stale', doc: ended });
    expect(storage.writes).toHaveLength(writes);
    expect(stored(storage)).toEqual(ended);
    expect(stored(storage).best).toEqual({ hits: 1, club: null });
  });

  it('a stale act after a failed write leads back to open, then a New run saves', async () => {
    const { storage, x, ended, ahead } = await setup();
    expect(await act(x, ahead, { type: 'abandon' })).toEqual({ kind: 'stale', doc: ended });
    expect(await act(x, ended, { type: 'newRun' })).toEqual({ kind: 'stale', doc: null });
    expect(await x.open('filmy', 'easy')).toEqual({ kind: 'terminal', doc: ended, saved: true });
    const fresh = await act(x, ended, { type: 'newRun' });
    expect(fresh).toMatchObject({ kind: 'saved' });
    expect(stored(storage)).toEqual(docOf(fresh));
  });

  it('a stale act then an unreadable slot: open plays unsaved and never overwrites the ended run', async () => {
    const { storage, x, ended, ahead } = await setup();
    expect(await act(x, ahead, { type: 'abandon' })).toEqual({ kind: 'stale', doc: ended });
    const writes = storage.writes.length;

    storage.unreadable.add(keys.run('filmy', 'easy'));
    expect(await x.open('filmy', 'easy')).toMatchObject({ kind: 'unsaved', cause: 'read-failed' });
    expect(storage.writes).toHaveLength(writes);
    expect(stored(storage)).toEqual(ended);

    storage.unreadable.clear();
    expect(await x.open('filmy', 'easy')).toEqual({ kind: 'terminal', doc: ended, saved: true });
  });

  it('open re-reads after a failed write: it resumes the stored run instead of reviving the finished one', async () => {
    const { storage, x, ended } = await setup();
    const writes = storage.writes.length;
    expect(await x.open('filmy', 'easy')).toEqual({ kind: 'terminal', doc: ended, saved: true });
    expect(storage.writes).toHaveLength(writes);
    expect(stored(storage)).toEqual(ended);
    expect(stored(storage).terminal).not.toBeNull();
    expect(await x.inspect('filmy', 'easy')).toEqual({ kind: 'terminal', doc: ended, unsaved: null });
  });

  it('still retries the unsaved run when nobody else changed storage', async () => {
    const storage = new FakeStorage();
    const store = makeStore(storage);
    const opened = docOf(await store.open('filmy', 'easy'));
    storage.failWrites = true;
    const ahead = docOf(await act(store, opened, { type: 'power', slot: 0 }));
    storage.failWrites = false;

    // The first retry still compares with the revision that is stored, not the unsaved one.
    expect(await store.open('filmy', 'easy')).toMatchObject({ kind: 'saved', source: 'resumed' });
    expect(stored(storage)).toEqual(ahead);

    storage.failWrites = true;
    const again = docOf(await act(store, ahead, { type: 'abandon' }));
    storage.failWrites = false;
    const ended = await act(store, again, { type: 'newRun' }); // `again` is unsaved, nothing else wrote
    expect(ended).toMatchObject({ kind: 'saved' });
    expect(stored(storage)).toEqual(docOf(ended));
  });
});

describe('the last stored revision (base) is tracked on every path', () => {
  /** A store that loaded a run it did not start, then loses one write (a power-up kept only in memory). */
  async function loadedThenFailed() {
    const storage = new FakeStorage();
    const opened = docOf(await makeStore(storage, BANK_WORDS, 1).open('filmy', 'easy'));
    const store = makeStore(storage, BANK_WORDS, 2);
    expect(await store.open('filmy', 'easy')).toMatchObject({ kind: 'saved', source: 'resumed' });
    storage.failWrites = true;
    const ahead = docOf(await act(store, opened, { type: 'power', slot: 0 }));
    storage.failWrites = false;
    return { storage, store, opened, ahead };
  }

  it('a loaded run keeps working after a failed write: act saves', async () => {
    const { storage, store, ahead } = await loadedThenFailed();
    const out = await act(store, ahead, { type: 'abandon' });
    expect(out).toMatchObject({ kind: 'saved' });
    expect(stored(storage)).toEqual(docOf(out));
  });

  it('a loaded run keeps working after a failed write: open keeps the unsaved progress', async () => {
    const { storage, store, ahead } = await loadedThenFailed();
    expect(await store.open('filmy', 'easy')).toEqual({ kind: 'saved', doc: ahead, source: 'resumed' });
    expect(stored(storage)).toEqual(ahead);
  });

  it('after open resumes another tab\'s finished run, a later failed write is still retried, not discarded', async () => {
    const storage = new FakeStorage();
    const x = makeStore(storage, BANK_WORDS, 1);
    const y = makeStore(storage, BANK_WORDS, 2);
    const opened = docOf(await x.open('filmy', 'easy'));
    await y.open('filmy', 'easy');
    storage.failWrites = true;
    await act(x, opened, { type: 'power', slot: 0 }); // x is now unsaved (write-failed)
    storage.failWrites = false;
    const ended = docOf(await act(y, await solve(y, opened), { type: 'abandon' }));
    expect(await x.open('filmy', 'easy')).toEqual({ kind: 'terminal', doc: ended, saved: true });

    storage.failWrites = true;
    const fresh = docOf(await act(x, ended, { type: 'newRun' }));
    storage.failWrites = false;
    expect(await x.open('filmy', 'easy')).toEqual({ kind: 'saved', doc: fresh, source: 'resumed' });
    expect(stored(storage)).toEqual(fresh);
  });

  it('after a read-failed run is replaced by the stored one, a later failed write is still retried', async () => {
    const storage = new FakeStorage();
    const opened = docOf(await makeStore(storage, BANK_WORDS, 1).open('filmy', 'easy'));
    const store = makeStore(storage, BANK_WORDS, 2);
    storage.unreadable.add(key);
    expect(await store.open('filmy', 'easy')).toMatchObject({ kind: 'unsaved', cause: 'read-failed' });
    storage.unreadable.clear();
    expect(await store.open('filmy', 'easy')).toEqual({ kind: 'saved', doc: opened, source: 'resumed' });

    storage.failWrites = true;
    const ahead = docOf(await act(store, opened, { type: 'power', slot: 0 }));
    storage.failWrites = false;
    expect(await store.open('filmy', 'easy')).toEqual({ kind: 'saved', doc: ahead, source: 'resumed' });
    expect(stored(storage)).toEqual(ahead);
  });
});

describe('storage that comes and goes', () => {
  it('keeps a saved run when a later open cannot read storage, and serves it again once storage recovers', async () => {
    const storage = new FakeStorage();
    const store = makeStore(storage);
    let doc = docOf(await store.open('filmy', 'easy'));
    doc = docOf(await act(store, doc, { type: 'power', slot: 0 }));
    const writes = storage.writes.length;

    storage.unreadable.add(key);
    const during = await store.open('filmy', 'easy');
    expect(during).toMatchObject({ kind: 'saved', source: 'resumed' });
    expect(docOf(during)).toEqual(doc);
    expect(await store.inspect('filmy', 'easy')).toEqual({ kind: 'resumable', doc, unsaved: null });
    storage.unreadable.clear();
    expect(docOf(await store.open('filmy', 'easy'))).toEqual(doc);
    expect(storage.writes).toHaveLength(writes);
  });

  it('retries an unsaved run on open and keeps the best from a legacy key that was unreadable before', async () => {
    const storage = new FakeStorage();
    storage.data.set(keys.best('filmy', 'easy'), JSON.stringify({ hits: 8, club: 50 }));
    storage.unreadable.add(key).add(keys.best('filmy', 'easy'));
    const store = makeStore(storage);
    const first = await store.open('filmy', 'easy');
    expect(first).toMatchObject({ kind: 'unsaved', cause: 'read-failed' });
    expect(docOf(first).best).toBeNull();
    expect(await store.open('filmy', 'easy')).toMatchObject({ kind: 'unsaved', cause: 'read-failed' });
    expect(storage.writes).toHaveLength(0);

    storage.unreadable.clear();
    const again = await store.open('filmy', 'easy');
    expect(again).toMatchObject({ kind: 'saved', source: 'resumed' });
    expect(docOf(again).run).toEqual(docOf(first).run);
    expect(docOf(again).best).toEqual({ hits: 8, club: 50 });
    expect(stored(storage)).toEqual(docOf(again));
  });

  it('does not call a run below a recovered best a new best (the recovered best is also the bar at the start)', async () => {
    const storage = new FakeStorage();
    storage.data.set(keys.best('filmy', 'easy'), JSON.stringify({ hits: 8, club: 50 }));
    storage.unreadable.add(key).add(keys.best('filmy', 'easy'));
    const store = makeStore(storage);
    const first = await store.open('filmy', 'easy');
    expect(docOf(first).bestAtStart).toBeNull();

    storage.unreadable.clear();
    let doc = docOf(await store.open('filmy', 'easy'));
    expect(doc.best).toEqual({ hits: 8, club: 50 });
    expect(doc.bestAtStart).toEqual({ hits: 8, club: 50 });
    expect(stored(storage)).toEqual(doc); // the saved document validates (best >= bestAtStart)

    doc = await solve(store, doc);
    doc = docOf(await act(store, doc, { type: 'continue' }));
    const ended = docOf(await act(store, doc, { type: 'abandon' }));
    expect(ended.terminal).toMatchObject({ reason: 'abandoned', hits: 1 });
    expect(ended.best).toEqual({ hits: 8, club: 50 });
    expect(isNewBest(ended)).toBe(false);
  });

  it('keeps the start bar when the unsaved run already ended before the best became readable', async () => {
    const storage = new FakeStorage();
    storage.data.set(keys.best('filmy', 'easy'), JSON.stringify({ hits: 8, club: 50 }));
    storage.unreadable.add(key).add(keys.best('filmy', 'easy'));
    const store = makeStore(storage);
    let doc = docOf(await store.open('filmy', 'easy'));
    doc = await solve(store, doc);
    doc = docOf(await act(store, doc, { type: 'continue' }));
    const ended = docOf(await act(store, doc, { type: 'abandon' }));
    expect(ended.terminal).toBeTruthy();
    expect(isNewBest(ended)).toBe(true); // nothing better is known yet

    storage.unreadable.clear();
    const out = await store.open('filmy', 'easy');
    expect(out).toMatchObject({ kind: 'terminal', saved: true });
    expect(docOf(out).best).toEqual({ hits: 8, club: 50 });
    expect(docOf(out).bestAtStart).toEqual({ hits: 8, club: 50 });
    expect(isNewBest(docOf(out))).toBe(false);
    expect(stored(storage)).toEqual(docOf(out));
  });

  it('still calls a run that beat the recovered best a new best (the bar is the recovered best, not the run score)', async () => {
    const storage = new FakeStorage();
    storage.data.set(keys.best('filmy', 'easy'), JSON.stringify({ hits: 1, club: null }));
    storage.unreadable.add(key).add(keys.best('filmy', 'easy'));
    const store = makeStore(storage);
    let doc = docOf(await store.open('filmy', 'easy'));
    for (let i = 0; i < 2; i += 1) {
      doc = await solve(store, doc);
      doc = docOf(await act(store, doc, { type: 'continue' }));
    }
    const ended = docOf(await act(store, doc, { type: 'abandon' }));
    expect(ended.terminal).toMatchObject({ reason: 'abandoned', hits: 2 });

    storage.unreadable.clear();
    const out = await store.open('filmy', 'easy');
    expect(out).toMatchObject({ kind: 'terminal', saved: true });
    expect(docOf(out).bestAtStart?.hits).toBe(1);
    expect(docOf(out).best?.hits).toBe(2);
    expect(isNewBest(docOf(out))).toBe(true);
    expect(stored(storage)).toEqual(docOf(out));
  });

  it('keeps the start bar it already had when the best it recovers is unreadable or corrupt', async () => {
    const storage = new FakeStorage();
    storage.data.set(keys.best('filmy', 'easy'), JSON.stringify({ hits: 8, club: 50 }));
    storage.unreadable.add(key); // only the run key: the legacy best (8) seeds the start bar
    const store = makeStore(storage);
    const first = await store.open('filmy', 'easy');
    expect(first).toMatchObject({ kind: 'unsaved', cause: 'read-failed' });
    expect(docOf(first).bestAtStart).toEqual({ hits: 8, club: 50 });

    storage.data.set(keys.best('filmy', 'easy'), '{not json');
    storage.unreadable.clear();
    const out = await store.open('filmy', 'easy');
    expect(docOf(out).bestAtStart).toEqual({ hits: 8, club: 50 });
    expect(docOf(out).best).toEqual({ hits: 8, club: 50 });
    expect(stored(storage)).toEqual(docOf(out));
  });

  it('prefers the stored run once an unreadable slot becomes readable and holds one', async () => {
    const elsewhere = new FakeStorage();
    const theirs = docOf(await makeStore(elsewhere, BANK_WORDS, 9).open('filmy', 'easy'));

    const storage = new FakeStorage();
    storage.unreadable.add(key);
    const store = makeStore(storage);
    const mine = docOf(await store.open('filmy', 'easy'));
    expect(mine.runId).not.toBe(theirs.runId);
    storage.data.set(key, elsewhere.data.get(key)!);
    storage.unreadable.clear();

    const out = await store.open('filmy', 'easy');
    expect(out).toMatchObject({ kind: 'saved', source: 'resumed' });
    expect(docOf(out)).toEqual(theirs);
    expect(storage.writes).toHaveLength(0);
  });

  it('retries a failed write when the slot is opened again', async () => {
    const storage = new FakeStorage();
    storage.failWrites = true;
    const store = makeStore(storage);
    const doc = docOf(await store.open('filmy', 'easy'));
    expect(await store.open('filmy', 'easy')).toMatchObject({ kind: 'unsaved', cause: 'write-failed' });
    storage.failWrites = false;
    const out = await store.open('filmy', 'easy');
    expect(out).toMatchObject({ kind: 'saved', source: 'resumed' });
    expect(docOf(out)).toEqual(doc);
    expect(stored(storage)).toEqual(doc);
  });
});

describe('changed word content', () => {
  const without = (id: string) => BANK_WORDS.filter((w) => w.id !== id);

  it('replaces a missing playable word once, refunds, and saves the replacement before it can be rerolled', async () => {
    const storage = new FakeStorage();
    const store = makeStore(storage);
    let doc = docOf(await store.open('filmy', 'easy'));
    doc = docOf(await act(store, doc, { type: 'power', slot: 0 }));
    doc = docOf(await act(store, doc, { type: 'power', slot: 1 }));
    const id = doc.run.current!.word.id;

    const migrated = await makeStore(storage, without(id), 2).open('filmy', 'easy');
    expect(migrated).toMatchObject({ kind: 'saved', source: 'migrated' });
    const next = docOf(migrated);
    expect(next.run.current!.word.id).not.toBe(id);
    expect(next.run.powerUps).toEqual([doc.run.powerUps[0] + 1, doc.run.powerUps[1] + 1, 1, 1]);
    expect(stored(storage)).toEqual(next);

    for (const seed of [3, 4, 5]) {
      const again = await makeStore(storage, without(id), seed).open('filmy', 'easy');
      expect(again).toMatchObject({ kind: 'saved', source: 'resumed' });
      expect(docOf(again)).toEqual(next);
    }
    expect(storage.writes).toHaveLength(4); // open, two powers, one migration
  });

  it('reports an unsaved migration and does not reroll it while the store is open', async () => {
    const storage = new FakeStorage();
    const doc = docOf(await makeStore(storage).open('filmy', 'easy'));
    storage.failWrites = true;
    const store = makeStore(storage, without(doc.run.current!.word.id), 2);
    const out = await store.open('filmy', 'easy');
    expect(out).toMatchObject({ kind: 'unsaved', cause: 'write-failed' });
    expect('migration' in out && out.migration).toBeTruthy();
    expect(docOf(await store.open('filmy', 'easy'))).toEqual(docOf(out));
  });

  it('keeps solved, milestone and lost stages as they were when their word is gone', async () => {
    const storage = new FakeStorage();
    const store = makeStore(storage);
    let doc = docOf(await store.open('filmy', 'easy'));
    const check = async (expected: SlotDoc) => {
      const changed = makeStore(storage, without(expected.run.current!.word.id), 8);
      const out = await changed.open('filmy', 'easy');
      expect(docOf(out)).toEqual(expected);
      expect(storage.writes).toHaveLength(writes);
      return changed;
    };
    doc = await solve(store, doc);
    let writes = storage.writes.length;
    await check(doc); // solved pause
    const afterSolve = doc;
    doc = docOf(await act(store, doc, { type: 'continue' }));
    doc = await solve(store, doc);
    writes = storage.writes.length;
    const changed = await check(doc); // milestone: no second hit or reward
    expect(doc.run.hits).toBe(2);
    expect(afterSolve.run.hits).toBe(1);
    const continued = await changed.act('filmy', 'easy', doc, { type: 'continue' }); // draws exactly once
    expect(continued.kind).toBe('saved');
    expect(docOf(continued).run).toMatchObject({ status: 'playing', hits: 2 });
    expect(docOf(continued).bag.remaining.length).toBe(doc.bag.remaining.length - 1);

    const lost = docOf(await lose(changed, docOf(continued)));
    writes = storage.writes.length;
    const terminal = await makeStore(storage, without(lost.run.current!.word.id), 9).open('filmy', 'easy');
    expect(terminal).toMatchObject({ kind: 'terminal' });
    expect(docOf(terminal)).toEqual(lost);
    expect(storage.writes).toHaveLength(writes);
  });

  it('reports an empty pool for a saved playing word without writing', async () => {
    const storage = new FakeStorage();
    const doc = docOf(await makeStore(storage).open('filmy', 'easy'));
    const writes = storage.writes.length;
    expect(await makeStore(storage, [], 2).open('filmy', 'easy')).toEqual({ kind: 'empty', best: doc.best });
    expect(storage.writes).toHaveLength(writes);
  });
});
