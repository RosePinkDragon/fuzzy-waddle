/**
 * Release guard: test-only switches must never reach a shipped build.
 * Pure and import-free, because app.config.ts loads it through the Expo
 * config loader (no `@/` alias there).
 */
export const TEST_ONLY_ENV = ['EXPO_PUBLIC_TEST_HOOKS', 'EXPO_PUBLIC_TEST_LADDER'] as const;

type Env = Record<string, string | undefined>;

/** RELEASE_BUILD=1, or an EAS build on the preview or production profile. */
export function isReleaseBuild(env: Env): boolean {
  return (
    env.RELEASE_BUILD === '1' ||
    env.EAS_BUILD_PROFILE === 'preview' ||
    env.EAS_BUILD_PROFILE === 'production'
  );
}

/** The test-only variables set to any non-empty value. */
export function releaseEnvProblems(env: Env): string[] {
  return TEST_ONLY_ENV.filter((name) => (env[name] ?? '') !== '');
}

/** Throws if this is a release build and any test-only switch is set. */
export function assertReleaseEnv(env: Env): void {
  if (!isReleaseBuild(env)) return;
  const problems = releaseEnvProblems(env);
  if (problems.length === 0) return;
  const many = problems.length > 1;
  throw new Error(
    `Release build blocked: ${problems.join(', ')} ${many ? 'are' : 'is'} set. ` +
      `These are test-only switches. Unset ${many ? 'them' : 'it'} ` +
      `(check your shell and .env* files) and build again.`,
  );
}
