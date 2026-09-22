# Archive — `superpowers-bridge` Spec Kit extension

**Status: inactive, archived 2026-09-23.** Nothing in this folder is loaded by Spec Kit or
Claude Code. The project owner stopped using the extension for the rest of development;
this folder keeps every file it consisted of, the records of the runs made with it, and this
documentation.

## What it was

`superpowers-bridge` was a custom [Spec Kit](https://github.com/github/spec-kit) extension
(author: Wissem Hamza, MIT) that plugged the [Superpowers](https://github.com/obra/superpowers-marketplace)
Claude Code plugin into Spec Kit's command hooks. It was built on purpose as reusable
Claude Code tooling — one of the two goals of this repository (see `CLAUDE.md`, "What this
repository is").

It registered two hooks in `.specify/extensions.yml`:

| Hook | Command | Delegated to |
|---|---|---|
| `before_specify` (optional) | `speckit.superpowers-bridge.brainstorm` | Superpowers `brainstorming` — refines a raw feature idea (questions, 2-3 approaches, sectioned design) and writes `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` plus a condensed brief before `/speckit-specify` writes `spec.md`. |
| `before_implement` (mandatory) | `speckit.superpowers-bridge.tdd-implement` | Superpowers `brainstorming` → `writing-plans` → `subagent-driven-development` + `test-driven-development`, replacing `/speckit-implement`'s in-context task loop. |

### `tdd-implement` in its last version (0.5.1)

Once per `/speckit-implement` run:

1. **Scope from Jira** — reads `jira.yml` (site `wissemhamza.atlassian.net`, project `D2`,
   Stories whose summary starts with the `tasks.md` ID `Txxx`). "next task" = first `À faire`
   Story by rank whose `tasks.md` item is unchecked; explicit Jira keys or `Txxx` IDs also
   accepted; stops if Jira is unreachable. Moves in-scope issues to `En cours` with a comment.
2. **Git safety** — one branch per run, `claude/task-<jira-key>-<slug>`; never on `main`.
3. **Brainstorming** with the human (within the approved spec/plan; a task is bounded or
   architectural, never a spike); design doc committed under `docs/superpowers/specs/`.
4. **`writing-plans`** — always run, even on brainstorming's bounded path; plan scoped to the
   in-scope tasks, each `### Task N:` naming its `tasks.md` ID; approved by the human.
5. **`subagent-driven-development`** on that plan — one fresh implementer subagent per plan
   task (strict RED-GREEN-REFACTOR), a task review (spec compliance + code quality), fix loop,
   final whole-branch review. Subagents get the plan only through SDD's `task-brief` output
   and the plan's Global Constraints. UI tasks (`[UI]`) also go through the `impeccable` skill.
6. **Trace** — `tasks.md` item marked `[X]` with an inline annotation of the reviewer verdict
   and Jira key; Jira issue moved to `Terminé` with a verdict comment (and the PR link).
7. **Terminal instruction** — the hook replaces `/speckit-implement`'s Outline steps 3-9, so
   the caller never implements a task in-context.

## Version history

| Version | Commit | Date | Change |
|---|---|---|---|
| 0.1.0 | `1d5a190` | 2026-09-19 | Scaffold Spec Kit + bridge: `before_specify` → brainstorming, `before_implement` → SDD + TDD |
| 0.1.0 | `eafae21` | 2026-09-19 | Let brainstorming write its design doc (no version bump) |
| 0.2.0 | `10af32e` | 2026-09-19 | Route `[UI]` tasks through the `impeccable` skill |
| 0.3.0 | `e9e4e87` | 2026-09-22 | Brainstorm the in-scope tasks once per run before implementing |
| 0.4.0 | `4f67fd4` | 2026-09-23 | Run `writing-plans` between brainstorming and SDD (never skipped) |
| 0.4.1 | `759a149` | 2026-09-23 | Final-review fixes: scope forwarding, no in-context execution after the hook, `writing-plans` on the bounded path, brief-only dispatch |
| 0.5.0 | `f8fa484` | 2026-09-23 | Select tasks from Jira and track them there |
| 0.5.1 | `2446228` | 2026-09-23 | `.superpowers/` untracked; follow SDD's Finish again |

0.5.x was never reviewed by a subagent nor exercised on a real task.

## What was built with it

T001–T010 of `specs/001-questionnaire-platform/tasks.md` (Jira D2-9 … D2-18). Their
`tasks.md` inline annotations record, per task, the RED/GREEN evidence and the reviewer
verdict. T001–T009 ran before the Superpowers plugin was installed (the workflow was followed
by hand, with hand-written briefs); T010 was the first run through the installed plugin
(under 0.2.0 semantics). T011 (D2-19) was mid-brainstorming when the extension was stopped —
its decisions are in `superpowers-workspace/pending-brainstorm-T011.md`.

## Contents of this folder

| Path | Was | Notes |
|---|---|---|
| `superpowers-bridge/` | `extensions/superpowers-bridge/` | Extension source: `extension.yml`, `jira.yml`, `commands/*.md`. |
| `installed/specify-extension-superpowers-bridge/` | `.specify/extensions/superpowers-bridge/` | Installed copy, including `.specify-dev/agent-commands/claude/*/SKILL.md` (the generated Claude Code skills). |
| `installed/claude-skills-symlinks.txt` | `.claude/skills/speckit-superpowers-bridge-*/SKILL.md` | Those two skills were symlinks to the generated SKILL.md files above; the symlinks were deleted, their targets are recorded here. |
| `installed/extensions.yml.snapshot` | `.specify/extensions.yml` | Hook registration as it was before deactivation. |
| `claude-md-workflow-sections.md` | `CLAUDE.md` | The "HARD RULE" and "Spec Kit workflow" sections that made the bridge binding, verbatim. |
| `superpowers-workspace/` | `.superpowers/sdd/` | Local SDD workspace (git-ignored; its T001/T005 files were tracked until `2446228`): run ledger `tasks/progress.md` with every ruling, task briefs/reports (T001, T005, T009, T010), review packages (`review-*.diff`), the T010 final-review findings and fix report, and the paused T011 brainstorming notes. |

## What was changed outside this folder when it was archived

- `.specify/extensions.yml` — no extension installed, no hooks (`installed: []`, `hooks: {}`).
- `CLAUDE.md` — HARD RULE and bridge workflow sections removed (copied here); points to this folder.
- `.specify/memory/constitution.md` — v1.1.0 → **v1.2.0**: Principe I and the "Workflow de
  Développement" section no longer name the Superpowers workflow / bridge hooks. The Test-First
  obligation and the per-task review before `[X]` are unchanged.
- `specs/001-questionnaire-platform/plan.md` — amendment 2026-09-23 (d): Testing line and the
  Principe I Constitution Check row no longer name the hook.
- Not changed: `docs/superpowers/specs/2026-09-19-questionnaire-platform-design.md` (a design
  record referenced by `plan.md`), the `tasks.md` annotations of T001–T010 (history), the
  `/.superpowers` line of `.gitignore`, the `impeccable` skill (`.agents/skills/impeccable/`),
  and the Superpowers plugin itself, which is installed at user level (`~/.claude/plugins`),
  outside this repository.

## Reinstalling it (if ever needed)

1. `git mv extension.save/superpowers-bridge extensions/superpowers-bridge` and
   `git mv extension.save/installed/specify-extension-superpowers-bridge .specify/extensions/superpowers-bridge`.
2. Restore `.specify/extensions.yml` from `installed/extensions.yml.snapshot`.
3. Recreate the two symlinks listed in `installed/claude-skills-symlinks.txt` under `.claude/skills/`.
4. Install the Superpowers plugin (`/plugin marketplace add obra/superpowers-marketplace`,
   `/plugin install superpowers@superpowers-marketplace`) and connect the Atlassian connector
   for the Jira steps.
5. Restore the CLAUDE.md sections from `claude-md-workflow-sections.md` and revert the
   constitution/plan amendments of 2026-09-23 if the bridge becomes binding again.
