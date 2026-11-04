# Game systems

How a run works, and the rules that must keep holding. Read this before reviewing or changing gameplay: lives, difficulty, words, bosses, milestones, power-ups or saving. For where the code lives, see [codebase-map.md](codebase-map.md).

**Source of truth:**
- Intended rules: [BRIEF.md section 3](../../BRIEF.md#3-game-rules), plus [README "Decisions made while building"](../../README.md#decisions-made-while-building-please-check) for calls the brief left open.
- Built behaviour and every number: [`src/game/config.ts`](../../src/game/config.ts) and the modules it feeds.

This sheet names the numbers' homes instead of copying them. If code and the brief disagree, list it under Disagreements below rather than picking one.

*Last checked against `e91aeb0` plus #51 (2026-11-04).*

## The run loop

`src/game/run.ts` is a pure state machine: `ready → playing → solved → ready …`, with `milestone` after a boss round and `over` when lives run out. `src/hooks/useRun.ts` drives it: it draws words, waits `SOLVED_PAUSE_MS` after a solve, and saves bests and bags. `useFlopDelay` holds the board for `FLOP_DELAY_MS` before the flop or challenge result screen.

| System | Rule (where the numbers live) | Code | Tests |
|---|---|---|---|
| **Hits** | Each solved word is +1 hit. A run is endless until lives run out. | `run.ts` `settleIfSolved` | `lives.test.ts`, `milestones.test.ts` |
| **Lives** | They carry over from word to word, and a wrong guess costs one. Max lives and pre-locked marks per difficulty are in `DIFFICULTY_RULES`. The sign always shows `LIVES_MARKS` marks. | `run.ts` `guess`, `difficulty.ts` `lifeMarks` | `lives.test.ts`, `difficulty.test.ts`, `gameConfigRules.test.ts` |
| **Difficulty** | Each difficulty sets lives, which clues show, and which word tiers it draws (`DIFFICULTY_RULES[d].pool`). | `difficulty.ts` | `difficulty.test.ts` |
| **Word pools** | `poolFor(theme, difficulty)`. Masala Mix draws from every category. Drafts are playable while `INCLUDE_DRAFT_WORDS` is true. | `src/data/words/index.ts` | `wordBank.test.ts` |
| **Shuffle bag** | One bag per theme and difficulty, saved between runs, with no repeats until the pool is used up. IDs that leave the pool are dropped. | `shuffleBag.ts` `drawNext` | `shuffleBag.test.ts` |
| **Milestones** | Club ladder from `CLUB_LADDER`, continued by `LADDER_EXTENSION` after the last rung. | `milestones.ts` `Ladder` | `milestones.test.ts`, `gameConfigRules.test.ts` |
| **Boss rounds** | The word that would reach the next club. It's drawn at random from the top `BOSS_CANDIDATES` by `bossScore` (harder tier, then more distinct letters, then length). | `shuffleBag.ts` `drawBoss`, `run.ts` `nextIsBoss` | `shuffleBag.test.ts`, `milestones.test.ts`, `gameConfigRules.test.ts` |
| **Boss reward** | Clearing it refills lives to the difficulty's max, gives `MILESTONE_REWARD`, and shows the milestone (win) screen. | `run.ts` `settleIfSolved` | `lives.test.ts`, `powerUps.test.ts`, `gameConfigRules.test.ts` |
| **Power-ups** | Four slots, the same in every theme (only names and icons change). Starting counts are in `START_POWER_UPS`. A slot is usable only when it would do something (`canApply`). | `powerUps.ts` | `powerUps.test.ts`, `gameConfigRules.test.ts` |
| **Answers** | Uppercase, canonical spelling. Only A–Z can be guessed. Spaces split words, and digits and punctuation are revealed automatically. | `answer.ts` | `answer.test.ts` |
| **Tiles** | Wrap at word breaks and shrink between the max and min size until the answer fits. | `tileLayout.ts` | `tileLayout.test.ts` |
| **Bests** | One per theme and difficulty: hits and club, saved when a run ends or reaches a club. | `useRun.ts`, `storage.ts` `keys.best` | `storage.test.ts` (the wrapper only) |
| **Challenges** | A link carries the word ID, never the answer. It plays one word with that word tier's rules, and lives don't matter beyond that word. | `src/app/c/[wordId].tsx`, `lib/share.ts` | `share.test.ts` (links) |

## Game config (simulation only)

`src/game/gameConfig.ts` makes the economy rules injectable so the balance simulator (#46) can run proposed numbers through the real game code. The live app never passes a config and always plays the defaults.

**The whitelist.** Nothing else is injectable:

| `GameConfig` field | Default comes from |
|---|---|
| `lives` (by difficulty) | `DIFFICULTY_RULES[d].lives` |
| `ladder` | `CLUB_LADDER` (never `TEST_CLUB_LADDER`, so a baseline can't pick up a build-time switch) |
| `ladderExtension` | `LADDER_EXTENSION` |
| `startPowerUps` | `START_POWER_UPS` |
| `milestoneReward` | `MILESTONE_REWARD` |
| `removeWrongCount` | `REMOVE_WRONG_COUNT` |
| `bossCandidates` | `BOSS_CANDIDATES` |

**How it works:**
- `defaultGameConfig` is built from `config.ts` and frozen. Only `config.ts` changes live numbers.
- Config is an optional last argument, like `ladder`: `maxLives`, `livesLeft`, `settleIfSolved`, `guess` and `applyPowerUp`. Where a function already takes the single value (`startRun`'s `powerUps`, `drawBoss`'s `candidates`), pass `config.startPowerUps` or `config.bossCandidates` to it.
- Pass a matching ladder and config together: `ladderFor(config)`, then `config`. `Ladder` grows lazily and is built once, so the two can drift apart if built separately.
- `rulesFor`, `lifeMarks`, `GameView`, `MilestoneView` and the hooks take no config. The UI only ever shows live values, and `lifeMarks` keeps using the live `locked` marks.
- The config is never stored on `RunState`, so a saved run (#32) can't carry its own tuning.
- `mergeGameConfig(base, override)` merges `lives`, `ladderExtension` and `milestoneReward` one level deep. Arrays and numbers replace.
- `validateGameConfig(unknown)` takes parsed JSON and returns `{ ok: true, config }` or `{ ok: false, errors }` with every error and its path. It rejects: unknown keys, non-integers, negative counts, lives outside 1 to `LIVES_MARKS`, fewer than 2 rungs, hits or crore that don't strictly increase, a negative `gapGrowth` (the ladder would stop growing), `croreEvery` or `bossCandidates` or `removeWrongCount` below 1, `startPowerUps` not of length `POWER_UP_SLOTS`, and a reward slot outside the slots. A reward `amount` of 0 is allowed.
- Tests: `gameConfig.test.ts` (validator and merge) and `gameConfigRules.test.ts` (defaults match the constants, seeded runs are identical with and without the default passed, and each setting changes what it controls).
- When a new tuning value becomes injectable, add it to the type, the default, the validator and a test that shows it changes behaviour.

## Slot numbering

The brief numbers the power-up slots **1–4**, but the code indexes them **0–3**:
- `REVEAL` = 0
- `EXTRA_CLUE` = 1
- `UNDO` = 2
- `REMOVE` = 3

"+1 of the slot-1 power-up" in the brief is index `0` in code. Say which numbering you mean in reviews.

## Invariants (a change that breaks one needs owner sign-off)

1. Nothing carries from one run into the next except bests, shuffle bags and the player's name. `startRun` always resets hits, lives, power-ups and status.
2. A word never repeats within a theme and difficulty until its pool is used up, even across sessions.
3. Lives never go below 0 or above the difficulty's max. Pre-locked marks never become live.
4. A boss round is the only way to enter a club, and entering a club always refills lives and grants the reward.
5. Undo gives a life back but leaves the key struck through, because the letter is still known to be wrong. Removed keys are dimmed without a strike.
6. The answer never appears in a URL, share text or scene art.
7. Spaces, digits and punctuation are never guessable and never cost a life.
8. The same rules apply in every theme. Themes change looks and names, never mechanics.

## Not built yet (open issues)

- **#31:** words get harder as a run goes on. Today every word in a run draws from the same pool, apart from bosses.
- **#32:** resume a run after leaving it. Today only bests, bags and the name persist, so leaving a run loses it.
- **#33:** rebalance survival between clubs.
- **#46:** `npm run simulate:game` for comparing balance changes with numbers. It builds on the game config above.

When reviewing these, check them against the invariants above, and against each other: #31 and #33 both change how hard it is to reach the next club.

## Testing aids

- `EXPO_PUBLIC_TEST_LADDER=1` gives a short ladder (`TEST_CLUB_LADDER`), so a milestone comes within a couple of words.
- `EXPO_PUBLIC_TEST_HOOKS=1` exposes the current answer and status on `globalThis.__HANGMAN__`.
- `npm run screenshots` uses both. Release builds refuse them (`src/lib/releaseGuard.ts`, called from `app.config.ts`).

## Disagreements

None found at the last check. Code matches BRIEF section 3 and the README decisions.
