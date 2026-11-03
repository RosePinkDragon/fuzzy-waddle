/// <reference types="node" />
import * as fs from 'fs';
import * as path from 'path';

import {
  assertReleaseEnv,
  isReleaseBuild,
  releaseEnvProblems,
  TEST_ONLY_ENV,
} from '../releaseGuard';

const ROOT = path.resolve(__dirname, '../../..');

function loadAppConfig(env: Record<string, string>): unknown {
  const saved = { ...process.env };
  try {
    for (const key of ['RELEASE_BUILD', 'EAS_BUILD_PROFILE', ...TEST_ONLY_ENV]) {
      delete process.env[key];
    }
    Object.assign(process.env, env);
    let loaded: unknown;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      loaded = require(path.join(ROOT, 'app.config.ts'));
    });
    return loaded;
  } finally {
    for (const key of Object.keys(process.env)) {
      if (!(key in saved)) delete process.env[key];
    }
    Object.assign(process.env, saved);
  }
}

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx|js|jsx)$/.test(entry.name) ? [full] : [];
  });
}

describe('release guard', () => {
  it('allows test switches outside a release build', () => {
    expect(() =>
      assertReleaseEnv({
        EXPO_PUBLIC_TEST_HOOKS: '1',
        EXPO_PUBLIC_TEST_LADDER: '1',
      }),
    ).not.toThrow();
  });

  it('allows a release build with no switches', () => {
    expect(() => assertReleaseEnv({ RELEASE_BUILD: '1' })).not.toThrow();
  });

  it.each(['EXPO_PUBLIC_TEST_HOOKS', 'EXPO_PUBLIC_TEST_LADDER'])(
    'blocks %s in a release build',
    (name) => {
      const env: Record<string, string> = { RELEASE_BUILD: '1' };
      env[name] = '1';
      expect(() => assertReleaseEnv(env)).toThrow(name);
    },
  );

  it('names both variables when both are set', () => {
    expect(() =>
      assertReleaseEnv({
        RELEASE_BUILD: '1',
        EXPO_PUBLIC_TEST_HOOKS: '1',
        EXPO_PUBLIC_TEST_LADDER: '1',
      }),
    ).toThrow(/EXPO_PUBLIC_TEST_HOOKS.*EXPO_PUBLIC_TEST_LADDER/);
  });

  it('blocks any non-empty value but allows an empty one', () => {
    expect(releaseEnvProblems({ EXPO_PUBLIC_TEST_HOOKS: 'true' })).toEqual([
      'EXPO_PUBLIC_TEST_HOOKS',
    ]);
    expect(releaseEnvProblems({ EXPO_PUBLIC_TEST_HOOKS: '0' })).toEqual(['EXPO_PUBLIC_TEST_HOOKS']);
    expect(releaseEnvProblems({ EXPO_PUBLIC_TEST_HOOKS: '' })).toEqual([]);
    expect(() =>
      assertReleaseEnv({ RELEASE_BUILD: '1', EXPO_PUBLIC_TEST_HOOKS: '' }),
    ).not.toThrow();
  });

  it('treats EAS preview and production as releases, not development', () => {
    expect(isReleaseBuild({ EAS_BUILD_PROFILE: 'production' })).toBe(true);
    expect(isReleaseBuild({ EAS_BUILD_PROFILE: 'preview' })).toBe(true);
    expect(isReleaseBuild({ EAS_BUILD_PROFILE: 'development' })).toBe(false);
  });

  it('does not treat RELEASE_BUILD=0 or unset as a release', () => {
    expect(isReleaseBuild({ RELEASE_BUILD: '0' })).toBe(false);
    expect(isReleaseBuild({})).toBe(false);
  });

  describe('wiring', () => {
    it('app.config.ts throws under a release env with a test switch', () => {
      expect(() => loadAppConfig({ RELEASE_BUILD: '1', EXPO_PUBLIC_TEST_HOOKS: '1' })).toThrow(
        'EXPO_PUBLIC_TEST_HOOKS',
      );
    });

    it('app.config.ts loads without the release flag', () => {
      expect(() => loadAppConfig({ EXPO_PUBLIC_TEST_HOOKS: '1' })).not.toThrow();
      expect(() => loadAppConfig({ RELEASE_BUILD: '1' })).not.toThrow();
    });

    it('every EXPO_PUBLIC_TEST_ name used in src/ is in TEST_ONLY_ENV', () => {
      const self = path.resolve(__filename);
      const found = new Set<string>();
      for (const file of sourceFiles(path.join(ROOT, 'src'))) {
        if (path.resolve(file) === self) continue;
        for (const m of fs.readFileSync(file, 'utf8').matchAll(/EXPO_PUBLIC_TEST_[A-Z0-9_]+/g)) {
          found.add(m[0]);
        }
      }
      expect(found.size).toBeGreaterThan(0);
      const known: readonly string[] = TEST_ONLY_ENV;
      expect([...found].filter((name) => !known.includes(name))).toEqual([]);
    });
  });
});
