/// <reference types="node" />
/**
 * Guard for #58 criterion 5, "challenges excluded": challenge play must never
 * reach the saved-run store (`src/lib/runStore.ts`), so a challenge can't
 * overwrite a real run or best.
 *
 * Two checks:
 * - Structural. The scanner walks every module the challenge route imports,
 *   transitively, and fails if one imports `runStore` (by any alias or relative
 *   path) or touches a `run:*` storage key. The route plays through
 *   `useChallenge`, so it must not reach `useRun` or `runController` either.
 * - Behavioural. `useChallenge` is rendered with a test renderer and played to a
 *   win and to a loss against a mocked AsyncStorage: nothing is written at all.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook } from '@testing-library/react-native';
import * as fs from 'fs';
import * as path from 'path';

import { challengePool } from '@/data/words';
import { ALPHABET, lettersOf } from '@/game/answer';
import { useChallenge } from '@/hooks/useChallenge';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Medium: 'medium' },
}));

const ROOT = path.resolve(__dirname, '../../..');
const SRC = path.join(ROOT, 'src');
const ROUTE = path.join(SRC, 'app', 'c', '[wordId].tsx');
const RUN_STORE = path.join(SRC, 'lib', 'runStore.ts');
const STORAGE = path.join(SRC, 'lib', 'storage.ts');

const CODE_EXT = ['.ts', '.tsx', '.js', '.jsx'];

interface Files {
  read(file: string): string;
  exists(file: string): boolean;
}

/** Every module specifier a source file imports, re-exports, requires or dynamically imports. */
function specifiersIn(text: string): { specs: string[]; dynamic: boolean } {
  const specs: string[] = [];
  const add = (re: RegExp) => {
    for (const m of text.matchAll(re)) specs.push(m[1]);
  };
  // import x from 'a' / import {\n a,\n b\n} from 'a' / export * from 'a' / import type ... from 'a'
  add(/^[ \t]*(?:import|export)\s[^;'"]*?\bfrom\s*['"]([^'"]+)['"]/gm);
  // import 'a'
  add(/^[ \t]*import\s*['"]([^'"]+)['"]/gm);
  // require('a') and import('a')
  add(/\b(?:require|import)\s*\(\s*['"]([^'"]+)['"]\s*\)/g);
  // require(x) / import(x) with a computed specifier can't be followed
  const dynamic = /\b(?:require|import)\s*\(\s*[^'"\s)]/.test(text);
  return { specs, dynamic };
}

/** The local file a specifier points at, or null for a package. Throws if a local one is missing. */
function resolveLocal(from: string, spec: string, files: Files): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = path.join(SRC, spec.slice(2));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(from), spec);
  else return null;
  const candidates = [
    base,
    ...CODE_EXT.map((e) => base + e),
    ...CODE_EXT.map((e) => path.join(base, 'index' + e)),
  ];
  const hit = candidates.find((c) => files.exists(c));
  if (!hit) throw new Error(`${path.relative(ROOT, from)}: cannot resolve '${spec}'`);
  return hit;
}

/** Every source file reachable from `entry`, including it. Assets are leaves. */
function reachableFrom(entry: string, files: Files): Map<string, string> {
  const seen = new Map<string, string>();
  const queue = [entry];
  while (queue.length) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    const text = files.read(file);
    seen.set(file, text);
    const { specs, dynamic } = specifiersIn(text);
    if (dynamic) throw new Error(`${path.relative(ROOT, file)}: computed import/require can't be followed`);
    for (const spec of specs) {
      const target = resolveLocal(file, spec, files);
      if (target && CODE_EXT.includes(path.extname(target))) queue.push(target);
    }
  }
  return seen;
}

/** Why a module graph breaks the rule, one line per problem. */
function runStoreProblems(graph: Map<string, string>, files: Files): string[] {
  const problems: string[] = [];
  for (const [file, text] of graph) {
    const rel = path.relative(ROOT, file);
    for (const spec of specifiersIn(text).specs) {
      if (resolveLocal(file, spec, files) === RUN_STORE) problems.push(`${rel} imports runStore ('${spec}')`);
    }
    if (file === STORAGE) continue; // defines keys.run; using it is what's banned
    if (/\bkeys\s*(?:\.|\[\s*['"])\s*run\b/.test(text) || /\{[^}]*\brun\b[^}]*\}\s*=\s*keys\b/.test(text)) {
      problems.push(`${rel} uses keys.run`);
    }
    if (/['"`]run:/.test(text)) problems.push(`${rel} builds a run:* key by hand`);
  }
  return problems;
}

const disk: Files = {
  read: (f) => fs.readFileSync(f, 'utf8'),
  exists: (f) => fs.existsSync(f) && fs.statSync(f).isFile(),
};

/** In-memory files, keyed by path relative to the repo root. */
function memory(contents: Record<string, string>): Files {
  const abs = new Map(Object.entries(contents).map(([k, v]) => [path.join(ROOT, k), v]));
  return { read: (f) => abs.get(f) ?? '', exists: (f) => abs.has(f) };
}

/** The real files, with some contents replaced (simulates a regression without touching disk). */
function overlay(changes: Record<string, string>): Files {
  const abs = new Map(Object.entries(changes).map(([k, v]) => [path.join(ROOT, k), v]));
  return { read: (f) => abs.get(f) ?? disk.read(f), exists: disk.exists };
}

describe('challenge play never reaches the saved-run store', () => {
  describe('the real challenge route', () => {
    const graph = reachableFrom(ROUTE, disk);

    it('imports neither runStore nor a run:* key, through any module it reaches', () => {
      expect(runStoreProblems(graph, disk)).toEqual([]);
    });

    it('reaches the modules that run a challenge (so the scan is not empty)', () => {
      const reached = [...graph.keys()].map((f) => path.relative(ROOT, f));
      for (const expected of [
        'src/app/c/[wordId].tsx',
        'src/hooks/useChallenge.ts',
        'src/lib/device.ts',
        'src/game/run.ts',
        'src/screens/GameView.tsx',
        'src/lib/share.ts',
      ]) {
        expect(reached).toContain(expected);
      }
      expect(reached).not.toContain('src/lib/runStore.ts');
      expect(reached).not.toContain('src/lib/runController.ts');
      expect(reached).not.toContain('src/hooks/useRun.ts');
      expect(graph.size).toBeGreaterThan(30);
    });

    it('fails when a module the route reaches imports runStore (alias form)', () => {
      const changed = overlay({
        'src/hooks/useChallenge.ts': `import { runStore } from '@/lib/runStore';\n${disk.read(path.join(SRC, 'hooks', 'useChallenge.ts'))}`,
      });
      expect(runStoreProblems(reachableFrom(ROUTE, changed), changed)).toContain(
        "src/hooks/useChallenge.ts imports runStore ('@/lib/runStore')",
      );
    });

    it('fails when a deep module imports runStore (relative form)', () => {
      const changed = overlay({
        'src/game/rng.ts': `import { runStore } from '../lib/runStore';\n${disk.read(path.join(SRC, 'game', 'rng.ts'))}`,
      });
      expect(runStoreProblems(reachableFrom(ROUTE, changed), changed)).toContain(
        "src/game/rng.ts imports runStore ('../lib/runStore')",
      );
    });

    it('fails when the route itself writes a run:* key', () => {
      const changed = overlay({
        'src/app/c/[wordId].tsx': `${disk.read(ROUTE)}\nvoid save(keys.run('filmy', 'easy'), {});\n`,
      });
      expect(runStoreProblems(reachableFrom(ROUTE, changed), changed)).toEqual([
        'src/app/c/[wordId].tsx uses keys.run',
      ]);
    });
  });

  describe('the scanner', () => {
    const entry = 'src/app/c/[wordId].tsx';
    const run = (contents: Record<string, string>) => {
      const files = memory(contents);
      return runStoreProblems(reachableFrom(path.join(ROOT, entry), files), files);
    };
    const store = { 'src/lib/runStore.ts': 'export const runStore = {};' };

    it('passes a graph that never reaches runStore', () => {
      expect(run({ [entry]: "import { a } from '@/a';", 'src/a.ts': 'export const a = 1;' })).toEqual([]);
    });

    it.each([
      ['alias', "import { runStore } from '@/lib/runStore';"],
      ['relative', "import { runStore } from '../../lib/runStore';"],
      ['type import', "import type { runStore } from '@/lib/runStore';"],
      ['side-effect import', "import '@/lib/runStore';"],
      ['re-export', "export { runStore } from '@/lib/runStore';"],
      ['star re-export', "export * from '@/lib/runStore';"],
      ['require', "const s = require('@/lib/runStore');"],
      ['dynamic import', "const s = await import('@/lib/runStore');"],
      ['multi-line import', "import {\n  runStore,\n  other,\n} from '@/lib/runStore';"],
      ['explicit extension', "import { runStore } from '@/lib/runStore.ts';"],
    ])('finds a %s in the route', (_name, line) => {
      const problems = run({ [entry]: line, ...store, 'src/lib/runStore.ts': 'export const runStore = {}; export const other = 1;' });
      expect(problems).toHaveLength(1);
      expect(problems[0]).toContain('imports runStore');
    });

    it('finds runStore three modules deep, through an index file', () => {
      const problems = run({
        [entry]: "import { a } from '@/a';",
        'src/a.ts': "import { b } from './b';",
        'src/b/index.ts': "export { c } from '../c';",
        'src/c.tsx': "import { runStore } from '@/lib/runStore';",
        ...store,
      });
      expect(problems).toEqual(["src/c.tsx imports runStore ('@/lib/runStore')"]);
    });

    it('finds a runStore import in a cycle', () => {
      const problems = run({
        [entry]: "import { a } from '@/a';",
        'src/a.ts': "import { b } from '@/b';",
        'src/b.ts': "import { a } from '@/a';\nimport { runStore } from '@/lib/runStore';",
        ...store,
      });
      expect(problems).toHaveLength(1);
    });

    it('ignores comments, similar names and packages', () => {
      expect(
        run({
          [entry]: [
            "// import { runStore } from '@/lib/runStore';",
            "import { runStoreNote } from '@/lib/runStoreNote';",
            "import AsyncStorage from '@react-native-async-storage/async-storage';",
          ].join('\n'),
          'src/lib/runStoreNote.ts': 'export const runStoreNote = 1;',
          ...store,
        }),
      ).toEqual([]);
    });

    it('finds a hand-built or keyed run:* storage key', () => {
      expect(run({ [entry]: "import { keys } from '@/lib/storage';\nkeys.run('filmy', 'easy');", 'src/lib/storage.ts': 'export const keys = {};' })).toEqual([
        `${entry} uses keys.run`,
      ]);
      expect(run({ [entry]: "import { keys } from '@/lib/storage';\nconst { run } = keys;", 'src/lib/storage.ts': 'export const keys = {};' })).toEqual([
        `${entry} uses keys.run`,
      ]);
      expect(run({ [entry]: "const k = `run:${theme}`;" })).toEqual([`${entry} builds a run:* key by hand`]);
    });

    it('allows storage.ts to define keys.run', () => {
      expect(
        run({
          [entry]: "import { keys } from '@/lib/storage';\nkeys.best('filmy', 'easy');",
          'src/lib/storage.ts': 'export const keys = { run: (t: string) => `run:${t}` };',
        }),
      ).toEqual([]);
    });

    it('throws rather than skip a local import it cannot resolve', () => {
      expect(() => run({ [entry]: "import { x } from '@/missing';" })).toThrow("cannot resolve '@/missing'");
    });

    it('throws on a computed require, which could hide runStore', () => {
      expect(() => run({ [entry]: 'const m = require(path);' })).toThrow("can't be followed");
    });
  });
});

describe('a challenge played through useChallenge writes nothing', () => {
  const storage = AsyncStorage as unknown as Record<'setItem' | 'removeItem' | 'multiSet' | 'mergeItem', jest.Mock>;
  const word = challengePool('filmy')[0];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // RNTL 14 renders and acts asynchronously.
  async function play(letters: string[]) {
    const hook = await renderHook(() => useChallenge(word));
    for (const letter of letters) await act(async () => hook.result.current.press(letter));
    return hook;
  }

  const expectNoWrites = () => {
    for (const method of [storage.setItem, storage.removeItem, storage.multiSet, storage.mergeItem]) {
      expect(method).not.toHaveBeenCalled();
    }
  };

  it('a win', async () => {
    const hook = await play([...lettersOf(word.answer)]);
    expect(hook.result.current.run.status).toBe('solved');
    expectNoWrites();
  });

  it('a loss', async () => {
    const wrong = ALPHABET.filter((l) => !lettersOf(word.answer).has(l));
    const hook = await play(wrong);
    expect(hook.result.current.run.status).toBe('over');
    expectNoWrites();
  });

  it('power-ups included, and it starts with the word it was given', async () => {
    const hook = await renderHook(() => useChallenge(word));
    expect(hook.result.current.run.current?.word.id).toBe(word.id);
    await act(async () => hook.result.current.usePower(0));
    expect(hook.result.current.run.current?.revealed.length).toBe(1);
    expectNoWrites();
  });
});
