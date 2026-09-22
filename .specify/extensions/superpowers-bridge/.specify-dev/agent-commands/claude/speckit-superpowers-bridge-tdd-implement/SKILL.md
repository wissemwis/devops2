---
name: speckit-superpowers-bridge-tdd-implement
description: Pick the next task(s) from the Jira project, brainstorm them, plan them with Superpowers writing-plans, then execute the plan via Superpowers subagent-driven-development and test-driven-development instead of Spec Kit's built-in sequential executor
compatibility: Requires spec-kit project structure with .specify/ directory
metadata:
  author: Wissem Hamza
  source: superpowers-bridge:commands/speckit.superpowers-bridge.tdd-implement.md
---

# Superpowers TDD Implementation Bridge

## Purpose

Replace /speckit.implement's default single-context task loop with Superpowers'
full workflow on the tasks this run will execute — selected from the Jira
project that tracks this feature, whose issues are moved and commented as the
work progresses: an interactive
`brainstorming` session, a `writing-plans` implementation plan, then
`subagent-driven-development` on that plan — a fresh implementer subagent per
plan task, enforced RED-GREEN-REFACTOR, and one task review (spec compliance
+ code quality — `subagent-driven-development`'s single review with two
verdicts) after each.

## Behavior

1. FEATURE_DIR is the feature directory the invoking `/speckit-implement`
   already resolved (its `check-prerequisites.sh --json` output, e.g.
   `specs/001-questionnaire-platform/`). From FEATURE_DIR, read `tasks.md`,
   `plan.md`, `spec.md`, and — if present — `.specify/memory/constitution.md`.
   Record their absolute paths.
2. **Determine this run's scope from Jira.** Jira drives task selection;
   `tasks.md` stays the trace (its `[X]` + reviewer-verdict annotation is still
   required, per CLAUDE.md's HARD RULE). Read the Jira settings from
   `.specify/extensions/superpowers-bridge/jira.yml` (site, project key,
   issue type, status/transition names). Resolve the Atlassian `cloudId` once
   (`getAccessibleAtlassianResources`, matching the configured site) and reuse
   it for every Jira call in this run. If Jira is unreachable or the config is
   missing, STOP and tell the human — never silently fall back to `tasks.md`.
   Scope, in this order — never silently "every open issue":
   - This command's own arguments below ($ARGUMENTS), if non-empty; else the
     user input given to the invoking `/speckit-implement`, if non-empty; else
     ASK the human, offering "next task" as the default, and wait.
   - **Jira keys** (e.g. `D2-19`) or **task IDs** (e.g. `T011`) in that input
     scope the run to those issues (a task ID is resolved to its issue through
     the `Txxx` prefix of the issue summary).
   - **"next task"** = the first issue returned by
     `project = <key> AND issuetype = <issue_type> AND status = "<todo_status>"
     ORDER BY rank ASC, key ASC` whose `Txxx` item in `tasks.md` is still
     unchecked. Skip — and report to the human, without changing them — issues
     whose `tasks.md` item is already `[X]` (Jira/tasks.md out of sync).
   - Every in-scope issue must map to exactly one unchecked `tasks.md` item via
     its `Txxx` summary prefix; if one does not (no prefix, no matching item,
     duplicates), STOP and ask. Also mention any unchecked `tasks.md` item
     earlier in dependency order that has no Jira issue at all.
   - Once scope is fixed, move each in-scope issue to the configured
     in-progress status (transition `in_progress_transition`) and add a
     comment: run started, branch name, and that design/plan approval comes
     next.

   $ARGUMENTS

3. **Git safety, before brainstorming touches anything.** One branch — and
   later one PR — per run. Unless the current branch already is this run's
   branch, create and switch to `claude/task-<jira-key-lowercase>-<slug>`
   (e.g. `claude/task-d2-19-contract-questionnaires-create`; several issues:
   join the keys) from the current `HEAD`. Never commit on `main`/`master`.
   If `HEAD` is a feature branch whose PR is still open, the new branch is
   stacked on it — say so in the Jira comment and, later, in the PR. Once
   `subagent-driven-development`'s workspace exists (step 6), note there that
   its worktree setup reuses this branch in place — a standing fact about how
   this repo runs the hook, not a fresh ruling to re-make every run.
4. **Brainstorm the scope — once per run, before any dispatch.** Invoke the
   Superpowers `brainstorming` skill on the in-scope task(s): their Jira key,
   summary and description, their exact `tasks.md` text, plus the absolute
   paths of `spec.md`, `plan.md`,
   `constitution.md` and, if present, `research.md`, `data-model.md`,
   `contracts/` and `quickstart.md`. Follow the skill's own process (classify
   bounded/architectural, clarifying questions one at a time, 2-3
   approaches, design in sections, human approval). Constraints that override
   brainstorming's defaults:
   - `spec.md`, `plan.md` and the constitution are already-approved design.
     Brainstorming decides *how* to implement the in-scope tasks within them;
     it does not reopen them. If the session surfaces a genuine conflict with
     them, say so and propose an explicit amendment (e.g. a dated `plan.md`
     amendment or a Complexity Tracking entry) — never diverge silently.
   - A `tasks.md` item is never a spike: it is already-scoped implementation
     work behind an approved spec and plan, never a bare feasibility
     question. Classify it bounded or architectural — never spike.
   - Whatever path brainstorming classifies (bounded or architectural), the
     next step is step 5 below (`writing-plans`). This explicitly overrides
     the bounded path's normal terminal state ("implementation proceeds
     directly through the normal development workflow; no plan document").
     `writing-plans` is never skipped for a `tasks.md` item, on either path.
     Do not chain into any other skill.
   - Whatever path is taken, persist the approved design to
     `docs/superpowers/specs/YYYY-MM-DD-<task-ids>-<topic>-design.md` and
     commit it (stage it by path). A bounded task gets a short document; it
     still gets one, because implementer and reviewer subagents can only read
     files.
   - Do NOT create, modify or delete application source files, tests or
     `tasks.md` during brainstorming.
5. **Plan — invoke the Superpowers `writing-plans` skill** on the approved
   design. Constraints that override its defaults:
   - Save to `docs/superpowers/plans/YYYY-MM-DD-<task-ids>-<topic>.md`; its
     `**Spec:**` line names the step-4 design document and `spec.md`; its
     Global Constraints copy verbatim the binding values from `spec.md`,
     `plan.md`, `contracts/` and the constitution that the in-scope tasks
     touch.
   - Scope is exactly the in-scope `tasks.md` items — no more. A `tasks.md`
     item may be split into several plan tasks, but every `### Task N:`
     heading must name the `tasks.md` ID it implements (e.g.
     `### Task 1: T011 — contract test POST /api/questionnaires`), and every
     in-scope ID must be covered. Respect `tasks.md` dependency order and
     `[P]` markers.
   - Execution method is already supplied: **Subagent-driven**. Still show
     the human the saved plan and ask "Does it capture what you want?";
     incorporate corrections, commit the plan (stage it by path), then
     continue at step 6.
6. Invoke the Superpowers `subagent-driven-development` skill with the step-5
   plan file as its PLAN_FILE (so its `task-brief`, `review-package` and
   per-plan ledger work natively).
7. For every task dispatched to a fresh subagent, the plan text itself must
   reach the subagent only through SDD's own channel — its task-brief output
   plus the plan's Global Constraints block copied verbatim — never as a
   handed-over path to the step-5 plan document. The dispatch prompt MUST
   explicitly include:
   - The `tasks.md` ID the plan task implements, and that item's exact
     description and file paths as written in `tasks.md`.
   - The absolute path to this task's brief, produced by SDD's
     `scripts/task-brief` (per SDD step "Dispatch the implementer") —
     introduced as "read this first — it is your requirements, with the
     exact values to use verbatim".
   - The absolute path to the design document approved in step 4.
   - The absolute paths to `spec.md`, `plan.md`, `tasks.md` and
     `constitution.md` collected in step 1, as reference reading only, with
     an explicit instruction: "do not read the whole implementation plan
     (the step-5 `writing-plans` document) — it reaches you only through the
     task-brief above and the Global Constraints copied into this dispatch."
   - An instruction to read `constitution.md` before proposing any
     implementation approach.
   - An instruction to follow the Superpowers `test-driven-development` skill:
     write a failing test first, watch it fail, then write the minimal code to
     pass. No production code without a failing test first.
   - **If the task creates or modifies a graphical user interface** (a page or
     component file under `frontend/`, e.g. anything the task labels
     "Frontend:" or touching `frontend/app/`, `frontend/components/`,
     `frontend/services/*.tsx`), an additional instruction to invoke the
     `impeccable` skill for the UI/UX/visual work — run its `shape` command
     (or let its own routing pick `new-work` for a new surface) before
     writing UI code, and follow its craft-floor quality bar while
     implementing. This runs alongside TDD, not instead of it: `impeccable`
     governs visual/UX craft and accessibility; `test-driven-development`
     still governs the task's testable behavior (component rendering,
     interactions, API calls). A subagent working a UI task without invoking
     `impeccable` has not correctly executed the task.
   The task reviewer's inputs are SDD's own — the brief file, the report
   file, the review-package diff, and the plan's Global Constraints block —
   plus the design-doc path from step 4; never the whole plan document
   either.
8. After each subagent completes, run the task review (spec compliance + code
   quality, SDD's single review with two verdicts) that
   `subagent-driven-development` prescribes. Mark a `tasks.md` item `[X]` —
   with an inline annotation recording the reviewer verdict and its Jira key —
   only once every plan task that names its ID has passed review. In the same
   step, move its Jira issue to the configured done status (transition
   `done_transition`) and add a comment with the reviewer verdict (spec +
   quality), the commit range, the test evidence summary, and any parked or
   carried-forward findings.
9. After the step-5 plan is approved, execute continuously without
   pausing between tasks to ask "should I continue?". Only stop for: an
   irreversible or destructive operation, a security-sensitive action, a side
   effect outside this worktree (merge, push to a shared branch, publish), or
   a plan too broken to proceed — and say why.
10. Once every in-scope task is complete, run the whole-branch review
    `subagent-driven-development` prescribes, then follow SDD's Finish
    section: collect the "Rulings I made" list, make sure each ruling is also
    recorded somewhere durable (the `tasks.md` annotation and the Jira done
    comment) — `.superpowers/` is git-ignored, so the ledger is local scratch —
    delete only this plan's SDD workspace directory, then invoke
    `superpowers:finishing-a-development-branch` — its push/PR/merge options
    remain gated by the human (the "only stop for ... a push to a shared
    branch, publish" rule in step 9 above already covers it). If a PR is
    opened, add its URL as a comment on every in-scope Jira issue. Then
    report: the Jira keys,
    the design document and plan paths, tasks completed, files touched,
    tests added, and any ruling you made without stopping to ask.
11. **Terminal instruction.** This hook REPLACES `/speckit-implement`'s
    Outline steps 3-9 in full. When this hook returns, the invoking
    `/speckit-implement` MUST NOT implement, review, or mark `[X]` any task
    itself — all of that happened in the steps above. It proceeds directly
    to its own "Mandatory Post-Execution Hooks" (`after_implement`) section
    and then its Completion Report.
