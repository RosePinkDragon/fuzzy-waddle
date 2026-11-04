import fs from 'node:fs';
import path from 'node:path';

import { poolFor } from '@/data/words';
import { word } from '@/game/__tests__/helpers';
import { defaultGameConfig, mergeGameConfig, type GameConfigOverride } from '@/game/gameConfig';
import { REVEAL } from '@/game/powerUps';
import { seededRng } from '@/game/rng';
import { beginWord } from '@/game/run';
import type { Word } from '@/game/types';

import { POLICIES, scriptedPlayer, type Player } from '../players';
import { bindRules, drawWord, loadConfig, makePool, type PoolInfo } from '../rules';
import { mixSeed, simulateBatch, STREAM, type BagMode, type BatchOptions } from '../simulate';

const FILMY_EASY = makePool(poolFor('filmy', 'easy'));

function options(over: Partial<BatchOptions> & { config?: GameConfigOverride } = {}): BatchOptions {
  const { config, ...rest } = over;
  const loaded = loadConfig(config ?? {});
  if (!loaded.ok) throw new Error(loaded.errors.join('; '));
  return {
    rules: bindRules(loaded.config),
    theme: 'filmy',
    difficulty: 'easy',
    runs: 5,
    seed: 7,
    cap: 30,
    bags: 'carry',
    player: scriptedPlayer('perfect'),
    policy: POLICIES.none,
    pool: FILMY_EASY,
    ...rest,
  };
}

describe('simulateBatch', () => {
  it('plays exactly the requested number of runs', () => {
    const { records } = simulateBatch(options({ runs: 1000, cap: 3 }));
    expect(records).toHaveLength(1000);
    expect(records.map((r) => r.runIndex)).toEqual(Array.from({ length: 1000 }, (_, i) => i));
  });

  it('gives identical results for identical inputs, and never touches Math.random', () => {
    const spy = jest.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random must not be used');
    });
    try {
      const player: Player = { ...scriptedPlayer('oneMiss'), name: 'x' };
      const a = simulateBatch(options({ runs: 30, player, policy: POLICIES.greedy }));
      const b = simulateBatch(options({ runs: 30, player, policy: POLICIES.greedy }));
      expect(JSON.stringify(b.records)).toBe(JSON.stringify(a.records));
    } finally {
      spy.mockRestore();
    }
  });

  it('changes the word sequence with the seed', () => {
    const a = simulateBatch(options({ seed: 1 })).records[0].wordIds;
    const b = simulateBatch(options({ seed: 2 })).records[0].wordIds;
    expect(a).not.toEqual(b);
  });

  it('keeps game draws on their own stream: the player consuming rolls does not change the words', () => {
    const base = scriptedPlayer('perfect');
    const greedyForRolls: Player = {
      ...base,
      choose(run, rng) {
        for (let i = 0; i < 5; i += 1) rng();
        return base.choose(run, rng);
      },
    };
    const a = simulateBatch(options({ runs: 8, player: base }));
    const b = simulateBatch(options({ runs: 8, player: greedyForRolls }));
    expect(b.records.map((r) => r.wordIds)).toEqual(a.records.map((r) => r.wordIds));
  });

  it('derives different seeds for each stream, run and word', () => {
    const seeds = new Set([
      mixSeed(7, 0, STREAM.draw),
      mixSeed(7, 0, STREAM.effect),
      mixSeed(7, 0, STREAM.player),
      mixSeed(7, 1, STREAM.draw),
      mixSeed(8, 0, STREAM.draw),
    ]);
    expect(seeds.size).toBe(5);
  });

  describe('paired comparison', () => {
    it('follows the same words until a changed setting alters the path', () => {
      const current = simulateBatch(options({ runs: 6 }));
      const proposed = simulateBatch(options({ runs: 6, config: { bossCandidates: 1 } }));
      for (let i = 0; i < 6; i += 1) {
        // The first boss is the 10th word, so the first 9 draws don't depend on bossCandidates.
        expect(proposed.records[i].wordIds.slice(0, 9)).toEqual(current.records[i].wordIds.slice(0, 9));
      }
    });
  });

  describe('golden runs', () => {
    it('Easy, one wrong guess per word, no power-ups: every run is lost on word 9 with 8 hits and no club', () => {
      const { records } = simulateBatch(options({ runs: 40, cap: 120, player: scriptedPlayer('oneMiss') }));
      expect(records).toHaveLength(40);
      for (const r of records) {
        expect(r.outcome).toBe('lost');
        expect(r.words).toBe(9);
        expect(r.hits).toBe(8);
        expect(r.clubs).toBe(0);
      }
    });

    it('a player who never misses loses no life, wins every boss and is capped, not lost', () => {
      const { records } = simulateBatch(options({ runs: 20, cap: 45 }));
      for (const r of records) {
        expect(r.outcome).toBe('capped');
        expect(r.words).toBe(45);
        expect(r.hits).toBe(45);
        expect(r.misses.every((m) => m === 0)).toBe(true);
        expect(r.bosses.map((b) => b.wordIndex)).toEqual([9, 19, 34]);
        expect(r.bosses.every((b) => b.won)).toBe(true);
        expect(r.clubs).toBe(3);
      }
    });

    it('one more life lasts at least as long with the same scripted guesses', () => {
      const lastedWords = (difficulty: 'easy' | 'medium', lives: number) =>
        simulateBatch(
          options({
            difficulty,
            theme: 'filmy',
            runs: 10,
            cap: 120,
            player: scriptedPlayer('oneMiss'),
            pool: makePool(poolFor('filmy', difficulty)),
            config: { lives: { [difficulty]: lives } },
          }),
        ).records.map((r) => r.words);
      // `lives.easy` is already 9, the most the validator allows, so the +1 step is 8 -> 9.
      const easy8 = lastedWords('easy', 8);
      const easy9 = lastedWords('easy', 9);
      const medium7 = lastedWords('medium', 7);
      const medium8 = lastedWords('medium', 8);
      easy8.forEach((n, i) => expect(easy9[i]).toBeGreaterThanOrEqual(n));
      medium7.forEach((n, i) => expect(medium8[i]).toBeGreaterThanOrEqual(n));
      expect(easy8[0]).toBe(8);
      expect(easy9[0]).toBe(9);
      expect(medium7[0]).toBe(7);
      expect(medium8[0]).toBe(8);
    });
  });

  describe('config wiring', () => {
    const ladder = { ladder: [{ crore: 50, hits: 5 }, { crore: 100, hits: 12 }] };

    it('puts boss words at the injected ladder: hits 5 and 12 give word 5 and word 12', () => {
      const { records } = simulateBatch(options({ runs: 5, cap: 14, config: ladder }));
      for (const r of records) {
        expect(r.bosses.map((b) => [b.club, b.wordIndex + 1])).toEqual([
          [0, 5],
          [1, 12],
        ]);
        expect(r.clubs).toBe(2);
      }
    });

    it('hands the ladder to applyPowerUp: a Reveal that finishes the boss at 4 hits enters the 50 Cr club', () => {
      const loaded = loadConfig({ ...ladder, startPowerUps: [40, 0, 0, 0] });
      if (!loaded.ok) throw new Error('config');
      const rules = bindRules(loaded.config);
      let run = rules.startRun('filmy', 'easy');
      run = { ...run, hits: 4 };
      expect(rules.nextIsBoss(run)).toBe(true);
      const drawn = drawWord(rules, run, { remaining: [] }, FILMY_EASY, seededRng(1));
      expect(drawn.boss).toBe(true);
      run = drawn.run;
      while (run.status === 'playing') run = rules.applyPowerUp(run, REVEAL, seededRng(2)).run;
      expect(run.status).toBe('milestone');
      expect(run.hits).toBe(5);
      expect(run.lastClub?.crore).toBe(50);
    });

    it('starts each run from the injected power-up counts', () => {
      const loaded = loadConfig({ startPowerUps: [5, 6, 7, 8] });
      if (!loaded.ok) throw new Error('config');
      expect(bindRules(loaded.config).startRun('filmy', 'easy').powerUps).toEqual([5, 6, 7, 8]);
      expect(bindRules(defaultGameConfig).startRun('filmy', 'easy').powerUps).toEqual([2, 1, 1, 1]);
    });

    it('does not let one run change the config the next run sees', () => {
      const loaded = loadConfig({ startPowerUps: [3, 3, 3, 3], lives: { easy: 6 } });
      if (!loaded.ok) throw new Error('config');
      const before = JSON.parse(JSON.stringify(loaded.config));
      const rules = bindRules(loaded.config);
      const run = () => simulateBatch({ ...options({ runs: 20, policy: POLICIES.greedy, player: scriptedPlayer('oneMiss') }), rules });
      const first = run();
      const second = run();
      expect(loaded.config).toEqual(before);
      expect(Object.isFrozen(loaded.config)).toBe(true);
      expect(Object.isFrozen(loaded.config.lives)).toBe(true);
      expect(Object.isFrozen(loaded.config.startPowerUps)).toBe(true);
      expect(JSON.stringify(second.records)).toBe(JSON.stringify(first.records));
    });
  });

  describe('bags', () => {
    const pool = (n: number): PoolInfo => makePool(Array.from({ length: n }, (_, i): Word => word(`WORD ${'X'.repeat(i + 1)}`, 'easy', `t${i}`)));
    const play = (bags: BagMode, size: number, cap: number, runs: number) =>
      simulateBatch(options({ bags, runs, cap, pool: pool(size), seed: 3, config: { ladder: [{ crore: 50, hits: 900 }, { crore: 100, hits: 901 }] } })).records;

    it('carry: one bag cycle runs across run boundaries with no repeats inside a cycle', () => {
      const records = play('carry', 3, 2, 9);
      const flat = records.flatMap((r) => r.wordIds);
      for (let i = 0; i + 3 <= flat.length; i += 3) expect(new Set(flat.slice(i, i + 3)).size).toBe(3);
      // Run 1 starts with the word run 0 left in the bag.
      const left = ['t0', 't1', 't2'].find((id) => !records[0].wordIds.includes(id));
      expect(records[1].wordIds[0]).toBe(left);
      expect(records.every((r) => r.repeats === 0)).toBe(true);
    });

    it('reset: each run starts with a fresh cycle, so cycles no longer line up across runs', () => {
      const cycles = (rs: ReturnType<typeof play>) => {
        const flat = rs.flatMap((r) => r.wordIds);
        let whole = 0;
        for (let i = 0; i + 3 <= flat.length; i += 3) whole += new Set(flat.slice(i, i + 3)).size === 3 ? 1 : 0;
        return whole;
      };
      const carry = play('carry', 3, 2, 30);
      const reset = play('reset', 3, 2, 30);
      expect(cycles(carry)).toBe(20);
      expect(cycles(reset)).toBeLessThan(20);
      expect(reset.every((r) => r.repeats === 0)).toBe(true);
      // A reset run can start with a word the previous run just played; a carried bag can't until it refills.
      const first = play('reset', 3, 2, 1)[0].wordIds;
      expect(new Set(first).size).toBe(2);
    });

    it('counts a repeat when a run outlasts the pool (hand trace)', () => {
      // Pool of 2: words 1-2 fill the cycle, word 3 starts the next one and must repeat.
      expect(play('carry', 2, 3, 1)[0].repeats).toBe(1);
      expect(play('reset', 2, 5, 1)[0].repeats).toBe(3);
      expect(play('carry', 4, 3, 1)[0].repeats).toBe(0);
    });
  });
});

describe('rule wiring', () => {
  const dir = path.resolve(__dirname, '..');
  const RULE_NAMES = ['startRun', 'nextIsBoss', 'drawBoss', 'guess', 'applyPowerUp', 'ladderFor', 'maxLives', 'livesLeft', 'settleIfSolved'];

  it('only rules.ts imports the game functions that take a config or ladder', () => {
    const offenders: string[] = [];
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
      if (file === 'rules.ts') continue;
      const text = fs.readFileSync(path.join(dir, file), 'utf8');
      for (const m of text.matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*'(?:@\/game|\.\.?\/)[^']*'/g)) {
        const names = m[1].split(',').map((n) => n.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0]);
        for (const n of names) if (RULE_NAMES.includes(n)) offenders.push(`${file}: ${n}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('never reads Math.random or the clock', () => {
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
      const text = fs.readFileSync(path.join(dir, file), 'utf8');
      expect(text).not.toMatch(/Math\.random|Date\.now|new Date|defaultRng/);
    }
  });
});

describe('drawWord', () => {
  it('draws a boss word when the next hit enters a club, and a normal word otherwise', () => {
    const rules = bindRules(defaultGameConfig);
    const rng = seededRng(5);
    const start = rules.startRun('filmy', 'easy');
    const first = drawWord(rules, start, { remaining: [] }, FILMY_EASY, rng);
    expect(first.boss).toBe(false);
    expect(first.bossBagSize).toBeUndefined();
    const atNine = drawWord(rules, { ...start, hits: 9 }, { remaining: [] }, FILMY_EASY, rng);
    expect(atNine.boss).toBe(true);
    expect(atNine.run.current?.isBoss).toBe(true);
    expect(atNine.bossBagSize).toBe(FILMY_EASY.ids.length);
    expect(beginWord(start, atNine.run.current!.word, true).current?.word.id).toBe(atNine.run.current?.word.id);
  });

  it('only uses the injected settings, not the live ones', () => {
    const cfg = mergeGameConfig(defaultGameConfig, { bossCandidates: 1 });
    const rules = bindRules(cfg);
    const hardest = [...FILMY_EASY.words].sort((a, b) => b.answer.length - a.answer.length)[0];
    const seen = new Set<string>();
    for (let s = 0; s < 30; s += 1) {
      const d = drawWord(rules, { ...rules.startRun('filmy', 'easy'), hits: 9 }, { remaining: [] }, FILMY_EASY, seededRng(s));
      seen.add(d.run.current!.word.id);
    }
    expect(seen.size).toBe(1);
    expect(hardest).toBeDefined();
  });
});
