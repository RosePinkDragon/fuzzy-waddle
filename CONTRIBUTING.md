# How we work

Every change goes through the same five steps. The **PR rules** check enforces them, and main is protected, so nothing lands without passing.

1. **Open an issue** using the Feature, Bug or Words template, with Given/When/Then acceptance criteria. Apply accepted review decisions to the issue body when the owner authorizes updates, recording that authorization and the resolved choices without requesting the same approval again. Otherwise, review existing issue bodies read-only.
2. **Branch from main** as `type/<issue>-short-name`, for example `feat/12-difficulty-picker` or `fix/15-long-word-tiles`.
3. **Keep PRs small:** at most 15 changed files per PR, not counting `package-lock.json`, files in `design/` and deleted files. When work exceeds that limit or benefits from independent delivery, the coordinator creates linked child issues with Given/When/Then criteria and dependencies, tracks aggregate acceptance on the parent, and uses a separate branch and PR per implementation child. Mechanical splitting of authorized scope needs no further owner approval. Commit in logical steps, with messages in Conventional Commits format: `type(scope): lowercase subject`, for example `feat(game): add boss rounds`.
4. **Open a PR** from the template. The title follows the same format, and the description starts with `Closes #<issue>`. A child PR starts with `Closes #<child>` and references the parent without closing it. Close the parent only when all parent acceptance criteria are satisfied.
5. **Review and merge:** checks must pass, then the owner reviews the commits and merges with a merge commit. Agents never push to main, merge or approve their own PR. That keeps every commit as it is, so commit messages matter.

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

1. **Describe what you want,** or point at an issue, and say "review issue #N".
   - The `review-issue` skill brings in only the specialists the issue needs: the game designer for mechanics, the BA for product value.
   - It skips product discovery for routine bugs and tooling unless they raise a real product decision.
   - It posts their reviews, a recommendation and any unresolved owner decisions. With your authorization, it incorporates accepted recommendations into the issue body; otherwise, it leaves proposed changes in comments.
2. **Approve new scope and choices.** For work needing your decision, read the issue and reviews, then swap `needs-approval` for `ready` when it's right.
   - Your 4 November 2026 instruction delegates routine bug fixes and mechanical child splitting. A reproducible bug restoring agreed behavior can be marked `ready` and delivered by the coordinator without asking you for issue, design or plan sign-off. The issue records the delegation, reproduction and evidence of expected behavior. Exact corrective copy and theme corrections are resolved with the UX reviewer.
   - A bug label does not approve a new mechanic, balance trade-off, changed flow or new layout choice. Those choices still come to you. Restoring an approved design goes through UX review without a new design approval gate.
   - Implementation children inherit the authorized parent scope. The coordinator records that scope, criteria and dependencies and may mark them `ready`; newly proposed scope still needs your decision.
3. **Say "run issue #N",** or let the coordinator continue delegated routine bugs and implementation children. The `run-issue` skill picks a mode and says why on the issue:
   - **Fast** for routine bugs restoring agreed behavior, tooling, words and copy fixes: for word issues that need outside facts, a researcher saves sources first, then the developer builds, the checks run, and the PR opens.
   - **Standard** for game rules, saving and small layout tweaks: a plan first.
   - **Full** for a new design choice marked **Design: needed**: the UX designer's mockups come first and the label becomes `needs-design-approval`. Look at them, then:
     - to approve, swap the label to `ready`
     - to ask for changes, comment with them and swap the label to `design-changes`

     Then say "run issue #N" again.
   Every bug fix gets a regression test. Every run requires `npm run verify`; UI changes also require screenshots and word changes require `npm run words:check`. Changes to game rules, saving, sharing or security, the workflow or CI, or releases always get an independent senior review. UI, copy and word changes always get a UX review. Standing delegation preserves these checks and reviews.
4. **Follow along on the issue.** Every step posts a comment, and the run ends with a **[Run] Report**: what was built, the checks, the reviews, anything skipped (with why) and the PR link.
   - Loops stop after two review rounds and come back to you.
5. **Review the PR and merge it.**

The BA's research is kept in the issue labelled `market`, so you can read it on your phone.

The agents, their models and when each one is used are listed in `CLAUDE.md`.

The game's spec is in `BRIEF.md`, and the designs are in `design/screens/`.
