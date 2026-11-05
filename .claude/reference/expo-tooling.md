# Expo and tooling

Platform versions, the helper commands, testing, building and the usual snags. Read this before touching Expo or React Native APIs, dependencies, scripts, CI or releases. For the code layout, see [codebase-map.md](codebase-map.md).

**Source of truth:**
- Platform rules: [`AGENTS.md`](../../AGENTS.md) and the Expo docs for the installed SDK. Never answer Expo questions from memory.
- Exact versions: [`package.json`](../../package.json). Config: [`app.config.ts`](../../app.config.ts) and [`eas.json`](../../eas.json).
- Pipelines: [`.github/workflows/`](../../.github/workflows/). Release plan: [BRIEF.md section 8](../../BRIEF.md#8-release-pipeline-needs-accounts-first).

*Last checked against `05b4774` plus #46 and #73 (2026-11-05).*

## Versions

- **SDK:** read the major version of `expo` in `package.json` (the SDK was 58 at the last check). React Native, React, Reanimated and TypeScript versions are there too.
- **Docs:** `https://docs.expo.dev/versions/v<major>.0.0/`. The index of corrections to common mistakes is `https://docs.expo.dev/llms.txt`.
- **Adding a dependency:** use `npx expo install <package>`, never `npm install`, so you get the SDK-compatible version. Prefer Expo modules over third-party ones.
- **Pinned dev tools:** `tsx` (runs the simulator) and `@types/node` are dev dependencies pinned to an exact version, which `expo install` can't do for dev dependencies. Add this kind with `npm install -D --save-exact <package>@<version>` and check there's no `^` in `package.json`. `expo install` puts them under `dependencies`.
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
| `npm run issue:brief -- <n>` | Prints a brief of an issue in at most 150 lines (`--max-lines`, at least 40): title, labels, user story, criteria, priority, estimate, linked issues and PRs, file paths, and **[Role]** and owner comments newest first with links. Says what it cut and how to get it back: `--full` prints everything uncut (every comment, in full), and `--comment <id>` prints one comment in full; the brief shows each comment's id. The acceptance criteria are trimmed last. `--json` prints the same trimmed content as JSON, plus `cut` and `textLines`; the line limit applies to the text, not the pretty-printed JSON. Read only: GETs through `gh api` (REST). | Briefing an agent on an issue instead of handing it the whole thread |
| `npm run words:sources -- Diwali "Holi" Q10434` (or a file of titles, one per line) | Fetches Wikipedia intro extracts (20 titles per request, redirects followed) and Wikidata labels, aliases (English and Hindi) and sitelinks (50 IDs per request), one request at a time with a delay, backing off on 429 and 5xx and honouring `Retry-After`. Saves each source to `.cache/word-sources/` (git-ignored) with its URL, revision ID and fetch time, and reuses it on later runs. `--refresh` fetches again, `--show` prints the text and aliases, `--no-wikidata` skips Wikidata, `--delay <ms>` changes the pause. Lists titles it couldn't fetch as "not fetched" with the reason, and exits 1 if there are any. Never invents content. | Gathering facts on Wikipedia or Wikidata for word and content research, instead of many single page calls. Use WebFetch for other sites and for pages it can't fetch. |
| `npm run simulate:game -- --runs 1000 --seed 7 --theme filmy --difficulty easy --preset casual --power-ups greedy` | Plays whole runs of the real rules with a simulated player and prints lost vs capped runs, club survival, boss rounds, power-ups and repeats. Every report opens with **ASSUMPTIONS — NOT PLAYER DATA** and lists the player model, policy, bag mode, cap, seed, git SHA and config. `--compare current proposed.json` runs two configs on the same seeds and prints deltas. `--config <file>`, `--json`, `--cap`, `--bags reset` and `--help` also exist. Exits 1 with a reason on a bad flag, file or config. | Comparing balance changes (for example #33), and for the `game-designer` |

**The simulator** lives in `scripts/simulate/` and runs under `tsx` (pinned), not Jest. `scripts/simulate-game.ts` is the only file with Node I/O. A proposed config may hold only the settings in the [game config whitelist](game-systems.md#game-config-simulation-only), and the game's own validator checks it. The player presets are assumptions with a documented calibration check (see [game-systems.md](game-systems.md#game-config-simulation-only)), so compare paired deltas and run a sensitivity pair before drawing conclusions. Reports print a `Config changes:` line, and the JSON header carries the full validated config. A change to `src/hooks/useRun.ts` `drawInto` also needs `drawWord` in `scripts/simulate/rules.ts` updated.

`words:check` can't judge facts, Hinglish or cultural accuracy, so a person still reviews those. `screenshots` finds layout faults, not design quality, so a person or the UX reviewer still compares the images with `design/screens/`.

## Tests

- Jest with the `jest-expo` preset. Files match `**/__tests__/**/*.test.ts(x)`, and `@/` maps to `src/` (both set in `package.json`).
- The simulator's tests (`scripts/simulate/__tests__/`) run in the same Jest run. They cover the run loop, players, report and CLI through a fake `Io`.
- `words:sources` keeps its parsing, backoff, batching and cache logic in `scripts/lib/wordSources.js`, tested in `scripts/__tests__/wordSources.test.ts` with a fake `fetch`, `sleep` and clock (no live network, no waiting). `scripts/words-sources.js` is the only file with file and network I/O.
- Game logic gets unit tests through public functions. Every bug fix adds a regression test.
- Screens have no snapshot tests. Use `npm run screenshots`.

## Test switches (build time only)

- `EXPO_PUBLIC_TEST_LADDER=1`: short club ladder (`TEST_CLUB_LADDER` in `src/game/config.ts`).
- `EXPO_PUBLIC_TEST_HOOKS=1`: puts the current answer and run status on `globalThis.__HANGMAN__` (`src/hooks/useRun.ts`).

Release builds refuse both. `app.config.ts` calls `src/lib/releaseGuard.ts`, which fails a build when `RELEASE_BUILD=1` or the EAS profile is `preview` or `production` and either switch is set. `release.yml` sets `RELEASE_BUILD`.

## CI and PR rules

- **`ci.yml`** runs on every PR and push to main: `npm ci`, lint, typecheck, tests, the web export, and a simulator smoke run (`simulate:game`, text and `--json`, which proves `tsx` and the `@/` alias work in CI). The Node version is set there, and its token is read-only.
  - On a PR, its "Decide what to run" step lists the changed files and skips steps they can't affect. If the PR changes only `*.md` files (outside `src/` and `assets/`), `LICENSE`, `design/` (except `.ts`/`.tsx`, which tsc checks), `.claude/`, `.vscode/`, `commitlint.config.mjs`, issue and PR templates, or workflows other than `ci.yml`, nothing runs. If it also changes `__tests__/` (outside `src/app/`), `scripts/` or `eslint.config.js`, everything runs except the web export. Everything runs for any other file, `ci.yml` itself, a push to main, or when the file listing fails.
  - The job always runs and reports as `check`, even when its steps are skipped, so don't move this to workflow-level `paths` filters (a required check would wait forever).
  - When you add a new kind of file that can't affect the app, add it to the list in that step. Until then it runs everything, which is safe.
- **Lint:** `npm run lint` covers `src`, `scripts` and `app.config.ts`. `eslint.config.js` gives `scripts/**/*.js` the Node globals. The TypeScript simulator files are linted and type-checked with the rest.
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
