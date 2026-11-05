/**
 * The saved form of one run: the document kept for each theme + difficulty.
 * One JSON document holds everything that has to agree (the rules the run
 * started under, the complete run, the matching shuffle bag, the best score
 * and the terminal outcome), so a single completed write is a transition.
 *
 * Pure TypeScript: it validates untrusted JSON and never touches storage.
 * `runSession.ts` changes documents; `lib/runStore.ts` reads and writes them.
 */
import { DIFFICULTY_ORDER, DIFFICULTY_RULES, POWER_UP_SLOTS } from './config';
import { ALPHABET, answerProblem, isSolved, lettersOf } from './answer';
import { defaultGameConfig, mergeGameConfig, validateGameConfig, type GameConfig } from './gameConfig';
import type { ClueSettings } from './difficulty';
import { Ladder, activeLadder, type Rung } from './milestones';
import { livesLeft, type RunState, type WordPlay } from './run';
import type { BagState } from './shuffleBag';
import type { CategoryId, ClueLevel, Difficulty, ThemeId, Word } from './types';

/** Bump when the document layout changes. Other versions recover visibly instead of loading. */
export const SCHEMA_VERSION = 1;
/** Bump when the meaning of the saved rules (how actions use them) changes. */
export const RULES_VERSION = 1;

const MAX_COUNT = 1_000_000;
const CATEGORIES: readonly CategoryId[] = ['filmy', 'khana', 'safar', 'cricket', 'tyohar'];
const THEMES: readonly ThemeId[] = [...CATEGORIES, 'masala'];

/** The rules a run was started under. Actions on a saved run read these, never the live config. */
export interface SavedRules {
  config: GameConfig;
  clues: ClueSettings;
  /** Word tiers the run draws from. */
  pool: Difficulty[];
}

/** A positive best only; a zero-only best is stored as `null` ("not played yet"). */
export interface BestScore {
  hits: number;
  club: number | null;
}

export type TerminalReason = 'lost' | 'abandoned';

export interface TerminalInfo {
  reason: TerminalReason;
  /** Hits when the run ended; already settled into `best` when positive. */
  hits: number;
  club: number | null;
}

/** Statuses a saved run can be in. `ready` is internal to a draw and is never saved. */
export type SavedStatus = 'playing' | 'solved' | 'milestone' | 'over';

export interface SlotDoc {
  schema: typeof SCHEMA_VERSION;
  rulesVersion: typeof RULES_VERSION;
  theme: ThemeId;
  difficulty: Difficulty;
  /** Identity of this run. A New run gets a new one. */
  runId: string;
  /** Counts completed transitions of this run; stale writers are rejected by it. */
  revision: number;
  rules: SavedRules;
  run: RunState;
  bag: BagState;
  best: BestScore | null;
  /** The best when this run began, so "new best" can be shown after the best is settled. */
  bestAtStart: BestScore | null;
  terminal: TerminalInfo | null;
}

// ---------- rules ----------

/** The live rules for a difficulty, copied so later changes to `config.ts` can't reach a saved run. */
export function currentRules(difficulty: Difficulty, rungs: readonly Rung[] = activeLadder()): SavedRules {
  const d = DIFFICULTY_RULES[difficulty];
  return {
    config: mergeGameConfig(defaultGameConfig, { ladder: rungs }),
    clues: { showChips: d.showChips, shownClues: [...d.shownClues], hiddenClues: [...d.hiddenClues] },
    pool: [...d.pool],
  };
}

const ladders = new WeakMap<SavedRules, Ladder>();

/** The ladder for saved rules, built once per rules object (a `Ladder` grows lazily). */
export function ladderOf(rules: SavedRules): Ladder {
  let l = ladders.get(rules);
  if (!l) {
    l = new Ladder(rules.config.ladder, rules.config.ladderExtension);
    ladders.set(rules, l);
  }
  return l;
}

// ---------- best ----------

/** The better of two bests; hits decide, and a zero or missing best never wins. */
export function betterBest(a: BestScore | null, b: BestScore | null): BestScore | null {
  if (!a) return b;
  if (!b) return a;
  return b.hits > a.hits ? b : a;
}

/** Folds a finished run into the best. Zero-hit endings change nothing; positive bests never drop. */
export function settleBest(best: BestScore | null, hits: number, club: number | null): BestScore | null {
  return hits > 0 ? betterBest(best, { hits, club }) : best;
}

/** Reads a stored best. Zero hits mean "not played" (null); anything malformed is `invalid`. */
export function readBest(value: unknown): { ok: true; best: BestScore | null } | { ok: false } {
  if (value === null || value === undefined) return { ok: true, best: null };
  if (!isRecord(value) || !isCount(value.hits)) return { ok: false };
  const club = value.club;
  if (club !== null && club !== undefined && !(Number.isSafeInteger(club) && (club as number) >= 0)) return { ok: false };
  if (value.hits === 0) return { ok: true, best: null };
  return { ok: true, best: { hits: value.hits, club: (club as number | null | undefined) ?? null } };
}

/** Reads a stored bag. */
export function readBag(value: unknown): BagState | null {
  if (!isRecord(value) || !Array.isArray(value.remaining)) return null;
  const { remaining, last } = value;
  if (!remaining.every((id) => typeof id === 'string' && id.length > 0) || new Set(remaining).size !== remaining.length) {
    return null;
  }
  if (last !== undefined && (typeof last !== 'string' || !last)) return null;
  return last === undefined ? { remaining: [...remaining] } : { remaining: [...remaining], last };
}

// ---------- parsing ----------

export type ParseResult =
  | { ok: true; doc: SlotDoc }
  | {
      ok: false;
      /** `unsupported`: a version this build doesn't read. `corrupt`: anything else wrong. */
      reason: 'corrupt' | 'unsupported';
      detail: string;
      /** What can be trusted from the bad document on its own: a positive best, and a valid bag. */
      salvage: { best: BestScore | null; bag: BagState | null };
    };

export function serializeDoc(doc: SlotDoc): string {
  return JSON.stringify(doc);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
const isCount = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0 && (v as number) <= MAX_COUNT;
const isStringList = (v: unknown): v is string[] => Array.isArray(v) && v.every((s) => typeof s === 'string');

class Invalid extends Error {}
function need(ok: boolean, why: string): asserts ok {
  if (!ok) throw new Invalid(why);
}

function readLetters(v: unknown, name: string): string[] {
  need(Array.isArray(v), `${name}: not a list`);
  const out = v as unknown[];
  need(out.every((l) => typeof l === 'string' && ALPHABET.includes(l)), `${name}: not A-Z letters`);
  need(new Set(out).size === out.length, `${name}: repeated letters`);
  return [...(out as string[])];
}

function readClueLevels(v: unknown, name: string): ClueLevel[] {
  need(Array.isArray(v) && v.every((c) => c === 'clue' || c === 'extraClue'), `${name}: bad clue levels`);
  const out = v as ClueLevel[];
  need(new Set(out).size === out.length, `${name}: repeated clue levels`);
  return [...out];
}

function readRules(v: unknown): SavedRules {
  need(isRecord(v) && isRecord(v.config) && isRecord(v.clues), 'rules: missing');
  const config = v.config as Record<string, unknown>;
  for (const key of Object.keys(defaultGameConfig)) need(key in config, `rules.config.${key}: missing`);
  const checked = validateGameConfig(config);
  need(checked.ok, `rules.config: ${checked.ok ? '' : checked.errors[0]}`);
  const clues = v.clues as Record<string, unknown>;
  need(typeof clues.showChips === 'boolean', 'rules.clues.showChips: not a boolean');
  const pool = v.pool;
  need(Array.isArray(pool) && pool.length > 0 && pool.every((d) => DIFFICULTY_ORDER.includes(d as Difficulty)), 'rules.pool: bad tiers');
  need(new Set(pool as string[]).size === (pool as string[]).length, 'rules.pool: repeated tiers');
  return {
    config: (checked as { ok: true; config: GameConfig }).config,
    clues: { showChips: clues.showChips as boolean, shownClues: readClueLevels(clues.shownClues, 'rules.clues.shownClues'), hiddenClues: readClueLevels(clues.hiddenClues, 'rules.clues.hiddenClues') },
    pool: [...(pool as Difficulty[])],
  };
}

function readWord(v: unknown): Word {
  need(isRecord(v), 'word: missing');
  const w = v as Record<string, unknown>;
  need(typeof w.id === 'string' && w.id.length > 0, 'word.id');
  need(typeof w.answer === 'string' && answerProblem(w.answer) === null, 'word.answer');
  need(DIFFICULTY_ORDER.includes(w.difficulty as Difficulty), 'word.difficulty');
  need(isStringList(w.chips), 'word.chips');
  need(typeof w.clue === 'string' && typeof w.extraClue === 'string', 'word.clue');
  need(w.status === 'draft' || w.status === 'approved', 'word.status');
  need(CATEGORIES.includes(w.category as CategoryId), 'word.category');
  need(w.display === undefined || typeof w.display === 'string', 'word.display');
  const word: Word = {
    id: w.id as string,
    answer: w.answer as string,
    difficulty: w.difficulty as Difficulty,
    chips: [...(w.chips as string[])],
    clue: w.clue as string,
    extraClue: w.extraClue as string,
    status: w.status as Word['status'],
    category: w.category as CategoryId,
  };
  if (typeof w.display === 'string') word.display = w.display;
  return word;
}

function readPlay(v: unknown, rules: SavedRules): WordPlay {
  need(isRecord(v), 'current: missing');
  const p = v as Record<string, unknown>;
  const word = readWord(p.word);
  const inAnswer = lettersOf(word.answer);
  const correct = readLetters(p.correct, 'correct');
  const wrong = readLetters(p.wrong, 'wrong');
  const undone = readLetters(p.undone, 'undone');
  const removed = readLetters(p.removed, 'removed');
  const revealed = readLetters(p.revealed, 'revealed');
  need(correct.every((l) => inAnswer.has(l)), 'correct: letter not in the answer');
  need(wrong.every((l) => !inAnswer.has(l)), 'wrong: letter in the answer');
  need(undone.every((l) => wrong.includes(l)), 'undone: not a wrong guess');
  need(removed.every((l) => !inAnswer.has(l) && !wrong.includes(l)), 'removed: letter in the answer or guessed');
  need(revealed.every((l) => correct.includes(l)), 'revealed: not a correct letter');
  need(Number.isSafeInteger(p.cluesRevealed) && (p.cluesRevealed as number) >= 0 && (p.cluesRevealed as number) <= rules.clues.hiddenClues.length, 'cluesRevealed');
  need(typeof p.isBoss === 'boolean', 'isBoss');
  return { word, correct, wrong, undone, removed, revealed, cluesRevealed: p.cluesRevealed as number, isBoss: p.isBoss as boolean };
}

function readRun(v: unknown, theme: ThemeId, difficulty: Difficulty, rules: SavedRules, ladder: Ladder): RunState {
  need(isRecord(v), 'run: missing');
  const r = v as Record<string, unknown>;
  need(r.theme === theme && r.difficulty === difficulty, 'run: wrong theme or difficulty for this slot');
  need(isCount(r.hits), 'run.hits');
  const hits = r.hits as number;
  need(isCount(r.livesLost) && (r.livesLost as number) <= rules.config.lives[difficulty], 'run.livesLost');
  need(Array.isArray(r.powerUps) && r.powerUps.length === POWER_UP_SLOTS && r.powerUps.every(isCount), 'run.powerUps');
  const status = r.status;
  // `ready` only exists between a transition and the draw that finishes it, so a saved one can't be resumed.
  need(status === 'playing' || status === 'solved' || status === 'milestone' || status === 'over', `run.status: ${String(status)} is not a savable stage`);
  const current = readPlay(r.current, rules);
  const solved = isSolved(current.word.answer, current.correct);
  const run: RunState = {
    theme,
    difficulty,
    hits,
    livesLost: r.livesLost as number,
    powerUps: [...(r.powerUps as number[])],
    current,
    status,
    lastClub: null,
  };
  if (status === 'playing') {
    need(!solved, "a solved word can't still be playing");
    need(livesLeft(run, rules.config) > 0, 'playing with no lives left');
  }
  if (status === 'solved' || status === 'milestone') {
    need(solved && hits >= 1, 'solved stage without a solved word');
    need(current.isBoss === (status === 'milestone'), 'solved stage and boss flag disagree');
  }
  if (status === 'over') need(!solved, 'over stage with a solved word');
  const bossAt = status === 'solved' || status === 'milestone' ? hits - 1 : hits;
  need(current.isBoss === ladder.isBossWord(bossAt), 'boss flag does not match the ladder');
  if (status === 'milestone') {
    const club = ladder.reached(hits);
    need(club !== null && club.hits === hits, 'milestone without a club at these hits');
    run.lastClub = club;
  } else need(r.lastClub === null || r.lastClub === undefined, 'run.lastClub');
  return run;
}

function readSlotBest(v: unknown, name: string): BestScore | null {
  const b = readBest(v);
  need(b.ok, `${name}: malformed`);
  return b.ok ? b.best : null;
}

function validate(o: Record<string, unknown>, theme: ThemeId, difficulty: Difficulty): SlotDoc {
  need(THEMES.includes(o.theme as ThemeId) && o.theme === theme && o.difficulty === difficulty, 'document is for another slot');
  need(typeof o.runId === 'string' && o.runId.length > 0 && o.runId.length <= 80, 'runId');
  need(isCount(o.revision), 'revision');
  const rules = readRules(o.rules);
  const ladder = ladderOf(rules);
  const run = readRun(o.run, theme, difficulty, rules, ladder);
  const bag = readBag(o.bag);
  need(bag !== null, 'bag: malformed');
  const current = run.current!;
  need(!bag.remaining.includes(current.word.id) && bag.last === current.word.id, 'bag does not match the current word');
  const best = readSlotBest(o.best, 'best');
  const bestAtStart = readSlotBest(o.bestAtStart, 'bestAtStart');
  need((best?.hits ?? 0) >= (bestAtStart?.hits ?? 0), 'best is below the best at the start');

  let terminal: TerminalInfo | null = null;
  if (o.terminal !== null && o.terminal !== undefined) {
    need(isRecord(o.terminal), 'terminal');
    const t = o.terminal as Record<string, unknown>;
    need(t.reason === 'lost' || t.reason === 'abandoned', 'terminal.reason');
    need(t.hits === run.hits, 'terminal.hits does not match the run');
    need(t.club === null || (Number.isSafeInteger(t.club) && (t.club as number) >= 0), 'terminal.club');
    need(run.hits === 0 || (best?.hits ?? 0) >= run.hits, 'terminal result was not settled into the best');
    terminal = { reason: t.reason, hits: run.hits, club: t.club as number | null };
  }
  need((terminal?.reason === 'lost') === (run.status === 'over'), 'terminal outcome and run stage disagree');
  if (terminal?.reason === 'lost') need(livesLeft(run, rules.config) === 0, 'lost run with lives left');

  return {
    schema: SCHEMA_VERSION,
    rulesVersion: RULES_VERSION,
    theme,
    difficulty,
    runId: o.runId as string,
    revision: o.revision as number,
    rules,
    run,
    bag,
    best,
    bestAtStart,
    terminal,
  };
}

/** Validates a stored document for one slot. Never throws; a bad document says why and what is still trustworthy. */
export function parseDoc(raw: string, theme: ThemeId, difficulty: Difficulty): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'corrupt', detail: 'not valid JSON', salvage: { best: null, bag: null } };
  }
  if (!isRecord(data)) return { ok: false, reason: 'corrupt', detail: 'not an object', salvage: { best: null, bag: null } };
  const salvage = () => {
    const a = readBest(data.best);
    const b = readBest(data.bestAtStart);
    const bag = readBag(data.bag);
    return { best: betterBest(a.ok ? a.best : null, b.ok ? b.best : null), bag };
  };
  if (data.schema !== SCHEMA_VERSION || data.rulesVersion !== RULES_VERSION) {
    return { ok: false, reason: 'unsupported', detail: `schema ${String(data.schema)} / rules ${String(data.rulesVersion)}`, salvage: salvage() };
  }
  try {
    return { ok: true, doc: validate(data, theme, difficulty) };
  } catch (e) {
    return { ok: false, reason: 'corrupt', detail: e instanceof Invalid ? e.message : 'unreadable', salvage: salvage() };
  }
}
