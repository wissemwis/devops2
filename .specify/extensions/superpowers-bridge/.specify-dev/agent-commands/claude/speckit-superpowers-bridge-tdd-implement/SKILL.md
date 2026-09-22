---
name: speckit-superpowers-bridge-tdd-implement
description: Brainstorm the in-scope tasks via Superpowers brainstorming, then execute them via Superpowers subagent-driven-development and test-driven-development instead of Spec Kit's built-in sequential executor
compatibility: Requires spec-kit project structure with .specify/ directory
metadata:
  author: Wissem Hamza
  source: superpowers-bridge:commands/speckit.superpowers-bridge.tdd-implement.md
---

# Superpowers TDD Implementation Bridge

## Purpose

Replace /speckit.implement's default single-context task loop with Superpowers'
workflow: an interactive `brainstorming` session on the tasks this run will
execute, then a fresh implementer subagent per task, enforced
RED-GREEN-REFACTOR, and a two-stage review after each task.

## Behavior

1. From FEATURE_DIR, read `tasks.md`, `plan.md`, `spec.md`, and — if present —
   `.specify/memory/constitution.md`. Record their absolute paths.
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
   - Do NOT invoke `writing-plans` afterwards: `tasks.md` is the plan. The
     approved design is the hand-off; continue at step 4.
   - Do NOT create, modify or delete application source files, tests or
     `tasks.md` during brainstorming.
4. Invoke the Superpowers `subagent-driven-development` skill to execute the
   in-scope tasks of `tasks.md`, respecting its phases, dependencies and `[P]`
   parallel markers.
5. For every task dispatched to a fresh subagent, the subagent's prompt MUST
   explicitly include:
   - The task's exact ID, description and file paths as written in `tasks.md`.
   - The absolute paths to `spec.md`, `plan.md`, `tasks.md` and
     `constitution.md` collected in step 1, **and to the design document
     approved in step 3**, which is binding for that task (subagents never
     inherit this session's context, so nothing reaches them unless it is
     written into their prompt). The task reviewer gets the design document
     path too and checks compliance against it.
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
6. After each subagent completes, run the task review (spec compliance + code
   quality) that `subagent-driven-development` prescribes before marking the
   task `[X]` in `tasks.md`.
7. After the step-3 brainstorming is approved, execute continuously without
   pausing between tasks to ask "should I continue?". Only stop for: an
   irreversible or destructive operation, a security-sensitive action, a side
   effect outside this worktree (merge, push to a shared branch, publish), or
   a plan too broken to proceed — and say why.
8. Once every in-scope task is complete, run the whole-branch review
   `subagent-driven-development` prescribes, then report: the design document
   path, tasks completed, files touched, tests added, and any ruling you made
   without stopping to ask.