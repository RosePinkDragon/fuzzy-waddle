# Codebase map

Where things live and where a change goes. Read this before planning or building code. For game rules, read [game-systems.md](game-systems.md). For screens and tokens, read [design-system.md](design-system.md).

**Source of truth:** the code itself, and the folder tour in [README "How the code is laid out"](../../README.md#how-the-code-is-laid-out). This sheet adds where-to-change guidance. It doesn't repeat that tour.

*Last checked against `e91aeb0` plus #51 and #58 (2026-11-05).*

## Boundaries

| Folder | Holds | Rule |
|---|---|---|
| `src/game/` | Pure TypeScript game logic | No React imports. Every change has unit tests in `src/game/__tests__/`. |
| `src/game/config.ts` | Every tuning number | Change numbers here, never inline in logic or screens. |
| `src/game/gameConfig.ts` | The injectable `GameConfig`, its frozen default and its validator, for the simulator | No numbers of its own: defaults come from `config.ts`. Must not import `run` or `powerUps`. Hooks and screens never pass a config. See [game-systems.md](game-systems.md). |
| `src/game/runSnapshot.ts`, `runSession.ts` | The saved-run core (#58): the `SlotDoc` schema, validation and frozen `SavedRules`, and the pure reducer for guesses, power-ups, continue, abandon, New run and content migration | Injected RNG, ids and word bank. See "Saved runs" in [game-systems.md](game-systems.md). |
| `src/data/words/` | One JSON bank per category, the loader `index.ts`, and the validation test | New entries stay `draft`. See [README "Adding or editing words"](../../README.md#adding-or-editing-words). |
| `src/lib/` | Platform helpers: `storage.ts` (AsyncStorage, `localStorage` on web), `runStore.ts` (the serialized saved-run store), `share.ts`, and `releaseGuard.ts` (stops release builds that set test switches) | `load` and `save` swallow failures, so a game never breaks. `runStore` uses `readRaw` and `writeRaw` and returns explicit outcomes instead. |
| `src/hooks/` | `useRun.ts` joins game logic to screens (bag, bests, haptics, test hooks). It is the legacy path: it doesn't use `runStore` yet, and #59 moves it over. `useChallengeShare.tsx` handles the name prompt and share. `useFlopDelay.ts` holds the board before the result screen. | Keep game rules out of hooks. Call `src/game`. |
| `src/app/` | Expo Router routes only | Non-route code goes elsewhere (see `AGENTS.md`). |
| `src/screens/` | `GameView`, `MilestoneView` (the win screen) and `FlopView` | Shared by run and challenge routes. |
| `src/components/` | Shared UI: `Screen`, `Header`, `SceneBox`, `Tiles`, `Keyboard`, `PowerUpBar`, `CluePanel`, `LivesSign`, `Stamp`, `ShareCard`, `NamePrompt` and others | Theme comes from `ThemeContext` or props, never hard-coded per theme. |
| `src/themes/` | `themes.ts` (six themes as config), `scenes/`, `icons.tsx`, `glyphs.tsx` | `scenes/ported/` is generated. Don't edit it by hand. |
| `src/copy/strings.ts` | Every line of copy, including themed lines | No copy in components. |
| `src/config/game.json` | Game name, web origin, bundle IDs (placeholders) | Read by `app.config.ts` and `strings.ts`. |

## Routes

| Path | File | Shows |
|---|---|---|
| `/` | `src/app/index.tsx` | Home: category picker |
| `/play/[theme]` | `src/app/play/[theme]/index.tsx` | Difficulty picker |
| `/play/[theme]/[difficulty]` | `src/app/play/[theme]/[difficulty].tsx` | A run: `GameView`, then `MilestoneView` or `FlopView` |
| `/c/[wordId]?from=` | `src/app/c/[wordId].tsx` | Challenge: landing, one-word game, result, or bad link |

The web build is a single-page app (`web.output: 'single'` in `app.config.ts`), so every path serves `index.html`.

## Where a change goes

| To change… | Touch |
|---|---|
| Lives, pools, ladder, power-up counts, boss pick size | `src/game/config.ts`, plus tests in `src/game/__tests__/` |
| How a guess, a solve, a boss round or a power-up works | `src/game/run.ts` or `powerUps.ts`, plus tests |
| Let the simulator override a new tuning value | `src/game/gameConfig.ts` (type, default, validator) plus the function that reads it |
| What a saved run holds, or how it migrates | `src/game/runSnapshot.ts` and `runSession.ts` (bump `SCHEMA_VERSION` or `RULES_VERSION` when the layout or the meaning of the rules changes), and `src/lib/runStore.ts` for ordering and outcomes |
| What else gets saved between sessions | `src/lib/storage.ts` keys, and the `useRun.ts` effects that load and save (until #59) |
| A theme's colours, lives sign or power-up names | `src/themes/themes.ts` and `src/copy/strings.ts` (`themeCopy`) |
| A scene's art | `design/source/<Screen>.dc.html`, then `npm run port-scenes` |
| A new category | The five steps in [README "Adding a category"](../../README.md#adding-a-category). No new screens. |
| A screen's layout | `src/screens/` or `src/app/`, with shared parts in `src/components/` |
| Copy | `src/copy/strings.ts` only |
| CI or PR checks | `.github/workflows/ci.yml`, `pr-rules.yml` and `commitlint.config.mjs` |
| Helper commands | `package.json` scripts and `scripts/`. See [expo-tooling.md](expo-tooling.md). |
| Agents, skills and these sheets | `.claude/agents/`, `.claude/skills/` and `.claude/reference/` |

## Tests

- Jest with the `jest-expo` preset. Tests sit in `__tests__/` folders next to the code (`testMatch` in `package.json`).
- `src/game/__tests__/helpers.ts` builds runs and words for tests.
- `src/data/words/__tests__/wordBank.test.ts` validates every word: format, IDs, duplicates, giveaways and phone fit.
- `src/lib/__tests__/` covers challenge links (`share`), the storage wrapper, the saved-run store (`runStore`, with an in-memory storage that can fail or hold writes) and the release guard and its wiring into `app.config.ts`.
- `src/game/__tests__/runSession.test.ts` covers the saved-run document and reducer. `helpers.ts` also holds a small fixed word bank (`bankContent`, `testEnv`).
- There are no component or snapshot tests. Screens are checked with `npm run screenshots`.

## Sizing a change

A PR may change at most 15 files. `package-lock.json`, `design/` and deleted files don't count. A theme-wide UI change often touches `themes.ts`, `strings.ts`, one or two components and a screen. A new mechanic touches `config.ts`, `run.ts` or `powerUps.ts`, their tests, `useRun.ts` and usually a component.

## Disagreements

None found at the last check.
