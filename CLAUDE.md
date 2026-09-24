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

## Code conventions

- **No comments in code.** Do not add comments to source, test, configuration or script files
  (`//`, `/* */`, JSDoc, `#` in shell/YAML, etc.) — including in code written into
  implementation plans. Clear names, small functions and tests carry the intent; the *why*
  goes in commit messages, `tasks.md` annotations and the spec/plan documents. Existing
  comments may stay; when a change makes one wrong, delete it rather than rewrite it.

## Current state

**T001–T010**, **T011–T021**, **T022**, **T060**, **T061**, **T062**, **T063**, **T071** and **T077** of 77 tasks in `specs/001-questionnaire-platform/tasks.md` are done
(each with a recorded reviewer-subagent verdict). What exists today:

- `backend/` — Strapi 5 TypeScript project (`create-strapi-app@5.54.0`, T002). SQLite by default
  for local dev, PostgreSQL via `DATABASE_CLIENT=postgres` with the `pg` driver installed (T006).
  User has the native users-permissions `role` relation plus a required `nom`; FR-016 roles
  `auteur`/`repondant`/`administrateur` are created at boot and public registration is closed
  (T061). Role permissions come from `ROLE_PERMISSIONS` in `src/bootstrap/permissions.ts`
  (granted at boot, additive; `auteur`: `users/me`, `role.find`, `auth.logout`, questionnaire
  `create`/`publish`/`close`/`findMine`/`findOneMine`, question `add`; `administrateur`:
  `users/me`, `role.find`, `auth.logout`, questionnaire `close`/`findMine`/`findOneMine`;
  `repondant`: `auth.logout`);
  in development, `DEV_AUTEUR_EMAIL`/`DEV_AUTEUR_PASSWORD` create a test `auteur` account at boot (T062).
  `GET /health` → 200 `{"status":"ok"}` / 503 `{"status":"degraded","reason":...}`, registered at the bare `/health`
  path via `strapi.server.routes()` in `src/index.ts` as well as `/api/health` (T008).
  Structured JSON logs on stdout via `config/logger.ts`, level from `LOG_LEVEL` (default `http`)
  (T009); Strapi's startup banner is still plain `console.log`, not JSON. Content-types
  `questionnaire` and `question` (ASCII enum codes, `draftAndPublish: false`, `options` JSON for
  `choix_multiple`); routes `POST /api/questionnaires`, `PATCH /api/questionnaires/:id/questions`,
  `POST /api/questionnaires/:id/publish`, `POST /api/questionnaires/:id/close`,
  `GET /api/mes-questionnaires` and `GET /api/mes-questionnaires/:id` (author-scoped reads, any
  statut, T077) in Strapi's `data` envelope, ownership in
  `api/questionnaire/services/questionnaire-access.ts` (404/403), 409 on a
  wrong transition, 422 when publishing without question (US1 backend, T011–T021).
- `frontend/` — Next.js App Router + TypeScript project (`create-next-app`, T003); `npm run build`
  works. `/login` (server action) and a protected `/questionnaires` home ("Mes questionnaires",
  logout); BFF session in httpOnly cookies `qp_access`/`qp_refresh` with `proxy.ts` refreshing the
  10-minute Strapi access token; server-only `STRAPI_URL` (`http://backend:1337` in Compose); visual
  world "Cahier Seyès" documented in `DESIGN.md` (T063). `/questionnaires/create` (creation form,
  `auteur` only) and the draft page `/questionnaires/[id]` (read via `GET /api/mes-questionnaires/:id`);
  the table of contents links each title to its draft; Strapi calls for questionnaires live in
  `services/questionnaireService.ts` (T022). `GET /health` → 200 `{"status":"ok"}` (liveness only,
  `app/health/route.ts`); server-side JSON logs on stdout via `lib/logger.ts` (`LOG_LEVEL`, default
  `info`; server-only — never import it from a client component), request errors logged by
  `onRequestError` in `instrumentation.ts` (Node runtime only); Next.js's own banner/dev lines stay
  plain text (T060).
- Tooling — ESLint + Prettier in both projects (`npm run lint`, `npm run format:check`, T004);
  root `.env.example` documents DB/JWT/SMTP/API-URL variables (T005).
- `docker-compose.yml` — local dev stack (T010, non-root/loopback fixes from the final-fix wave):
  `db` (postgres:16, `127.0.0.1:5432`), `backend` (node:20 + bind mount, `npm run develop`,
  `127.0.0.1:1337`, healthcheck on `/health`), `frontend` (node:20, `npm run dev`,
  `127.0.0.1:3000`, healthcheck on `/health`); every published port is loopback-only by default — `BIND_ADDRESS`
  (default `127.0.0.1`) moves the backend/frontend ports to another interface, e.g. `0.0.0.0` in a
  local env file for LAN access; `db` always stays on loopback. `backend`/`frontend` run as the
  image's non-root `node` user (uid:gid 1000:1000), via a one-shot `init` helper service that
  chowns the named node_modules volumes first — verified live to leave no root-owned files under
  `backend/`/`frontend/` on the host (the empty node_modules mountpoint directories that Docker's
  daemon creates for the named volumes are the sole, expected exception — no real content lands
  there). No Dockerfiles yet (T055). `cp .env.example .env && docker compose up -d`.
- Tests — `tests/structure/*.sh` shell scripts, plus a Jest + Supertest harness in `backend/`
  (`npm test`; in-process Strapi on a throwaway SQLite file, `tests/helpers/strapi.ts`, introduced
  by T061; `tests/contract/` and `tests/unit/` added by T011–T021), and a Vitest harness in
  `frontend/` (`npm test`, `tests/**/*.test.ts`, T060).

The T007 `role` enum risk is resolved by T061.

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
