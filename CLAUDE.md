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
   develop reusable Claude Code skills (the first one, `superpowers-bridge`, is archived in
   `extension.save/`).

Both purposes are recorded in `specs/001-questionnaire-platform/spec.md` and
`.specify/memory/constitution.md` — read those before assuming either purpose is the only one.

## Spec Kit — how this repo is specified

This repo uses [Spec Kit](https://github.com/github/spec-kit) (`.specify/`, `.claude/skills/speckit-*`)
for spec-driven development. The canonical command order for this feature (already run once;
re-run only to amend): `/speckit-constitution` → `/speckit-specify` → `/speckit-plan` →
`/speckit-tasks` → `/speckit-implement`. No Spec Kit extension or hook is installed
(`.specify/extensions.yml` is empty).

Tasks T001–T010 were implemented through a custom Spec Kit extension, `superpowers-bridge`
(hooks delegating to the Superpowers plugin: brainstorming, writing-plans,
subagent-driven-development, TDD, Jira-driven task selection). Its use was stopped on
2026-09-23: the extension, its installed copies, its run records and the CLAUDE.md sections
that made it binding are archived, with documentation, in `extension.save/` — see
`extension.save/README.md`. Nothing in that folder is active. The `tasks.md` annotations of
T001–T010 still describe how those tasks were built and reviewed.

## Current state

**T001–T010** of 59 tasks in `specs/001-questionnaire-platform/tasks.md` are done (each with a
recorded reviewer-subagent verdict). What exists today:

- `backend/` — Strapi 5 TypeScript project (`create-strapi-app@5.54.0`, T002). SQLite by default
  for local dev, PostgreSQL via `DATABASE_CLIENT=postgres` with the `pg` driver installed (T006).
  User content-type extended with a business `role` enum (T007). `GET /health` → 200
  `{"status":"ok"}` / 503 `{"status":"degraded","reason":...}`, registered at the bare `/health`
  path via `strapi.server.routes()` in `src/index.ts` as well as `/api/health` (T008).
  Structured JSON logs on stdout via `config/logger.ts`, level from `LOG_LEVEL` (default `http`)
  (T009); Strapi's startup banner is still plain `console.log`, not JSON.
- `frontend/` — Next.js App Router + TypeScript project (`create-next-app`, T003); `npm run build`
  works. No application pages yet.
- Tooling — ESLint + Prettier in both projects (`npm run lint`, `npm run format:check`, T004);
  root `.env.example` documents DB/JWT/SMTP/API-URL variables (T005).
- `docker-compose.yml` — local dev stack (T010, non-root/loopback fixes from the final-fix wave):
  `db` (postgres:16, `127.0.0.1:5432`), `backend` (node:20 + bind mount, `npm run develop`,
  `127.0.0.1:1337`, healthcheck on `/health`), `frontend` (node:20, `npm run dev`,
  `127.0.0.1:3000`); every published port is loopback-only. `backend`/`frontend` run as the
  image's non-root `node` user (uid:gid 1000:1000), via a one-shot `init` helper service that
  chowns the named node_modules volumes first — verified live to leave no root-owned files under
  `backend/`/`frontend/` on the host (the empty node_modules mountpoint directories that Docker's
  daemon creates for the named volumes are the sole, expected exception — no real content lands
  there). No Dockerfiles yet (T055). `cp .env.example .env && docker compose up -d`.
- Tests — so far only shell scripts under `tests/structure/*.sh` (run each one; all should pass).
  No Jest/contract/integration test harness exists yet (starts with T011+).

**Open risk carried forward from T007** (see its `tasks.md` annotation): the custom `role` enum
overwrites Strapi's built-in `users-permissions` `role` relation, which breaks authenticated
permission resolution. Resolve it (rename the field, or amend `data-model.md` + `plan.md`
Complexity Tracking) before any login/auth/permission-gated task. Direction chosen by the project
owner on 2026-09-23 (T011 brainstorming, not yet written into the spec): FR-016 roles become
native `users-permissions` roles and the T007 enum extension is undone — see
`extension.save/superpowers-workspace/pending-brainstorm-T011.md`.

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

`.specify/memory/constitution.md` (currently v1.2.0) is binding project governance, not
guidance: Test-First (TDD, non-negotiable), Simplicité/YAGNI,
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
