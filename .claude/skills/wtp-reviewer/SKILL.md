---
name: wtp-reviewer
description: Use when reviewing WorktreePilot task branches before or during integration into main. Three modes — review-only (default; safe; never modifies anything), merge (opt-in via "merge <task>" / "integrate <task>"; performs git merge --no-ff), and squash/apply (opt-in via "squash <task>" / "apply <task>"; runs git merge --squash so changes are staged on main for the user to review before committing). Accepts task names (auto-prefixed to worktree-<task>) or full branch names. Reviews committed branch diffs AND uncommitted task-worktree changes. Protects main; integrates at most one branch per invocation; asks before merge, before commit, and before cleanup; never force-cleans unless the user explicitly says so.
---

# WorktreePilot Reviewer Skill

Use this skill when reviewing one or more WorktreePilot task branches before merging — or, opt-in, to actually perform a single safe integration into `main`.

> Use your agent's invocation style:
> - Claude Code: `/wtp-reviewer`
> - Codex: `$wtp-reviewer`

Your job is to protect `main`.

You operate in one of three modes:

| Mode             | When                                                                                  | What it does                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Review-only**  | Default. The user passes only task / branch names.                                    | Inspect each branch vs `main` **and** the task worktree for uncommitted changes. **Never modify, merge, or delete.** |
| **Merge**        | Opt-in via `merge <task>` or `integrate <task>`.                                      | Review → ask → `git merge --no-ff` (one branch, commits immediately on success) → checks → ask → cleanup.            |
| **Squash/Apply** | Opt-in via `squash <task>` or `apply <task>`.                                         | Review → ask → `git merge --squash` so changes are **staged** on `main` → checks → ask before commit → ask before cleanup. |

Default is review-only. The two integrate modes are opt-in.

`merge` vs `squash`/`apply` — the distinction matters:

- `merge` runs `git merge --no-ff worktree-<task>`. It creates a merge commit and the integration is committed immediately if the merge succeeds.
- `squash`/`apply` runs `git merge --squash worktree-<task>`. The task's changes are applied to `main` as **staged** changes; `main` has no new commit until you approve one. This is the mode for "I want to review the changes on `main` before they land."

**There is no completed merge with no commit.** If a user asks for "merge but don't commit", you must explain that and offer squash/apply instead — that's the supported way to land changes on `main` for review without yet committing them.

---

## Argument parsing

The user invokes you with arguments like:

```text
# Review-only mode (default):
/wtp-reviewer task1
/wtp-reviewer task1 task2 task3
/wtp-reviewer worktree-task1 worktree-task2
/wtp-reviewer check task2
/wtp-reviewer review task2 against main
/wtp-reviewer review task2 task3 and recommend merge order
/wtp-reviewer all
/wtp-reviewer active branches

# Merge mode (opt-in — review + confirm + git merge --no-ff + checks + confirm + cleanup):
/wtp-reviewer merge task1
/wtp-reviewer integrate task1

# Squash/apply mode (opt-in — review + confirm + git merge --squash + checks + ask before commit + ask before cleanup):
/wtp-reviewer squash task1
/wtp-reviewer apply task1
```

### Mode detection

Look at the **first non-filler token**:

- `merge` or `integrate` → **merge mode** (git merge --no-ff).
- `squash` or `apply`     → **squash/apply mode** (git merge --squash, leaves staged on main).
- anything else            → **review-only mode** (default).

In either integrate mode (merge or squash/apply) there must be **exactly one** target task. If the user passes more than one (`/wtp-reviewer merge task1 task2`, `/wtp-reviewer apply task1 task2`), refuse and tell them to integrate one at a time. Parallel building is okay; parallel merging is not.

### Normalizing arguments

1. **Strip filler words**: `check`, `review`, `for`, `against`, `main`, `and`, `readiness`, `recommend`, `order`, `branches`, `branch`, `active`, `the`, `all`.
   - `merge` / `integrate` / `squash` / `apply` are stripped **only after** mode detection (above).
   - In review-only mode those words are stripped too — they're just hints about user intent.
2. **`all` / `active branches` mode** (review-only only): if any remaining token (or the original input) is `all` or `active`, list all active worktree branches:

   ```bash
   git branch --format='%(refname:short)' | grep '^worktree-'
   ```

   Review every branch returned.
3. **Otherwise**, the remaining tokens are task identifiers. For each token:
   - If it already starts with `worktree-` → use as-is.
   - Otherwise → prefix it: `<token>` becomes `worktree-<token>`.

   Examples:
   - `task1 task2` → `worktree-task1`, `worktree-task2`.
   - `worktree-fix-login` → `worktree-fix-login` (unchanged).
   - `names-refactor invites-fix` → `worktree-names-refactor`, `worktree-invites-fix`.

4. **Before reviewing**, verify each branch exists locally:

   ```bash
   git rev-parse --verify <branch> 2>/dev/null
   ```

   If a branch is missing, note it and continue with the rest. Don't fabricate findings for branches that don't exist.

---

## Rules (always apply, in all modes)

- Do not modify project files unless the user explicitly asks (outside this skill's scope).
- Do not delete branches.
- Do not delete worktrees.
- Do not run destructive commands.
- Treat secrets and `.env` files as sensitive — flag them if they appear in a diff.
- Focus on correctness, conflicts, scope, and integration safety.
- **Never use `--force` for cleanup** unless the user explicitly says they want to discard the task's work.
- **Never integrate more than one branch per invocation.**
- **Never commit on the user's behalf without explicit confirmation** — this applies to commits on the task branch (when the worktree is uncommitted) and to the staged commit on `main` (in squash/apply mode).
- In review-only mode you additionally do not run `git merge` at all.

---

## What to review (per branch — all modes)

For task `<task>`:

- branch: `worktree-<task>`
- worktree path: `.worktree-pilot/worktrees/<task>`

Inspect the **committed** diff vs main:

```bash
git diff main...worktree-<task> --stat
git diff --name-only main...worktree-<task>
git diff main...worktree-<task>
```

Then also inspect the **uncommitted** changes in the task worktree, if the worktree exists:

```bash
git -C .worktree-pilot/worktrees/<task> status --short
git -C .worktree-pilot/worktrees/<task> diff
git -C .worktree-pilot/worktrees/<task> diff --staged
```

Both diffs matter. The builder may have left changes uncommitted on purpose ("Uncommitted but ready for review" in their Review Readiness section). The committed diff is what `git merge` would actually integrate; the uncommitted diff is what the user can still see and what would have to be committed first before any integration.

Check:

- Does the diff match the stated task?
- Are there hidden side effects?
- Are generated / vendor / build files included accidentally?
- Are `.env`, secrets, logs, or runtime artifacts (`.worktree-pilot/sessions/`, `.worktree-pilot/worktrees/`, `.claude/worktrees/`, `*.log`) included?
- Are imports / types / routes likely broken?
- Do multiple active branches touch the same files?
- What checks should run before integration?
- Is the branch safe to integrate now, or should it first update from latest `main`?

---

## Conflict & integration checks

Cheap, read-only checks (always safe to run):

```bash
git diff --name-only main...<branchA>
git diff --name-only main...<branchB>
# Intersect the file lists to find branches that touch the same files.
```

Real conflict simulation that dirties the working tree — **suggest it; do not run it unless the user explicitly asks** (in review-only mode):

```bash
# In a clean checkout. Always abort after.
git checkout main
git merge --no-commit --no-ff <branch>
git status
git merge --abort
```

If you do offer to run it, follow this exact pattern: ensure `git status` is clean first, run, capture, immediately `git merge --abort`. Leave `main` in the same state you found it.

---

## Per-branch output format

For **each** branch produce this Markdown block. The structure is the same in review-only and integrate mode (integrate mode adds extra confirmation steps **after** the report, not inside it).

Always start with the branch as an H1 so it's easy to scan when many branches are reviewed at once:

```md
# worktree-<task>

## Verdict

APPROVE | NEEDS CHANGES | REJECT

## Worktree State

- Branch: worktree-<task>
- Worktree path: .worktree-pilot/worktrees/<task>
- Committed changes vs main: yes | no
- Uncommitted changes in worktree: yes | no
- Merge-ready: yes | no  (yes only if there are committed changes AND no uncommitted changes blocking integration)

## Review Summary

<2-4 sentences. What the branch does, scope, and the headline judgment.>

## Blocking Issues

1. <issue title>
   - Severity: high | medium | low
   - Files:
     - path/to/file.ts
     - path/to/other-file.ts
   - Problem:
     <Clear, specific description. No "fix types" hand-waving — point at the exact symptom.>
   - Expected fix:
     <What the builder should change. Be concrete enough that the builder can act without re-reading the original task.>
   - Validation:
     <Command or check to run after fixing — e.g. `pnpm typecheck`, "rerun route and verify 200".>

## Non-blocking Suggestions

1. <suggestion title>
   - Why it matters:
   - Suggested change:

## Conflict / Integration Notes

- Branches likely to conflict:
  - <other-branch>  (overlapping files: ...)
- Files touched by multiple active branches:
  - path/to/shared.ts  (also in <other-branch>)
- Suggested merge order:
  - <ordering rationale, or "merge any time after fixes">

## Required Checks Before Merge

- pnpm typecheck
- pnpm lint
- <other project-specific checks if relevant>
```

### When verdict is APPROVE

Append a final section with the exact commands the user can run manually. Show **both** integration paths so the user picks the one that fits — `merge` for a normal merge commit, `squash` to land changes as staged on `main` for a final review:

```md
## Approved Merge Commands

Standard merge (creates a merge commit immediately):

\`\`\`bash
cd <repo-root>
git checkout main
git pull
git merge --no-ff worktree-<task>
<typecheck / lint / test commands if known>
wtp finish <task> --remove-worktree --delete-branch
\`\`\`

Squash apply (changes staged on main; review with `git diff --staged`, then commit yourself):

\`\`\`bash
cd <repo-root>
git checkout main
git pull
git merge --squash worktree-<task>
<typecheck / lint / test commands if known>
git diff --staged                 # review
git commit -m "<message>"
wtp finish <task> --remove-worktree --delete-branch
\`\`\`
```

If the worktree had uncommitted changes, prefix both blocks with a note: those changes must be committed on the task branch first (either via the builder, or by you, or via squash/apply mode which can prompt to do it).

(No `Builder Handoff` section is produced for an APPROVE verdict.)

### When verdict is NEEDS CHANGES or REJECT

You **must** append a copy-pasteable `Builder Handoff` block. This is the contract that lets the builder act on the feedback without re-interpreting the original task.

```md
## Builder Handoff

Copy this into the builder session:

\`\`\`text
/wtp-builder

You are continuing work on branch: worktree-<task>

The reviewer found issues that must be fixed before merge.

Do not rewrite unrelated code.
Do not change files outside the reviewed scope unless required.
Preserve the original task intent.
Do not merge.
Do not run \`wtp finish\`.

<If the task worktree had uncommitted changes, insert this line:>
This task currently has uncommitted changes. Fix the listed issues in the same worktree. Do not merge. Do not run \`wtp finish\`.

Fix these issues:

1. <issue title from Blocking Issues #1>
   Files:
   - <file>
   Problem:
   <copy from Blocking Issues #1 — keep it specific>
   Expected fix:
   <copy from Blocking Issues #1>
   Validation:
   <copy from Blocking Issues #1>

2. <issue title from Blocking Issues #2>
   Files:
   - <file>
   Problem:
   <copy>
   Expected fix:
   <copy>
   Validation:
   <copy>

After fixing:
- run the required checks
- summarize changed files
- explain how each reviewer issue was addressed
- do not merge
- do not finish/remove the worktree
\`\`\`
```

Hard rules for the handoff:

- One numbered item per Blocking Issue. Same numbering as the report above.
- Carry through **Files**, **Problem**, **Expected fix**, **Validation** verbatim — those are the four things the builder needs.
- Don't include Non-blocking Suggestions in the handoff (leave them in the report for the human reader).
- Don't tell the builder to merge, finish, push, or delete anything.
- The "Replace the merge-commands section with (none — do not merge yet)" line from the old format is no longer needed — when verdict is not APPROVE, you simply omit the `Approved Merge Commands` section.

---

## After all branches: Integration plan

```text
Integration plan:
1. Recommended merge order:
   - <branch>
   - <branch>
2. Branches that conflict:
   - <branchA> ↔ <branchB>  (files: ...)
3. Branches that need changes:
   - <branch>  (reason)
4. Branches safe to merge now:
   - <branch>
5. Branches that should update from latest main first:
   - <branch>  (reason)
```

Place safest-to-merge first; then branches that depend on it.

---

## Shared pre-flight: handle uncommitted task changes

Both merge mode and squash/apply mode run this before touching `main`. The committed branch is what gets integrated — if the task worktree has uncommitted work, that work has to land on the branch first or it will silently be left behind.

After reviewing and getting verdict APPROVE, but **before** the "do you want me to integrate" question:

```bash
git -C .worktree-pilot/worktrees/<task> status --short
```

If output is empty → skip this section.

If output is **non-empty** (the task worktree is dirty):

1. Ask exactly:

   ```text
   The task has uncommitted changes. Do you want me to create a commit on worktree-<task> before integrating it?
   ```

2. Wait for a clear yes.

3. If the user says **no** → stop. Do not merge or apply. The user can either go back to the builder, commit themselves, or invoke the reviewer again later.

4. If the user says **yes**:
   - Propose a commit message based on the diff and the original task. Ask the user to confirm or adjust it.
   - Once the message is approved, run **inside the task worktree** (not in main):

     ```bash
     git -C .worktree-pilot/worktrees/<task> add .
     git -C .worktree-pilot/worktrees/<task> commit -m "<approved message>"
     ```

5. Re-verify the worktree is clean:

   ```bash
   git -C .worktree-pilot/worktrees/<task> status --short
   ```

   If it's still dirty (e.g. untracked files the user wants to keep but not commit), stop and ask the user how to handle them.

Only after this pre-flight passes do you proceed into Merge mode or Squash/Apply mode below.

---

## Merge mode — strict step-by-step

Invoked by `/wtp-reviewer merge <task>` or `/wtp-reviewer integrate <task>`. This uses `git merge --no-ff` — the integration is **committed immediately** on a successful merge.

### Step 1 — Review

Run the same per-branch review described above for the single target branch.

If the verdict is **NEEDS CHANGES** or **REJECT** → **stop here**. Output the Builder Handoff. Do not proceed.

### Step 2 — Pre-flight: handle uncommitted task changes

See "Shared pre-flight" above.

### Step 3 — Ask for explicit merge confirmation

Ask the user *exactly*:

```text
Do you want me to merge worktree-<task> into main now?
```

Wait. Do not proceed without a clear "yes" / "go ahead" / equivalent. A reply like "looks good" is **not** confirmation — re-ask.

### Step 4 — Pre-flight on main

Once confirmed:

```bash
git checkout main
git status --short
```

- If `git status --short` is **non-empty** → stop. Tell the user main is dirty, show the output, and ask them to clean up first. Do not merge.
- Otherwise:

  ```bash
  git pull
  ```

  If the pull fails, stop and report. Do not merge.

### Step 5 — Merge (single branch only)

```bash
git merge --no-ff worktree-<task>
```

- If merge **conflicts**, **stop**:
  - Run `git status` and list the conflicted files.
  - Tell the user the conflict needs human resolution.
  - **Do not auto-resolve.** Auto-resolution is allowed only after a separate, explicit user instruction.
  - If the user asks to abort, first verify a merge is actually in progress (`[ -f .git/MERGE_HEAD ]` or `git status` shows "All conflicts fixed but you are still merging" / "Unmerged paths"), then run `git merge --abort`. Don't blindly run `git merge --abort` if no merge is in progress — it errors and confuses the state.

### Step 6 — Checks

Run the project's typecheck/lint/test commands. The canonical pnpm flow is:

```bash
pnpm typecheck
pnpm lint
```

If the project clearly uses npm/yarn/bun, substitute (`npm run typecheck`, `yarn typecheck`, etc.). If the project doesn't have these scripts, run whatever the user has indicated as their pre-merge checks; if unknown, ask before running anything beyond `git`.

If any check **fails**, **stop**:
- Show the failing output.
- Tell the user the merge is on `main` but checks failed — they can fix-forward, revert (`git reset --hard ORIG_HEAD` only on user request), or investigate.
- **Do not run cleanup.** Do not call `wtp finish`.

### Step 7 — Ask for explicit cleanup confirmation

If merge + checks both succeeded, ask:

```text
Merge and checks passed. Do you want me to clean up the task worktree and branch now?
```

Wait for a clear yes.

### Step 8 — Cleanup

Once confirmed:

```bash
wtp finish <task> --remove-worktree --delete-branch
```

**Never** add `--force` here unless the user explicitly says they want to discard the task's work (e.g. "yes, force-remove it"). If `wtp finish` refuses (dirty tree, processes still using the worktree, branch not fully merged), surface its output verbatim and let the user decide — don't bypass.

---

## Squash / Apply mode — strict step-by-step

Invoked by `/wtp-reviewer squash <task>` or `/wtp-reviewer apply <task>` (aliases). This uses `git merge --squash` — the task's changes are **staged on main**, with no commit, so the user can review the staged diff before deciding whether to commit.

### Step 1 — Review

Same as merge mode. If the verdict is **NEEDS CHANGES** or **REJECT** → stop, output the Builder Handoff, do not proceed.

### Step 2 — Pre-flight: handle uncommitted task changes

See "Shared pre-flight" above. Same gate as merge mode.

### Step 3 — Ask for explicit apply confirmation

Ask the user *exactly*:

```text
Do you want me to apply worktree-<task> onto main with squash now?
```

Wait for a clear yes.

### Step 4 — Pre-flight on main

```bash
git checkout main
git status --short
```

- If non-empty → stop. Do not apply.
- Otherwise:

  ```bash
  git pull
  ```

  If pull fails, stop.

### Step 5 — Squash apply

```bash
git merge --squash worktree-<task>
```

- **Do not commit.** `git merge --squash` deliberately leaves the changes staged so the user can review them.
- If the operation reports **conflicts**, stop:
  - Run `git status` and list conflicted files.
  - Tell the user this needs human resolution.
  - **Do not auto-resolve.**
  - If the user asks to undo, run `git reset --merge` (or `git reset --hard HEAD` if the user explicitly confirms — that throws away staged work).

### Step 6 — Checks

Same as merge mode (`pnpm typecheck`, `pnpm lint`, or the project equivalent).

If any check fails, **stop**:
- Show the failing output.
- Tell the user the changes are **staged on main but not committed**.
- They can: fix-forward by editing files (staged state will be amended), unstage with `git reset HEAD` to inspect, or fully discard with `git checkout -- .` + `git reset --hard HEAD` (only on explicit user request).
- **Do not run cleanup.** Do not call `wtp finish`.

### Step 7 — Tell the user the changes are staged

Print exactly (or close to):

```text
The task changes are now staged on main. Review them with:
git diff --staged
```

### Step 8 — Ask before committing

Ask:

```text
Do you want me to commit these staged changes to main now?
```

Wait for a clear yes/no.

- If **no** → stop. Leave the changes staged. Do **not** run cleanup. Explain that cleanup should happen only after the user commits or explicitly discards.
- If **yes** → propose a commit message (based on the squashed diff + original task name), ask the user to confirm or adjust, then run:

  ```bash
  git commit -m "<approved message>"
  ```

### Step 9 — Ask for explicit cleanup confirmation

After a successful commit:

```text
Commit succeeded. Do you want me to clean up the task worktree and branch now?
```

### Step 10 — Cleanup

Once confirmed:

```bash
wtp finish <task> --remove-worktree --delete-branch
```

Same `--force` rule as merge mode — never add it unless the user explicitly says discard.

---

## What "stop" means

In integrate mode, "stop" means: produce a concise status report and **wait for the user**. Don't try to recover the next step yourself. Don't proceed by inferring what they "probably want."

---

## Quick reference

Invocation syntax depends on your agent: Claude Code uses `/wtp-reviewer …`, Codex uses `$wtp-reviewer …`. The semantics are identical.

| User input                                                     | Mode          | What you do                                                                                                                  |
| -------------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `/wtp-reviewer task1`                                          | review-only   | Review `worktree-task1` (committed + uncommitted). Output verdict + integration plan.                                        |
| `/wtp-reviewer task1 task2 task3`                              | review-only   | Review all three vs main; recommend merge order.                                                                             |
| `/wtp-reviewer worktree-fix-login`                             | review-only   | Branch name used as-is.                                                                                                      |
| `/wtp-reviewer check task2`                                    | review-only   | Same as `/wtp-reviewer task2`.                                                                                               |
| `/wtp-reviewer review task2 against main`                      | review-only   | Normal review.                                                                                                               |
| `/wtp-reviewer review task2 task3 and recommend merge order`   | review-only   | Review both, emphasize the merge-order section.                                                                              |
| `/wtp-reviewer all`                                            | review-only   | List `worktree-*` branches; review each.                                                                                     |
| `/wtp-reviewer merge task1`                                    | merge         | Review → (commit-on-task gate if dirty) → confirm → `git merge --no-ff` → checks → confirm → cleanup. One branch only.       |
| `/wtp-reviewer integrate task1`                                | merge         | Same as `merge task1`.                                                                                                        |
| `/wtp-reviewer squash task1`                                   | squash/apply  | Review → (commit-on-task gate) → confirm → `git merge --squash` (staged on main) → checks → ask before commit → ask before cleanup. |
| `/wtp-reviewer apply task1`                                    | squash/apply  | Same as `squash task1`.                                                                                                       |
| `/wtp-reviewer merge task1 task2`, `apply task1 task2` etc.   | merge/squash  | Refuse. Ask the user to integrate one at a time.                                                                             |

Parallel building is okay. Parallel merging is not.
