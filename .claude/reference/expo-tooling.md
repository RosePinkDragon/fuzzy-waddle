# Expo and tooling

Platform versions, the helper commands, testing, building and the usual snags. Read this before touching Expo or React Native APIs, dependencies, scripts, CI or releases. For the code layout, see [codebase-map.md](codebase-map.md).

**Source of truth:**
- Platform rules: [`AGENTS.md`](../../AGENTS.md) and the Expo docs for the installed SDK. Never answer Expo questions from memory.
- Exact versions: [`package.json`](../../package.json). Config: [`app.config.ts`](../../app.config.ts) and [`eas.json`](../../eas.json).
- Pipelines: [`.github/workflows/`](../../.github/workflows/). Release plan: [BRIEF.md section 8](../../BRIEF.md#8-release-pipeline-needs-accounts-first).

*Last checked against `c636a30` (main, 2026-11-04).*

## Versions

- **SDK:** read the major version of `expo` in `package.json` (the SDK was 58 at the last check). React Native, React, Reanimated and TypeScript versions are there too.
- **Docs:** `https://docs.expo.dev/versions/v<major>.0.0/`. The index of corrections to common mistakes is `https://docs.expo.dev/llms.txt`.
- **Adding a dependency:** use `npx expo install <package>`, never `npm install`, so you get the SDK-compatible version. Prefer Expo modules over third-party ones.
- **Native folders:** `ios/` and `android/` are generated (Continuous Native Generation). Configure native behaviour in `app.config.ts`, never by hand.
- **Web:** a single-page app (`web.output: 'single'`). WhatsApp challenge links open it.

## Helper commands

| Command | Does | When |
|---|---|---|
| `npm run verify` | Lint, typecheck, unit tests (`--ci`), then the web export. Stops at the first failure. | Before every push that opens or updates a PR |
| `npm run verify:quick` | The same without the web export | While iterating |
| `npm run screenshots` | Builds into `dist-test/` with the test ladder and test hooks, then screenshots each screen at 390×700 and 390×844 into `design/build-screenshots/`. Lists overflow, clipped text and scrolling. Exits 1 on problems. | After UI changes |
| `npm run screenshots -- --screens game,win --themes filmy` | Only the screens and themes affected | Everyday UI PRs |
| `npm run screenshots -- --skip-build` | Reuses the last `dist-test/` build | When re-running quickly |
| `npm run words:check` | The word-bank tests, then a report: tier counts per category (flags any under 5), answers repeated across categories, and the `draft` list. Exits 1 on problems. | When words change, and before a release |
| `node scripts/render-mockups.js` | Renders `design/source/*.dc.html` to PNGs and lists layout problems | Making or reviewing mockups |
| `npm run port-scenes` | Ports scene SVGs from the mockups into `src/themes/scenes/ported/` | After changing scene art |

Planned, not built yet:
- `npm run simulate:game` (#46)
- `npm run issue:brief -- <n>` (#47)

`words:check` can't judge facts, Hinglish or cultural accuracy, so a person still reviews those. `screenshots` finds layout faults, not design quality, so a person or the UX reviewer still compares the images with `design/screens/`.

## Tests

- Jest with the `jest-expo` preset. Files match `**/__tests__/**/*.test.ts(x)`, and `@/` maps to `src/` (both set in `package.json`).
- Game logic gets unit tests through public functions. Every bug fix adds a regression test.
- Screens have no snapshot tests. Use `npm run screenshots`.

## Test switches (build time only)

- `EXPO_PUBLIC_TEST_LADDER=1`: short club ladder (`TEST_CLUB_LADDER` in `src/game/config.ts`).
- `EXPO_PUBLIC_TEST_HOOKS=1`: puts the current answer and run status on `globalThis.__HANGMAN__` (`src/hooks/useRun.ts`).

Release builds refuse both. `app.config.ts` calls `src/lib/releaseGuard.ts`, which fails a build when `RELEASE_BUILD=1` or the EAS profile is `preview` or `production` and either switch is set. `release.yml` sets `RELEASE_BUILD`.

## CI and PR rules

- **`ci.yml`** runs on every PR and push to main: `npm ci`, lint, typecheck, tests and the web export. The Node version is set there, and its token is read-only.
  - On a PR, its "Decide what to run" step lists the changed files and skips steps they can't affect. If the PR changes only `*.md` files (outside `src/` and `assets/`), `LICENSE`, `design/` (except `.ts`/`.tsx`, which tsc checks), `.claude/`, `.vscode/`, `commitlint.config.mjs`, issue and PR templates, or workflows other than `ci.yml`, nothing runs. If it also changes `__tests__/` (outside `src/app/`), `scripts/` or `eslint.config.js`, everything runs except the web export. Everything runs for any other file, `ci.yml` itself, a push to main, or when the file listing fails.
  - The job always runs and reports as `check`, even when its steps are skipped, so don't move this to workflow-level `paths` filters (a required check would wait forever).
  - When you add a new kind of file that can't affect the app, add it to the list in that step. Until then it runs everything, which is safe.
- **Lint:** `npm run lint` covers `src`, `scripts` and `app.config.ts`. `eslint.config.js` gives `scripts/` the Node globals.
- **`pr-rules.yml`** checks four things:
  - the branch is `type/<issue>-short-name`
  - the description says `Closes #<issue>` for that issue
  - the title and every commit pass commitlint (`commitlint.config.mjs`)
  - at most 15 changed files, not counting `package-lock.json`, `design/` and deleted files
- Main is protected. The owner merges with a merge commit (no squash), so every commit message matters.

## Building and releasing

- **Release pipeline:** `release.yml` is written but switched off until the store accounts exist. It runs only when started by hand, and only if `vars.RELEASES_ENABLED == 'true'`. The file's header lists what it needs.
- **EAS profiles** in `eas.json` are `preview` (Play internal testing and TestFlight) and `production`. Run the CLI as `npx eas-cli@latest <command>`.
- **Placeholders:** the name, bundle IDs and web origin are placeholders in `src/config/game.json`.
- **Web hosting:** Vercel is planned in #43.

## Snags

- **GitHub API:** GraphQL is blocked in Claude's cloud sessions, so `gh issue view` and `gh pr view` fail. Use REST: `gh api repos/RosePinkDragon/fuzzy-waddle/issues/<n>`.
- **Playwright** isn't a project dependency, because the cloud sessions bring their own. On your own machine, run `npm i --no-save playwright && npx playwright install chromium`.
- **`dist-test/`** is git-ignored, so screenshot builds never get committed by accident.
- **Sharing on web:** it uses the Web Share API where the browser has it, and otherwise opens WhatsApp's share link (`src/lib/share.ts`).

## Disagreements

None found at the last check.
