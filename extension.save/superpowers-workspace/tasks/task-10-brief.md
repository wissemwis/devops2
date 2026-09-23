# Task Brief — T010

Source: /project/devops2/specs/001-questionnaire-platform/tasks.md, Phase 2: Foundational

- [ ] T010 Create `docker-compose.yml` at repository root wiring `db` (PostgreSQL), `backend`, `frontend` services per plan.md Constraints (Principe III — IaC)

Branch: `claude/task-t010-docker-compose` (checked out; BASE 0b5e0fc). Commit here; never push.

## Required reading (read constitution.md BEFORE choosing an approach)

- /project/devops2/.specify/memory/constitution.md — Principe I Test-First (non-negotiable),
  II Simplicité/YAGNI, III IaC & reproductibilité, IV no secret in clear, V health + JSON logs.
- /project/devops2/specs/001-questionnaire-platform/plan.md — "Constraints" line; amendment (c).
- /project/devops2/specs/001-questionnaire-platform/research.md — § Persistance (PostgreSQL in
  CI/prod, SQLite in dev) and the V1 deployment section: "`docker-compose.yml` (T010) reste
  utilisé pour le développement local et deviendra la base du déploiement auto-hébergé à partir
  de S5-S7".
- /project/devops2/specs/001-questionnaire-platform/quickstart.md — "Démarrage local" runs
  `docker compose up -d db` then the backend natively, and "Nettoyage" runs
  `docker compose down -v`. Both must keep working.
- /project/devops2/specs/001-questionnaire-platform/spec.md — context only.
- /project/devops2/specs/001-questionnaire-platform/tasks.md — read T010 only, plus T055
  (Dockerfiles, a LATER task) to understand the boundary.

## Controller rulings (binding for this task)

1. **No Dockerfiles in T010.** Dockerfiles are T055. `backend` and `frontend` run the official
   `node:20` image (Node 20 LTS per plan.md) with their source directory bind-mounted and a
   command that installs deps and starts the dev server (`npm run develop` for Strapi on 1337,
   `npm run dev` for Next.js on 3000). Keep container `node_modules` out of the host tree (e.g.
   a named/anonymous volume on the node_modules path) so the host checkout isn't polluted with
   Linux-built native modules (`better-sqlite3`).
2. **`db` service**: official `postgres` image (pin a major, e.g. `postgres:16`), named volume
   for data, publishes 5432 to the host (quickstart's native backend connects to it), a
   `pg_isready` healthcheck.
3. **`backend` service**: `DATABASE_CLIENT=postgres`, `DATABASE_HOST=db`, depends on `db`
   being healthy, healthcheck on the bare `GET /health` (T008, contracts/api.md), publishes 1337.
   **Named risk**: `backend/config/database.ts` gives `DATABASE_URL` precedence, and the root
   `.env.example` ships a non-empty placeholder `DATABASE_URL`. The backend service must
   neutralise it (e.g. set `DATABASE_URL` to empty in the service environment) so
   `DATABASE_HOST=db` wins — verify how an empty value is treated by reading database.ts and
   the installed `pg` source, don't assume.
4. **`frontend` service**: depends on `backend`, publishes 3000, `NEXT_PUBLIC_API_BASE_URL`
   pointing at the backend as the *browser* sees it (`http://localhost:1337`).
5. **Secrets (Principe IV)**: no secret or password literal in `docker-compose.yml`. Take
   credentials/secrets from the environment / root `.env` (gitignored) via `${VAR}`
   interpolation or `env_file`; `.env.example` (root) must document every variable compose
   needs — add any missing ones there (placeholders only). A fresh clone doing
   `cp .env.example .env && docker compose up` should work without further edits.
6. YAGNI: no nginx, no extra services, no profiles, no prod overrides.

## TDD (Superpowers `test-driven-development` — mandatory)

RED first: create `tests/structure/test_docker_compose.sh` in the style of the existing
`tests/structure/*.sh` (✓ PASS / ✗ FAIL lines, counters, non-zero exit on failure). Run it,
capture the failing output, and only then write `docker-compose.yml`.

Make the test behavioural, not grep-only: Docker Compose v5 is installed (`docker compose`);
use `docker compose config --format json` (with a throwaway env file built from
`.env.example`) and assert on the parsed model with node or python (`python3` is available;
node is not on PATH — a portable Node 22 lives at
/tmp/claude-1000/-project-devops2/f0c0f41e-6d12-45e7-a390-b175e6f2473f/scratchpad/node-v22.12.0-linux-x64/bin,
but python3 is preferable so the test doesn't depend on it). Check at least: the three services
exist; db image/healthcheck/volume/port; backend env (client/host, DATABASE_URL neutralised),
depends_on db `service_healthy`, `/health` healthcheck, port 1337; frontend port 3000 and API
URL; no secret literals in the raw YAML (only `${...}` references).

Then do a **live verification** and put the evidence in your report: `docker compose up -d`,
wait for health, `curl http://localhost:1337/health` → `{"status":"ok"}` (proving Strapi talks
to Postgres), confirm backend logs are JSON lines (T009), frontend answers on :3000. Then
`docker compose down -v` and remove any throwaway `.env` you created. The first `npm ci` in
containers is slow — be patient, use generous timeouts. If live verification is impossible
(e.g. no network for images), report DONE_WITH_CONCERNS with the exact error.

Regression before committing: all `tests/structure/*.sh` must still pass. Formatting: run
backend/frontend `npm run format:check` only if you touched files they cover.

## Scope / git hygiene

Expected files: `docker-compose.yml`, `tests/structure/test_docker_compose.sh`, `.env.example`
(only if variables are missing). Do not edit `tasks.md`, `CLAUDE.md`, or anything under
`.superpowers/` except your report file. **Stage files explicitly by path** — never
`git add -A` / `git add .` (the working tree may contain controller bookkeeping files).
Commit message: `T010: Create docker-compose.yml wiring db, backend, frontend`, ending with the
two lines:
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018oex3Jpgz8jfd3XAQ58F4t
