import { ALPHABET, lettersOf } from '../answer';
import { visibleClues } from '../difficulty';
import { EXTRA_CLUE, REMOVE, REVEAL, UNDO } from '../powerUps';
import { livesLeft } from '../run';
import { isNewBest, reconcileContent, reduce, startDoc, type SessionAction, type SessionEnv } from '../runSession';
import {
  currentRules,
  ladderOf,
  parseDoc,
  readBest,
  serializeDoc,
  settleBest,
  type SlotDoc,
} from '../runSnapshot';
import { emptyBag } from '../shuffleBag';
import { BANK_WORDS, testEnv, word } from './helpers';

// A short ladder: the first boss round is the second word (reached at 2 hits).
beforeAll(() => {
  process.env.EXPO_PUBLIC_TEST_LADDER = '1';
});
afterAll(() => {
  delete process.env.EXPO_PUBLIC_TEST_LADDER;
});

function fresh(env: SessionEnv, difficulty: 'easy' | 'medium' | 'hard' = 'easy', best = null as SlotDoc['best']): SlotDoc {
  const doc = startDoc('filmy', difficulty, { bag: emptyBag(), best }, env);
  if (!doc) throw new Error('empty pool');
  return doc;
}

function act(doc: SlotDoc, action: SessionAction, env: SessionEnv): SlotDoc {
  const r = reduce(doc, action, env);
  if (r.kind !== 'changed') throw new Error(`${action.type} was ${r.kind}`);
  return r.doc;
}

const answerOf = (doc: SlotDoc) => doc.run.current!.word.answer;
const wrongKeys = (doc: SlotDoc) => ALPHABET.filter((l) => !lettersOf(answerOf(doc)).has(l));
const solve = (doc: SlotDoc, env: SessionEnv) =>
  [...lettersOf(answerOf(doc))].reduce((d, l) => act(d, { type: 'guess', letter: l }, env), doc);
const loseLives = (doc: SlotDoc, n: number, env: SessionEnv) =>
  wrongKeys(doc).slice(0, n).reduce((d, l) => act(d, { type: 'guess', letter: l }, env), doc);
const roundtrip = (doc: SlotDoc) => {
  const r = parseDoc(serializeDoc(doc), doc.theme, doc.difficulty);
  if (!r.ok) throw new Error(`parse failed: ${r.detail}`);
  return r.doc;
};

describe('snapshot round trip', () => {
  it('restores the complete run, rules and bag without drawing again', () => {
    const env = testEnv(3);
    let doc = fresh(env);
    doc = act(doc, { type: 'power', slot: REVEAL }, env);
    doc = act(doc, { type: 'power', slot: EXTRA_CLUE }, env);
    doc = loseLives(doc, 2, env);
    doc = act(doc, { type: 'power', slot: UNDO }, env);
    doc = act(doc, { type: 'power', slot: REMOVE }, env);
    const play = doc.run.current!;
    expect(play.revealed).toHaveLength(1);
    expect(play.undone).toHaveLength(1);
    expect(play.removed.length).toBeGreaterThan(0);

    const restored = roundtrip(doc);
    expect(restored).toEqual(doc);
    // The same ordered guesses, effects, charges and bag come back every time.
    expect(roundtrip(restored)).toEqual(doc);
    expect(restored.run.current!.wrong).toEqual(play.wrong);
    expect(restored.run.powerUps).toEqual(doc.run.powerUps);
    expect(restored.bag).toEqual(doc.bag);
  });

  it('restores a solved pause and a milestone without replaying the transition', () => {
    const env = testEnv(4);
    const solved = solve(fresh(env), env);
    expect(solved.run.status).toBe('solved');
    expect(roundtrip(solved).run.hits).toBe(1);
    const continued = act(solved, { type: 'continue' }, env);
    const milestone = solve(continued, env);
    expect(milestone.run.status).toBe('milestone');
    const restored = roundtrip(milestone);
    expect(restored).toEqual(milestone);
    expect(restored.run.hits).toBe(2);
    expect(restored.run.lastClub?.hits).toBe(2);
  });

  it('keeps answers with spaces, digits and punctuation unguessable and free', () => {
    const env = testEnv(5, [word('DON 2', 'easy', 'don-2'), word("ROJA & CO.", 'easy', 'roja-co')]);
    const doc = fresh(env);
    const before = doc.run;
    expect(reduce(doc, { type: 'guess', letter: '2' }, env).kind).toBe('ignored');
    expect(reduce(doc, { type: 'guess', letter: ' ' }, env).kind).toBe('ignored');
    expect(reduce(doc, { type: 'guess', letter: '&' }, env).kind).toBe('ignored');
    expect(doc.run).toBe(before);
    const solved = solve(doc, env);
    expect(solved.run.status).toBe('solved');
    expect(roundtrip(solved)).toEqual(solved);
  });
});

describe('snapshot validation', () => {
  const env = testEnv(6);
  const base = fresh(env);
  const parse = (value: unknown) => parseDoc(JSON.stringify(value), 'filmy', 'easy');
  const tweak = (fn: (d: any) => void) => {
    const copy = JSON.parse(serializeDoc(base));
    fn(copy);
    return parse(copy);
  };

  it('accepts the unmodified document', () => {
    expect(parse(base).ok).toBe(true);
  });

  it('rejects an internal ready stage instead of loading a stuck run', () => {
    const solved = solve(base, env);
    const result = tweak(() => undefined);
    expect(result.ok).toBe(true);
    for (const doc of [base, solved]) {
      const copy = JSON.parse(serializeDoc(doc));
      copy.run.status = 'ready';
      const r = parse(copy);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe('corrupt');
    }
  });

  it.each([
    ['not JSON', () => parseDoc('{nope', 'filmy', 'easy')],
    ['an array', () => parse([])],
    ['another slot', () => parseDoc(serializeDoc(base), 'khana', 'easy')],
    ['a repeated letter', () => tweak((d) => (d.run.current.correct = ['D', 'D']))],
    ['a correct letter outside the answer', () => tweak((d) => (d.run.current.correct = ['Z']))],
    ['a wrong letter inside the answer', () => tweak((d) => (d.run.current.wrong = [[...lettersOf(answerOf(base))][0]]))],
    ['an undone letter that was never wrong', () => tweak((d) => (d.run.current.undone = ['Z']))],
    ['negative lives lost', () => tweak((d) => (d.run.livesLost = -1))],
    ['more lives lost than lives', () => tweak((d) => (d.run.livesLost = 99))],
    ['a non-finite charge', () => tweak((d) => (d.run.powerUps[0] = null))],
    ['three charge slots', () => tweak((d) => (d.run.powerUps = [1, 1, 1]))],
    ['a bag that still holds the current word', () => tweak((d) => d.bag.remaining.push(d.run.current.word.id))],
    ['a bag whose last word is not the current one', () => tweak((d) => (d.bag.last = 'other'))],
    ['a boss flag that disagrees with the ladder', () => tweak((d) => (d.run.current.isBoss = true))],
    ['more clue uses than clues', () => tweak((d) => (d.run.current.cluesRevealed = 5))],
    ['a lost terminal on a run with lives left', () => tweak((d) => (d.terminal = { reason: 'lost', hits: 0, club: null }))],
    ['a best below the best at the start', () => tweak((d) => (d.bestAtStart = { hits: 5, club: null }))],
    ['a chips setting that is not a boolean', () => tweak((d) => (d.rules.clues.showChips = 'yes'))],
    ['rules missing a setting', () => tweak((d) => delete d.rules.config.removeWrongCount)],
    ['rules with a bad ladder', () => tweak((d) => (d.rules.config.ladder = [{ crore: 1, hits: 5 }]))],
  ])('recovers visibly from %s', (_name, make) => {
    const r = make();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('corrupt');
  });

  it('reports other schema or rules versions as unsupported and keeps their positive best', () => {
    for (const patch of [{ schema: 2 }, { rulesVersion: 9 }]) {
      const r = parse({ ...JSON.parse(serializeDoc(base)), ...patch, best: { hits: 8, club: 50 } });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.reason).toBe('unsupported');
        expect(r.salvage.best).toEqual({ hits: 8, club: 50 });
      }
    }
  });

  it('rejects a finished run whose result was not settled into the best', () => {
    const lost = loseLives(base, base.rules.config.lives.easy, env);
    expect(lost.terminal?.reason).toBe('lost');
    expect(parse(lost).ok).toBe(true);
    const hit = solve(base, env);
    const abandoned = act(hit, { type: 'abandon' }, env);
    expect(parse(abandoned).ok).toBe(true);
    const unsettled = JSON.parse(serializeDoc(abandoned));
    unsettled.best = null;
    expect(parse(unsettled).ok).toBe(false);
  });
});

describe('bests', () => {
  it('reads a zero-only best as not played and rejects malformed ones', () => {
    expect(readBest({ hits: 0, club: null })).toEqual({ ok: true, best: null });
    expect(readBest(null)).toEqual({ ok: true, best: null });
    expect(readBest({ hits: 6, club: 50 })).toEqual({ ok: true, best: { hits: 6, club: 50 } });
    expect(readBest({ hits: -1, club: null }).ok).toBe(false);
    expect(readBest({ hits: 'x' }).ok).toBe(false);
  });

  it('never lowers a positive best and ignores zero-hit endings', () => {
    expect(settleBest(null, 0, null)).toBeNull();
    expect(settleBest({ hits: 8, club: 50 }, 0, null)).toEqual({ hits: 8, club: 50 });
    expect(settleBest({ hits: 8, club: 50 }, 3, null)).toEqual({ hits: 8, club: 50 });
    expect(settleBest({ hits: 8, club: 50 }, 9, 50)).toEqual({ hits: 9, club: 50 });
  });
});

describe('transitions', () => {
  it('records guesses in order and the final-life loss settles the best at once, exactly once', () => {
    const env = testEnv(7);
    let doc = fresh(env, 'easy', { hits: 4, club: null });
    doc = solve(doc, env);
    doc = act(doc, { type: 'continue' }, env);
    doc = solve(doc, env); // boss at 2 hits -> milestone
    doc = act(doc, { type: 'continue' }, env);
    expect(doc.run.hits).toBe(2);
    const lost = loseLives(doc, doc.rules.config.lives.easy, env);
    expect(lost.run.status).toBe('over');
    expect(lost.terminal).toEqual({ reason: 'lost', hits: 2, club: 50 });
    expect(lost.best).toEqual({ hits: 4, club: null }); // below the existing best: unchanged
    expect(reduce(lost, { type: 'guess', letter: 'Z' }, env).kind).toBe('ignored');
    expect(reduce(lost, { type: 'abandon' }, env).kind).toBe('ignored');
    expect(reduce(lost, { type: 'continue' }, env).kind).toBe('ignored');
    expect(lost.revision).toBeGreaterThan(doc.revision);
  });

  it('a loss with a better score raises the best, and a zero-hit loss leaves it not played', () => {
    const env = testEnv(8);
    const lostAtZero = loseLives(fresh(env), 9, env);
    expect(lostAtZero.terminal?.hits).toBe(0);
    expect(lostAtZero.best).toBeNull();
    expect(isNewBest(lostAtZero)).toBe(false);

    let doc = solve(fresh(env, 'easy', { hits: 1, club: null }), env);
    doc = act(doc, { type: 'continue' }, env);
    const lost = loseLives(doc, 9, env);
    expect(lost.terminal?.hits).toBe(1);
    expect(lost.best).toEqual({ hits: 1, club: null });
    expect(isNewBest(lost)).toBe(false);
    const better = loseLives(act(solve(doc, env), { type: 'continue' }, env), 9, env);
    expect(better.best?.hits).toBe(2);
    expect(isNewBest(better)).toBe(true);
  });

  it('a boss round on the last life: clearing it refills lives once, a wrong guess ends the run', () => {
    const env = testEnv(9);
    let doc = solve(fresh(env), env);
    doc = act(doc, { type: 'continue' }, env);
    expect(doc.run.current!.isBoss).toBe(true);
    // Spend all but the last life on the boss word.
    doc = loseLives(doc, 8, env);
    expect(livesLeft(doc.run, doc.rules.config)).toBe(1);

    const wrong = wrongKeys(doc).find((l) => !doc.run.current!.wrong.includes(l))!;
    const lost = act(doc, { type: 'guess', letter: wrong }, env);
    expect(lost.terminal).toMatchObject({ reason: 'lost', hits: 1 });
    expect(lost.best).toEqual({ hits: 1, club: null });

    const before = doc.run.powerUps[REVEAL];
    const cleared = solve(doc, env);
    expect(cleared.run.status).toBe('milestone');
    expect(cleared.run.hits).toBe(2);
    expect(cleared.run.livesLost).toBe(0);
    expect(cleared.run.powerUps[REVEAL]).toBe(before + 1);
    expect(cleared.terminal).toBeNull();
    expect(cleared.best).toBeNull(); // bests move only when a run ends
    // Replaying the clearing letter does nothing: no second hit or reward.
    expect(reduce(cleared, { type: 'guess', letter: [...lettersOf(answerOf(cleared))][0] }, env).kind).toBe('ignored');
  });

  it('continue draws exactly one word, and a repeated continue is ignored', () => {
    const env = testEnv(10);
    const solved = solve(fresh(env), env);
    const bagBefore = solved.bag.remaining.length;
    const next = act(solved, { type: 'continue' }, env);
    expect(next.run.status).toBe('playing');
    expect(next.bag.remaining.length).toBe(bagBefore - 1);
    expect(next.run.current!.word.id).not.toBe(solved.run.current!.word.id);
    expect(reduce(next, { type: 'continue' }, env).kind).toBe('ignored');
  });

  it('abandon settles the best and ends the run; new run keeps bag and best and resets the rest', () => {
    const env = testEnv(11);
    let doc = solve(fresh(env), env);
    doc = act(doc, { type: 'continue' }, env);
    doc = act(doc, { type: 'power', slot: REVEAL }, env);
    const abandoned = act(doc, { type: 'abandon' }, env);
    expect(abandoned.terminal).toEqual({ reason: 'abandoned', hits: 1, club: null });
    expect(abandoned.best).toEqual({ hits: 1, club: null });
    expect(reduce(abandoned, { type: 'guess', letter: 'A' }, env).kind).toBe('ignored');

    // New run straight from an in-progress run settles it once, atomically.
    const started = act(doc, { type: 'newRun' }, env);
    expect(started.best).toEqual({ hits: 1, club: null });
    expect(started.bestAtStart).toEqual({ hits: 1, club: null });
    expect(started.run).toMatchObject({ hits: 0, livesLost: 0, status: 'playing', powerUps: [2, 1, 1, 1] });
    expect(started.runId).not.toBe(doc.runId);
    expect(started.revision).toBe(doc.revision + 1);
    expect(started.terminal).toBeNull();
    expect(started.bag.remaining).not.toContain(started.run.current!.word.id);
    expect(started.bag.remaining.length).toBeLessThan(doc.bag.remaining.length);
    // From a finished run the best is not settled twice.
    const again = act(abandoned, { type: 'newRun' }, env);
    expect(again.best).toEqual(abandoned.best);
    expect(again.run.hits).toBe(0);
  });

  it('does not change anything when the pool is empty', () => {
    const empty = testEnv(12, []);
    expect(startDoc('filmy', 'easy', { bag: emptyBag(), best: null }, empty)).toBeNull();
    const env = testEnv(12);
    const solved = solve(fresh(env), env);
    expect(reduce(solved, { type: 'continue' }, empty)).toEqual({ kind: 'empty', doc: solved });
    expect(reduce(solved, { type: 'newRun' }, empty).kind).toBe('empty');
  });

  it('applies every power-up effect and keeps hard mode clues locked until used', () => {
    const env = testEnv(13);
    let doc = fresh(env, 'hard');
    expect(doc.rules.clues.hiddenClues).toEqual(['clue', 'extraClue']);
    expect(doc.run.powerUps).toEqual([2, 1, 1, 1]);
    // One extra clue charge: it unlocks the first hidden clue only.
    doc = act(doc, { type: 'power', slot: EXTRA_CLUE }, env);
    expect(doc.run.current!.cluesRevealed).toBe(1);
    expect(reduce(doc, { type: 'power', slot: EXTRA_CLUE }, env).kind).toBe('ignored'); // no charges
    doc = { ...doc, run: { ...doc.run, powerUps: [2, 1, 1, 1] } };
    doc = act(doc, { type: 'power', slot: EXTRA_CLUE }, env);
    expect(doc.run.current!.cluesRevealed).toBe(2);
    doc = { ...doc, run: { ...doc.run, powerUps: [2, 1, 1, 1] } };
    expect(reduce(doc, { type: 'power', slot: EXTRA_CLUE }, env).kind).toBe('ignored'); // nothing left to unlock
    expect(roundtrip(doc)).toEqual(doc);
  });
});

describe('original rules', () => {
  it('finishes a run under the rules it started with, whatever the live config says', () => {
    const env = testEnv(14);
    const doc = fresh(env);
    const old: SlotDoc = {
      ...doc,
      rules: {
        ...doc.rules,
        config: { ...doc.rules.config, lives: { ...doc.rules.config.lives, easy: 3 }, removeWrongCount: 1 },
        clues: { showChips: false, shownClues: ['clue'], hiddenClues: [] },
      },
    };
    expect(currentRules('easy').config.lives.easy).toBe(9);
    const restored = roundtrip(old);
    expect(restored.rules.config.lives.easy).toBe(3);
    // Chips visibility is frozen with the clues: easy shows chips today, this run began without them.
    expect(visibleClues('easy', 0).chips).toBe(true);
    expect(visibleClues('easy', 0, restored.rules.clues).chips).toBe(false);
    const lost = loseLives(restored, 3, env);
    expect(lost.run.status).toBe('over');
    // Clue settings come from the saved rules too: this run has no hidden clue to unlock.
    expect(reduce(restored, { type: 'power', slot: EXTRA_CLUE }, env).kind).toBe('ignored');
    // The reducer used the saved remove count of 1.
    const removed = act(restored, { type: 'power', slot: REMOVE }, env);
    expect(removed.run.current!.removed).toHaveLength(1);
  });

  it('draws the next word from the saved pool, not the live tiers', () => {
    const env = testEnv(16);
    const doc = fresh(env);
    expect(doc.rules.pool).toEqual(['easy']);
    const custom: SlotDoc = { ...doc, rules: { ...doc.rules, pool: ['hard'] }, bag: emptyBag() };
    const next = act(solve(custom, env), { type: 'continue' }, env);
    expect(next.run.current!.word.difficulty).toBe('hard');
  });

  it('executes the saved ladder: a different ladder gives a different boss round', () => {
    const env = testEnv(15);
    const doc = fresh(env);
    const rules = { ...doc.rules, config: { ...doc.rules.config, ladder: [{ crore: 10, hits: 3 }, { crore: 20, hits: 5 }] } };
    expect(ladderOf(rules).isBossWord(2)).toBe(true);
    expect(ladderOf(doc.rules).isBossWord(1)).toBe(true);
    const custom: SlotDoc = { ...doc, rules };
    const solved = solve(custom, env);
    const next = act(solved, { type: 'continue' }, env);
    expect(next.run.current!.isBoss).toBe(false); // hits 1 is not a boss under the saved ladder
  });
});

describe('content recovery', () => {
  /** A playing document with every word-local effect used, on a known word. */
  function spent(env: SessionEnv, hits = 0, boss = false): SlotDoc {
    let doc = fresh(env);
    if (hits) {
      doc = solve(doc, env);
      doc = act(doc, { type: 'continue' }, env);
    }
    expect(doc.run.current!.isBoss).toBe(boss);
    doc = act(doc, { type: 'power', slot: REVEAL }, env);
    doc = act(doc, { type: 'power', slot: EXTRA_CLUE }, env);
    doc = loseLives(doc, 2, env);
    doc = act(doc, { type: 'power', slot: UNDO }, env);
    doc = act(doc, { type: 'power', slot: REMOVE }, env);
    return doc;
  }

  it('leaves a word that is still in the bank untouched, picking up edited clue text', () => {
    const env = testEnv(16);
    const doc = spent(env);
    const edited = BANK_WORDS.map((w) => (w.id === doc.run.current!.word.id ? { ...w, clue: 'A better clue' } : w));
    const r = reconcileContent(doc, testEnv(16, edited));
    expect(r.kind).toBe('same');
    expect(r.doc.revision).toBe(doc.revision);
    expect(r.doc.run.current!.word.clue).toBe('A better clue');
    expect(r.doc.run.current!.removed).toEqual(doc.run.current!.removed);
  });

  it.each([
    ['missing', (id: string) => BANK_WORDS.filter((w) => w.id !== id)],
    ['answer-changed', (id: string) => BANK_WORDS.map((w) => (w.id === id ? { ...w, answer: 'ZZZ' } : w))],
    ['out-of-pool', (id: string) => BANK_WORDS.map((w) => (w.id === id ? { ...w, difficulty: 'hard' as const } : w))],
  ])('replaces a %s word once, refunds exactly, and keeps earned progress', (cause, edit) => {
    const env = testEnv(17);
    const doc = spent(env, 1, true); // a boss round after one hit
    const play = doc.run.current!;
    const uses = { reveal: play.revealed.length, clue: play.cluesRevealed, remove: Math.ceil(play.removed.length / 3) };
    expect(uses).toEqual({ reveal: 1, clue: 1, remove: 1 });
    const bagBefore = doc.bag.remaining.length;

    const r = reconcileContent(doc, testEnv(18, edit(play.word.id)));
    if (r.kind !== 'migrated') throw new Error(`expected migrated, got ${r.kind}`);
    expect(r.migration).toMatchObject({ cause, replacedWordId: play.word.id });
    expect(r.migration.refunds).toEqual(uses);
    const next = r.doc;
    expect(next.revision).toBe(doc.revision + 1);
    expect(next.run.hits).toBe(doc.run.hits);
    expect(next.run.livesLost).toBe(doc.run.livesLost); // undo's restored life stays
    expect(next.run.status).toBe('playing');
    expect(next.run.current!.isBoss).toBe(true);
    expect(next.run.current!.word.id).not.toBe(play.word.id);
    expect(next.run.current).toMatchObject({ correct: [], wrong: [], undone: [], removed: [], revealed: [], cluesRevealed: 0 });
    // Reveal, clue and remove come back; the spent undo does not.
    expect(next.run.powerUps).toEqual([
      doc.run.powerUps[REVEAL] + 1,
      doc.run.powerUps[EXTRA_CLUE] + 1,
      doc.run.powerUps[UNDO],
      doc.run.powerUps[REMOVE] + 1,
    ]);
    expect(next.bag.remaining.length).toBeLessThanOrEqual(bagBefore);
    expect(next.bag.last).toBe(next.run.current!.word.id);
    expect(parseDoc(serializeDoc(next), 'filmy', 'easy').ok).toBe(true);
    // The replacement is stable: reconciling it again changes nothing.
    expect(reconcileContent(next, testEnv(19, edit(play.word.id))).kind).toBe('same');
  });

  it('refunds a partial remove as one use', () => {
    const env = testEnv(20);
    const doc = fresh(env);
    const play = doc.run.current!;
    const letters = wrongKeys(doc).slice(0, 4); // one full use of 3 plus a partial use of 1
    const withRemoved: SlotDoc = { ...doc, run: { ...doc.run, current: { ...play, removed: letters } } };
    const r = reconcileContent(withRemoved, testEnv(20, BANK_WORDS.filter((w) => w.id !== play.word.id)));
    if (r.kind !== 'migrated') throw new Error('expected migrated');
    expect(r.migration.refunds.remove).toBe(2);
    expect(r.doc.run.powerUps[REMOVE]).toBe(doc.run.powerUps[REMOVE] + 2);
  });

  it('treats solved, milestone and finished stages as immutable history', () => {
    const env = testEnv(21);
    const gone = (doc: SlotDoc) => testEnv(22, BANK_WORDS.filter((w) => w.id !== doc.run.current!.word.id));
    const solved = solve(fresh(env), env);
    const milestone = solve(act(solved, { type: 'continue' }, env), env);
    const lost = loseLives(fresh(env), 9, env);
    const abandoned = act(fresh(env), { type: 'abandon' }, env);
    for (const doc of [solved, milestone, lost, abandoned]) {
      const r = reconcileContent(doc, gone(doc));
      expect(r.kind).toBe('same');
      expect(r.doc).toEqual(doc);
    }
    // Continuing draws the next playable word once, under the saved rules.
    const next = act(milestone, { type: 'continue' }, gone(milestone));
    expect(next.run).toMatchObject({ status: 'playing', hits: 2 });
    expect(next.bag.remaining.length).toBe(milestone.bag.remaining.length - 1);
  });

  it('does not award a second hit or reward when a solved word is edited away', () => {
    const env = testEnv(23);
    const milestone = solve(act(solve(fresh(env), env), { type: 'continue' }, env), env);
    const changed = testEnv(24, BANK_WORDS.map((w) => (w.id === milestone.run.current!.word.id ? { ...w, answer: 'ZZZZ' } : w)));
    const r = reconcileContent(milestone, changed);
    expect(r.doc.run.hits).toBe(2);
    expect(r.doc.run.powerUps).toEqual(milestone.run.powerUps);
    expect(r.doc.run.status).toBe('milestone');
    expect(r.doc.run.current!.word.answer).toBe(milestone.run.current!.word.answer);
  });

  it('reports an empty pool without throwing or changing the run', () => {
    const env = testEnv(25);
    const doc = fresh(env);
    const r = reconcileContent(doc, testEnv(25, []));
    expect(r).toEqual({ kind: 'empty', doc });
  });

  it('replacing a word consumes the bag once and cannot repeat a word within a cycle', () => {
    const env = testEnv(26);
    const doc = fresh(env);
    const play = doc.run.current!;
    const bank = BANK_WORDS.filter((w) => w.id !== play.word.id);
    const a = reconcileContent(doc, testEnv(27, bank));
    if (a.kind !== 'migrated') throw new Error('expected migrated');
    expect(a.doc.bag.remaining).not.toContain(a.doc.run.current!.word.id);
    // Applying the saved result to different RNG does not reroll it.
    expect(reconcileContent(a.doc, testEnv(99, bank)).doc.run.current!.word.id).toBe(a.doc.run.current!.word.id);
  });
});
