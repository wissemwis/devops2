# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

Two things at once, on purpose:

1. **A real application**: a questionnaire platform (create/publish questionnaires, collect
   responses via public link or private invitation, view results/export CSV) that will be
   deployed for actual use — end-of-session feedback surveys for a DevOps course.
2. **Teaching material**: this same application is the pre-built artifact students bring into
   a "software factory" exercise (Git branching, CI/CD, Docker, Kubernetes) for the course
   module it belongs to. It is being built with agentic AI deliberately, partly to test and
   develop reusable Claude Code skills (see `extensions/superpowers-bridge/`).

Both purposes are recorded in `specs/001-questionnaire-platform/spec.md` and
`.specify/memory/constitution.md` — read those before assuming either purpose is the only one.

## Spec Kit workflow — how this repo is developed

This repo uses [Spec Kit](https://github.com/github/spec-kit) (`.specify/`, `.claude/skills/speckit-*`)
for spec-driven development, extended with a custom extension,
`extensions/superpowers-bridge/` (installed into `.specify/extensions/`), which delegates two
steps to the [Superpowers](https://github.com/obra/superpowers-marketplace) plugin:

- **`before_specify`** (optional hook) → `speckit.superpowers-bridge.brainstorm` → Superpowers
  `brainstorming` skill. Refines a raw feature idea (questions, 2-3 approaches, sectioned
  design) before `/speckit-specify` writes `spec.md`. Writes its design doc to
  `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` in addition to a condensed brief.
- **`before_implement`** (mandatory hook, `optional: false`) → `speckit.superpowers-bridge.tdd-implement`
  → Superpowers `subagent-driven-development` + `test-driven-development`. Executes `tasks.md`
  with a fresh implementer subagent per task, strict RED-GREEN-REFACTOR, and a task-scoped
  reviewer subagent before a task is marked `[X]`. For a task marked **`[UI]`** in `tasks.md`
  (creates/modifies a page or component under `frontend/`), the dispatched subagent must
  *also* invoke the `impeccable` skill (`.agents/skills/impeccable/`) for the visual/UX/
  accessibility work, alongside — not instead of — TDD: `impeccable` governs craft quality,
  `test-driven-development` still governs testable behavior.

Do not run `/speckit-implement` expecting it to write code in the current context — it hands
off to the hook above, which dispatches subagents. Subagents never inherit this session's
context: any dispatch must explicitly pass the task's brief plus absolute paths to `spec.md`,
`plan.md`, `tasks.md`, and `.specify/memory/constitution.md`.

The canonical command order for this feature (already run once; re-run only to amend):
`/speckit-constitution` → `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`.

**Known friction**: Superpowers' `subagent-driven-development` helper scripts
(`scripts/task-brief`) expect Superpowers' own plan format (`## Task N` headings), not Spec
Kit's `tasks.md` checklist format (`- [ ] T001 ...`). Write task briefs by hand when dispatching
implementer subagents; `scripts/review-package` (diff-based) works unmodified. The
`subagent-driven-development` workspace (`.superpowers/sdd/`) self-regenerates a `.gitignore`
excluding itself on every run — this project tracks its content anyway (ledger, briefs,
reports) via `git add -f`, so future dispatches need the same `-f`.

## Current state

**T001** and **T002** of 59 tasks in `specs/001-questionnaire-platform/tasks.md` are done: the
`backend/`/`frontend/` directory skeleton exists (T001, matching `plan.md` § Project Structure),
and `backend/` is now a real Strapi 5 TypeScript project (`create-strapi-app@5.54.0`, SQLite for
local dev per research.md), with `npm install`/`npm run build` verified working. `frontend/` is
still empty except `.gitkeep` files and `tests/structure/test_layout.sh` — do not assume any
frontend build command works until T003 lands it.

## Source of truth for requirements and design

Everything below lives under `specs/001-questionnaire-platform/` — read the relevant file
before making a change instead of re-deriving decisions from this summary:

- `spec.md` — functional requirements (FR-001…FR-019), user stories with priorities, entities.
- `plan.md` — tech stack, target platforms, constitution-gate justifications. Carries dated
  amendment notes at the top; treat the latest amendment as current, not the original body text
  further down, when the two disagree.
- `research.md` — the *why* behind each tech decision (one section per decision).
- `data-model.md` — Strapi content-types and their fields/validation rules.
- `contracts/api.md` — the REST contract the frontend and backend must both honor.
- `quickstart.md` — end-to-end manual validation scenarios (one per user story).
- `tasks.md` — the dependency-ordered task list `/speckit-implement` executes.

`.specify/memory/constitution.md` (currently v1.1.0) is binding project governance, not
guidance: Test-First (TDD via the `before_implement` hook, non-negotiable), Simplicité/YAGNI,
Infrastructure as Code, Sécurité par défaut, Observabilité. A task that violates a principle
needs a justification in `plan.md`'s Complexity Tracking section, not a silent workaround.

## Architecture (target, per plan.md)

- **`backend/`** — Strapi 5, TypeScript, content-types `questionnaire`/`question`/`response`
  (+ `response-question` junction, `invitation` — both implementation entities not named in
  `spec.md`, see `data-model.md`), PostgreSQL. Exposes `GET /health` and structured JSON logs
  on stdout (constitution Principle V).
- **`frontend/`** — Next.js (App Router), TypeScript. Talks to the backend only via the REST
  contract in `contracts/api.md` — never a direct DB connection.
- The two are deployed and versioned independently (separate `Dockerfile`s later; separate
  managed platforms now — see below).

## Deployment: two independent tracks

Per constitution v1.1.0 and `plan.md` amendment (c) — these do not block each other:

1. **V1 (current reference)**: frontend on **Vercel**, backend on **Strapi Cloud/SaaS**, both
   deployed from Git on push. This is the real deployment used for actual surveys. Tasks
   T051-T054 in `tasks.md`.
2. **Self-hosted migration (pedagogical, later)**: Docker/Compose → Jenkins/GitLab CI →
   Kubernetes, introduced progressively per the course's session calendar (S1-S11, see
   constitution "Contraintes Techniques et Pédagogiques"). Tasks T055-T057. Not a prerequisite
   for shipping V1.

Environment variables (DB, JWT, SMTP) are never committed — see `.env.example` (T005) and the
Vercel/Strapi Cloud dashboards for the real values.
