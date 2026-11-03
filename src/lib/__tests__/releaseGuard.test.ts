import { assertReleaseEnv, isReleaseBuild, releaseEnvProblems } from '../releaseGuard';

describe('release guard', () => {
  it('allows test switches outside a release build', () => {
    expect(() =>
      assertReleaseEnv({ EXPO_PUBLIC_TEST_HOOKS: '1', EXPO_PUBLIC_TEST_LADDER: '1' }),
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
});
