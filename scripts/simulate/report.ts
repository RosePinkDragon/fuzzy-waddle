/**
 * Turns a batch of run records into the numbers #33 needs, flags settings that
 * need care, and renders them as text or JSON. There are no timestamps and every
 * number has a fixed format, so the same inputs print the same report.
 */
import { lettersOf } from '@/game/answer';
import { DIFFICULTY_RULES, INCLUDE_DRAFT_WORDS, LIVES_MARKS, POWER_UP_SLOTS } from '@/game/config';
import { defaultGameConfig, type GameConfig } from '@/game/gameConfig';
import { UNDO } from '@/game/powerUps';

import { configIdentity } from './rules';
import type { BatchResult, RunRecord } from './simulate';

export const BANNER = 'ASSUMPTIONS — NOT PLAYER DATA';
const BANNER_NOTE =
  'The players below are simulated from the assumptions listed here. They are not observed behaviour, ' +
  'and a result here does not prove a change is fun. Compare presets and policies before drawing conclusions.';

const SLOT_NAMES = ['Reveal', 'Extra Clue', 'Undo', 'Remove'];

/** What the CLI knows that the batch doesn't. */
export interface ReportContext {
  /** Short git SHA with `+dirty` when the tree has changes, or `unknown`. */
  gitSha: string;
  /** The config file path, or null for the live defaults. */
  configSource: string | null;
  /** Where the cap came from: the computed default or the `--cap` flag. */
  capSource: 'default' | '--cap';
  /** Show club rows down to at least this ladder position (a comparison gives both sides the same depth). */
  clubDepth?: number;
}

export interface Header {
  banner: string;
  player: { name: string; lines: readonly string[] };
  policy: { name: string; triggers: readonly string[] };
  theme: string;
  difficulty: string;
  bags: string;
  cap: number;
  capSource: string;
  runs: number;
  seed: number;
  gitSha: string;
  config: string;
  /** Settings that differ from the live defaults, as `path=value`. */
  configChanges: string[];
  /** The full validated config that was simulated. */
  configValues: GameConfig;
  pool: { size: number; drafts: number; includeDrafts: boolean };
  flags: string[];
}

export interface ClubRow {
  /** Ladder position. Row `i` covers the stretch that ends in club `i`. */
  index: number;
  crore: number;
  hits: number;
  atRisk: number;
  reached: number;
  reachedPct: number;
  lost: number;
  censored: number;
  /** reached / (reached + lost). Censored runs are left out. Null when nobody reached or lost. */
  survival: number | null;
  bossAttempts: number;
  bossWins: number;
  bossLosses: number;
  misses: number;
  missesPerRun: number | null;
  undos: number;
  livesAtBoss: number | null;
  stockAtBoss: (number | null)[];
}

export interface Spread {
  p10: number | null;
  p50: number | null;
  p90: number | null;
}

export interface Summary {
  header: Header;
  outcomes: { lost: number; capped: number };
  hits: Spread;
  wordsAtLoss: Spread;
  clubs: ClubRow[];
  powerUps: { earnedPerRun: number[]; usedPerRun: number[]; usedTotal: number[] };
  repeats: { mean: number; max: number };
  remove: { uses: number; avgRemoved: number | null; shareShort: number | null; asked: number };
  boss: { draws: number; shareSmallBag: number | null; candidates: number };
}

const r6 = (x: number) => Math.round(x * 1e6) / 1e6;
const ratio = (a: number, b: number) => (b === 0 ? null : r6(a / b));
const maxOf = (xs: number[]) => xs.reduce((m, x) => Math.max(m, x), 0);
const mean = (xs: number[]) => (xs.length ? r6(xs.reduce((s, x) => s + x, 0) / xs.length) : null);

/** Nearest-rank percentile of an ascending list. */
function nearestRank(sorted: number[], p: number): number | null {
  if (!sorted.length) return null;
  return sorted[Math.max(1, Math.ceil((p / 100) * sorted.length)) - 1];
}

function spread(values: number[]): Spread {
  const sorted = [...values].sort((a, b) => a - b);
  return { p10: nearestRank(sorted, 10), p50: nearestRank(sorted, 50), p90: nearestRank(sorted, 90) };
}

/** The validated config's differences from the live defaults, as `path=value` (empty for `current`). */
export function configChanges(config: GameConfig): string[] {
  const out: string[] = [];
  const diff = (path: string, a: unknown, b: unknown) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) out.push(`${path}=${JSON.stringify(b)}`);
  };
  for (const d of Object.keys(config.lives) as (keyof GameConfig['lives'])[]) diff(`lives.${d}`, defaultGameConfig.lives[d], config.lives[d]);
  diff('ladder', defaultGameConfig.ladder, config.ladder);
  for (const k of ['gapGrowth', 'croreSteps', 'croreEvery'] as const) {
    diff(`ladderExtension.${k}`, defaultGameConfig.ladderExtension[k], config.ladderExtension[k]);
  }
  diff('startPowerUps', defaultGameConfig.startPowerUps, config.startPowerUps);
  diff('milestoneReward.slot', defaultGameConfig.milestoneReward.slot, config.milestoneReward.slot);
  diff('milestoneReward.amount', defaultGameConfig.milestoneReward.amount, config.milestoneReward.amount);
  diff('removeWrongCount', defaultGameConfig.removeWrongCount, config.removeWrongCount);
  diff('bossCandidates', defaultGameConfig.bossCandidates, config.bossCandidates);
  return out;
}

/** The deepest club any run entered (0 when none did). */
export function deepestClub(result: BatchResult): number {
  return maxOf(result.records.map((r) => r.clubs));
}

function buildHeader(result: BatchResult, ctx: ReportContext): Header {
  const o = result.options;
  const cfg = o.rules.config;
  const flags: string[] = [];

  const locked = DIFFICULTY_RULES[o.difficulty].locked;
  if (cfg.lives[o.difficulty] + locked !== LIVES_MARKS) {
    flags.push(
      `lives.${o.difficulty} ${cfg.lives[o.difficulty]} + locked ${locked} is not ${LIVES_MARKS} sign marks: needs a lives-sign (locked) change to ship`,
    );
  }
  const maxWrong = maxOf(o.pool.words.map((w) => 26 - lettersOf(w.answer).size));
  if (cfg.removeWrongCount >= maxWrong) {
    flags.push(
      `removeWrongCount ${cfg.removeWrongCount} is at least the wrong letters available (at most ${maxWrong} in this pool): saturated: has no further effect`,
    );
  }
  if (cfg.bossCandidates >= o.pool.ids.length) {
    flags.push(
      `bossCandidates ${cfg.bossCandidates} is at least the full bag (${o.pool.ids.length} words): saturated: has no further effect`,
    );
  }

  return {
    banner: BANNER,
    player: { name: o.player.name, lines: o.player.describe },
    policy: { name: o.policy.name, triggers: o.policy.triggers },
    theme: o.theme,
    difficulty: o.difficulty,
    bags: o.bags,
    cap: o.cap,
    capSource: ctx.capSource,
    runs: o.runs,
    seed: o.seed,
    gitSha: ctx.gitSha,
    config: configIdentity(ctx.configSource, cfg),
    configChanges: configChanges(cfg),
    configValues: cfg,
    pool: {
      size: o.pool.ids.length,
      drafts: o.pool.words.filter((w) => w.status === 'draft').length,
      includeDrafts: INCLUDE_DRAFT_WORDS,
    },
    flags,
  };
}

function clubRows(result: BatchResult, minDepth: number): ClubRow[] {
  const { records, options } = result;
  const { ladder } = options.rules;
  const deepest = Math.max(deepestClub(result), minDepth);
  const rows: ClubRow[] = [];
  for (let i = 0; i <= deepest; i += 1) {
    const club = ladder.clubAt(i);
    const atRisk = records.filter((r) => r.clubs >= i).length;
    const reached = records.filter((r) => r.clubs >= i + 1).length;
    const lost = records.filter((r) => r.outcome === 'lost' && r.clubs === i).length;
    const censored = records.filter((r) => r.outcome === 'capped' && r.clubs === i).length;
    const bosses = records.flatMap((r) => r.bosses).filter((b) => b.club === i);
    const misses = records.reduce((s, r) => s + (r.misses[i] ?? 0), 0);
    rows.push({
      index: i,
      crore: club.crore,
      hits: club.hits,
      atRisk,
      reached,
      reachedPct: r6(reached / records.length),
      lost,
      censored,
      survival: ratio(reached, reached + lost),
      bossAttempts: bosses.length,
      bossWins: bosses.filter((b) => b.won).length,
      bossLosses: bosses.filter((b) => !b.won).length,
      misses,
      missesPerRun: ratio(misses, atRisk),
      undos: records.reduce((s, r) => s + r.uses.filter((u) => u.slot === UNDO && u.interval === i).length, 0),
      livesAtBoss: mean(bosses.map((b) => b.livesLeft)),
      stockAtBoss: Array.from({ length: POWER_UP_SLOTS }, (_, s) => mean(bosses.map((b) => b.stock[s]))),
    });
  }
  return rows;
}

export function summarize(result: BatchResult, ctx: ReportContext): Summary {
  const { records, options } = result;
  const n = records.length;
  const lostRuns = records.filter((r) => r.outcome === 'lost');
  const uses = records.flatMap((r: RunRecord) => r.uses);
  const removes = uses.filter((u) => u.slot === 3);
  const asked = options.rules.config.removeWrongCount;
  const bossDraws = records.flatMap((r) => r.bosses);
  const earned = Array.from({ length: POWER_UP_SLOTS }, (_, s) => records.reduce((t, r) => t + (r.earned[s] ?? 0), 0));
  const usedTotal = Array.from({ length: POWER_UP_SLOTS }, (_, s) => uses.filter((u) => u.slot === s).length);

  return {
    header: buildHeader(result, ctx),
    outcomes: { lost: lostRuns.length, capped: n - lostRuns.length },
    hits: spread(records.map((r) => r.hits)),
    wordsAtLoss: spread(lostRuns.map((r) => r.words)),
    clubs: clubRows(result, ctx.clubDepth ?? 0),
    powerUps: {
      earnedPerRun: earned.map((e) => r6(e / n)),
      usedPerRun: usedTotal.map((u) => r6(u / n)),
      usedTotal,
    },
    repeats: { mean: r6(records.reduce((s, r) => s + r.repeats, 0) / n), max: maxOf(records.map((r) => r.repeats)) },
    remove: {
      uses: removes.length,
      avgRemoved: mean(removes.map((u) => u.removed ?? 0)),
      shareShort: ratio(removes.filter((u) => (u.removed ?? 0) < asked).length, removes.length),
      asked,
    },
    boss: {
      draws: bossDraws.length,
      shareSmallBag: ratio(bossDraws.filter((b) => b.bagSize <= options.rules.config.bossCandidates).length, bossDraws.length),
      candidates: options.rules.config.bossCandidates,
    },
  };
}

// ---------------------------------------------------------------------------
// Metric rows, shared by the text report and the comparison.

type Kind = 'int' | 'pct' | 'num';
export interface Metric {
  key: string;
  label: string;
  kind: Kind;
  value: number | null;
}

/** Every scalar in the summary, in print order. */
export function metrics(s: Summary): Metric[] {
  const m: Metric[] = [];
  const add = (key: string, label: string, kind: Kind, value: number | null) => m.push({ key, label, kind, value });
  add('lost', 'runs lost (out of lives)', 'int', s.outcomes.lost);
  add('capped', 'runs capped (still alive at the cap, censored)', 'int', s.outcomes.capped);
  add('hits.p10', 'hits p10', 'int', s.hits.p10);
  add('hits.p50', 'hits p50', 'int', s.hits.p50);
  add('hits.p90', 'hits p90', 'int', s.hits.p90);
  add('wordsAtLoss.p10', 'words at loss p10', 'int', s.wordsAtLoss.p10);
  add('wordsAtLoss.p50', 'words at loss p50', 'int', s.wordsAtLoss.p50);
  add('wordsAtLoss.p90', 'words at loss p90', 'int', s.wordsAtLoss.p90);
  for (const c of s.clubs) {
    const p = `club${c.index}`;
    const name = `club ${c.index + 1}`;
    add(`${p}.reachedPct`, `${name} runs reaching`, 'pct', c.reachedPct);
    add(`${p}.atRisk`, `${name} runs at risk`, 'int', c.atRisk);
    add(`${p}.lost`, `${name} interval lost`, 'int', c.lost);
    add(`${p}.censored`, `${name} interval censored`, 'int', c.censored);
    add(`${p}.survival`, `${name} conditional survival`, 'pct', c.survival);
    add(`${p}.bossAttempts`, `${name} boss attempts`, 'int', c.bossAttempts);
    add(`${p}.bossWins`, `${name} boss wins`, 'int', c.bossWins);
    add(`${p}.bossLosses`, `${name} boss losses`, 'int', c.bossLosses);
    add(`${p}.missesPerRun`, `${name} misses per run at risk`, 'num', c.missesPerRun);
    add(`${p}.undos`, `${name} undos`, 'int', c.undos);
    add(`${p}.livesAtBoss`, `${name} lives left at boss start`, 'num', c.livesAtBoss);
    c.stockAtBoss.forEach((v, slot) => add(`${p}.stock${slot}`, `${name} ${SLOT_NAMES[slot]} stock at boss start`, 'num', v));
  }
  s.powerUps.earnedPerRun.forEach((v, slot) => add(`earned${slot}`, `${SLOT_NAMES[slot]} earned per run`, 'num', v));
  s.powerUps.usedPerRun.forEach((v, slot) => add(`used${slot}`, `${SLOT_NAMES[slot]} used per run`, 'num', v));
  add('repeats.mean', 'repeats per run (mean)', 'num', s.repeats.mean);
  add('repeats.max', 'repeats per run (max)', 'int', s.repeats.max);
  add('remove.avg', 'letters removed per Remove (average)', 'num', s.remove.avgRemoved);
  add('remove.short', 'Removes that took fewer than asked', 'pct', s.remove.shareShort);
  add('boss.smallBag', 'boss draws from a bag no bigger than bossCandidates', 'pct', s.boss.shareSmallBag);
  return m;
}

function fmt(value: number | null, kind: Kind): string {
  if (value === null) return '-';
  if (kind === 'int') return String(value);
  if (kind === 'pct') return `${(value * 100).toFixed(1)}%`;
  return value.toFixed(2);
}

function fmtDelta(a: number | null, b: number | null, kind: Kind): string {
  if (a === null || b === null) return '-';
  const d = r6(b - a);
  const sign = d > 0 ? '+' : '';
  if (kind === 'int') return `${sign}${d}`;
  if (kind === 'pct') return `${sign}${(d * 100).toFixed(1)} pp`;
  return `${sign}${d.toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Text

function table(rows: string[][]): string[] {
  const widths = rows[0].map((_, c) => Math.max(...rows.map((r) => r[c].length)));
  return rows.map((r) => r.map((cell, c) => (c === 0 ? cell.padEnd(widths[c]) : cell.padStart(widths[c]))).join('  ').trimEnd());
}

function headerLines(h: Header, opts: { sides?: boolean } = {}): string[] {
  const out = [
    h.banner,
    BANNER_NOTE,
    '',
    `Player model: ${h.player.name}`,
    ...h.player.lines.map((l) => `  ${l}`),
    `Power-up policy: ${h.policy.name}`,
    ...h.policy.triggers.map((l) => `  ${l}`),
    `Theme: ${h.theme}   Difficulty: ${h.difficulty}`,
    `Pool: ${h.pool.size} words (${h.pool.drafts} draft; drafts ${h.pool.includeDrafts ? 'included' : 'excluded'})`,
    `Bags: ${h.bags}   Word cap: ${h.cap} (${h.capSource})   Runs: ${h.runs}   Seed: ${h.seed}`,
    `Git: ${h.gitSha}`,
  ];
  if (!opts.sides) {
    out.push(`Config: ${h.config}`, `Config changes: ${h.configChanges.length ? h.configChanges.join(', ') : 'none'}`);
    for (const f of h.flags) out.push(`FLAG: ${f}`);
  }
  return out;
}

function clubTable(s: Summary): string[] {
  const head = ['club', 'crore', 'hits', 'at risk', 'reached', 'reach %', 'lost', 'censored', 'survival', 'boss att/win/loss', 'misses', 'undos', 'lives@boss', 'stock@boss R/E/U/X'];
  const rows = [head];
  for (const c of s.clubs) {
    rows.push([
      String(c.index + 1),
      String(c.crore),
      String(c.hits),
      String(c.atRisk),
      String(c.reached),
      fmt(c.reachedPct, 'pct'),
      String(c.lost),
      String(c.censored),
      fmt(c.survival, 'pct'),
      `${c.bossAttempts}/${c.bossWins}/${c.bossLosses}`,
      String(c.misses),
      String(c.undos),
      fmt(c.livesAtBoss, 'num'),
      c.stockAtBoss.map((v) => fmt(v, 'num')).join('/'),
    ]);
  }
  return table(rows);
}

export function renderText(s: Summary): string {
  const lines = headerLines(s.header);
  lines.push('', 'Outcomes (lost and capped are different things; capped runs are censored, not losses)');
  lines.push(`  lost: ${s.outcomes.lost}   capped: ${s.outcomes.capped}   of ${s.header.runs} runs`);
  lines.push(`  hits p10/p50/p90: ${fmt(s.hits.p10, 'int')}/${fmt(s.hits.p50, 'int')}/${fmt(s.hits.p90, 'int')}`);
  lines.push(`  words at loss p10/p50/p90: ${fmt(s.wordsAtLoss.p10, 'int')}/${fmt(s.wordsAtLoss.p50, 'int')}/${fmt(s.wordsAtLoss.p90, 'int')}`);
  lines.push('', 'Clubs (row N is the stretch that ends in club N; survival = reached / (reached + lost), capped runs excluded)');
  lines.push(...clubTable(s).map((l) => `  ${l}`));
  lines.push('', 'Power-ups per run');
  lines.push(...table([['slot', 'earned', 'used'], ...SLOT_NAMES.map((n, i) => [n, fmt(s.powerUps.earnedPerRun[i], 'num'), fmt(s.powerUps.usedPerRun[i], 'num')])]).map((l) => `  ${l}`));
  lines.push('', `Repeats per run: mean ${fmt(s.repeats.mean, 'num')}, max ${s.repeats.max}`);
  lines.push(
    `Remove: ${s.remove.uses} uses, asked for ${s.remove.asked}, average letters removed ${fmt(s.remove.avgRemoved, 'num')}, fewer than asked ${fmt(s.remove.shareShort, 'pct')}`,
  );
  lines.push(`Boss draws: ${s.boss.draws}, from a bag no bigger than bossCandidates (${s.boss.candidates}): ${fmt(s.boss.shareSmallBag, 'pct')}`);
  return `${lines.join('\n')}\n`;
}

// ---------------------------------------------------------------------------
// Comparison

export interface DeltaRow {
  key: string;
  label: string;
  kind: Kind;
  a: number | null;
  b: number | null;
  delta: number | null;
}

export interface Comparison {
  a: Summary;
  b: Summary;
  /** Clubs are matched by ladder position; each side's crore and hits are in the club rows. */
  deltas: DeltaRow[];
}

export function compare(a: Summary, b: Summary): Comparison {
  const mb = new Map(metrics(b).map((m) => [m.key, m]));
  const ma = new Map(metrics(a).map((m) => [m.key, m]));
  const keys = [...new Set([...ma.keys(), ...mb.keys()])];
  const deltas = keys.map((key): DeltaRow => {
    const x = ma.get(key);
    const y = mb.get(key);
    const va = x ? x.value : null;
    const vb = y ? y.value : null;
    return { key, label: (x ?? y)!.label, kind: (x ?? y)!.kind, a: va, b: vb, delta: va === null || vb === null ? null : r6(vb - va) };
  });
  return { a, b, deltas };
}

export function renderCompare(c: Comparison): string {
  const lines = headerLines(c.a.header, { sides: true });
  const side = (h: Header) => [`  Config: ${h.config}`, `  Config changes: ${h.configChanges.length ? h.configChanges.join(', ') : 'none'}`, ...h.flags.map((f) => `  FLAG: ${f}`)];
  lines.push('', 'Side A (baseline)', ...side(c.a.header));
  lines.push('Side B (proposed)', ...side(c.b.header));
  lines.push('', 'Same per-run game and player seeds on both sides. Word sequences match only while both sides follow the same selection rules and paths. With carry bags each side keeps its own bag, so --bags reset keeps the pairing tighter.');
  const depth = Math.max(c.a.clubs.length, c.b.clubs.length);
  lines.push('', 'Clubs matched by ladder position');
  const pair = (s: Summary, i: number) => (s.clubs[i] ? `${s.clubs[i].crore} Cr @ ${s.clubs[i].hits} hits` : '-');
  lines.push(...table([['club', 'A', 'B'], ...Array.from({ length: depth }, (_, i) => [String(i + 1), pair(c.a, i), pair(c.b, i)])]).map((l) => `  ${l}`));
  lines.push('', 'Metrics');
  const rows = [['metric', 'A', 'B', 'delta (B - A)']];
  for (const d of c.deltas) rows.push([d.label, fmt(d.a, d.kind), fmt(d.b, d.kind), fmtDelta(d.a, d.b, d.kind)]);
  lines.push(...table(rows).map((l) => `  ${l}`));
  return `${lines.join('\n')}\n`;
}

export function renderJson(value: Summary | Comparison): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
