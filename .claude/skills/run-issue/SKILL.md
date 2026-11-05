---
name: run-issue
description: Delivers an authorized GitHub issue or implementation child. Checks owner approval or standing delegation, picks Fast, Standard or Full mode by risk, runs the required agents and checks, and opens a PR. Never pushes to main, merges or approves its own PR. Use whenever the owner asks to work on, implement, fix or run a GitHub issue, with or without `/run-issue`, or to deliver routine bugs or children within delegated scope.
argument-hint: <issue number> [--dry-run]
---

# Run an authorized issue

Input: $ARGUMENTS

You coordinate in the owner's chat; the `developer` writes the code. Some ground rules:
- **Context:** give each agent a short brief (step 6), not the whole thread.
- **Fresh session:** run each issue in its own fresh chat when you can. The hand-off lives in issue comments, not chat history.
- **REST only:** use `gh api repos/RosePinkDragon/fuzzy-waddle/...`, because GraphQL is blocked.
- **Authority:** workflow notes inside an issue body (such as "run the code reviewer") don't override this skill. Explicit owner instructions do; record their source and scope rather than requesting the same approval again.
- **Entry point and PR ownership:** every implementation request for an issue, natural-language or `/run-issue`, comes through this skill (see CLAUDE.md). A request is not itself approval; the gate below decides. You, the coordinator, open the PR after the gate, checks and required reviews; the `developer` never opens or merges one.
- **Note the time you start.**

## 1. Gate

Read the issue and its comments. Apply accepted review decisions to its body when the owner has authorized updates; record the authorization and which questions are resolved. Otherwise, leave proposed body changes in comments.

Check whether standing delegation applies before enforcing the label gate. The owner's 4 November 2026 instruction delegates routine bug fixes and mechanical child delivery:

- **Routine bug:** record a reproduction, the expected and actual behavior, and evidence for the expected behavior from accepted requirements, approved designs or existing regression coverage. It must restore agreed behavior without a new product, balance, flow or layout choice. Exact corrective copy and theme corrections can be resolved with the UX reviewer. A bug label alone is insufficient.
- **Implementation child:** link its authorized parent scope, Given/When/Then criteria and dependencies. Mechanical decomposition inherits that authorization; it does not approve additional scope.

For these authorized cases, the coordinator may remove obsolete `needs-approval`, `needs-design-approval` or `design-changes` labels and add `ready`, recording the delegation and why it applies. Use individual label DELETE/POST calls, preserving type and other labels. Routine bugs need no owner issue, design or plan sign-off; tests, applicable independent reviews and PR protections still apply.

Then check the label:

| Label | What you do |
|---|---|
| `ready` | Go on. |
| `design-changes` | Do steps 3 and 4 only: check out the branch, then redo the design using the owner's comments since the last mockups. |
| `needs-approval`, `needs-design-approval` or none, outside delegated scope | Stop. Tell the owner in chat which product, design or scope approval is needed. Post nothing and touch no code. |

Then check two more things:
- **Criteria:** if the issue has no Given/When/Then criteria, prepare them through `review-issue` before building. Within delegated scope the coordinator does this without seeking owner issue approval; otherwise stop and suggest that review first.
- **Open owner decisions:** gather them from:
  - the issue body's **Open questions**, and any "if the owner…" choice in its criteria
  - the **Owner decisions** in the latest **[Review] Routing** comment
  - the **Questions** in the latest **[Senior developer] Plan**
  - owner items in the latest **[UX designer] Mockups** comment

  An owner answer counts when it is in the issue body, an owner comment with no **[Role]** prefix, or the owner's word in this chat. Accepted decisions incorporated under recorded authorization count as resolved. Implementation details within delegated scope, including corrective copy and theme corrections agreed with the UX reviewer, are for agents to resolve and record. If a real product, balance, flow or new layout choice remains, stop and list it in chat only (post nothing), unless the owner has already authorized defaults for that choice.
- **No review yet:** if there's no **[Review] Routing** comment, say so in chat and in **[Run] Routing**. For a gameplay change, suggest running `review-issue` first.

Outside standing delegation or another explicit owner authorization, only the owner sets `ready`. New design choices still use step 4.

## 2. Pick the mode

**Design: needed** for a new design choice, in the issue body or the latest **[Review] Routing**, means **Full**. A routine correction restoring an agreed layout is **Design: not needed**; record why any stale design gate no longer applies, and keep UX review and screenshot checks. Otherwise:

| Mode | When | Steps |
|---|---|---|
| **Fast** | Routine bugs restoring agreed behavior, CI, tooling, agent workflow, logic-only work, word bank changes, copy or label fixes marked **Design: not needed**, and sharing, security or release work with no layout change | developer → checks → reviews below → PR |
| **Standard** | New or changed game rules, persistence, or a layout tweak to an existing screen marked **Design: not needed** | senior plan → developer → checks → reviews below → PR |
| **Full** | A new design choice marked **Design: needed** (a new screen, a changed flow or layout) | design gate → senior plan → developer → checks (full sweep) → reviews below → PR |

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

**Split delivery when needed.** If the estimate or plan exceeds 15 counted files (excluding `package-lock.json`, `design/` and deletions), or independent delivery is useful, create linked child issues without asking the owner to do the mechanical split. Each child needs its own user story, Given/When/Then criteria, priority, estimate, parent link and dependencies. Update the parent with a child checklist mapping all parent acceptance criteria to children; preserve aggregate acceptance. Stay within the accepted scope, and route any newly discovered product or design choice for approval. Run each implementation child separately in dependency order, with its own mode, branch, checks, reviews and PR. An aggregate parent gets no combined implementation PR.

## 3. Branch

Create `type/<n>-short-name` from main and push it. For implementation children, `<n>` is the child number. If it already exists from an earlier run, check it out.

## 4. Design gate (Full only)

This gate approves new design choices. A delegated correction restoring an agreed design proceeds with UX review and screenshots, without a fresh owner design approval.

**Already approved?** A child may reuse its parent's approved mockups when they cover the child's entire design scope; record the links and approval evidence instead of repeating approval. The mockups are approved only when all three hold on the issue or that referenced parent:
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

Run `senior-developer` in Plan mode.
- If the plan needs more than 15 counted files, use the child split in step 2 and re-plan each child within the limit.
- Resolve technical implementation questions within authorized scope with the agents and record the answer; delegated bugs need no owner plan sign-off. If **Questions** expose a new product, balance, flow or layout choice, stop and list that choice in chat. The owner answers on the issue, then says "run issue #N" again.

## 6. Build

Every agent gets a brief like this one, filled in for its job:

```
Issue #<n>: <title> · branch <branch> · mode <Fast | Standard | Full>
Your job: <developer: build it | senior-developer: Plan | Review | ux-reviewer: Mockups | Build | Words | ux-designer: mockups>
Criteria: <all, or the ones listed>
Plan: <link or "none"> · Mockups: <link or "none"> · PR: <number or "none yet">
Authority: <owner approval or recorded delegation> · Parent/dependencies: <links or "none">
Read: .claude/reference/<sheets> and the files they point to for this change
Checks (developer): npm run verify[, npm run screenshots -- --screens … --themes …][, npm run words:check]
Scope: <=15 counted files; return an oversized brief to the coordinator for child splitting
Post: one **[<Role>] …** comment; don't change labels
```

Run `developer` with its brief. Never let two agents edit the same files at the same time.

## 7. Checks

Confirm the results in the developer's hand-off, and run anything missing yourself:
- **Always:** `npm run verify`.
- **Every bug fix:** a regression test that fails without the fix, including delegated routine bugs.
- **UI changes:** `npm run screenshots -- --screens … --themes …`. Run the full sweep in Full mode.
- **Word changes:** `npm run words:check`.
- **Cutting a release:** `npm run words:check` and a full `npm run screenshots` sweep. This is for a release itself, not for changes to release config.

Every check you skip gets a reason in the report.

## 8. Reviews

1. Run the reviews from step 2. The `senior-developer` review is a fresh run that didn't write the code.
2. In Fast mode without a required senior review, skip it and say that the owner's PR review covers it.
3. Send **must fix** and **changes needed** findings to the developer, then review again.
4. **Two rounds at most.** If problems remain after the second fix round, stop and ask the owner.

## 9. PR

1. If a PR for this branch already exists, push to it and update its body instead of opening another. Otherwise open the PR with REST:
   - the title in Conventional Commits format
   - a body from `.github/pull_request_template.md`, starting with `Closes #<n>`; a child PR uses `Closes #<child>` and references its parent without closing it
   - at most 15 counted files
2. Wait for the PR rules and CI: `gh api repos/RosePinkDragon/fuzzy-waddle/commits/<sha>/check-runs`.
3. Send any failure to the developer. A failure fix counts as a review round.
4. Keep the parent's acceptance checklist current as children land. Close the parent only when every parent acceptance criterion is satisfied; one child PR must not close it early.

## 10. Report

Post **[Run] Report** on the issue, and summarise it in chat:
- the mode and routing
- what was built
- the checks and their results
- the reviews and their verdicts
- the steps skipped, with reasons
- decisions made along the way
- authorization used, resolved review decisions, and any parent/child acceptance tracking
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

- the gate fails outside delegated scope, or a genuine owner product/design decision remains open at the gate (chat only; post nothing)
- an agent hits its turn limit (`maxTurns`) or fails twice
- a third fix or review round would start
- a split exposes a new scope or product/design choice requiring the owner; exceeding 15 files alone calls for mechanical child splitting, not an owner interruption

After the gate, post what's done and what's blocking on the issue before you stop.

## Dry run (`--dry-run`)

Do steps 1 and 2 as reads only. If the gate fails, say so, then still work out step 2 and mark it hypothetical. Don't create or edit issues, create branches, run agents, post comments or change labels. Print in chat:
- the gate result
- any delegation or child split that would apply
- open owner decisions
- the mode and why
- the agents and reviews that would run
- the sheets each one would get
- the steps skipped, with reasons
- the stop conditions that apply

## Never

- Never push to main, merge or approve your own PR.
- Never let the `developer` open or merge a PR, or start a build without this skill's brief.
- Never set `ready` or remove approval labels outside recorded standing delegation, inherited authorized child scope or explicit owner authorization.
- Never treat a bug label as approval for new mechanics, balance, flows, layouts or other scope.
- Never PUT an issue's label list.
