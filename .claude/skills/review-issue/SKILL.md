---
name: review-issue
description: Reviews an unapproved GitHub issue or a rough requirement before the owner approves it. Classifies its gameplay, product, UX and technical risk, runs only the specialists it needs, and posts their reviews plus a routing summary. Never labels an issue ready and never writes code. Use when the owner asks to review an issue, or describes a new requirement and asks for it to be written up or reviewed.
argument-hint: <issue number or rough idea> [--dry-run]
---

# Review an issue before approval

Input: $ARGUMENTS

You run this in the owner's chat. You coordinate, and the specialists judge. Keep context small: read only what each step needs, and give each specialist a short brief instead of the whole thread. GraphQL is blocked, so use REST (`gh api repos/RosePinkDragon/fuzzy-waddle/...`).

## 1. Read

**An issue number.** Read the issue and its comments:
- `gh api repos/RosePinkDragon/fuzzy-waddle/issues/<n>`
- `gh api repos/RosePinkDragon/fuzzy-waddle/issues/<n>/comments`

**A rough idea with no issue.**
1. Look for duplicates: `gh api "repos/RosePinkDragon/fuzzy-waddle/issues?state=open&per_page=100"`.
2. Write the issue:
   - **A product idea:** run `business-analyst` in **Write** mode, then go on with that issue.
   - **A bug or a technical task:** write it yourself from `.github/ISSUE_TEMPLATE/` (user story, Given/When/Then criteria, priority, estimate). Label it with its type and `needs-approval`.
3. Note who wrote it. The author never reviews its own work (step 3).

**The label decides whether to go on.**
- `needs-approval`, or no approval label: go on.
- `ready`, `needs-design-approval` or `design-changes`: it's already approved. Say so and stop, unless the owner explicitly asks for a re-review.
- A closed issue: stop.

## 2. Classify

Mark each signal that applies, with a one-line reason taken from the issue.

| Signal | Looks like | Who reviews now | Sheets |
|---|---|---|---|
| **Gameplay or economy** | Lives, difficulty, word pools, boss rounds, milestones, power-ups, scoring, run persistence, anything a player could exploit | `game-designer` | `game-systems` |
| **Product value** | It's unclear who it helps or whether to build it now; a new feature area; a monetisation or market question. A cost note on its own isn't one. | `business-analyst` in **Review** mode | none |
| **New screen or changed flow or layout** | A screen that doesn't exist yet, a new state on a screen, a changed flow | Nobody yet. Record **Design: needed**; `ux-designer` runs after approval. | `design-system` |
| **Copy or label change only** | New wording on an existing screen | Nobody now, and no mockups. Record **Design: not needed**; `ux-reviewer` checks it after the build. | `design-system` |
| **Technical risk** | Persistence, challenge links or sharing, security, Expo config or platform APIs, CI or releases, likely more than 15 files | Nobody yet. Record the risk and the size; `senior-developer` reviews after the build. | `codebase-map`, plus `expo-tooling` only for Expo config, platform APIs, CI or releases |

- **Skip rule:** bugs, CI or tooling, and logic-only changes skip the BA and UX unless the issue raises a concrete product or visual question. Give every skipped specialist a reason.
- **Fallback:** if you can't tell whether the game designer, the BA or a design step is needed, don't guess. Post the routing comment (step 4) with that question as an owner decision, and stop.

## 3. Brief and run the specialists

The author never reviews its own work:
- **The BA wrote the issue in this run:** don't run the BA again in Review mode. Cite its write-up instead.
- **You wrote the issue:** say "written by review-issue; no independent review" in the routing comment, and leave the recommendation to the owner unless a specialist ran.

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
- **Size:** the estimate, and whether it fits in 15 files or needs splitting.
- **Recommendation:** approve as written, revise before approval, or defer. Take the most cautious one from the specialists, unless you say why not.
- **Owner decisions:** numbered, from every review plus any unanswered **Open questions** in the issue body.
- **Proposed criteria changes:** quoted, for the owner to accept. Never edit the issue body unless the owner asks.

End it with: "To approve, swap `needs-approval` for `ready`."

## 5. Tell the owner

In chat, write two or three lines: the recommendation, how many decisions are waiting, and the comment link.

## Dry run (`--dry-run`)

Do steps 1 and 2 as reads only. Don't run agents, post comments, create or edit issues, or change labels. For a rough idea, print the issue you would write instead of creating it. Print in chat:
- the label check
- the classification
- who you'd run and who you'd skip, with reasons
- the sheets each would get
- **Design** and **Size**
- the owner decisions
- any stop condition that applies

## Never

- Never add or remove `ready`, or any other approval label. The one exception is labelling an issue you just created `needs-approval`.
- Never write code or create branches.
- Never change accepted requirements on your own. Suggestions go in comments.
