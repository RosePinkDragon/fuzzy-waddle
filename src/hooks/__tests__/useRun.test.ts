/**
 * `useRun` joins a saved run to the run route. These tests render the hook (RNTL `renderHook`) over a real
 * run store on an in-memory storage, and "restart the app" by mounting again over a new store.
 * They check the integration: no extra draw, no duplicate reward, no resurrected run, and that nothing but
 * `run:*` documents is written.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { AppState } from 'react-native';

import { newRun, recovery, wordReplaced } from '@/copy/strings';
import { ALPHABET, lettersOf } from '@/game/answer';
import { seededRng } from '@/game/rng';
import { settleBest } from '@/game/runSnapshot';
import { bankContent, BANK_WORDS } from '@/game/__tests__/helpers';
import type { Difficulty, ThemeId } from '@/game/types';
import { markRecoveryShown, pendingRecoveries, resetRecoveryRegistry, tapRecoveryCard } from '@/lib/runController';
import { createRunStore, type RawStorage, type RunStore } from '@/lib/runStore';
import { keys, type RawRead } from '@/lib/storage';

import { useRun } from '../useRun';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Medium: 'medium' },
}));

// A short ladder: the second word is the first boss round.
beforeAll(() => {
  process.env.EXPO_PUBLIC_TEST_LADDER = '1';
});
afterAll(() => {
  delete process.env.EXPO_PUBLIC_TEST_LADDER;
});
beforeEach(() => {
  resetRecoveryRegistry();
  jest.clearAllMocks();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const PAUSE = 1100;

class FakeStorage implements RawStorage {
  data = new Map<string, string>();
  failWrites = false;
  writes: string[] = [];

  async read(key: string): Promise<RawRead> {
    return { ok: true, raw: this.data.get(key) ?? null };
  }

  async write(key: string, raw: string): Promise<boolean> {
    if (this.failWrites) return false;
    this.data.set(key, raw);
    this.writes.push(key);
    return true;
  }
}

/** A store over the storage that counts what reaches it. */
function makeStore(storage: FakeStorage, seed = 1) {
  const calls = { open: 0, act: [] as string[] };
  const inner = createRunStore({
    storage,
    rng: seededRng(seed),
    content: bankContent(BANK_WORDS),
    newRunId: (() => {
      let n = 0;
      return () => `run-${seed}-${(n += 1)}`;
    })(),
  });
  const store: RunStore = {
    inspect: (t, d) => inner.inspect(t, d),
    open: (t, d) => {
      calls.open += 1;
      return inner.open(t, d);
    },
    act: async (t, d, seen, action) => {
      const result = await inner.act(t, d, seen, action);
      calls.act.push(`${action.type}:${result.kind}`);
      return result;
    },
  };
  return { store, calls };
}

/** Mounts the hook on a store over `storage` (a new store is a restarted app) and waits for it to settle. */
async function mount(storage: FakeStorage, { theme = 'filmy', difficulty = 'easy', seed = 1 }: { theme?: ThemeId; difficulty?: Difficulty; seed?: number } = {}) {
  const { store, calls } = makeStore(storage, seed);
  const hook = await renderHook(() => useRun(theme, difficulty, { store, pauseMs: PAUSE }));
  await waitFor(() => expect(hook.result.current.phase).not.toBe('loading'));
  return { hook, calls, store };
}

type Mounted = Awaited<ReturnType<typeof mount>>;
const game = (m: Mounted) => m.hook.result.current;
const answerOf = (m: Mounted) => game(m).run!.current!.word.answer;
const press = (m: Mounted, letter: string) => act(async () => game(m).press(letter));
const wrongLetters = (m: Mounted) => ALPHABET.filter((l) => !lettersOf(answerOf(m)).has(l));
async function solve(m: Mounted) {
  for (const l of lettersOf(answerOf(m))) await press(m, l);
}

describe('a run through the hook', () => {
  it('resumes the same word and guesses after a remount, and writes only run documents', async () => {
    const storage = new FakeStorage();
    const first = await mount(storage);
    const answer = answerOf(first);
    await press(first, wrongLetters(first)[0]);
    await press(first, [...lettersOf(answer)][0]);
    const before = game(first).doc!;
    await first.hook.unmount();

    const second = await mount(storage, { seed: 7 });
    expect(game(second).doc).toEqual(before);
    expect(answerOf(second)).toBe(answer);
    expect(second.calls.open).toBe(1);
    expect(storage.writes.length).toBeGreaterThan(0);
    expect(new Set(storage.writes)).toEqual(new Set([keys.run('filmy', 'easy')]));
    expect([...storage.data.keys()].every((k) => k.startsWith('run:'))).toBe(true);
  });

  it('plays the wrong-guess haptic once for a wrong letter and not for a right one', async () => {
    const m = await mount(new FakeStorage());
    await press(m, [...lettersOf(answerOf(m))][0]);
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    await press(m, wrongLetters(m)[0]);
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
  });

  it('says so when a write fails, and again when a later one lands', async () => {
    const storage = new FakeStorage();
    const m = await mount(storage);
    expect(game(m).saved).toBe(true);
    storage.failWrites = true;
    await press(m, wrongLetters(m)[0]);
    expect(game(m).saved).toBe(false);
    storage.failWrites = false;
    await press(m, wrongLetters(m)[1]);
    expect(game(m).saved).toBe(true);
  });

  it('opens once more when the app goes to the background and comes back, however many return events arrive', async () => {
    const handlers: ((state: string) => void)[] = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
      handlers.push(handler as (state: string) => void);
      return { remove: jest.fn() };
    });
    const m = await mount(new FakeStorage());
    expect(m.calls.open).toBe(1);
    const emit = async (state: string) => act(async () => handlers.forEach((h) => h(state)));
    await emit('inactive');
    await emit('active');
    expect(m.calls.open).toBe(1);
    await emit('background');
    await emit('active');
    await emit('active');
    await waitFor(() => expect(m.calls.open).toBe(2));
    expect(game(m).doc!.revision).toBe(0);
  });

  it('continues a solved word once, even when the screen is remounted during the pause', async () => {
    jest.useFakeTimers();
    const storage = new FakeStorage();
    const first = await mount(storage);
    await solve(first);
    expect(game(first).run!.status).toBe('solved');
    await first.hook.unmount();
    await act(async () => jest.advanceTimersByTimeAsync(PAUSE * 2));
    expect(first.calls.act).not.toContain('continue:saved');

    const second = await mount(storage, { seed: 3 });
    expect(game(second).run!.status).toBe('solved');
    await act(async () => jest.advanceTimersByTimeAsync(PAUSE));
    await waitFor(() => expect(game(second).run!.status).toBe('playing'));
    expect(second.calls.act.filter((a) => a === 'continue:saved')).toHaveLength(1);
    expect(game(second).run!.hits).toBe(1);
    expect(game(second).doc!.bag.remaining).toHaveLength(8); // two words drawn from ten, once each
    await act(async () => jest.advanceTimersByTimeAsync(PAUSE * 3));
    expect(second.calls.act.filter((a) => a.startsWith('continue'))).toHaveLength(1);
  });

  it('shows a lost run as over after a remount and never plays on; only restart leaves it', async () => {
    const storage = new FakeStorage();
    const first = await mount(storage);
    for (const l of wrongLetters(first)) await press(first, l);
    expect(game(first).run!.status).toBe('over');
    await first.hook.unmount();

    const second = await mount(storage);
    expect(game(second).run!.status).toBe('over');
    expect(game(second).doc!.terminal?.reason).toBe('lost');
    const revision = game(second).doc!.revision;
    await press(second, 'A');
    expect(game(second).run!.status).toBe('over');
    expect(game(second).doc!.revision).toBe(revision);

    await act(async () => {
      await game(second).restart();
      await game(second).restart();
    });
    expect(game(second).run!.status).toBe('playing');
    expect(game(second).doc!.terminal).toBeNull();
    expect(second.calls.act.filter((a) => a === 'newRun:saved')).toHaveLength(1);
  });

  it('keeps a Masala Mix word concealed until its reel lands, on every mount', async () => {
    const storage = new FakeStorage();
    const first = await mount(storage, { theme: 'masala' });
    expect(game(first).reelLanded).toBe(false);
    expect(game(first).powerEnabled).toEqual([false, false, false, false]);
    await press(first, wrongLetters(first)[0]);
    expect(game(first).run!.current!.wrong).toEqual([]);
    await act(async () => game(first).onReelLanded());
    expect(game(first).reelLanded).toBe(true);
    await press(first, wrongLetters(first)[0]);
    expect(game(first).run!.current!.wrong).toHaveLength(1);
    await first.hook.unmount();

    const second = await mount(storage, { theme: 'masala' });
    expect(game(second).reelLanded).toBe(false);
    await act(async () => game(second).onReelLanded());
    expect(game(second).reelLanded).toBe(true);
  });

  it('shows the replaced word once and clears it when dismissed', async () => {
    const storage = new FakeStorage();
    const first = await mount(storage);
    await first.hook.unmount();
    const id = game(first).run!.current!.word.id;
    storage.data.set(
      keys.run('filmy', 'easy'),
      storage.data
        .get(keys.run('filmy', 'easy'))!
        .replace(new RegExp(`"(id|last)":"${id}"`, 'g'), '"$1":"filmy-gone"'),
    );
    const second = await mount(storage, { seed: 2 });
    expect(game(second).notice).toMatchObject({ kind: 'wordReplaced' });
    expect(game(second).run!.current!.word.id).not.toBe('filmy-gone');
    await act(async () => game(second).dismissNotice());
    expect(game(second).notice).toBeNull();
  });
});

describe('recovery', () => {
  const corrupt = (storage: FakeStorage, ...difficulties: Difficulty[]) =>
    difficulties.forEach((d) => storage.data.set(keys.run('filmy', d), '{"schema":999}'));

  it('waits for the notice, then opens the slot with a new controller once it has been shown', async () => {
    const storage = new FakeStorage();
    corrupt(storage, 'medium');
    const m = await mount(storage, { difficulty: 'medium' });
    expect(game(m).phase).toBe('recoveryPending');
    expect(pendingRecoveries('filmy').map((e) => e.difficulty)).toEqual(['medium']);
    expect(m.calls.open).toBe(0);

    markRecoveryShown('filmy', 'medium');
    await m.hook.rerender(undefined);
    await waitFor(() => expect(game(m).phase).toBe('ready'));
    expect(game(m).doc!.revision).toBe(0);
    expect(game(m).run!.hits).toBe(0);
  });

  it('with two slots needing recovery, tapping the second one shows its notice and then lands on the game', async () => {
    const storage = new FakeStorage();
    corrupt(storage, 'medium', 'hard');
    // Opening each route finds the bad data and records its notice.
    const medium = await mount(storage, { difficulty: 'medium' });
    const hard = await mount(storage, { difficulty: 'hard' });
    expect(game(medium).phase).toBe('recoveryPending');
    expect(game(hard).phase).toBe('recoveryPending');
    expect(pendingRecoveries('filmy').map((e) => e.difficulty)).toEqual(['medium', 'hard']);

    // The picker showed medium's notice (and marked it shown). A tap on hard's card shows hard's notice...
    markRecoveryShown('filmy', 'medium');
    expect(tapRecoveryCard('filmy', 'hard')).toBe('show notice');
    // ...and the next tap goes on to the game, which opens the slot instead of bouncing back.
    expect(tapRecoveryCard('filmy', 'hard')).toBe('navigate');
    const route = await mount(storage, { difficulty: 'hard' });
    expect(game(route).phase).toBe('ready');
    expect(game(route).run!.hits).toBe(0);
    expect(game(route).doc!.run.difficulty).toBe('hard');
    expect(pendingRecoveries('filmy')).toEqual([]);
  });

  it('leaves the other slot waiting for its own notice', async () => {
    const storage = new FakeStorage();
    corrupt(storage, 'medium', 'hard');
    await mount(storage, { difficulty: 'medium' });
    await mount(storage, { difficulty: 'hard' });
    expect(tapRecoveryCard('filmy', 'hard')).toBe('show notice');
    expect(pendingRecoveries('filmy').map((e) => e.difficulty)).toEqual(['medium']);
    const medium = await mount(storage, { difficulty: 'medium' });
    expect(game(medium).phase).toBe('recoveryPending');
  });
});

describe('copy the picker and sheets are built from', () => {
  const best = (hits: number, club: number | null) => ({ hits, club });
  /** The sheet's lines for a run that ends with `hits` in `club`, as the picker builds them. */
  const lines = (
    difficulty: Difficulty,
    hits: number,
    lives: number,
    before: ReturnType<typeof best> | null,
    club: number | null,
  ) => newRun.lines(difficulty, hits, lives, before, settleBest(before, hits, club));

  it('says what the best becomes when the run beats it', () => {
    expect(lines('medium', 14, 4, best(9, null), 50)).toEqual([
      'Your Medium run ends here: 14 hits, 4 lives left.',
      'Your Medium best goes up from 9 to 14 hits.',
      'Your Medium club best goes up to 50 Cr Club.',
    ]);
  });

  it('says the best stays when the run does not beat it, with the best that stays', () => {
    expect(lines('hard', 3, 5, best(12, 50), null)).toEqual([
      'Your Hard run ends here: 3 hits, 5 lives left.',
      'Your Hard best stays at 12 hits.',
      'Your Hard club best stays at 50 Cr Club.',
    ]);
    // A tie keeps the old best, and without a club there is no club line.
    expect(lines('easy', 5, 1, best(5, null), null)).toEqual([
      'Your Easy run ends here: 5 hits, 1 life left.',
      'Your Easy best stays at 5 hits.',
    ]);
  });

  it('with no earlier best, the hits line goes up from 0', () => {
    expect(lines('easy', 2, 9, null, null)).toEqual([
      'Your Easy run ends here: 2 hits, 9 lives left.',
      'Your Easy best goes up from 0 to 2 hits.',
    ]);
  });

  it('with zero hits, one line replaces both best lines', () => {
    expect(lines('medium', 0, 7, best(9, 50), null)).toEqual([
      'Your Medium run ends here: 0 hits, 7 lives left.',
      'No hits yet, so nothing is recorded.',
    ]);
  });

  it('says "stays" for the club when more hits land in the same club', () => {
    expect(lines('medium', 12, 3, best(9, 50), 50)).toContain('Your Medium club best stays at 50 Cr Club.');
  });

  it('gives one chip per refund over zero, named with the theme power-ups', () => {
    const names = ["Director's Cut", 'Trailer', 'Flashback', 'Censor Board'];
    expect(wordReplaced.refunds({ reveal: 1, clue: 0, remove: 0 }, names)).toEqual(["GOT BACK: 1 DIRECTOR'S CUT"]);
    expect(wordReplaced.refunds({ reveal: 2, clue: 1, remove: 1 }, names)).toEqual([
      "GOT BACK: 2 DIRECTOR'S CUT",
      'GOT BACK: 1 TRAILER',
      'GOT BACK: 1 CENSOR BOARD',
    ]);
    expect(wordReplaced.refunds({ reveal: 0, clue: 0, remove: 0 }, names)).toEqual([]);
  });

  it('keeps what was earned in the replaced-word notice, with or without a club', () => {
    expect(wordReplaced.body2(14, 4, 50)).toBe('Your 14 hits, 4 lives and 50 Cr Club are kept.');
    expect(wordReplaced.body2(1, 1, null)).toBe('Your 1 hit and 1 life are kept.');
  });

  it('leaves the bests line out of the recovery notice when no best survived', () => {
    expect(recovery.body(true)).toContain('Your bests stay as they were.');
    expect(recovery.body(false)).not.toContain('bests');
  });
});
