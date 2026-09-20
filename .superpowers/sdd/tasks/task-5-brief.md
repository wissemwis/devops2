# Task Brief — T005

Source: specs/001-questionnaire-platform/tasks.md, Phase 1: Setup

- [ ] T005 Create `.env.example` documenting DB, JWT and SMTP variables per plan.md Constraints (Principe IV — aucun secret en clair)

Jira ticket: D2-13 ("T005 Create .env.example (DB, JWT, SMTP variables)"),
description: "Create `.env.example` documenting DB, JWT and SMTP variables
per plan.md Constraints (Principe IV — aucun secret en clair)."

## Required reading before implementing

Read these in full before proposing an approach — do not assume this brief
is a complete restatement of them:

- `/home/user/devops2/.specify/memory/constitution.md` — binding governance,
  in particular Principe I (Test-First, NON-NEGOTIABLE) and Principe IV
  (Sécurité par défaut — no secret ever committed in clear).
- `/home/user/devops2/specs/001-questionnaire-platform/plan.md` — read the
  "Constraints" line under the Technical Context section ("Aucun secret en
  clair dans le dépôt (Principe IV)...") and the Constitution Check table
  row for Principe IV.
- `/home/user/devops2/specs/001-questionnaire-platform/research.md` — the
  SMTP decision (generic SMTP provider via Strapi's Email plugin /
  Nodemailer, configured by env vars) and the JWT-invitation-link decision
  (signed JWT, scoped per invitation/questionnaire/respondent), plus the
  V1 deployment note: "Variables d'environnement (DB, JWT, SMTP) configurées
  dans les dashboards Vercel/Strapi Cloud, jamais commitées — cohérent avec
  `.env.example` (Principe IV)."
- `/home/user/devops2/specs/001-questionnaire-platform/tasks.md` — read
  T005 in context of T006 (PostgreSQL config), T053 (production env vars:
  "DB connection, JWT secret, SMTP credentials — FR-017, API base URL —
  per `.env.example` (T005)"). T053 confirms this file's scope spans both
  backend (DB/JWT/SMTP) and frontend (API base URL) concerns.
- `/home/user/devops2/specs/001-questionnaire-platform/spec.md` — FR-017
  (invitation links) for why JWT/SMTP exist at all.
- Existing code that already consumes env vars, so the file you write is
  accurate rather than guessed: `/home/user/devops2/backend/config/database.ts`
  (DATABASE_CLIENT, DATABASE_URL/HOST/PORT/NAME/USERNAME/PASSWORD/SSL*/SCHEMA/
  POOL_MIN/POOL_MAX/CONNECTION_TIMEOUT/FILENAME),
  `/home/user/devops2/backend/config/server.ts` (HOST, PORT, APP_KEYS,
  WEBHOOKS_POPULATE_RELATIONS), `/home/user/devops2/backend/config/admin.ts`
  (ADMIN_JWT_SECRET, API_TOKEN_SALT, TRANSFER_TOKEN_SALT, ENCRYPTION_KEY),
  and the Strapi-generated `/home/user/devops2/backend/.env.example` (JWT_SECRET
  is used by the users-permissions plugin even though no config file
  references it directly by name).

## Scope for this task

Create **one `.env.example` file at the repository root**
(`/home/user/devops2/.env.example`), distinct from the existing
Strapi-scaffolded `backend/.env.example` (that one is T002's output, used
to bootstrap a local backend `.env`; do not delete or replace it — this
task's file is the project-wide reference documenting every variable both
`backend/` and `frontend/` need, matching what T053 will later configure in
the Vercel/Strapi Cloud dashboards).

Document, with placeholder (never real) values and a one-line comment above
each variable or logical group explaining what it's for:

1. **DB variables** — the full set `backend/config/database.ts` reads via
   `env(...)`, covering both the Postgres path (production/CI, per
   research.md) and the SQLite path (local dev, per research.md), e.g.
   `DATABASE_CLIENT`, `DATABASE_URL`, `DATABASE_HOST`, `DATABASE_PORT`,
   `DATABASE_NAME`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`,
   `DATABASE_SSL`, `DATABASE_FILENAME`.
2. **JWT / Strapi core secrets** — `APP_KEYS`, `ADMIN_JWT_SECRET`,
   `API_TOKEN_SALT`, `TRANSFER_TOKEN_SALT`, `JWT_SECRET`, `ENCRYPTION_KEY`
   (all currently `tobemodified`-style placeholders in
   `backend/.env.example` — mirror that convention here, do not invent
   real-looking secrets).
3. **SMTP variables** — the standard Strapi Email plugin (Nodemailer)
   variable set per research.md's decision: `SMTP_HOST`, `SMTP_PORT`,
   `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_DEFAULT_FROM`,
   `SMTP_DEFAULT_REPLY_TO`. (No `backend/config/plugins.ts` email block
   exists yet — that's a later task — but T005 is documentation, so this
   file may document variables not yet consumed by code, provided the
   brief's "Required reading" above justifies why they'll be needed.)
4. **Frontend / cross-cutting** — the frontend API base URL variable
   referenced by T053 ("API base URL"). Check whether `frontend/` already
   references an env var name for this (search `frontend/` for
   `process.env` or `NEXT_PUBLIC_`); if none exists yet, use the
   conventional Next.js public env var name and note in a comment that
   it must be set to the deployed backend's URL.

Do not commit any real secret. Every value must be an obvious placeholder
(e.g. `changeme`, `tobemodified`, `your-smtp-host.example.com`).

Out of scope for this task (do not touch): `backend/config/plugins.ts`
(wiring SMTP into Strapi — a later task), `backend/config/database.ts`
(T006), any frontend code changes.

## TDD approach for this task

This is a documentation/config task, not application logic (same category
as T001) — apply test-driven-development in the form that fits, following
the precedent set by `tests/structure/test_layout.sh` (T001),
`tests/structure/test_backend_init.sh` (T002) and
`tests/structure/test_lint_format.sh` (T004):

1. **RED**: write `tests/structure/test_env_example.sh` first, asserting
   (a) `.env.example` exists at the repository root, and (b) it contains
   every variable name listed above (grep-based assertions are fine, e.g.
   the pattern used in `test_lint_format.sh`), and (c) — to enforce
   Principe IV — that no line in the file looks like a real secret (e.g.
   assert placeholder markers like `changeme`/`tobemodified`/`example` are
   present rather than trying to prove a negative about "real" secrets).
   Run it and confirm it fails (the file doesn't exist yet).
2. **GREEN**: create `/home/user/devops2/.env.example` with the content
   above, re-run the test, confirm it passes.
3. Also re-run the existing regression tests (`test_layout.sh`,
   `test_backend_init.sh`, `test_frontend_init.sh`, `test_lint_format.sh`)
   to confirm no regression.

## Report contract

Report one of: DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED.
Commit your work directly (you may commit on the current branch,
`claude/ticket-d2-13-xp17e6` — do not create or push a different branch).
Use a commit message in the style of prior task commits (see `git log
--oneline` for T001-T004 style: `T005: <summary>`), ending with the
attribution footer given in your dispatch instructions.
Return: status, commit hash, a one-line RED→GREEN test summary, exact path
of the new file, and any concerns.
