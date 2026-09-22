---
description: "Brainstorm the in-scope tasks, plan them with Superpowers writing-plans, then execute the plan via Superpowers subagent-driven-development and test-driven-development instead of Spec Kit's built-in sequential executor"
---

# Superpowers TDD Implementation Bridge

## Purpose

Replace /speckit.implement's default single-context task loop with Superpowers'
full workflow on the tasks this run will execute: an interactive
`brainstorming` session, a `writing-plans` implementation plan, then
`subagent-driven-development` on that plan — a fresh implementer subagent per
plan task, enforced RED-GREEN-REFACTOR, and a two-stage review after each.

## Behavior

1. From FEATURE_DIR, read `tasks.md`, `plan.md`, `spec.md`, and — if present —
   `/memory/constitution.md`. Record their absolute paths.
2. **Determine this run's scope** from the arguments below (e.g. "next task"
   = the first unchecked task in `tasks.md` in dependency order; a list of IDs
   = those tasks; empty = every unchecked task).

   $ARGUMENTS

3. **Brainstorm the scope — once per run, before any dispatch.** Invoke the
   Superpowers `brainstorming` skill on the in-scope task(s): their exact
   `tasks.md` text plus the absolute paths of `spec.md`, `plan.md`,
   `constitution.md` and, if present, `research.md`, `data-model.md`,
   `contracts/` and `quickstart.md`. Follow the skill's own process (classify
   spike/bounded/architectural, clarifying questions one at a time, 2-3
   approaches, design in sections, human approval). Constraints that override
   brainstorming's defaults:
   - `spec.md`, `plan.md` and the constitution are already-approved design.
     Brainstorming decides *how* to implement the in-scope tasks within them;
     it does not reopen them. If the session surfaces a genuine conflict with
     them, say so and propose an explicit amendment (e.g. a dated `plan.md`
     amendment or a Complexity Tracking entry) — never diverge silently.
   - Whatever path the skill classifies, persist the approved design to
     `docs/superpowers/specs/YYYY-MM-DD-<task-ids>-<topic>-design.md` and
     commit it (stage it by path). A bounded task gets a short document; it
     still gets one, because implementer and reviewer subagents can only read
     files.
   - Once the design is approved, brainstorming's normal terminal step —
     invoking `writing-plans` — is exactly step 4. Do not chain into any other
     skill.
   - Do NOT create, modify or delete application source files, tests or
     `tasks.md` during brainstorming.
4. **Plan — invoke the Superpowers `writing-plans` skill** on the approved
   design. Constraints that override its defaults:
   - Save to `docs/superpowers/plans/YYYY-MM-DD-<task-ids>-<topic>.md`; its
     `**Spec:**` line names the step-3 design document and `spec.md`; its
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
     continue at step 5.
5. Invoke the Superpowers `subagent-driven-development` skill with the step-4
   plan file as its PLAN_FILE (so its `task-brief`, `review-package` and
   per-plan ledger work natively).
6. For every task dispatched to a fresh subagent, the subagent's prompt MUST
   explicitly include:
   - The `tasks.md` ID the plan task implements, and that item's exact
     description and file paths as written in `tasks.md`.
   - The absolute paths to `spec.md`, `plan.md`, `tasks.md` and
     `constitution.md` collected in step 1, **and to the design document
     approved in step 3 and the plan written in step 4**, which are binding
     for that task (subagents never
     inherit this session's context, so nothing reaches them unless it is
     written into their prompt). The task reviewer gets both paths too and
     checks compliance against them.
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
7. After each subagent completes, run the task review (spec compliance + code
   quality) that `subagent-driven-development` prescribes. Mark a `tasks.md`
   item `[X]` — with an inline annotation recording the reviewer verdict —
   only once every plan task that names its ID has passed review.
8. After the step-4 plan is approved, execute continuously without
   pausing between tasks to ask "should I continue?". Only stop for: an
   irreversible or destructive operation, a security-sensitive action, a side
   effect outside this worktree (merge, push to a shared branch, publish), or
   a plan too broken to proceed — and say why.
9. Once every in-scope task is complete, run the whole-branch review
   `subagent-driven-development` prescribes, then report: the design document
   and plan paths, tasks completed, files touched, tests added, and any ruling you made
   without stopping to ask.
