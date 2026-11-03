# Instructions for Claude and other agents

This repo is an Expo (React Native) hangman game. The product spec is `BRIEF.md`, and the designs are in `design/screens/`.

Expo-specific rules: @AGENTS.md

## Workflow (required; the PR rules check enforces it)

1. **Issue first.** Before changing anything, find or open a GitHub issue for the work. Write it like the templates in `.github/ISSUE_TEMPLATE/`: user story, Given/When/Then acceptance criteria, priority, estimate. GraphQL is blocked in cloud sessions, so use the REST API:
   `gh api repos/RosePinkDragon/fuzzy-waddle/issues -f title="feat: ..." -F body=@issue.md -f "labels[]=feature"`
2. **Branch from main** as `type/<issue>-short-name`. Types: feat, fix, chore, docs, test, refactor, ci, style, perf, build. Example: `feat/12-difficulty-picker`.
3. **Small PRs.** At most 15 changed files per PR, not counting `package-lock.json`, files in `design/` and deleted files. If the work needs more, split the issue first. Commit in logical steps, with messages in Conventional Commits format: `type(scope): lowercase subject`. End each message with the attribution lines your session asks for.
4. **Before opening a PR,** run `npm run verify`. For UI changes, also run `npm run screenshots` (with `--screens` and `--themes` for the screens you touched). For word changes, also run `npm run words:check`. Changes to game rules, persistence, sharing or security, the agent workflow or CI, or releases need an independent `senior-developer` review before the PR.
5. **Open a PR** from `.github/pull_request_template.md`. The title is in Conventional Commits format, and the description starts with `Closes #<issue>`. With REST:
   `gh api repos/RosePinkDragon/fuzzy-waddle/pulls -f title="feat: ..." -f head=<branch> -f base=main -F body=@pr.md`
6. **Never push to main and never merge.** The owner reviews and merges.

## Quality bar

- Game logic stays in plain TypeScript modules with unit tests. Every bug fix adds a regression test.
- Themes are config: a new category means new config and words, not new screens. All copy lives in the strings file.
- Follow the UI rules in `BRIEF.md` section 4.
- Word bank entries stay `draft` until the owner approves them.

## The agent team

Two skills run the team from the owner's chat. Agents are called only when a change needs them.

- **`review-issue`** (`.claude/skills/review-issue/`): "review issue #31".
  - Runs before approval on a `needs-approval` issue or a rough idea.
  - Calls only the specialists the issue needs, then posts their reviews and a **[Review] Routing** summary with owner decisions.
  - Never labels an issue `ready` and never writes code.
- **`run-issue`** (`.claude/skills/run-issue/`): "run issue #12".
  - Runs after the owner approves, on `ready` issues only.
  - Picks Fast, Standard or Full mode by risk, runs the needed agents and checks, opens the PR and posts a **[Run] Report**.

| Agent | Model / effort / turns | Does | Called when |
|---|---|---|---|
| `game-designer` | Opus / medium / 30 | Reviews the loop, difficulty, lives, rewards, fairness and exploits before approval | An issue changes mechanics or the game economy |
| `business-analyst` | Opus / medium / 30 | Market evidence, player needs and build-or-defer calls. Writes issues from rough ideas. | Value or priority is unclear. Skipped for bugs, tooling and logic-only work. |
| `ux-designer` | Opus / medium / 30 | Mockups in `design/` before anything is built | An issue marked **Design: needed** (Full mode) |
| `ux-reviewer` | Sonnet / medium / 30 | Independent review of mockups, built screens and word content | Player-facing UI or copy, new mockups, or word changes |
| `senior-developer` | Opus / high / 40 | Plans Standard and Full runs, and reviews code it didn't write | Every Standard and Full run, plus any change to game rules, persistence, sharing or security, the agent workflow or CI, or releases |
| `developer` | Sonnet / high / 80 | Builds the whole change: logic, UI, copy, words, tests and tooling | Every approved issue |

**Modes** (`run-issue` picks one and logs why):

| Mode | For | Steps |
|---|---|---|
| Fast | Bugs, CI, tooling, workflow, logic-only work, word changes, copy fixes | developer → checks → reviews → PR |
| Standard | Game rules, persistence, a layout tweak marked **Design: not needed** | plan → developer → checks → reviews → PR |
| Full | Anything marked **Design: needed** | design gate → plan → developer → checks → reviews → PR |

Some reviews happen in every mode:
- **Senior review:** whenever game rules, persistence, sharing or security, the workflow or CI, or releases change.
- **UX review:** whenever player-facing UI, copy or words change.

**Approvals:**
- The owner approves each issue by swapping `needs-approval` for `ready`.
- The owner approves each design by swapping `needs-design-approval` for `ready`, or for `design-changes` with a comment asking for changes.
- The owner merges each PR.

**Limits:**
- Review and fix loops stop after two rounds and go back to the owner.
- Each agent has a turn limit (`maxTurns`).

The BA keeps its market research in one open issue labelled `market`, and reuses it for 30 days before researching again.

## Reference sheets (`.claude/reference/`)

Short shared docs that agents load only when a task needs them. They are not skills or agents.

| Sheet | Covers | Read by |
|---|---|---|
| [`codebase-map.md`](.claude/reference/codebase-map.md) | Where code lives and where a change goes | developer, senior-developer |
| [`game-systems.md`](.claude/reference/game-systems.md) | Lives, pools, bosses, milestones, power-ups, saving, invariants | game-designer, developer, senior-developer |
| [`design-system.md`](.claude/reference/design-system.md) | Themes, layout, accessibility, copy, mockup and screenshot steps | ux-designer, ux-reviewer, developer on UI work |
| [`expo-tooling.md`](.claude/reference/expo-tooling.md) | Expo versions, helper commands, tests, CI and releases | developer, senior-developer |

**Which source wins:**
- `BRIEF.md` for product requirements
- code and config for built behaviour (`src/game/config.ts`)
- `src/themes/themes.ts` and `design/source/` for design values
- `AGENTS.md` and the versioned Expo docs for the platform

A sheet links to these rather than copying them, and lists any conflict under Disagreements. **When a change makes a sheet wrong, update the sheet in the same PR.**

## Helper commands

- `npm run verify` (or `verify:quick`, which skips the web export)
- `npm run screenshots`
- `npm run words:check`

[`expo-tooling.md`](.claude/reference/expo-tooling.md) says what each does and when to use it.
