import { poolFor } from '@/data/words';
import { word } from '@/game/__tests__/helpers';
import { ALPHABET } from '@/game/answer';
import { defaultGameConfig, ladderFor } from '@/game/gameConfig';
import { applyPowerUp, EXTRA_CLUE, REMOVE, REVEAL, UNDO } from '@/game/powerUps';
import { seededRng } from '@/game/rng';
import { beginWord, lockedLetters, type RunState } from '@/game/run';
import type { Difficulty, Word } from '@/game/types';

import {
  insightChance,
  letterOrder,
  playerFromParams,
  POLICIES,
  PRESETS,
  presetPlayer,
  scriptedPlayer,
  type PresetParams,
} from '../players';
import { bindRules, loadConfig, makePool } from '../rules';
import { simulateBatch } from '../simulate';

const rules = bindRules(defaultGameConfig);
const ORDER = ALPHABET;

/** A run mid-word on `answer`, built with the real rules. */
function runOn(answer: string, opts: { difficulty?: Difficulty; tier?: Difficulty; boss?: boolean; powerUps?: number[]; livesLost?: number } = {}): RunState {
  const difficulty = opts.difficulty ?? 'easy';
  const start = rules.startRun('filmy', difficulty);
  const run = beginWord({ ...start, powerUps: opts.powerUps ?? start.powerUps, livesLost: opts.livesLost ?? 0 }, word(answer, opts.tier ?? 'easy'), opts.boss ?? false);
  return run;
}

function press(run: RunState, letters: string): RunState {
  return [...letters].reduce((r, l) => rules.guess(r, l).run, run);
}

const params = (insight: number, clueBonus = 0): PresetParams => ({ insight: { easy: insight, medium: insight, hard: insight }, clueBonus });

describe('letterOrder', () => {
  it('ranks letters by how many answers contain them, ties alphabetical', () => {
    const pool: Word[] = [word('AB'), word('AC'), word('A B Z')];
    const order = letterOrder(pool);
    expect(order.slice(0, 4)).toEqual(['A', 'B', 'C', 'Z']);
    expect(order.slice(4)).toEqual(ALPHABET.filter((l) => !'ABCZ'.includes(l)));
    expect(order).toHaveLength(26);
  });

  it('counts each answer once per letter and ignores digits and punctuation', () => {
    expect(letterOrder([word('EEE'), word('3 D! E'), word('D')]).slice(0, 2)).toEqual(['D', 'E']);
  });

  it('is built from the real word bank pool', () => {
    const order = letterOrder(poolFor('filmy', 'easy'));
    expect([...order].sort()).toEqual(ALPHABET);
    expect(order[0]).toBe('A');
  });
});

describe('preset player', () => {
  it('never guesses a letter that is locked, removed or already found', () => {
    for (const name of ['casual', 'skilled'] as const) {
      const player = presetPlayer(name, ORDER);
      for (let seed = 0; seed < 60; seed += 1) {
        let run = runOn('KAL HO NAA HO', { powerUps: [0, 0, 0, 3] });
        run = applyPowerUp(run, REMOVE, seededRng(seed)).run;
        const rng = seededRng(seed);
        for (let i = 0; i < 8 && run.status === 'playing'; i += 1) {
          const letter = player.choose(run, rng);
          expect(lockedLetters(run.current!).has(letter)).toBe(false);
          run = rules.guess(run, letter).run;
        }
      }
    }
  });

  it('with no insight, guesses strictly in letter order', () => {
    const order = ['Q', 'W', 'E', 'A', 'J', 'Z', ...ALPHABET.filter((l) => !'QWEAJZ'.includes(l))];
    const player = playerFromParams('blind', params(0), order);
    let run = runOn('JAZZ');
    const picked: string[] = [];
    while (run.status === 'playing') {
      const letter = player.choose(run, seededRng(1));
      picked.push(letter);
      run = rules.guess(run, letter).run;
    }
    // Q, W and E miss; then A, J and Z are right, in letter order.
    expect(picked).toEqual(['Q', 'W', 'E', 'A', 'J', 'Z']);
    expect(run.livesLost).toBe(3);
  });

  it('with full insight, always guesses a letter in the answer, in letter order', () => {
    const player = playerFromParams('sure', params(1), 'ZYXWVUTSRQPONMLKJIHGFEDCBA'.split(''));
    let run = runOn('BADGE');
    const picked: string[] = [];
    while (run.status === 'playing') {
      const letter = player.choose(run, seededRng(3));
      picked.push(letter);
      run = rules.guess(run, letter).run;
    }
    expect(picked).toEqual(['G', 'E', 'D', 'B', 'A']);
    expect(run.livesLost).toBe(0);
  });

  it('uses one roll per guess: under the chance picks a hidden letter, otherwise the next pressable one', () => {
    const player = playerFromParams('half', params(0.5), ORDER);
    const run = runOn('ZEBRA');
    // Hidden letters are A, B, E, R and Z, so under the chance it picks A; at or over it, the first pressable letter, also A.
    expect(player.choose(run, () => 0.49)).toBe('A');
    expect(player.choose(run, () => 0.5)).toBe('A');
    const wordWithoutA = runOn('ZEBU');
    expect(player.choose(wordWithoutA, () => 0.1)).toBe('B');
    expect(player.choose(wordWithoutA, () => 0.9)).toBe('A');
    let count = 0;
    player.choose(wordWithoutA, () => (count += 1, 0.9));
    expect(count).toBe(1);
  });

  it('raises the chance by clueBonus for each clue level on screen, and by Extra Clue', () => {
    const p = PRESETS.casual;
    const easy = runOn('ZEBU');
    expect(insightChance(easy, p)).toBeCloseTo(0.6 + 0.15); // Easy shows the clue
    const unlocked = applyPowerUp(easy, EXTRA_CLUE, seededRng(1)).run;
    expect(insightChance(unlocked, p)).toBeCloseTo(0.6 + 0.3);
    const hard = runOn('ZEBU', { difficulty: 'hard', tier: 'hard' });
    expect(insightChance(hard, p)).toBeCloseTo(0.3); // Hard hides both clues
    const hardOne = applyPowerUp(hard, EXTRA_CLUE, seededRng(1)).run;
    expect(insightChance(hardOne, p)).toBeCloseTo(0.3 + 0.15);
    const medium = runOn('ZEBU', { difficulty: 'medium', tier: 'medium' });
    expect(insightChance(medium, PRESETS.skilled)).toBeCloseTo(0.6 + 0.15);
    expect(insightChance(easy, params(0.95, 0.5))).toBe(1);
  });

  it('uses the tier of the word on screen, not the run difficulty', () => {
    const run = runOn('ZEBU', { difficulty: 'medium', tier: 'easy' });
    expect(insightChance(run, PRESETS.casual)).toBeCloseTo(0.6 + 0.15);
  });

  it('describes every parameter in the header lines', () => {
    const text = presetPlayer('skilled', ORDER).describe.join('\n');
    expect(text).toContain('0.75');
    expect(text).toContain('0.6');
    expect(text).toContain('0.45');
    expect(text).toContain('clueBonus 0.15');
    expect(text).toContain(ALPHABET.join(''));
  });
});

describe('scripted players', () => {
  it('perfect never misses', () => {
    const p = scriptedPlayer('perfect');
    let run = runOn('RAAZI 2!');
    while (run.status === 'playing') run = rules.guess(run, p.choose(run, seededRng(1))).run;
    expect(run.livesLost).toBe(0);
    expect(run.status).toBe('solved');
  });

  it('oneMiss misses first on each word, then solves it', () => {
    const p = scriptedPlayer('oneMiss');
    let run = runOn('RAAZI');
    while (run.status === 'playing') run = rules.guess(run, p.choose(run, seededRng(1))).run;
    expect(run.livesLost).toBe(1);
    expect(run.current!.wrong).toEqual(['B']);
    expect(run.status).toBe('solved');
  });
});

describe('policies', () => {
  const direct = (run: RunState, slot: 0 | 1 | 2 | 3) => applyPowerUp(run, slot, seededRng(9), ladderFor(defaultGameConfig), defaultGameConfig);

  it('none never uses a power-up', () => {
    const run = press(runOn('ZEBU', { livesLost: 8 }), 'Q');
    expect(POLICIES.none.choose(run, rules)).toBeNull();
    expect(POLICIES.none.triggers.join(' ')).toContain('never');
  });

  describe('greedy', () => {
    it('undoes right after a miss', () => {
      const run = press(runOn('ZEBU'), 'Q');
      expect(POLICIES.greedy.choose(run, rules)).toBe(UNDO);
    });

    it('does not undo with no stock, and falls through to the next rule', () => {
      const run = press(runOn('ZEBU', { powerUps: [2, 1, 0, 1] }), 'Q');
      expect(POLICIES.greedy.choose(run, rules)).toBe(EXTRA_CLUE);
    });

    it('reveals on the last life, or removes if Reveal cannot be used', () => {
      expect(POLICIES.greedy.choose(runOn('ZEBU', { livesLost: 8, powerUps: [1, 0, 0, 1] }), rules)).toBe(REVEAL);
      expect(POLICIES.greedy.choose(runOn('ZEBU', { livesLost: 8, powerUps: [0, 0, 0, 1] }), rules)).toBe(REMOVE);
      expect(POLICIES.greedy.choose(runOn('ZEBU', { livesLost: 8, powerUps: [0, 0, 0, 0] }), rules)).toBeNull();
    });

    it('opens a locked clue level, and stops when none is locked', () => {
      const run = runOn('ZEBU');
      expect(POLICIES.greedy.choose(run, rules)).toBe(EXTRA_CLUE);
      const opened = applyPowerUp(run, EXTRA_CLUE, seededRng(1)).run;
      expect(POLICIES.greedy.choose(opened, rules)).toBeNull();
    });

    it('does nothing on a spare life when no clue is locked and stock is not needed', () => {
      const run = applyPowerUp(runOn('ZEBU'), EXTRA_CLUE, seededRng(1)).run;
      expect(POLICIES.greedy.choose(run, rules)).toBeNull();
    });

    it('its choice matches a direct applyPowerUp call with the same rng', () => {
      const run = press(runOn('ZEBU'), 'Q');
      const slot = POLICIES.greedy.choose(run, rules)!;
      expect(rules.applyPowerUp(run, slot, seededRng(9))).toEqual(direct(run, slot));
    });
  });

  describe('save-for-boss', () => {
    it('keeps power-ups on an ordinary word while lives remain', () => {
      expect(POLICIES['save-for-boss'].choose(runOn('ZEBU'), rules)).toBeNull();
      const missed = press(runOn('ZEBU'), 'Q');
      expect(POLICIES['save-for-boss'].choose(missed, rules)).toBeNull();
    });

    it('on the last life of an ordinary word, undoes or reveals, and never removes or opens clues', () => {
      const missed = press(runOn('ZEBU', { livesLost: 7 }), 'Q');
      expect(rules.livesLeft(missed)).toBe(1);
      expect(POLICIES['save-for-boss'].choose(missed, rules)).toBe(UNDO);
      expect(POLICIES['save-for-boss'].choose(runOn('ZEBU', { livesLost: 8, powerUps: [1, 1, 0, 1] }), rules)).toBe(REVEAL);
      expect(POLICIES['save-for-boss'].choose(runOn('ZEBU', { livesLost: 8, powerUps: [0, 1, 0, 1] }), rules)).toBeNull();
    });

    it('on a boss word, follows the greedy rules', () => {
      const boss = runOn('ZEBU', { boss: true });
      expect(POLICIES['save-for-boss'].choose(boss, rules)).toBe(EXTRA_CLUE);
      expect(POLICIES['save-for-boss'].choose(press(boss, 'Q'), rules)).toBe(UNDO);
    });
  });

  describe('recorded in a run', () => {
    const pool = makePool(poolFor('filmy', 'easy'));
    const base = { rules, theme: 'filmy', difficulty: 'easy', runs: 1, seed: 4, cap: 3, bags: 'carry', pool } as const;

    it('logs each use with its slot, word, boss flag and lives before', () => {
      const { records } = simulateBatch({ ...base, player: scriptedPlayer('oneMiss'), policy: POLICIES.greedy });
      const uses = records[0].uses;
      expect(uses.slice(0, 2).map((u) => [u.slot, u.wordIndex, u.boss, u.livesBefore])).toEqual([
        [EXTRA_CLUE, 0, false, 9],
        [UNDO, 0, false, 8],
      ]);
    });

    it('none records no uses', () => {
      const { records } = simulateBatch({ ...base, player: scriptedPlayer('oneMiss'), policy: POLICIES.none });
      expect(records[0].uses).toEqual([]);
    });

    it('records how many letters Remove actually took off', () => {
      const loaded = loadConfig({ lives: { easy: 1 }, startPowerUps: [0, 0, 0, 1], removeWrongCount: 4 });
      if (!loaded.ok) throw new Error('config');
      const { records } = simulateBatch({ ...base, rules: bindRules(loaded.config), player: scriptedPlayer('perfect'), policy: POLICIES.greedy, cap: 1 });
      const remove = records[0].uses.filter((u) => u.slot === REMOVE);
      expect(remove).toHaveLength(1);
      expect(remove[0].removed).toBe(4);
      expect(remove[0].livesBefore).toBe(1);
    });

    it('a Reveal that finishes the last word of a run ends the word without a guess', () => {
      const loaded = loadConfig({ lives: { easy: 1 }, startPowerUps: [50, 0, 0, 0] });
      if (!loaded.ok) throw new Error('config');
      const { records } = simulateBatch({ ...base, rules: bindRules(loaded.config), player: scriptedPlayer('oneMiss'), policy: POLICIES.greedy, cap: 2 });
      expect(records[0].outcome).toBe('capped');
      expect(records[0].uses.every((u) => u.slot === REVEAL)).toBe(true);
    });
  });
});
