---
name: review-issue
description: Reviews GitHub issues or rough requirements, applies accepted decisions when authorized, and splits authorized delivery into children. Classifies gameplay, product, UX and technical risk and posts specialist reviews and routing. May mark delegated routine bugs or authorized implementation children ready; never writes code. Use when the owner asks for issue review, authorized updates or routine bug triage.
argument-hint: <issue number or rough idea> [--dry-run]
---

# Review and prepare an issue

Input: $ARGUMENTS

You run this in the owner's chat. You coordinate, and the specialists judge. Keep context small: read only what each step needs, and give each specialist a short brief instead of the whole thread. GraphQL is blocked, so use REST (`gh api repos/RosePinkDragon/fuzzy-waddle/...`).

## 1. Read

**An issue number.** Read the issue and its comments:
- `gh api repos/RosePinkDragon/fuzzy-waddle/issues/<n>`
- `gh api repos/RosePinkDragon/fuzzy-waddle/issues/<n>/comments`

If the issue is closed, stop before making updates.

**A rough idea with no issue.**
1. Look for duplicates: `gh api "repos/RosePinkDragon/fuzzy-waddle/issues?state=open&per_page=100"`.
2. Write the issue:
   - **A product idea:** run `business-analyst` in **Write** mode, then go on with that issue.
   - **A bug or a technical task:** write it yourself from `.github/ISSUE_TEMPLATE/` (user story, Given/When/Then criteria, priority, estimate). Add its type label. Use `needs-approval` unless routine-bug delegation below applies.
3. Note who wrote it. The author never reviews its own work (step 3).

**Apply authorization before the label check.** When the owner accepts recommendations and authorizes updates, incorporate those decisions into the issue body, record the authorization and resolved questions, and don't ask for the same approval again. Without that authorization, leave proposed changes to existing requirements in comments. Applying accepted decisions on an already approved issue does not require a fresh review or approval unless scope changes.

The owner's 4 November 2026 instruction also delegates routine bug fixes and mechanical child delivery. A routine bug must have a reproduction, expected and actual behavior, and evidence that it restores agreed behavior (accepted requirements, approved designs or existing regression coverage). It must not introduce a new product, balance, flow or layout choice. Exact corrective copy and theme corrections can be resolved with the UX reviewer. Record the delegation and why it applies; the coordinator may remove obsolete approval labels and add `ready` without owner issue, design or plan sign-off. A bug label alone is insufficient. Required regression tests, independent senior/UX reviews, checks and PR protections still apply in `run-issue`.

**Then check the label.**

- `needs-approval`, or no approval label: go on.
- `ready`, `needs-design-approval` or `design-changes`: it's already approved. Do authorized issue updates, routine-bug classification or child splitting as requested; otherwise say so and stop unless the owner asks for a re-review. Delegation never resolves a genuine new design choice.

## 2. Classify

Mark each signal that applies, with a one-line reason taken from the issue.

| Signal | Looks like | Who reviews now | Sheets |
|---|---|---|---|
| **Gameplay or economy** | Proposed changes to lives, difficulty, word pools, boss rounds, milestones, power-ups, scoring, run persistence or exploits. Routine bugs restoring agreed rules use that evidence rather than reopening balance decisions. | `game-designer` for new rules or balance decisions | `game-systems` |
| **Product value** | It's unclear who it helps or whether to build it now; a new feature area; a monetisation or market question. A cost note on its own isn't one. | `business-analyst` in **Review** mode | none |
| **New screen or changed flow or layout** | A new screen, state, flow or layout choice. A routine correction restoring an approved layout is **Design: not needed**, with UX review and screenshots after the build. | Nobody yet for new choices. Record **Design: needed**; `ux-designer` runs after approval. | `design-system` |
| **Copy or label change only** | New wording on an existing screen | Nobody now, and no mockups. Record **Design: not needed**; `ux-reviewer` checks it after the build. | `design-system` |
| **Technical risk** | Persistence, challenge links or sharing, security, Expo config or platform APIs, CI or releases, likely more than 15 files | Nobody yet. Record the risk and the size; `senior-developer` reviews after the build. | `codebase-map`, plus `expo-tooling` only for Expo config, platform APIs, CI or releases |

- **Skip rule:** routine bugs, CI or tooling, and logic-only changes skip product discovery and mockups unless they raise a concrete product or new design choice. This does not skip build-stage UX review for UI, copy or words, or required senior review. Give every skipped specialist a reason.
- **Fallback:** use evidence and the relevant specialist to resolve implementation details within delegated scope. If a real product, balance, flow or new layout choice remains, record it as an owner decision rather than treating its bug label as approval. Independently deliverable routine corrections may proceed separately.
- **Owner choices:** an unanswered "if the owner…" choice outside delegated scope is an owner decision, not a reason to call the BA. Choices already resolved under recorded authorization stay resolved.

**Split large delivery.** If work exceeds 15 counted files (excluding `package-lock.json`, `design/` and deletions), or benefits from independent delivery, the coordinator creates linked child issues with user stories, Given/When/Then criteria, priority, estimates and dependencies. Maintain a parent checklist mapping every parent acceptance criterion to children. Mechanical splitting needs no owner involvement. Children inherit the parent's authorization status: record accepted scope and mark implementation children `ready` once criteria and dependencies are clear; children of unapproved scope retain `needs-approval`. Proposed new scope or product/design choices still need approval. Each implementation child gets its own branch and PR in `run-issue`: `Closes #<child>`, plus a parent reference. Keep the parent open until all aggregate acceptance criteria are satisfied.

## 3. Brief and run the specialists

The author never reviews its own work:
- **The BA wrote the issue in this run:** don't run the BA again in Review mode. Cite its write-up instead.
- **You wrote the issue:** say "written by review-issue; no independent review" in the routing comment. Outside delegated routine bugs or inherited authorized child scope, leave the recommendation to the owner unless a specialist ran. Delegation does not count as independent specialist review.

Give each specialist a brief of about 15 lines:

```
Issue #<n>: <title>
Judge: <the signals that sent it to you, with their reasons>
Read: .claude/reference/<one or two sheets> and the files they point to for this change
Related: <issues to read alongside, e.g. #33 with #31>
Post: one **[<Role>] Review** comment with a recommendation (approve as written / revise before approval / defer) and owner decisions. Don't edit the issue or its labels.
```

- Run independent specialists in parallel.
- Each specialist runs once; don't loop.
- If one fails or hits its turn limit, note it in the routing comment and carry on.

## 4. Post the routing summary

Post one comment starting with **[Review] Routing**:
- **Classification:** each signal with its reason.
- **Specialists:** who ran (link their comments) and who was skipped, with why. Say who wrote the issue.
- **Sheets used.**
- **Design:** needed or not needed, with why. `run-issue` reads this line to choose its mode.
- **Size:** the estimate, whether it fits in 15 files, and any linked children, dependencies and parent acceptance mapping.
- **Recommendation:** approve as written, revise before approval, or defer. Take the most cautious one from the specialists, unless you say why not. If no specialist ran, say so; leave the call to the owner outside recorded delegation or already accepted decisions.
- **Owner decisions:** numbered, unresolved choices outside delegated scope. Check every review, **Open questions** in the issue body and "if the owner…" criteria; list accepted or delegated resolutions separately with their authorization.
- **Criteria changes:** quote proposals when no updates are authorized. When the owner has accepted the decisions and authorized updates, apply them to the body and link the authorization and resolved decisions here. No repeated approval request is needed.
- **Delegation:** if used, record the reproduction and expected-behavior evidence for a routine bug, or the authorized parent scope for a child, and any label changes. New product, balance, flow or layout choices remain explicit owner decisions.

End with the actual next step: "Ready under recorded delegation; continue with `run-issue`", "Accepted decisions applied; existing approval retained", or "To approve, swap `needs-approval` for `ready`" for work still needing owner approval. A new design choice still follows the design gate in `run-issue`.

## 5. Tell the owner

In chat, write two or three lines: the recommendation or delegated readiness, any genuinely unresolved owner decisions, child links if created, and the routing comment link. Routine bugs need no owner approval prompt.

## Dry run (`--dry-run`)

Do steps 1 and 2 as reads only. Don't run agents, post comments, create or edit issues, or change labels. For a rough idea, print the issue you would write instead of creating it. Print in chat:
- the label check
- any authorization, delegated readiness or child split that would apply
- the classification
- who you'd run and who you'd skip, with reasons
- the sheets each would get
- **Design** and **Size**
- the owner decisions
- any stop condition that applies

## Never

- Never change approval labels outside recorded routine-bug delegation, inherited authorized child scope or explicit owner authorization, except adding `needs-approval` to a newly created issue. Preserve unrelated labels with individual DELETE/POST calls; never PUT the label list.
- Never write code or create branches.
- Never invent or expand accepted requirements. Apply accepted changes only under recorded owner authorization; otherwise suggestions go in comments.
- Never treat a bug label as unlimited scope, or skip regression checks, required independent reviews or the two-round fix limit in `run-issue`.
- Never push to main, merge or approve your own PR.
