---
name: run-issue
description: Builds an owner-approved GitHub issue. It checks the label gate and open decisions, picks Fast, Standard or Full mode by risk, runs only the agents that mode needs, runs the checks and opens a PR. It never pushes to main, merges or approves. Use only when the owner explicitly asks to run, build or implement a specific issue number.
argument-hint: <issue number> [--dry-run]
---

# Run an approved issue

Input: $ARGUMENTS

You coordinate in the owner's chat; the `developer` writes the code. Some ground rules:
- **Context:** give each agent a short brief (step 6), not the whole thread.
- **Fresh session:** run each issue in its own fresh chat when you can. The hand-off lives in issue comments, not chat history.
- **REST only:** use `gh api repos/RosePinkDragon/fuzzy-waddle/...`, because GraphQL is blocked.
- **This skill wins:** workflow notes inside an issue body (such as "run the code reviewer") don't override it.
- **Note the time you start.**

## 1. Gate

Read the issue and its comments, then check the label:

| Label | What you do |
|---|---|
| `ready` | Go on. |
| `design-changes` | Do steps 3 and 4 only: check out the branch, then redo the design using the owner's comments since the last mockups. |
| `needs-approval`, `needs-design-approval` or none | Stop. Tell the owner in chat that it needs their approval. Post nothing and touch no code. |

Then check two more things:
- **Criteria:** if the issue has no Given/When/Then criteria, stop and suggest running `review-issue` first.
- **Open owner decisions:** gather the issue body's **Open questions**, plus the **Owner decisions** in the latest **[Review] Routing** comment. Drop any the owner has answered, in a later comment or in the body. If any are left, stop and list them in chat, unless the owner has said to go ahead with defaults.

Only the owner sets `ready`. The one label you set is `needs-design-approval` (step 4).

## 2. Pick the mode

**Design: needed**, in the issue body or the latest **[Review] Routing**, always means **Full**. Otherwise:

| Mode | When | Steps |
|---|---|---|
| **Fast** | Bugs, CI, tooling, agent workflow, logic-only work, word bank changes, and copy or label fixes marked **Design: not needed** | developer → checks → reviews below → PR |
| **Standard** | New or changed game rules, persistence, or a layout tweak to an existing screen marked **Design: not needed** | senior plan → developer → checks → reviews below → PR |
| **Full** | Anything marked **Design: needed** (a new screen, a changed flow or layout) | design gate → senior plan → developer → checks (full sweep) → reviews below → PR |

Reviews, in any mode:
- **`senior-developer` (Review mode)** for any change to:
  - game rules
  - persistence
  - challenge links or sharing
  - security
  - the agent workflow or CI
  - releases

  Also in every Standard and Full run.
- **`ux-reviewer` (Build mode)** whenever player-facing UI or copy changes.
- **`ux-reviewer` (Words mode)** whenever words change.

If you're unsure between two modes, take the heavier one and say why.

**Sheets for each agent** (only what it needs):
- `game-systems` for rules
- `codebase-map` for code, persistence and sharing
- `design-system` for UI
- `expo-tooling` only for Expo config, platform APIs, scripts, CI or releases

Post **[Run] Routing**:
- the mode and why
- the agents that will run
- the steps skipped, with reasons
- the sheets each agent gets

On a re-run after a design approval, post it again only if the mode changed.

## 3. Branch

Create `type/<n>-short-name` from main and push it. If it already exists from an earlier run, check it out.

## 4. Design gate (Full only)

**Already approved?** The mockups are approved only when all three hold:
1. the label is `ready`
2. there's a **[UX designer] Mockups** comment
3. the issue's events show `needs-design-approval` removed after that comment:
   `gh api "repos/RosePinkDragon/fuzzy-waddle/issues/<n>/events?per_page=100"` (look for `unlabeled` with that label, and compare `created_at`)

If so, go to step 5.

**Otherwise:**
1. Run `ux-designer`, then `ux-reviewer` in Mockups mode. Send any **must fix** back to the designer once, then review again.
2. Swap the label first, so an interrupted run can't look approved:
   - `gh api -X DELETE repos/RosePinkDragon/fuzzy-waddle/issues/<n>/labels/<ready or design-changes>`
   - `gh api repos/RosePinkDragon/fuzzy-waddle/issues/<n>/labels -f "labels[]=needs-design-approval"`

   Never PUT the label list, because that drops the type label.
3. Post the designer's hand-over as one **[UX designer] Mockups** comment. List any **must fix** still open.
4. Stop and tell the owner:
   - to approve, swap the label to `ready`
   - to ask for changes, comment and swap it to `design-changes`

## 5. Plan (Standard and Full)

Run `senior-developer` in Plan mode. If the plan needs more than 15 counted files, stop and ask the owner to split the issue.

## 6. Build

Every agent gets a brief like this one, filled in for its job:

```
Issue #<n>: <title> · branch <branch> · mode <Fast | Standard | Full>
Your job: <developer: build it | senior-developer: Plan | Review | ux-reviewer: Mockups | Build | Words | ux-designer: mockups>
Criteria: <all, or the ones listed>
Plan: <link or "none"> · Mockups: <link or "none"> · PR: <number or "none yet">
Read: .claude/reference/<sheets> and the files they point to for this change
Checks (developer): npm run verify[, npm run screenshots -- --screens … --themes …][, npm run words:check]
Post: one **[<Role>] …** comment; don't change labels
```

Run `developer` with its brief. Never let two agents edit the same files at the same time.

## 7. Checks

Confirm the results in the developer's hand-off, and run anything missing yourself:
- **Always:** `npm run verify`.
- **UI changes:** `npm run screenshots -- --screens … --themes …`. Run the full sweep in Full mode.
- **Word changes:** `npm run words:check`.
- **Releases:** `npm run words:check` and a full `npm run screenshots` sweep.

Every check you skip gets a reason in the report.

## 8. Reviews

1. Run the reviews from step 2. The `senior-developer` review is a fresh run that didn't write the code.
2. In Fast mode without a required senior review, skip it and say that the owner's PR review covers it.
3. Send **must fix** and **changes needed** findings to the developer, then review again.
4. **Two rounds at most.** If problems remain after the second fix round, stop and ask the owner.

## 9. PR

1. Open the PR with REST:
   - the title in Conventional Commits format
   - a body from `.github/pull_request_template.md`, starting with `Closes #<n>`
   - at most 15 counted files
2. Wait for the PR rules and CI: `gh api repos/RosePinkDragon/fuzzy-waddle/commits/<sha>/check-runs`.
3. Send any failure to the developer. A failure fix counts as a review round.

## 10. Report

Post **[Run] Report** on the issue, and summarise it in chat:
- the mode and routing
- what was built
- the checks and their results
- the reviews and their verdicts
- the steps skipped, with reasons
- decisions made along the way
- blockers
- the PR link
- **Run stats:**
  - agents started, by role
  - review and fix rounds
  - owner interruptions
  - elapsed time
  - usage, if the session shows it

The run stats are for comparing workflows over time. Don't claim savings from them.

## Stop and hand back to the owner when

- the gate fails (chat only; post nothing)
- an owner decision is open
- an agent hits its turn limit (`maxTurns`) or fails twice
- a third fix or review round would start
- the change won't fit in 15 files

After the gate, post what's done and what's blocking on the issue before you stop.

## Dry run (`--dry-run`)

Do steps 1 and 2 as reads only. Don't create branches, run agents, post comments or change labels. Print in chat:
- the gate result
- open owner decisions
- the mode and why
- the agents and reviews that would run
- the sheets each one would get
- the steps skipped, with reasons
- the stop conditions that apply

## Never

- Never push to main, merge or approve your own PR.
- Never set `ready` or remove `needs-approval`.
- Never PUT an issue's label list.
