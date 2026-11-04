/**
 * Argument parsing and the run-and-print flow for `npm run simulate:game`.
 * This module does no Node I/O of its own: the entry point passes it an `Io`.
 */
import { CATEGORY_IDS, poolFor } from '@/data/words';
import { DIFFICULTY_ORDER } from '@/game/config';
import { defaultGameConfig } from '@/game/gameConfig';
import type { Difficulty, ThemeId } from '@/game/types';

import { letterOrder, POLICIES, POLICY_NAMES, PRESET_NAMES, presetPlayer, type Policy, type PresetName } from './players';
import { compare, renderCompare, renderJson, renderText, summarize, type ReportContext } from './report';
import { bindRules, defaultCap, loadConfig, makePool, type BoundRules } from './rules';
import { simulateBatch, type BagMode } from './simulate';

export interface Io {
  /** Reads a file as text. Throws if it can't. */
  readFile(path: string): string;
  /** The checked-out revision, or null when git isn't available. */
  gitInfo(): { sha: string; dirty: boolean } | null;
  out(text: string): void;
  err(text: string): void;
}

const THEMES: readonly string[] = [...CATEGORY_IDS, 'masala'];
const BAG_MODES: readonly BagMode[] = ['carry', 'reset'];

export interface CliOptions {
  runs: number;
  seed: number;
  theme: ThemeId;
  difficulty: Difficulty;
  preset: PresetName;
  powerUps: Policy['name'];
  bags: BagMode;
  cap: number | null;
  config: string | null;
  compare: [string, string] | null;
  json: boolean;
  help: boolean;
}

const LIMITS = { runs: [1, 100000], seed: [0, 4294967295], cap: [1, 10000] } as const;

export const USAGE = `Usage: npm run simulate:game -- [options]

Plays whole runs of the real game rules with a simulated player and prints the
results. The player is an assumption, not player data.

Options:
  --runs <n>          runs to simulate, ${LIMITS.runs[0]} to ${LIMITS.runs[1]} (default 1000)
  --seed <n>          seed, ${LIMITS.seed[0]} to ${LIMITS.seed[1]} (default 1)
  --theme <id>        ${THEMES.join(' | ')} (default filmy)
  --difficulty <d>    ${DIFFICULTY_ORDER.join(' | ')} (default easy)
  --preset <name>     ${PRESET_NAMES.join(' | ')} (default casual)
  --power-ups <name>  ${POLICY_NAMES.join(' | ')} (default greedy)
  --bags <mode>       ${BAG_MODES.join(' | ')} (default carry)
  --cap <n>           word cap per run, ${LIMITS.cap[0]} to ${LIMITS.cap[1]} (default: first rung past the ladder, plus 10)
  --config <file>     simulate a proposed config (JSON) instead of the live rules
  --compare <a> <b>   compare two configs, each "current" or a JSON file, on the same seeds
  --json              print JSON instead of text
  --help              show this help

Settings a config may hold: lives, ladder, ladderExtension, startPowerUps,
milestoneReward, removeWrongCount, bossCandidates.
`;

class UsageError extends Error {}

function integer(flag: string, value: string, [min, max]: readonly [number, number]): number {
  if (!/^\d+$/.test(value) || Number(value) < min || Number(value) > max) {
    throw new UsageError(`${flag} must be a whole number from ${min} to ${max} (got "${value}")`);
  }
  return Number(value);
}

function oneOf<T extends string>(flag: string, value: string, allowed: readonly T[]): T {
  if (!(allowed as readonly string[]).includes(value)) {
    throw new UsageError(`${flag} must be one of ${allowed.join(', ')} (got "${value}")`);
  }
  return value as T;
}

export function parseArgs(argv: readonly string[]): CliOptions {
  const o: CliOptions = {
    runs: 1000,
    seed: 1,
    theme: 'filmy',
    difficulty: 'easy',
    preset: 'casual',
    powerUps: 'greedy',
    bags: 'carry',
    cap: null,
    config: null,
    compare: null,
    json: false,
    help: false,
  };
  const seen = new Set<string>();
  const take = (flag: string, i: number): string => {
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) throw new UsageError(`${flag} needs a value`);
    return value;
  };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (!flag.startsWith('--')) throw new UsageError(`unexpected argument "${flag}"`);
    if (seen.has(flag)) throw new UsageError(`${flag} was given more than once`);
    seen.add(flag);
    switch (flag) {
      case '--json':
        o.json = true;
        break;
      case '--help':
        o.help = true;
        break;
      case '--compare':
        o.compare = [take(flag, i), take(flag, i + 1)];
        i += 2;
        break;
      case '--runs':
        o.runs = integer(flag, take(flag, i), LIMITS.runs);
        i += 1;
        break;
      case '--seed':
        o.seed = integer(flag, take(flag, i), LIMITS.seed);
        i += 1;
        break;
      case '--cap':
        o.cap = integer(flag, take(flag, i), LIMITS.cap);
        i += 1;
        break;
      case '--theme':
        o.theme = oneOf(flag, take(flag, i), THEMES) as ThemeId;
        i += 1;
        break;
      case '--difficulty':
        o.difficulty = oneOf(flag, take(flag, i), DIFFICULTY_ORDER);
        i += 1;
        break;
      case '--preset':
        o.preset = oneOf(flag, take(flag, i), PRESET_NAMES);
        i += 1;
        break;
      case '--power-ups':
        o.powerUps = oneOf(flag, take(flag, i), POLICY_NAMES);
        i += 1;
        break;
      case '--bags':
        o.bags = oneOf(flag, take(flag, i), BAG_MODES);
        i += 1;
        break;
      case '--config':
        o.config = take(flag, i);
        i += 1;
        break;
      default:
        throw new UsageError(`unknown option ${flag}`);
    }
  }
  if (o.config !== null && o.compare !== null) throw new UsageError('--config and --compare cannot be used together');
  return o;
}

interface Side {
  source: string | null;
  rules: BoundRules;
}

/** `current` is the live rules; anything else is a JSON file checked by the game's own validator. */
function loadSide(source: string, io: Io): Side {
  if (source === 'current') return { source: null, rules: bindRules(defaultGameConfig) };
  let text: string;
  try {
    text = io.readFile(source);
  } catch (e) {
    throw new UsageError(`${source}: cannot read the file (${(e as Error).message})`);
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new UsageError(`${source}: not valid JSON (${(e as Error).message})`);
  }
  const loaded = loadConfig(json);
  if (!loaded.ok) throw new UsageError(loaded.errors.map((m) => `${source}: ${m}`).join('\n'));
  return { source, rules: bindRules(loaded.config) };
}

/** Runs the CLI. Returns the exit code: 0 on success, 1 on a usage or config problem. */
export function runCli(argv: readonly string[], io: Io): number {
  try {
    const o = parseArgs(argv);
    if (o.help) {
      io.out(USAGE);
      return 0;
    }
    const sources = o.compare ?? [o.config ?? 'current'];
    const sides = sources.map((s) => loadSide(s, io));
    const words = poolFor(o.theme, o.difficulty);
    if (!words.length) throw new UsageError(`no words to draw for ${o.theme} ${o.difficulty}`);
    const pool = makePool(words);
    const player = presetPlayer(o.preset, letterOrder(words));
    const cap = o.cap ?? Math.max(...sides.map((s) => defaultCap(s.rules)));
    const git = io.gitInfo();
    const gitSha = git ? `${git.sha}${git.dirty ? '+dirty' : ''}` : 'unknown';

    const summaries = sides.map((side) => {
      const ctx: ReportContext = { gitSha, configSource: side.source, capSource: o.cap === null ? 'default' : '--cap' };
      const result = simulateBatch({
        rules: side.rules,
        theme: o.theme,
        difficulty: o.difficulty,
        runs: o.runs,
        seed: o.seed,
        cap,
        bags: o.bags,
        player,
        policy: POLICIES[o.powerUps],
        pool,
      });
      return summarize(result, ctx);
    });

    if (summaries.length === 2) {
      const comparison = compare(summaries[0], summaries[1]);
      io.out(o.json ? renderJson(comparison) : renderCompare(comparison));
    } else {
      io.out(o.json ? renderJson(summaries[0]) : renderText(summaries[0]));
    }
    return 0;
  } catch (e) {
    if (!(e instanceof UsageError)) throw e;
    io.err(`simulate:game: ${e.message}\nRun with --help for usage.\n`);
    return 1;
  }
}
