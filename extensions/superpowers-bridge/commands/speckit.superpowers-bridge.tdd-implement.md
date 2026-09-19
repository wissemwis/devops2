---
description: "Execute tasks.md via Superpowers subagent-driven-development and test-driven-development instead of Spec Kit's built-in sequential executor"
---

# Superpowers TDD Implementation Bridge

## Purpose

Replace /speckit.implement's default single-context task loop with Superpowers'
stricter workflow: a fresh implementer subagent per task, enforced
RED-GREEN-REFACTOR, and a two-stage review after each task.

## Behavior

1. From FEATURE_DIR, read `tasks.md`, `plan.md`, `spec.md`, and — if present —
   `/memory/constitution.md`. Record their absolute paths.
2. Invoke the Superpowers `subagent-driven-development` skill to execute the plan
   described in `tasks.md`, respecting its phases, dependencies and `[P]`
   parallel markers.
3. For every task dispatched to a fresh subagent, the subagent's prompt MUST
   explicitly include:
   - The task's exact ID, description and file paths as written in `tasks.md`.
   - The absolute paths to `spec.md`, `plan.md`, `tasks.md` and
     `constitution.md` collected in step 1 (subagents never inherit this
     session's context, so nothing reaches them unless it is written into their
     prompt).
   - An instruction to read `constitution.md` before proposing any
     implementation approach.
   - An instruction to follow the Superpowers `test-driven-development` skill:
     write a failing test first, watch it fail, then write the minimal code to
     pass. No production code without a failing test first.
4. After each subagent completes, run the task review (spec compliance + code
   quality) that `subagent-driven-development` prescribes before marking the
   task `[X]` in `tasks.md`.
5. Execute continuously without pausing between tasks to ask "should I
   continue?". Only stop for: an irreversible or destructive operation, a
   security-sensitive action, a side effect outside this worktree (merge, push
   to a shared branch, publish), or a plan too broken to proceed — and say why.
6. Once every task is complete, run the whole-branch review
   `subagent-driven-development` prescribes, then report: tasks completed,
   files touched, tests added, and any ruling you made without stopping to ask.
