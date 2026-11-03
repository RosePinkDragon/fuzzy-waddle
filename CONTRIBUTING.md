# How we work

Every change goes through the same five steps. The **PR rules** check enforces them, and main is protected, so nothing lands without passing.

1. **Open an issue** using the Feature, Bug or Words template.
2. **Branch from main** as `type/<issue>-short-name`, for example `feat/12-difficulty-picker` or `fix/15-long-word-tiles`.
3. **Keep PRs small:** at most 15 changed files per PR, not counting `package-lock.json`, files in `design/` and deleted files. Commit in logical steps, with messages in Conventional Commits format: `type(scope): lowercase subject`, for example `feat(game): add boss rounds`.
4. **Open a PR** from the template. The title follows the same format, and the description starts with `Closes #<issue>`.
5. **Review and merge:** checks must pass, then the owner reviews the commits and squash-merges.

## Types

| Type | Use for |
|---|---|
| feat | New or changed behaviour |
| fix | Bug fixes |
| test | Tests only |
| refactor | Code changes that don't change behaviour |
| docs | Documentation |
| style | Formatting only |
| perf | Performance |
| ci | Pipeline and workflow files |
| build | Build setup and dependencies |
| chore | Everything else (tooling, repo setup) |

## What the PR rules check looks at

- The branch name matches `type/<issue>-short-name`.
- The PR description closes the issue in the branch name.
- The PR title and every commit message pass commitlint (`commitlint.config.mjs`).
- The PR changes 15 files or fewer, not counting `package-lock.json`, files in `design/` and deleted files.

## Working with the agent team

1. **Describe what you want** to Claude in this repo. The BA agent checks store reviews and similar games, writes the issue with its market impact and a recommendation, and labels it `needs-approval`.
2. **Read the issue.** When it's right, swap `needs-approval` for `ready`.
3. **Say "run issue #N".** If the issue changes screens, the UX designer's mockups are posted on the issue first and the label becomes `needs-design-approval`. Look at them (and show them to anyone who reviews designs), then:
   - to approve, swap the label to `ready`
   - to ask for changes, comment with them and swap the label to `design-changes`

   Then say "run issue #N" again.
4. The team lead then runs the senior developer's plan, the developer and coder, QA (including the UX reviewer) and review, then opens the PR. Every step is posted as a comment on the issue, so you can follow along and reply.
5. **Review the PR and merge it.**

The BA's research is kept in the issue labelled `market`, so you can read it on your phone.

The roles and their models are listed in `CLAUDE.md`.

The game's spec is in `BRIEF.md`, and the designs are in `design/screens/`.
