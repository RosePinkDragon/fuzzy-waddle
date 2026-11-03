# Instructions for Claude and other agents

This repo is an Expo (React Native) hangman game. The product spec is `BRIEF.md`, and the designs are in `design/screens/`.

Expo-specific rules: @AGENTS.md

## Workflow (required; the PR rules check enforces it)

1. **Issue first.** Before changing anything, find or open a GitHub issue for the work. Write it like the templates in `.github/ISSUE_TEMPLATE/`: user story, Given/When/Then acceptance criteria, priority, estimate. GraphQL is blocked in cloud sessions, so use the REST API:
   `gh api repos/RosePinkDragon/fuzzy-waddle/issues -f title="feat: ..." -F body=@issue.md -f "labels[]=feature"`
2. **Branch from main** as `type/<issue>-short-name`. Types: feat, fix, chore, docs, test, refactor, ci, style, perf, build. Example: `feat/12-difficulty-picker`.
3. **Small commits.** At most 15 changed files per commit (`package-lock.json` doesn't count). Messages in Conventional Commits format: `type(scope): lowercase subject`. End each message with the attribution lines your session asks for.
4. **Before opening a PR,** run lint, typecheck and tests, then run the `code-reviewer` agent on your diff and fix what it finds. For UI changes, also run `screen-checker`.
5. **Open a PR** from `.github/pull_request_template.md`. The title is in Conventional Commits format, and the description starts with `Closes #<issue>`. With REST:
   `gh api repos/RosePinkDragon/fuzzy-waddle/pulls -f title="feat: ..." -f head=<branch> -f base=main -F body=@pr.md`
6. **Never push to main and never merge.** The owner reviews and merges.

## Quality bar

- Game logic stays in plain TypeScript modules with unit tests. Every bug fix adds a regression test.
- Themes are config: a new category means new config and words, not new screens. All copy lives in the strings file.
- Follow the UI rules in `BRIEF.md` section 4.
- Word bank entries stay `draft` until the owner approves them.

## Review agents (`.claude/agents/`)

- `code-reviewer`: reviews a diff against `BRIEF.md` and these rules. Read-only.
- `test-keeper`: writes and updates tests.
- `screen-checker`: screenshots the web build at 390×844 and 390×700 and compares it with `design/screens/`.
- `word-bank-checker`: validates the word bank files.
