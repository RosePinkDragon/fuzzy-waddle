import { poolFor } from '@/data/words';
import { defaultGameConfig, type GameConfigOverride } from '@/game/gameConfig';
import { EXTRA_CLUE, REMOVE, REVEAL, UNDO } from '@/game/powerUps';

import { runCli, USAGE, type Io } from '../cli';
import { letterOrder, POLICIES, presetPlayer, scriptedPlayer, type Player, type Policy } from '../players';
import { BANNER, compare, deepestClub, metrics, renderCompare, renderJson, renderText, summarize, type ReportContext, type Summary } from '../report';
import { bindRules, loadConfig, makePool } from '../rules';
import { simulateBatch, type BatchResult, type RunRecord } from '../simulate';

const WORDS = poolFor('filmy', 'easy');
const POOL = makePool(WORDS);
const CTX: ReportContext = { gitSha: 'test-sha', configSource: null, capSource: 'default' };

function rulesFor(override: GameConfigOverride = {}) {
  const loaded = loadConfig(override);
  if (!loaded.ok) throw new Error(loaded.errors.join('; '));
  return bindRules(loaded.config);
}

interface Setup {
  config?: GameConfigOverride;
  player?: Player;
  policy?: Policy;
  difficulty?: 'easy' | 'medium' | 'hard';
  runs?: number;
  cap?: number;
}

function batch(s: Setup = {}): BatchResult {
  const difficulty = s.difficulty ?? 'easy';
  return simulateBatch({
    rules: rulesFor(s.config),
    theme: 'filmy',
    difficulty,
    runs: s.runs ?? 20,
    seed: 7,
    cap: s.cap ?? 30,
    bags: 'carry',
    player: s.player ?? scriptedPlayer('perfect'),
    policy: s.policy ?? POLICIES.none,
    pool: difficulty === 'easy' ? POOL : makePool(poolFor('filmy', difficulty)),
  });
}

const sum = (s?: Setup, ctx: ReportContext = CTX): Summary => summarize(batch(s), ctx);
const metric = (s: Summary, key: string) => metrics(s).find((m) => m.key === key)?.value;

describe('summarize, checked against hand-computed values', () => {
  const rec = (over: Partial<RunRecord>): RunRecord => ({
    runIndex: 0,
    outcome: 'lost',
    hits: 0,
    words: 0,
    wordIds: [],
    clubs: 0,
    misses: [],
    bosses: [],
    uses: [],
    earned: [0, 0, 0, 0],
    repeats: 0,
    ...over,
  });
  const boss = (club: number, won: boolean, livesLeft: number, stock: number[], bagSize: number) => ({ club, wordIndex: 0, livesLeft, stock, won, bagSize });
  const use = (slot: 0 | 1 | 2 | 3, interval: number, removed?: number) => ({ slot, wordIndex: 0, interval, boss: false, livesBefore: 3, ...(removed === undefined ? {} : { removed }) });

  const records: RunRecord[] = [
    rec({ runIndex: 0, outcome: 'lost', hits: 4, words: 5, clubs: 0, misses: [9] }),
    rec({
      runIndex: 1,
      outcome: 'lost',
      hits: 12,
      words: 13,
      clubs: 1,
      misses: [3, 9],
      bosses: [boss(0, true, 5, [2, 1, 1, 1], 15)],
      uses: [use(UNDO, 1), use(UNDO, 1), use(REMOVE, 1, 3), use(REMOVE, 1, 1)],
      earned: [1, 0, 0, 0],
    }),
    rec({
      runIndex: 2,
      outcome: 'capped',
      hits: 25,
      words: 25,
      clubs: 2,
      misses: [1, 2, 0],
      bosses: [boss(0, true, 7, [2, 1, 0, 1], 2), boss(1, true, 6, [3, 0, 0, 1], 15)],
      repeats: 2,
      earned: [2, 0, 0, 0],
    }),
    rec({ runIndex: 3, outcome: 'capped', hits: 14, words: 14, clubs: 1, misses: [0, 4], bosses: [boss(0, true, 9, [2, 1, 1, 1], 3)], earned: [1, 0, 0, 0] }),
    rec({
      runIndex: 4,
      outcome: 'lost',
      hits: 19,
      words: 20,
      clubs: 1,
      misses: [2, 8],
      bosses: [boss(0, true, 4, [2, 1, 1, 1], 7), boss(1, false, 1, [3, 0, 0, 0], 9)],
      repeats: 1,
      uses: [use(REVEAL, 1), use(UNDO, 0), use(EXTRA_CLUE, 0)],
      earned: [1, 0, 0, 0],
    }),
  ];
  const result: BatchResult = { options: { ...batch().options, runs: 5 }, records };
  const s = summarize(result, CTX);

  it('reports outcomes, hit percentiles (nearest rank) and words at loss', () => {
    expect(s.outcomes).toEqual({ lost: 3, capped: 2 });
    expect(s.hits).toEqual({ p10: 4, p50: 14, p90: 25 });
    expect(s.wordsAtLoss).toEqual({ p10: 5, p50: 13, p90: 20 });
  });

  it('counts runs at risk, reached, lost and censored per club, with survival leaving censored runs out', () => {
    expect(s.clubs.map((c) => [c.atRisk, c.reached, c.lost, c.censored])).toEqual([
      [5, 4, 1, 0],
      [4, 1, 2, 1],
      [1, 0, 0, 1],
    ]);
    expect(s.clubs.map((c) => c.reachedPct)).toEqual([0.8, 0.2, 0]);
    expect(s.clubs.map((c) => c.survival)).toEqual([0.8, 0.333333, null]);
    expect(s.clubs.map((c) => [c.crore, c.hits])).toEqual([[50, 10], [100, 20], [200, 35]]);
  });

  it('counts boss attempts, wins and losses per club', () => {
    expect(s.clubs.map((c) => [c.bossAttempts, c.bossWins, c.bossLosses])).toEqual([[4, 4, 0], [2, 1, 1], [0, 0, 0]]);
  });

  it('sums misses and undos per interval', () => {
    expect(s.clubs.map((c) => c.misses)).toEqual([9 + 3 + 1 + 0 + 2, 9 + 2 + 4 + 8, 0]);
    expect(s.clubs.map((c) => c.missesPerRun)).toEqual([3, 5.75, 0]);
    expect(s.clubs.map((c) => c.undos)).toEqual([1, 2, 0]);
  });

  it('averages lives left and power-up stock when each boss starts', () => {
    expect(s.clubs[0].livesAtBoss).toBe((5 + 7 + 9 + 4) / 4);
    expect(s.clubs[0].stockAtBoss).toEqual([2, 1, 0.75, 1]);
    expect(s.clubs[1].livesAtBoss).toBe(3.5);
    expect(s.clubs[1].stockAtBoss).toEqual([3, 0, 0, 0.5]);
    expect(s.clubs[2].livesAtBoss).toBeNull();
  });

  it('counts power-ups earned (boss wins times the reward) and used, per run', () => {
    expect(s.powerUps.earnedPerRun).toEqual([1, 0, 0, 0]); // 5 gained / 5 runs
    expect(s.powerUps.usedTotal).toEqual([1, 1, 3, 2]);
    expect(s.powerUps.usedPerRun).toEqual([0.2, 0.2, 0.6, 0.4]);
  });

  it('reports repeats, the letters actually removed, and boss draws from a small bag', () => {
    expect(s.repeats).toEqual({ mean: 0.6, max: 2 });
    expect(s.remove).toEqual({ uses: 2, avgRemoved: 2, shareShort: 0.5, asked: 3 });
    // Boss bags of 15, 2, 15, 3, 7, 9: bossCandidates is 3, so the bags of 2 and 3 count.
    expect(s.boss.draws).toBe(6);
    expect(s.boss.shareSmallBag).toBeCloseTo(2 / 6, 5);
  });
});

describe('power-ups earned are measured from stock, net of uses', () => {
  it('counts the reward on the slot it goes to, even while the policy spends that slot', () => {
    const setup: Setup = { cap: 25, runs: 5, config: { milestoneReward: { slot: 1, amount: 2 } } };
    expect(sum(setup).powerUps.earnedPerRun).toEqual([0, 4, 0, 0]);
    // Greedy spends the Extra Clue stock on every word; earned must not shrink by what was spent.
    const greedy = sum({ ...setup, policy: POLICIES.greedy });
    expect(greedy.powerUps.usedPerRun[1]).toBeGreaterThan(0);
    expect(greedy.powerUps.earnedPerRun).toEqual([0, 4, 0, 0]);
  });

  it('is zero when nothing is rewarded', () => {
    expect(sum({ cap: 25, runs: 5, config: { milestoneReward: { amount: 0 } } }).powerUps.earnedPerRun).toEqual([0, 0, 0, 0]);
  });
});

describe('lost, capped and sampling', () => {
  it('a player who never misses is all capped and none lost', () => {
    const s = sum({ cap: 25 });
    expect(s.outcomes).toEqual({ lost: 0, capped: 20 });
    expect(s.wordsAtLoss).toEqual({ p10: null, p50: null, p90: null });
    expect(s.clubs.at(-1)!.censored).toBe(20);
    expect(s.clubs.every((c) => c.survival === null || c.survival === 1)).toBe(true);
  });

  it('a player who always misses once is all lost and none capped', () => {
    const s = sum({ player: scriptedPlayer('oneMiss'), cap: 25 });
    expect(s.outcomes).toEqual({ lost: 20, capped: 0 });
    expect(s.clubs).toHaveLength(1);
    expect(s.clubs[0].survival).toBe(0);
    expect(s.wordsAtLoss.p50).toBe(9);
  });

  it('text and JSON keep the two outcomes apart', () => {
    const text = renderText(sum({ cap: 25 }));
    expect(text).toContain('lost: 0');
    expect(text).toContain('capped: 20');
    expect(text).toContain('censored');
  });
});

describe('header', () => {
  const s = sum({ config: { lives: { easy: 7 } }, policy: POLICIES.greedy, player: presetPlayer('skilled', letterOrder(WORDS)) }, { ...CTX, configSource: 'proposed.json' });
  const text = renderText(s);
  const json = JSON.parse(renderJson(s));

  it('has every required field in the text', () => {
    for (const expected of [
      BANNER,
      'Player model: skilled',
      '0.6',
      'clueBonus 0.15',
      'letter order: ',
      'Power-up policy: greedy',
      'Undo whenever it can be used',
      'Theme: filmy',
      'Difficulty: easy',
      'Bags: carry',
      'Word cap: 30 (default)',
      'Runs: 20',
      'Seed: 7',
      'Git: test-sha',
      'Config: proposed.json (fnv1a ',
      'Pool: 15 words (15 draft; drafts included)',
    ]) {
      expect(text).toContain(expected);
    }
  });

  it('has every required field in the JSON', () => {
    const h = json.header;
    expect(h.banner).toBe(BANNER);
    expect(h).toMatchObject({ theme: 'filmy', difficulty: 'easy', bags: 'carry', cap: 30, capSource: 'default', runs: 20, seed: 7, gitSha: 'test-sha' });
    expect(h.player.name).toBe('skilled');
    expect(h.player.lines.join(' ')).toContain('clueBonus 0.15');
    expect(h.policy.name).toBe('greedy');
    expect(h.policy.triggers).toHaveLength(3);
    expect(h.config).toMatch(/^proposed\.json \(fnv1a [0-9a-f]{8}\)$/);
    expect(h.pool).toEqual({ size: 15, drafts: 15, includeDrafts: true });
  });

  it('lists what a proposed config changes, and carries the full validated config', () => {
    const changed = sum({ config: { lives: { easy: 8 }, bossCandidates: 1, ladder: [{ crore: 50, hits: 5 }, { crore: 100, hits: 12 }] } }, { ...CTX, configSource: 'p.json' });
    expect(changed.header.configChanges).toEqual(['lives.easy=8', 'ladder=[{"crore":50,"hits":5},{"crore":100,"hits":12}]', 'bossCandidates=1']);
    expect(renderText(changed)).toContain('Config changes: lives.easy=8, ladder=[{"crore":50,"hits":5},{"crore":100,"hits":12}], bossCandidates=1');
    const values = JSON.parse(renderJson(changed)).header.configValues;
    expect(values.lives).toEqual({ easy: 8, medium: 7, hard: 5 });
    expect(values.bossCandidates).toBe(1);
    expect(values.startPowerUps).toEqual([2, 1, 1, 1]);
    expect(sum().header.configChanges).toEqual([]);
    expect(renderText(sum())).toContain('Config changes: none');
  });

  it('calls the live rules "current" and hashes a file config by its content', () => {
    expect(sum().header.config).toBe('current');
    const a = sum({ config: { lives: { easy: 7 } } }, { ...CTX, configSource: 'x.json' }).header.config;
    const b = sum({ config: { lives: { easy: 6 } } }, { ...CTX, configSource: 'x.json' }).header.config;
    expect(a).not.toBe(b);
  });
});

describe('flags', () => {
  it('flags lives that break the lives-sign sum, and still runs', () => {
    const s = sum({ difficulty: 'medium', config: { lives: { medium: 8 } }, player: scriptedPlayer('oneMiss') });
    expect(s.header.flags.join('\n')).toContain('needs a lives-sign (locked) change to ship');
    expect(s.outcomes.lost).toBe(20);
    expect(renderText(s)).toContain('FLAG: lives.medium 8 + locked 2');
  });

  it('does not flag the defaults', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) expect(sum({ difficulty, runs: 2 }).header.flags).toEqual([]);
  });

  it('notes a saturated removeWrongCount and reports the letters actually removed', () => {
    const s = sum({
      config: { removeWrongCount: 25, startPowerUps: [0, 0, 0, 30] },
      policy: POLICIES.greedy,
      player: scriptedPlayer('oneMiss'),
      difficulty: 'medium',
      runs: 20,
      cap: 20,
    });
    expect(s.header.flags.join('\n')).toContain('removeWrongCount 25');
    expect(s.header.flags.join('\n')).toContain('saturated: has no further effect');
    expect(s.remove.asked).toBe(25);
    expect(s.remove.uses).toBeGreaterThan(0);
    expect(s.remove.avgRemoved).toBeLessThan(25);
    expect(s.remove.shareShort).toBe(1);
  });

  it('notes a bossCandidates that covers the whole bag', () => {
    expect(sum({ config: { bossCandidates: 99 } }).header.flags.join('\n')).toContain('bossCandidates 99');
    expect(sum({ config: { bossCandidates: 15 } }).header.flags.join('\n')).toContain('saturated: has no further effect');
    expect(sum({ config: { bossCandidates: 14 } }).header.flags).toEqual([]);
  });
});

describe('every whitelisted setting changes the output', () => {
  const asJson = (s: Summary) => JSON.stringify(s);
  const current = (setup: Setup) => sum({ ...setup });
  const proposed = (setup: Setup, config: GameConfigOverride) => sum({ ...setup, config });

  it('lives', () => {
    const setup = { player: scriptedPlayer('oneMiss') };
    expect(asJson(proposed(setup, { lives: { easy: 5 } }))).not.toBe(asJson(current(setup)));
    expect(proposed(setup, { lives: { easy: 5 } }).wordsAtLoss.p50).toBe(5);
    expect(current(setup).wordsAtLoss.p50).toBe(9);
  });

  it('ladder', () => {
    const setup = { cap: 8, runs: 5 };
    const p = proposed(setup, { ladder: [{ crore: 20, hits: 3 }, { crore: 40, hits: 6 }] });
    expect(asJson(p)).not.toBe(asJson(current(setup)));
    expect(p.clubs.slice(0, 2).map((c) => [c.crore, c.hits])).toEqual([[20, 3], [40, 6]]);
    expect(p.clubs[0].hits).toBe(3);
    expect(current(setup).clubs[0].hits).toBe(10);
  });

  it('ladderExtension', () => {
    const setup = { cap: 125, runs: 3 };
    const p = proposed(setup, { ladderExtension: { gapGrowth: 0 } });
    expect(asJson(p)).not.toBe(asJson(current(setup)));
    expect(metric(current(setup), 'club5.reachedPct')).toBe(1);
    expect(current(setup).clubs[5].hits).toBe(110);
    expect(p.clubs[5].hits).toBe(105);
  });

  it('startPowerUps', () => {
    const setup = { player: scriptedPlayer('oneMiss'), policy: POLICIES.greedy };
    const p = proposed(setup, { startPowerUps: [0, 0, 0, 0] });
    expect(asJson(p)).not.toBe(asJson(current(setup)));
    expect(p.powerUps.usedTotal).toEqual([0, 0, 0, 0]);
    expect(current(setup).powerUps.usedTotal.some((n) => n > 0)).toBe(true);
  });

  it('milestoneReward', () => {
    const setup = { cap: 25, runs: 5 };
    const p = proposed(setup, { milestoneReward: { amount: 0 } });
    expect(asJson(p)).not.toBe(asJson(current(setup)));
    expect(current(setup).clubs[1].stockAtBoss[0]).toBe(3);
    expect(p.clubs[1].stockAtBoss[0]).toBe(2);
    expect(p.powerUps.earnedPerRun[0]).toBe(0);
    expect(current(setup).powerUps.earnedPerRun[0]).toBe(2);
  });

  it('removeWrongCount', () => {
    const setup = { difficulty: 'hard' as const, runs: 200, cap: 40, player: presetPlayer('casual', letterOrder(poolFor('filmy', 'hard'))), policy: POLICIES.greedy };
    const base = current(setup);
    const p = proposed(setup, { removeWrongCount: 1 });
    expect(asJson(p)).not.toBe(asJson(base));
    expect(base.remove.uses).toBeGreaterThan(0);
    expect(base.remove.avgRemoved).toBe(3);
    expect(p.remove.avgRemoved).toBe(1);
  });

  it('bossCandidates', () => {
    const setup = { runs: 40, cap: 11 };
    const bossWords = (b: BatchResult) => new Set(b.records.map((r) => r.wordIds[9]));
    const base = batch(setup);
    const one = batch({ ...setup, config: { bossCandidates: 1 } });
    expect(bossWords(one).size).toBeLessThan(bossWords(base).size);
    expect(asJson(summarize(one, CTX))).not.toBe(asJson(summarize(base, CTX)));
  });
});

describe('determinism and comparison', () => {
  it('prints identical text and JSON for identical inputs', () => {
    const setup: Setup = { policy: POLICIES.greedy, player: presetPlayer('casual', letterOrder(WORDS)), runs: 50, cap: 40 };
    const a = sum(setup);
    const b = sum(setup);
    expect(renderText(a)).toBe(renderText(b));
    expect(renderJson(a)).toBe(renderJson(b));
    expect(renderJson(a)).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it('current against current has zero deltas', () => {
    const c = compare(sum(), sum());
    expect(JSON.stringify(c.a)).toBe(JSON.stringify(c.b));
    expect(c.deltas.every((d) => d.delta === 0 || d.delta === null)).toBe(true);
    expect(c.deltas.some((d) => d.delta === 0)).toBe(true);
  });

  it('matches clubs by ladder position and shows each side, with a delta column', () => {
    const c = compare(sum({ cap: 15 }), sum({ cap: 15, config: { ladder: [{ crore: 50, hits: 5 }, { crore: 100, hits: 12 }] } }));
    const text = renderCompare(c);
    expect(text).toContain('50 Cr @ 10 hits');
    expect(text).toContain('50 Cr @ 5 hits');
    expect(text).toContain('delta (B - A)');
    const row = c.deltas.find((d) => d.key === 'club0.reachedPct')!;
    expect(row).toMatchObject({ a: 1, b: 1, delta: 0 });
    const other = c.deltas.find((d) => d.key === 'club1.reachedPct')!;
    expect(other.a).toBe(0);
    expect(other.b).toBe(1);
    expect(other.delta).toBe(1);
  });

  it('shows both sides to the same club depth, so a club one side never reaches reads 0.0%', () => {
    const shallow = batch({ cap: 8, runs: 5 });
    const deep = batch({ cap: 8, runs: 5, config: { ladder: [{ crore: 50, hits: 3 }, { crore: 100, hits: 6 }] } });
    const depth = Math.max(deepestClub(shallow), deepestClub(deep));
    expect(depth).toBe(2);
    const c = compare(summarize(shallow, { ...CTX, clubDepth: depth }), summarize(deep, { ...CTX, clubDepth: depth }));
    expect(c.a.clubs).toHaveLength(3);
    expect(c.b.clubs).toHaveLength(3);
    const reach = c.deltas.find((d) => d.key === 'club1.reachedPct')!;
    expect(reach).toMatchObject({ a: 0, b: 1, delta: 1 });
    const text = renderCompare(c);
    expect(text).toContain('0.0%');
    // Club rows come before the power-up rows.
    expect(c.deltas.findIndex((d) => d.key === 'club2.reachedPct')).toBeLessThan(c.deltas.findIndex((d) => d.key === 'earned0'));
  });

  it('shows the sensitivity of a result to the assumed player and policy', () => {
    const order = letterOrder(WORDS);
    const casual = sum({ player: presetPlayer('casual', order), policy: POLICIES.greedy, runs: 100, cap: 30 });
    const skilled = sum({ player: presetPlayer('skilled', order), policy: POLICIES.none, runs: 100, cap: 30 });
    expect(renderText(casual)).toContain('Player model: casual');
    expect(renderText(skilled)).toContain('Player model: skilled');
    expect(renderText(skilled)).toContain('Power-up policy: none');
    expect(casual.header.banner).toBe(BANNER);
    expect(skilled.header.banner).toBe(BANNER);
    expect(skilled.hits.p50!).toBeGreaterThan(casual.hits.p50!);
  });
});

describe('presets', () => {
  it('skilled reaches at least as many hits as casual on every difficulty (same seed, greedy)', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      const order = letterOrder(poolFor('filmy', difficulty));
      const run = (name: 'casual' | 'skilled') => sum({ difficulty, runs: 200, cap: 60, policy: POLICIES.greedy, player: presetPlayer(name, order) });
      expect(run('skilled').hits.p50!).toBeGreaterThanOrEqual(run('casual').hits.p50!);
    }
  });
});

describe('runCli', () => {
  const files: Record<string, string> = {};
  const io = (): Io & { stdout: string; stderr: string } => {
    const state = { stdout: '', stderr: '' };
    return {
      get stdout() {
        return state.stdout;
      },
      get stderr() {
        return state.stderr;
      },
      readFile(path: string) {
        if (!(path in files)) throw new Error(`ENOENT: no such file, open '${path}'`);
        return files[path];
      },
      gitInfo: () => ({ sha: 'test-sha', dirty: false }),
      out: (t: string) => void (state.stdout += t),
      err: (t: string) => void (state.stderr += t),
    };
  };
  const small = ['--runs', '20', '--seed', '7', '--cap', '15'];

  const run = (args: string[]) => {
    const i = io();
    const code = runCli(args, i);
    return { code, out: i.stdout, err: i.stderr };
  };

  it('prints a report and exits 0', () => {
    const r = run([...small, '--preset', 'casual', '--power-ups', 'greedy']);
    expect(r.code).toBe(0);
    expect(r.out).toContain(BANNER);
    expect(r.out).toContain('Git: test-sha');
    expect(r.out).toContain('Runs: 20');
    expect(r.err).toBe('');
  });

  it('adds +dirty to a changed tree and says unknown with no git', () => {
    const dirty: Io = { ...io(), gitInfo: () => ({ sha: 'abc1234', dirty: true }) };
    let out = '';
    runCli(small, { ...dirty, out: (t) => void (out += t) });
    expect(out).toContain('Git: abc1234+dirty');
    out = '';
    runCli(small, { ...dirty, gitInfo: () => null, out: (t) => void (out += t) });
    expect(out).toContain('Git: unknown');
  });

  it('prints JSON with --json', () => {
    const r = run([...small, '--json']);
    expect(r.code).toBe(0);
    expect(JSON.parse(r.out).header.runs).toBe(20);
  });

  it('prints the default cap, 120 today, and the larger default in a comparison', () => {
    expect(run(['--runs', '2']).out).toContain('Word cap: 120 (default)');
    expect(run(['--runs', '2', '--cap', '9']).out).toContain('Word cap: 9 (--cap)');
    files['long.json'] = JSON.stringify({ ladder: [{ crore: 50, hits: 100 }, { crore: 100, hits: 200 }] });
    const cmp = run(['--runs', '2', '--compare', 'current', 'long.json', '--json']);
    expect(JSON.parse(cmp.out).a.header.cap).toBe(315);
    expect(JSON.parse(cmp.out).b.header.cap).toBe(315);
  });

  it('shows usage with --help', () => {
    const r = run(['--help']);
    expect(r.code).toBe(0);
    expect(r.out).toBe(USAGE);
  });

  it('runs a proposed config with --config, and compares with --compare', () => {
    files['proposed.json'] = JSON.stringify({ lives: { easy: 5 } });
    const one = run([...small, '--config', 'proposed.json']);
    expect(one.code).toBe(0);
    expect(one.out).toContain('Config: proposed.json (fnv1a ');
    const two = run([...small, '--compare', 'current', 'proposed.json']);
    expect(two.code).toBe(0);
    expect(two.out).toContain('Side A (baseline)');
    expect(two.out).toContain('delta (B - A)');
    const both = run([...small, '--compare', 'proposed.json', 'proposed.json', '--json']);
    expect(JSON.parse(both.out).deltas.every((d: { delta: number | null }) => d.delta === 0 || d.delta === null)).toBe(true);
  });

  describe('rejects bad input with exit 1 and a reason on stderr', () => {
    it.each([
      [['--runs', '0'], '--runs'],
      [['--runs', '-1'], '--runs'],
      [['--runs', '1.5'], '--runs'],
      [['--runs', 'abc'], '--runs'],
      [['--runs', '100001'], '--runs'],
      [['--seed', '4294967296'], '--seed'],
      [['--cap', '0'], '--cap'],
      [['--runs'], '--runs needs a value'],
      [['--runs', '--json'], '--runs needs a value'],
      [['--runs', '5', '--runs', '6'], 'more than once'],
      [['--bogus'], 'unknown option --bogus'],
      [['extra'], 'unexpected argument'],
      [['--theme', 'sports'], '--theme'],
      [['--difficulty', 'brutal'], '--difficulty'],
      [['--preset', 'expert'], '--preset'],
      [['--power-ups', 'always'], '--power-ups'],
      [['--bags', 'sometimes'], '--bags'],
      [['--compare', 'current'], '--compare needs a value'],
      [['--config', 'a.json', '--compare', 'current', 'b.json'], 'cannot be used together'],
    ])('%j', (args, message) => {
      const r = run(args as string[]);
      expect(r.code).toBe(1);
      expect(r.err).toContain(message);
      expect(r.out).toBe('');
    });

    it('a missing file names the path', () => {
      const r = run(['--config', 'nope.json']);
      expect(r.code).toBe(1);
      expect(r.err).toContain('nope.json: cannot read the file');
    });

    it('a file that is not JSON names the path', () => {
      files['bad.json'] = '{ lives: ';
      const r = run(['--config', 'bad.json']);
      expect(r.code).toBe(1);
      expect(r.err).toContain('bad.json: not valid JSON');
    });

    it('an unknown setting names the path and says what is not built yet', () => {
      files['stages.json'] = JSON.stringify({ stages: [{ at: 5 }], recovery: 1 });
      const r = run(['--config', 'stages.json']);
      expect(r.code).toBe(1);
      expect(r.err).toContain('stages.json: stages: unknown setting');
      expect(r.err).toContain('stages.json: recovery: unknown setting');
      expect(r.err).toContain('#31 stage pools and #33 earned recovery are not built yet');
    });

    it('a bad value names the path and the setting', () => {
      files['range.json'] = JSON.stringify({ lives: { easy: 12 }, bossCandidates: 0, removeWrongCount: 'many' });
      const r = run(['--compare', 'current', 'range.json']);
      expect(r.code).toBe(1);
      expect(r.err).toContain('range.json: lives.easy: must be an integer from 1 to 9');
      expect(r.err).toContain('range.json: bossCandidates');
      expect(r.err).toContain('range.json: removeWrongCount');
      expect(r.err).not.toContain('not built yet');
    });

    it('rejects a lives increase past the sign, so current plus one on Easy is refused', () => {
      files['more.json'] = JSON.stringify({ lives: { easy: defaultGameConfig.lives.easy + 1 } });
      expect(run(['--config', 'more.json']).code).toBe(1);
    });

    it('treats an __proto__ key in the file as an unknown setting', () => {
      files['proto.json'] = '{"__proto__": {"bossCandidates": 1}}';
      const r = run(['--config', 'proto.json']);
      expect(r.code).toBe(1);
      expect(r.err).toContain('__proto__: unknown setting');
    });
  });
});
