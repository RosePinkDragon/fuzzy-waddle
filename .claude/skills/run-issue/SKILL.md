---
name: run-issue
description: Builds an owner-approved GitHub issue. It checks the label gate, picks Fast, Standard or Full mode by risk, runs only the agents that mode needs, runs the checks and opens a PR. It never pushes to main, merges or approves. Use when the owner says "run issue #N".
argument-hint: <issue number>
---

# Run an approved issue

Input: $ARGUMENTS

You coordinate in the owner's chat; the `developer` writes the code. Keep context small: give each agent a short brief, not the whole thread. Use REST (`gh api repos/RosePinkDragon/fuzzy-waddle/...`), because GraphQL is blocked. Note the time you start.

## 1. Gate

Read the issue and its comments, then check the label:

| Label | What you do |
|---|---|
| `ready` | Go on. |
| `design-changes` | Redo the design step only (step 4), using the owner's comments since the last mockups. |
| `needs-approval`, `needs-design-approval` or none | Stop and tell the owner it needs their approval. Don't touch code. |

- **Approval is the owner's:** only the owner swaps a label to `ready`. The one label you set is `needs-design-approval`, after posting mockups (step 4).
- **No criteria, no run:** if the issue has no Given/When/Then criteria, stop and suggest running `review-issue` first.

## 2. Pick the mode

| Mode | When | Steps |
|---|---|---|
| **Fast** | A bug, CI, tooling or logic-only change. No game-rule, persistence, sharing, security or release change, and no screen change beyond a tiny fix. | developer → checks → PR |
| **Standard** | A game-rule change, a change to an existing screen or its copy, or anything touching persistence, sharing, security or releases, with no new screens. | senior plan → developer → checks → ux-reviewer (if player-facing) → senior review → PR |
| **Full** | A new or materially changed screen or flow (**Design: needed**). | design gate → senior plan → developer → checks (full screenshot sweep) → ux-reviewer → senior review → PR |

- **Senior review whatever the mode:** any change to game rules, persistence, challenge links or sharing, security, or releases gets an independent `senior-developer` review.
- **When in doubt:** if you're unsure between two modes, take the heavier one and say why.
- **Sheets by agent (only what each needs):**
  - `game-systems` for rules
  - `codebase-map` for code changes
  - `design-system` for UI
  - `expo-tooling` for platform, scripts, CI or releases

Post a comment starting with **[Run] Routing**:
- the mode and why
- the agents that will run
- the steps skipped, each with a reason
- the sheets each agent gets

## 3. Branch

Create `type/<n>-short-name` from main and push it. If it already exists from an earlier run, check it out.

## 4. Design gate (Full only)

- **Mockups already approved:** if the issue has a **[UX designer] Mockups** comment and the label is `ready`, the owner approved them. Go to step 5.
- **Otherwise:**
  1. Run `ux-designer`. Its brief: the issue, the branch, the owner's latest comments and `design-system.md`.
  2. Run `ux-reviewer` in **Mockups** mode. Send any **must fix** back to the designer once, then review again.
  3. Post the designer's hand-over as one **[UX designer] Mockups** comment. List any **must fix** still open.
  4. Swap the current label (`ready` or `design-changes`) for `needs-design-approval`.
  5. Stop and tell the owner:
     - to approve, swap the label to `ready`
     - to ask for changes, comment and swap it to `design-changes`

## 5. Plan (Standard and Full)

Run `senior-developer` in **Plan** mode. If the plan needs more than 15 files, stop and ask the owner to split the issue.

## 6. Build

Run `developer` with this brief:

```
Issue #<n>: <title> (branch <branch>)
Mode: <Fast | Standard | Full>
Criteria: <all, or the ones listed>
Plan: <link or "none (Fast)"> · Mockups: <link or "none">
Read: .claude/reference/<sheets> and the files they point to for this change
Checks: npm run verify[, npm run screenshots -- --screens … --themes …][, npm run words:check]
Post: a **[Developer]** comment when done
```

## 7. Checks

Confirm the results in the developer's hand-off, and run anything that's missing yourself:
- `npm run verify`: always.
- `npm run screenshots -- --screens … --themes …`: for UI changes. Run the full sweep in Full mode and before releases.
- `npm run words:check`: for word changes.

Every check you skip gets a reason in the report.

## 8. Reviews

- **`ux-reviewer`:** **Build** mode for player-facing UI or copy, and **Words** mode for word bank changes.
- **`senior-developer` in Review mode:** a fresh run that didn't write the code.
  - Required in Standard and Full, and for the senior-review rule in step 2.
  - In Fast mode without that rule, skip it and say that the owner's PR review covers it.
- **Fixes:** send **must fix** and **changes needed** findings to the developer, then review again.
- **Two rounds at most:** if problems remain after the second fix round, stop and ask the owner.

## 9. PR

1. Open the PR with REST:
   - the title in Conventional Commits format
   - a body from `.github/pull_request_template.md`, starting with `Closes #<n>`
   - at most 15 counted files
2. Wait for the PR rules and CI: `gh api repos/RosePinkDragon/fuzzy-waddle/commits/<sha>/check-runs`.
3. Send any failure to the developer. A failure fix counts as a review round.

## 10. Report

Post a comment starting with **[Run] Report** on the issue, and summarise it in chat:
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

- the label gate fails
- an agent hits its turn limit (`maxTurns`) or fails twice
- a third fix or review round would start
- an owner decision is open
- the change won't fit in 15 files

Before stopping, post what's done and what's blocking on the issue.

## Never

- Never push to main, merge or approve your own PR.
- Never set `ready` or remove `needs-approval`.
- Never let two agents edit the same files at the same time.
