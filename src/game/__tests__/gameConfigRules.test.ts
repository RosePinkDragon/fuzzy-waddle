import { ALPHABET, lettersOf } from '../answer';
import {
  BOSS_CANDIDATES,
  CLUB_LADDER,
  DIFFICULTY_ORDER,
  DIFFICULTY_RULES,
  LADDER_EXTENSION,
  MILESTONE_REWARD,
  REMOVE_WRONG_COUNT,
  START_POWER_UPS,
} from '../config';
import { lifeMarks, rulesFor } from '../difficulty';
import { defaultGameConfig, ladderFor, mergeGameConfig, type GameConfig, type GameConfigOverride } from '../gameConfig';
import { ladder as liveLadder } from '../milestones';
import { REMOVE, REVEAL, UNDO, applyPowerUp, canUse, type PowerUpSlot } from '../powerUps';
import { seededRng } from '../rng';
import { beginWord, continueRun, guess, livesLeft, maxLives, nextIsBoss, startRun, type RunState } from '../run';
import { drawBoss, drawNext, emptyBag, type BagState } from '../shuffleBag';
import type { Difficulty, Word } from '../types';
import { word } from './helpers';

function withConfig(override: GameConfigOverride): GameConfig {
  return mergeGameConfig(defaultGameConfig, override);
}

const POOL: Word[] = [
  'DON', 'PK', 'SHOLAY', 'DANGAL', 'LAGAAN', 'KABIR SINGH', 'DDLJ', '3 IDIOTS', 'GULLY BOY', 'SWADES',
  'KAL HO NAA HO', 'ZINDAGI NA MILEGI DOBARA', 'RRR', 'MOTHER INDIA', 'BARFI!', 'QUEEN', 'ANDHADHUN',
  'TAARE ZAMEEN PAR', 'PIKU', 'RAAZI', 'DEVDAS', 'GADAR', 'KGF', 'JAWAN', 'PATHAAN', 'DHOOM', 'KOI MIL GAYA',
  'HUM DIL DE CHUKE SANAM', 'OM SHANTI OM', 'CHAK DE! INDIA', 'LAGE RAHO MUNNA BHAI', 'DILWALE', 'BAAHUBALI',
  'ROCKSTAR', 'WAKE UP SID', 'JAB WE MET', 'SWADES', 'GUIDE', 'AAN', 'BLACK',
].map((a, i) => word(a, DIFFICULTY_ORDER[i % 3], `w-${i}`));

interface Step {
  status: RunState['status'];
  hits: number;
  livesLost: number;
  powerUps: number[];
  id?: string;
  action: string;
}

/** Plays one seeded run, passing the config only when given. Returns every step taken. */
function playRun(seed: number, difficulty: Difficulty, cfg?: GameConfig, maxWords = 70): Step[] {
  const rng = seededRng(seed);
  const ladder = cfg && ladderFor(cfg);
  const trace: Step[] = [];
  const ids = POOL.map((w) => w.id);
  let bag: BagState = emptyBag();
  let run = startRun('filmy', difficulty, cfg?.startPowerUps);
  for (let n = 0; n < maxWords && run.status !== 'over'; n += 1) {
    const boss = nextIsBoss(run, ladder);
    const drawn = boss ? drawBoss(bag, POOL, rng, cfg?.bossCandidates) : drawNext(bag, ids, rng);
    bag = drawn.bag;
    run = beginWord(run, POOL.find((w) => w.id === drawn.id)!, boss);
    for (let step = 0; step < 80 && run.status === 'playing'; step += 1) {
      const slots = ([0, 1, 2, 3] as PowerUpSlot[]).filter((s) => canUse(run, s));
      if (slots.length && rng() < 0.15) {
        const slot = slots[Math.floor(rng() * slots.length)];
        const out = applyPowerUp(run, slot, rng, ladder, cfg);
        run = out.run;
        trace.push({ status: run.status, hits: run.hits, livesLost: run.livesLost, powerUps: run.powerUps, action: `p${slot}` });
        continue;
      }
      const hidden = [...lettersOf(run.current!.word.answer)].filter((l) => !run.current!.correct.includes(l));
      const letter = rng() < 0.85 ? hidden[Math.floor(rng() * hidden.length)] : ALPHABET[Math.floor(rng() * 26)];
      const out = guess(run, letter, ladder, cfg);
      run = out.run;
      trace.push({ status: run.status, hits: run.hits, livesLost: run.livesLost, powerUps: run.powerUps, id: drawn.id, action: `g${letter}${out.result}` });
    }
    run = continueRun(run);
  }
  return trace;
}

describe('defaultGameConfig', () => {
  it('is built from the live constants', () => {
    for (const d of DIFFICULTY_ORDER) expect(defaultGameConfig.lives[d]).toBe(DIFFICULTY_RULES[d].lives);
    expect(defaultGameConfig.ladder).toEqual(CLUB_LADDER);
    expect(defaultGameConfig.ladderExtension).toEqual(LADDER_EXTENSION);
    expect(defaultGameConfig.startPowerUps).toEqual(START_POWER_UPS);
    expect(defaultGameConfig.milestoneReward).toEqual(MILESTONE_REWARD);
    expect(defaultGameConfig.removeWrongCount).toBe(REMOVE_WRONG_COUNT);
    expect(defaultGameConfig.bossCandidates).toBe(BOSS_CANDIDATES);
  });

  it('is frozen all the way down', () => {
    expect(Object.isFrozen(defaultGameConfig)).toBe(true);
    expect(Object.isFrozen(defaultGameConfig.lives)).toBe(true);
    expect(Object.isFrozen(defaultGameConfig.ladder)).toBe(true);
    expect(Object.isFrozen(defaultGameConfig.ladder[0])).toBe(true);
    expect(Object.isFrozen(defaultGameConfig.ladderExtension.croreSteps)).toBe(true);
    expect(Object.isFrozen(defaultGameConfig.milestoneReward)).toBe(true);
    expect(() => (defaultGameConfig.startPowerUps as number[]).push(1)).toThrow();
    try {
      (defaultGameConfig.lives as Record<string, number>).easy = 1;
    } catch {
      // Strict mode throws; sloppy mode ignores the write. Either way the value must hold.
    }
    expect(defaultGameConfig.lives.easy).toBe(9);
  });

  it('is not changed by a merged copy, and never reaches the live rules', () => {
    const merged = withConfig({ lives: { easy: 2 }, startPowerUps: [9, 9, 9, 9] });
    (merged.lives as Record<string, number>).easy = 1;
    (merged.startPowerUps as number[]).length = 0;
    (merged.ladder[0] as { hits: number }).hits = 1;
    expect(defaultGameConfig.lives.easy).toBe(9);
    expect(defaultGameConfig.startPowerUps).toEqual(START_POWER_UPS);
    expect(defaultGameConfig.ladder[0].hits).toBe(10);
    expect(rulesFor('easy').lives).toBe(9);
    expect(lifeMarks('easy', 0)).toEqual(Array(9).fill('live'));
    expect(startRun('filmy', 'easy').powerUps).toEqual([2, 1, 1, 1]);
  });

  it('ignores EXPO_PUBLIC_TEST_LADDER, which only the live ladder honours', () => {
    const before = process.env.EXPO_PUBLIC_TEST_LADDER;
    process.env.EXPO_PUBLIC_TEST_LADDER = '1';
    try {
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const live = require('../milestones').ladder;
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const cfg = require('../gameConfig').defaultGameConfig;
        expect(live.clubAt(0).hits).toBe(2);
        expect(cfg.ladder[0].hits).toBe(10);
      });
    } finally {
      if (before === undefined) delete process.env.EXPO_PUBLIC_TEST_LADDER;
      else process.env.EXPO_PUBLIC_TEST_LADDER = before;
    }
    expect(liveLadder.clubAt(0).hits).toBe(10);
  });
});

describe('default equivalence', () => {
  it('gives the same seeded runs with no config and with the default passed explicitly', () => {
    let milestones = 0;
    for (const difficulty of DIFFICULTY_ORDER) {
      for (let seed = 1; seed <= 25; seed += 1) {
        const implicit = playRun(seed, difficulty);
        const explicit = playRun(seed, difficulty, defaultGameConfig);
        expect(explicit).toEqual(implicit);
        milestones += implicit.filter((s) => s.status === 'milestone').length;
      }
    }
    // The comparison must cover boss rounds, or it proves little.
    expect(milestones).toBeGreaterThan(0);
  });

  it('uses the default config when undefined is passed', () => {
    expect(playRun(3, 'medium', undefined)).toEqual(playRun(3, 'medium', defaultGameConfig));
  });
});

describe('lives setting', () => {
  const cfg = withConfig({ lives: { easy: 3 } });

  it('changes max lives and ends the run sooner', () => {
    expect(maxLives({ difficulty: 'easy' }, cfg)).toBe(3);
    expect(maxLives({ difficulty: 'medium' }, cfg)).toBe(7);
    let withCfg = beginWord(startRun('filmy', 'easy'), word('DON'), false);
    let live = withCfg;
    for (const l of ['Z', 'Q', 'X']) {
      withCfg = guess(withCfg, l, undefined, cfg).run;
      live = guess(live, l).run;
    }
    expect(withCfg.status).toBe('over');
    expect(live.status).toBe('playing');
    expect(livesLeft(withCfg, cfg)).toBe(0);
    expect(livesLeft(live)).toBe(6);
  });

  it('refills to the configured lives after a boss round, even from the last life', () => {
    const lad = ladderFor(withConfig({ lives: { easy: 3 }, ladder: [{ crore: 50, hits: 1 }, { crore: 100, hits: 5 }] }));
    let run = beginWord(startRun('filmy', 'easy'), word('DON'), true);
    run = guess(run, 'Z', lad, cfg).run;
    run = guess(run, 'Q', lad, cfg).run;
    expect(livesLeft(run, cfg)).toBe(1);
    for (const l of ['D', 'O', 'N']) run = guess(run, l, lad, cfg).run;
    expect(run.status).toBe('milestone');
    expect(run.livesLost).toBe(0);
    expect(livesLeft(run, cfg)).toBe(3);
  });

  it('does not change the lives sign', () => {
    expect(lifeMarks('easy', 0)).toEqual(Array(9).fill('live'));
  });
});

describe('ladder setting', () => {
  it('moves the boss rounds and the club a boss enters', () => {
    const cfg = withConfig({ ladder: [{ crore: 50, hits: 2 }, { crore: 100, hits: 4 }] });
    const lad = ladderFor(cfg);
    const run = { ...startRun('filmy', 'easy'), hits: 1 };
    expect(nextIsBoss(run, lad)).toBe(true);
    expect(nextIsBoss(run)).toBe(false);
    let boss = beginWord(run, word('DON'), true);
    for (const l of ['D', 'O', 'N']) boss = guess(boss, l, lad, cfg).run;
    expect(boss.lastClub?.crore).toBe(50);
    expect(boss.hits).toBe(2);
  });

  it('changes how the ladder continues past its last rung', () => {
    const base = ladderFor(defaultGameConfig);
    expect([5, 6, 7].map((i) => base.clubAt(i))).toEqual([
      { index: 5, crore: 1500, hits: 110 },
      { index: 6, crore: 2000, hits: 145 },
      { index: 7, crore: 3000, hits: 185 },
    ]);
    const flat = ladderFor(withConfig({ ladderExtension: { gapGrowth: 0, croreSteps: [], croreEvery: 250 } }));
    expect([5, 6, 7].map((i) => flat.clubAt(i))).toEqual([
      { index: 5, crore: 1250, hits: 105 },
      { index: 6, crore: 1500, hits: 130 },
      { index: 7, crore: 1750, hits: 155 },
    ]);
  });

  it('does not change the live ladder', () => {
    ladderFor(withConfig({ ladder: [{ crore: 1, hits: 1 }, { crore: 2, hits: 2 }] }));
    expect(liveLadder.clubAt(0)).toEqual({ index: 0, crore: 50, hits: 10 });
  });
});

describe('start power-ups setting', () => {
  it('sets the counts a run starts with', () => {
    const cfg = withConfig({ startPowerUps: [0, 3, 0, 4] });
    expect(startRun('khana', 'hard', cfg.startPowerUps).powerUps).toEqual([0, 3, 0, 4]);
  });
});

describe('milestone reward setting', () => {
  const cfg = withConfig({
    milestoneReward: { slot: 3, amount: 2 },
    ladder: [{ crore: 50, hits: 1 }, { crore: 100, hits: 5 }],
  });
  const lad = ladderFor(cfg);

  it('goes to the configured slot when a guess clears a boss round', () => {
    let run = beginWord(startRun('filmy', 'easy', [1, 1, 1, 1]), word('PK'), true);
    for (const l of ['P', 'K']) run = guess(run, l, lad, cfg).run;
    expect(run.status).toBe('milestone');
    expect(run.powerUps).toEqual([1, 1, 1, 3]);
  });

  it('goes to the configured slot when Reveal clears a boss round', () => {
    let run = beginWord(startRun('filmy', 'easy', [1, 1, 1, 1]), word('PK'), true);
    run = guess(run, 'P', lad, cfg).run;
    run = applyPowerUp(run, REVEAL, seededRng(1), lad, cfg).run;
    expect(run.status).toBe('milestone');
    expect(run.powerUps).toEqual([0, 1, 1, 3]);
  });

  it('gives the live reward when no config is passed', () => {
    let run = beginWord(startRun('filmy', 'easy', [1, 1, 1, 1]), word('PK'), true);
    for (const l of ['P', 'K']) run = guess(run, l, lad).run;
    expect(run.powerUps).toEqual([2, 1, 1, 1]);
  });
});

describe('remove count setting', () => {
  it('changes how many letters Remove takes off', () => {
    const run = beginWord(startRun('filmy', 'easy'), word('DON'), false);
    const five = applyPowerUp(run, REMOVE, seededRng(2), undefined, withConfig({ removeWrongCount: 5 }));
    expect(five.effect).toMatchObject({ slot: 3 });
    expect((five.effect as { letters: string[] }).letters).toHaveLength(5);
    expect(five.run.current!.removed).toHaveLength(5);
    const live = applyPowerUp(run, REMOVE, seededRng(2));
    expect((live.effect as { letters: string[] }).letters).toHaveLength(3);
  });

  it('never removes a letter from the answer', () => {
    const run = beginWord(startRun('filmy', 'easy'), word('DON'), false);
    const out = applyPowerUp(run, REMOVE, seededRng(5), undefined, withConfig({ removeWrongCount: 99 }));
    const letters = (out.effect as { letters: string[] }).letters;
    expect(letters).toHaveLength(23);
    expect(letters).not.toContain('D');
  });

  it('leaves Undo alone', () => {
    let run = beginWord(startRun('filmy', 'easy'), word('DON'), false);
    run = guess(run, 'Z').run;
    expect(canUse(run, UNDO)).toBe(true);
  });
});

describe('boss candidates setting', () => {
  const pool = ['AB', 'ABC', 'ABCD', 'ABCDE', 'ABCDEF'].map((a, i) => word(a, 'easy', `b-${i}`));

  it('with 1 candidate always picks the top boss word', () => {
    const cfg = withConfig({ bossCandidates: 1 });
    for (let seed = 0; seed < 30; seed += 1) {
      expect(drawBoss(emptyBag(), pool, seededRng(seed), cfg.bossCandidates).id).toBe('b-4');
    }
  });

  it('with the default spreads over the top three', () => {
    const picked = new Set<string>();
    for (let seed = 0; seed < 60; seed += 1) {
      picked.add(drawBoss(emptyBag(), pool, seededRng(seed), defaultGameConfig.bossCandidates).id);
    }
    expect([...picked].sort()).toEqual(['b-2', 'b-3', 'b-4']);
  });
});
