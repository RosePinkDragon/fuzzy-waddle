---
name: review-issue
description: Reviews an unapproved GitHub issue or a rough requirement before the owner approves it. Classifies its gameplay, product, UX and technical risk, runs only the specialists it needs, and posts their reviews plus a routing summary. Never labels an issue ready and never writes code. Use when the owner says "review issue #N" or describes something new to build.
argument-hint: <issue number or rough idea> [--dry-run]
---

# Review an issue before approval

Input: $ARGUMENTS

You run this in the owner's chat. You coordinate and the specialists judge. Keep context small: read only what each step needs, and give each specialist a short brief instead of the whole thread. GraphQL is blocked, so use REST (`gh api repos/RosePinkDragon/fuzzy-waddle/...`).

## 1. Read

- **An issue number:** read the issue and its comments:
  - `gh api repos/RosePinkDragon/fuzzy-waddle/issues/<n>`
  - `gh api repos/RosePinkDragon/fuzzy-waddle/issues/<n>/comments`
- **A rough idea with no issue:**
  1. Look for duplicates: `gh api "repos/RosePinkDragon/fuzzy-waddle/issues?state=open&per_page=100"`.
  2. If it's a product idea, run `business-analyst` in **Write** mode to write the issue, then go on with that issue.
  3. If it's a bug or a technical task, write the issue yourself from `.github/ISSUE_TEMPLATE/`, labelled with its type and `needs-approval`:
     - user story
     - Given/When/Then criteria
     - priority and estimate
- **The label decides whether to go on:**
  - `needs-approval`, or no approval label: go on.
  - `ready`, `needs-design-approval` or `design-changes`: it's already approved. Say so and stop, unless the owner explicitly asks for a re-review.
  - A closed issue: stop.

## 2. Classify

Mark each signal that applies, with a one-line reason taken from the issue.

| Signal | Looks like | Who reviews now | Sheets |
|---|---|---|---|
| **Gameplay or economy** | Lives, difficulty, word pools, boss rounds, milestones, power-ups, scoring, run persistence, anything a player could exploit | `game-designer` | `game-systems` |
| **Product value** | Unclear who it helps, priority calls, a new feature area, money, market fit | `business-analyst` in **Review** mode | none |
| **Player-facing UI** | A new screen, a changed flow, new UI copy | Nobody yet. Record **Design: needed**; `ux-designer` runs after approval. | `design-system` |
| **Technical risk** | Persistence, challenge links or sharing, security, releases or CI, Expo config, likely more than 15 files | Nobody yet. Record the risk and the size; `senior-developer` plans after approval. | `codebase-map`, `expo-tooling` |

- **Skip rule:** bugs, CI or tooling, and logic-only changes skip the BA and UX unless the issue raises a concrete product or visual question. Give every skipped specialist a reason.
- **Fallback:** if you can't tell whether a game-design or UX review is needed, don't guess. Post the routing comment (step 4) with that question as an owner decision, and stop.

## 3. Brief and run the specialists

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
- **Specialists:** who ran (link their comments) and who was skipped, with why.
- **Sheets used.**
- **Design:** needed or not needed, with why.
- **Size:** the estimate, and whether it fits in 15 files or needs splitting.
- **Recommendation:** approve as written, revise before approval, or defer. Take the most cautious one from the specialists, unless you say why not.
- **Owner decisions:** every open question from every review, numbered.
- **Proposed criteria changes:** quoted, for the owner to accept. Never edit the issue body unless the owner asks.

End it with: "To approve, swap `needs-approval` for `ready`."

## 5. Tell the owner

In chat, write two or three lines: the recommendation, how many decisions are waiting, and the comment link.

## Dry run (`--dry-run`)

Do steps 1 and 2 only, and read only.
- **Don't:** run agents, post comments, change labels or edit the issue.
- **Print in chat:**
  - the classification
  - who you'd run and who you'd skip, with reasons
  - the sheets each one would get
  - any stop condition that applies

Use it to check routing.

## Never

- Never add or remove `ready`, `needs-approval` or any other approval label. Only the owner approves.
- Never write code or create branches.
- Never change accepted requirements on your own. Suggestions go in comments.
