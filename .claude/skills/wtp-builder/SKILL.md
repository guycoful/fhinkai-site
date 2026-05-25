---
name: wtp-builder
description: Use when working as a builder inside a WorktreePilot task worktree. Two modes — New task mode (a fresh implementation request) and Review-fix mode (the user pasted a Builder Handoff from wtp-reviewer; fix only those listed issues, keep scope tight, never merge or run `wtp finish`). Keeps the agent scoped to the current task branch, avoids touching main, and prepares changes for review.
---

# WorktreePilot Builder Skill

Use this skill when you are working inside a WorktreePilot task worktree.

> Use your agent's invocation style:
> - Claude Code: `/wtp-builder`
> - Codex: `$wtp-builder`

You operate in one of two modes:

| Mode             | When                                                                          | What it does                                                                                  |
| ---------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **New task**     | Default. The user describes new work to implement.                            | Plan → implement only the requested scope → check → report.                                   |
| **Review-fix**   | The user pastes a `Builder Handoff` block from `wtp-reviewer`.                | Fix **only** the listed reviewer issues. No broad refactors. Report issue-by-issue.           |

Both modes share the same hard rules below. Both end in a structured report — the format differs (see "Final response format" sections).

**You may leave changes uncommitted.** Committing is not a prerequisite for the reviewer to inspect your work — the reviewer can read both committed diffs (`git diff main...worktree-<task>`) and uncommitted ones (`git -C .worktree-pilot/worktrees/<task> diff`). If the user prefers you not commit, leave the worktree dirty and report `Uncommitted but ready for review` in your Review Readiness section. The reviewer will ask before creating a commit on your behalf.

---

## Rules (always apply, in both modes)

- Work only inside the current worktree.
- Do not switch to `main` unless the user explicitly asks.
- Do not merge branches.
- Do not delete worktrees.
- Do not run `wtp finish` or any destructive cleanup.
- Do not run destructive commands unless explicitly approved.
- Do not edit `.env`, secret files, credentials, or local runtime folders (`.worktree-pilot/sessions/`, `.worktree-pilot/worktrees/`, `.claude/worktrees/`, `*.log`).
- Keep the diff focused on the requested scope.
- Avoid unrelated refactors.
- Before finishing, summarize changed files, risks, and tests/checks run.

---

## New task mode

The user gives a new implementation task.

### Workflow

1. **Understand the task.** Re-state it briefly in your head; ask for clarification if anything is ambiguous.
2. **Inspect first.** Look at relevant files / current branch / recent commits. Confirm `git branch --show-current` is the task branch (`worktree-<task>`).
3. **Plan briefly.** A few bullet points are enough — don't over-design.
4. **Implement only the requested scope.** No drive-by cleanup.
5. **Run relevant checks** when available (typecheck, lint, tests).
6. **Report results** using the format below.
7. **Do not merge. Do not run `wtp finish`.** Hand off to the user / to `wtp-reviewer`.

### Useful commands

```bash
git status
git diff
git diff --staged
git branch --show-current
```

If the user asks to commit:

```bash
git add <files>
git commit -m "<clear message>"
```

If the user asks you **not** to commit:

- Leave the changes in the worktree.
- Report `Uncommitted but ready for review` in your Review Readiness section (below).
- Do not stage things "just in case" — leave the working tree the way the user expects it.

### Final response format (new task mode)

```md
## Summary

<What was done, in 2-4 sentences.>

## Files Changed

- path/to/file (added | modified | deleted) — <why>

## Tests / Checks Run

- <command> — <result>

## Risks or Follow-ups

- <risk or "None">

## Suggested Commit Message

<one-line summary>

<optional body>

## Review Readiness

Status: Committed and ready for review | Uncommitted but ready for review | Not ready for review

If uncommitted:
- The reviewer can review the worktree diff (`git -C .worktree-pilot/worktrees/<task> diff`).
- Integration will require a commit on the task branch before merge/apply — the reviewer will ask before creating one.
- Do not delete the worktree.

## Review Notes

<What `wtp-reviewer` should pay extra attention to.>
```

---

## Review-fix mode

### Handling Reviewer Feedback

If the user pastes a `Builder Handoff` from `wtp-reviewer`, treat it as a **review-fix task**, not a new broad task.

Rules:

- Do not reinterpret the original task broadly.
- Fix **only** the listed reviewer issues.
- Do not introduce unrelated improvements.
- Do not merge into main.
- Do not delete branches.
- Do not run `wtp finish`.
- Preserve existing behavior unless the reviewer specifically identified a behavior bug.
- If a requested fix is unsafe or unclear, **ask for clarification before editing**.
- After changes, run the validation commands the reviewer requested where possible.
- Do not edit files the reviewer didn't mention, unless required to make a listed fix compile/pass.

### Workflow (review-fix)

1. Parse the handoff. The numbered issues each include **Files**, **Problem**, **Expected fix**, **Validation**.
2. Verify you're on the right branch (the handoff names it: `worktree-<task>`). If not, stop and tell the user.
3. For each issue:
   a. Read the listed files.
   b. Apply the expected fix.
   c. Run the validation command.
   d. Record what changed and the validation result.
4. After all issues, run the project's broader checks if the reviewer asked for them (e.g. `pnpm typecheck`, `pnpm lint`).
5. Produce the **Review Fix Summary** below.
6. Do not merge. Do not run `wtp finish`. Set "Ready For Reviewer: Yes" only when every issue is `fixed` (not `partially fixed` / `not fixed`) and checks pass.

### Final response format (review-fix mode)

```md
## Review Fix Summary

### Issues Addressed

1. <issue title — copied from the handoff>
   - Status: fixed | partially fixed | not fixed
   - Files changed:
     - path/to/file
   - What changed:
     <One or two sentences. Reference the line/function changed.>
   - Validation:
     <The exact command run + result, or "not run because …">

2. <issue title>
   - Status:
   - Files changed:
   - What changed:
   - Validation:

### Commands Run

- <command> — <pass | fail | output snippet>

### Remaining Risks

- <risk or "None">

### Ready For Reviewer

Yes | No

<If No: one sentence saying what still needs to happen and who needs to act.>
```

Hard rules for the summary:

- **One numbered item per Blocking Issue from the handoff.** Same numbering.
- **Don't add issues** the reviewer didn't raise (keep those in "Remaining Risks" or surface them separately to the user).
- **Don't claim `fixed` if validation didn't pass.** Use `partially fixed` or `not fixed` and explain in "What changed".
- **`Ready For Reviewer: Yes` only when every issue is `fixed` and checks pass.** Otherwise `No`.

---

## Quick reference

| Input                                              | Mode        | What you do                                                                  |
| -------------------------------------------------- | ----------- | ---------------------------------------------------------------------------- |
| A new task description                             | new task    | Plan → implement → check → report (new-task format).                         |
| Pasted block starting with `/wtp-builder` + `Builder Handoff` issues | review-fix  | Fix only those issues → report (Review Fix Summary format).                  |
| Ambiguous request, or fix would change unrelated files | either   | Ask for clarification before editing.                                        |

Parallel building is okay. Parallel merging is not — that's the reviewer's call, not yours.
