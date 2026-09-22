# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
   `tasks.md`, same style as T001/T002). No verdict recorded → the box stays `[ ]`, however
   confident the implementation looks.

If you find yourself about to `Write`/`Edit` files under `backend/` or `frontend/` to satisfy a
`tasks.md` item without having dispatched an implementer+reviewer subagent pair first: stop,
back out, and start over through the process above.

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
- **`before_implement`** (mandatory hook, `optional: false` — see the HARD RULE above, this is
  not optional in practice either) → `speckit.superpowers-bridge.tdd-implement`
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

**T001–T008** of 59 tasks in `specs/001-questionnaire-platform/tasks.md` are done (each with a
recorded reviewer-subagent verdict); T009 (JSON logging in `backend/config/logger.ts`) is in
progress. What exists today:

- `backend/` — Strapi 5 TypeScript project (`create-strapi-app@5.54.0`, T002). SQLite by default
  for local dev, PostgreSQL via `DATABASE_CLIENT=postgres` with the `pg` driver installed (T006).
  User content-type extended with a business `role` enum (T007). `GET /health` → 200
  `{"status":"ok"}` / 503 `{"status":"degraded","reason":...}`, registered at the bare `/health`
  path via `strapi.server.routes()` in `src/index.ts` as well as `/api/health` (T008).
- `frontend/` — Next.js App Router + TypeScript project (`create-next-app`, T003); `npm run build`
  works. No application pages yet.
- Tooling — ESLint + Prettier in both projects (`npm run lint`, `npm run format:check`, T004);
  root `.env.example` documents DB/JWT/SMTP/API-URL variables (T005).
- Tests — so far only shell scripts under `tests/structure/*.sh` (run each one; all should pass).
  No Jest/contract/integration test harness exists yet (starts with T011+).

**Open risk carried forward from T007** (see its `tasks.md` annotation): the custom `role` enum
overwrites Strapi's built-in `users-permissions` `role` relation, which breaks authenticated
permission resolution. Resolve it (rename the field, or amend `data-model.md` + `plan.md`
Complexity Tracking) before any login/auth/permission-gated task.

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
