# Sections removed from CLAUDE.md on 2026-09-23

Verbatim copy of the two CLAUDE.md sections that made the superpowers-bridge workflow binding,
removed when the project owner stopped using the extension. Kept for reference only — they no
longer apply to this repository.

---

## HARD RULE — applies to every session, no exceptions

**No implementation task from `specs/001-questionnaire-platform/tasks.md` may be coded directly
in a Claude Code session's own context.** This has already been violated once (T002 was
implemented and marked `[X]` directly in-session, skipping the review gate below, then fixed
retroactively — see `tasks.md` T002 annotation). It must not happen again, in this session or any
future one, on any branch.

Before touching a task's implementation:
1. Run `/speckit-implement` (or, in an environment where that skill isn't registered but this
   file is, follow the same sequence manually per the "Spec Kit workflow" section below).
2. That means: a fresh implementer subagent per task, RED before GREEN (a failing test exists
   before any production code), and a task-scoped reviewer subagent that actually runs and
   reports PASS/FAIL — dispatched with the Agent tool if the Superpowers skills aren't directly
   invocable — **before** the task's checkbox in `tasks.md` is changed from `[ ]` to `[X]`.
3. A task is only `[X]` once that reviewer subagent's verdict is recorded (inline annotation in
   `tasks.md`, same style as T001/T002, naming its Jira key). Its Jira Story (project `D2`) moves
   to `Terminé` at the same time, never earlier. No verdict recorded → the box stays `[ ]`, however
   confident the implementation looks.

If you find yourself about to `Write`/`Edit` files under `backend/` or `frontend/` to satisfy a
`tasks.md` item without having dispatched an implementer+reviewer subagent pair first: stop,
back out, and start over through the process above.

---

## Spec Kit workflow — how this repo is developed

This repo uses [Spec Kit](https://github.com/github/spec-kit) (`.specify/`, `.claude/skills/speckit-*`)
for spec-driven development, extended with a custom extension,
`extensions/superpowers-bridge/` (installed into `.specify/extensions/`), which delegates two
steps to the [Superpowers](https://github.com/obra/superpowers-marketplace) plugin:

- **`before_specify`** (optional hook) → `speckit.superpowers-bridge.brainstorm` → Superpowers
  `brainstorming` skill. Refines a raw feature idea (questions, 2-3 approaches, sectioned
  design) before `/speckit-specify` writes `spec.md`. Writes its design doc to
  `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` in addition to a condensed brief.
- **`before_implement`** (mandatory hook, `optional: false` — see the HARD RULE above, this is
  not optional in practice either) → `speckit.superpowers-bridge.tdd-implement`
  → Superpowers `brainstorming` → `writing-plans` → `subagent-driven-development` +
  `test-driven-development` (bridge v0.5.1). **Tasks are selected from Jira** (project `D2`
  on wissemhamza.atlassian.net, settings in `.specify/extensions/superpowers-bridge/jira.yml`,
  one Story per `tasks.md` item, summary prefixed with its `Txxx` ID); `tasks.md` stays the
  trace. Once per `/speckit-implement` run, before any dispatch: (1) determines this run's scope
  from the hook's own arguments, else the invoking `/speckit-implement`'s user input, else asks
  the human (never silently "every open issue") — "next task" is the first `À faire` Story by
  Jira rank whose `tasks.md` item is unchecked — then moves each in-scope issue to `En cours`
  with a comment, and works on a new branch `claude/task-<jira-key>-<slug>` (one PR per run); (2) brainstorms the in-scope task(s) interactively with the human (within the
  already-approved spec/plan — it proposes amendments rather than reopening them; a `tasks.md`
  item is always classified bounded or architectural, never a spike) and commits the
  approved design to `docs/superpowers/specs/YYYY-MM-DD-<task-ids>-<topic>-design.md`;
  (3) runs `writing-plans` on it regardless of path — this is always the next step, even on the
  bounded path — scoped to exactly those `tasks.md` items, each `### Task N:` heading naming the
  `tasks.md` ID it implements, saved to `docs/superpowers/plans/YYYY-MM-DD-<task-ids>-<topic>.md`
  and shown to the human for approval; (4) executes that plan with a fresh implementer subagent
  per plan task, strict RED-GREEN-REFACTOR, and a task-scoped reviewer subagent before a task is
  marked `[X]` — at which point its Jira issue moves to `Terminé` with a comment carrying the
  reviewer verdict (and, later, the PR link). If Jira is unreachable the hook stops rather than
  falling back to `tasks.md`. **This hook replaces `/speckit-implement`'s own Outline steps 3-9 entirely**: once
  it returns, the invoking `/speckit-implement` does not implement, review, or mark `[X]` any task
  itself — it proceeds straight to its Mandatory Post-Execution Hooks and Completion Report. For a
  task marked **`[UI]`** in `tasks.md` (creates/modifies a page or component under `frontend/`),
  the dispatched subagent must *also* invoke the `impeccable` skill (`.agents/skills/impeccable/`)
  for the visual/UX/accessibility work, alongside — not instead of — TDD: `impeccable` governs
  craft quality, `test-driven-development` still governs testable behavior.

Do not run `/speckit-implement` expecting it to write code in the current context — it hands
off to the hook above, which dispatches subagents. Subagents never inherit this session's
context: an implementer's dispatch carries the `tasks.md` ID line, the task-brief path (SDD's
`scripts/task-brief` output — the single source of exact requirements), the design-doc path, and
the absolute paths to `spec.md`/`plan.md`/`tasks.md`/`.specify/memory/constitution.md` as
reference reading only. The `writing-plans` implementation plan document itself is never handed
to a subagent as a path to read — it reaches the subagent only through the task-brief output and
the plan's Global Constraints block copied verbatim into the dispatch. The reviewer gets the same
SDD inputs (brief, report, review-package diff, Global Constraints) plus the design-doc path.

The canonical command order for this feature (already run once; re-run only to amend):
`/speckit-constitution` → `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`.

**Known friction**: Superpowers' `subagent-driven-development` helper scripts
(`scripts/task-brief`) expect Superpowers' own plan format (`### Task N` headings), not Spec
Kit's `tasks.md` checklist format (`- [ ] T001 ...`). Since bridge v0.4.0 this is resolved by
running SDD on the `writing-plans` plan (not on `tasks.md`), so `task-brief`/`review-package`
work natively. `.superpowers/` (SDD's workspace: ledgers, briefs, reports, review packages) is
git-ignored and was untracked on 2026-09-23 — it is local scratch. The durable record of every
task is its `tasks.md` inline annotation, its Jira Story comments, and git history; T001-T010's
hand-written briefs survive only in git history (T001/T005) or locally. The
`subagent-driven-development` workspace self-regenerates a `.gitignore` excluding itself on
every run; the root `.gitignore` already covers it.

