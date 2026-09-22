---

description: "Task list template for feature implementation"
---

# Tasks: Plateforme de gestion de questionnaires

**Input**: Design documents from `/specs/001-questionnaire-platform/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: Requis pour toutes les tâches d'implémentation — la Constitution du projet (Principe I,
NON-NEGOTIABLE) impose le TDD strict, appliqué par le hook `before_implement` de l'extension
`superpowers-bridge` (Superpowers `test-driven-development` + `subagent-driven-development`) :
chaque tâche d'implémentation ci-dessous doit être précédée d'un test qui échoue.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing
of each story.

## Format: `[ID] [P?] [Story] [UI?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- **[UI]**: Task creates/modifies a graphical interface — routes through the `impeccable` skill (see Paths note below)
- Paths: `backend/` = API Strapi, `frontend/` = Next.js App Router (Option 2, voir plan.md — amendé 2026-09-19, remplace React/Vite). Langage : TypeScript sur les deux projets (amendé 2026-09-19, remplace JavaScript) — `.ts` pour le code non-UI, `.tsx` pour les composants/pages React.
- **[UI]**: Toute tâche marquée `[UI]` DOIT passer par le skill `impeccable` (`.agents/skills/impeccable/`) pour le travail visuel/UX, en plus du TDD standard — voir `extensions/superpowers-bridge/commands/speckit.superpowers-bridge.tdd-implement.md` (amendé 2026-09-19).

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Create project structure per plan.md: `backend/`, `frontend/` at repository root *(complété avant l'amendement Next.js du 2026-09-19 ; `frontend/` restructuré manuellement vers `app/`/`components/`/`services/` pour rester conforme à plan.md — voir commit de l'amendement)*
- [X] T002 Initialize backend Strapi 5 project in `backend/` with the TypeScript template (Node.js 20 LTS) per plan.md Primary Dependencies *(scaffolded via `create-strapi-app@5.54.0 --ts --dbclient sqlite`, merged into the existing `backend/` skeleton from T001; verified by `tests/structure/test_backend_init.sh` and `npm run build`; task-scoped reviewer subagent ran retroactively against commit `9965ce0` per the `before_implement` review gate — verdict PASS, no blocking defects)*
- [X] T003 [P] Initialize frontend Next.js project in `frontend/` (App Router, TypeScript enabled via `tsconfig.json`) per plan.md Primary Dependencies *(scaffolded via `create-next-app@latest --typescript --app`, merged non-destructively into the existing `frontend/` skeleton from T001, preserving all pre-existing route-folder placeholders; verified by new RED/GREEN test `tests/structure/test_frontend_init.sh` and `npm run build`; task-scoped reviewer subagent independently re-ran the RED/GREEN check via file-move, reproduced `npm install`/`npm run build` from a clean `.next`, and confirmed `tests/structure/test_layout.sh` and `tests/structure/test_backend_init.sh` regressions still pass — verdict PASS, no blocking defects)*
- [X] T004 [P] Configure linting/formatting (ESLint + Prettier) for `backend/` and `frontend/` *(implementer subagent added flat-config ESLint 10 + `typescript-eslint` and Prettier to `backend/` from scratch, and Prettier + `eslint-config-prettier` to `frontend/` alongside its existing `create-next-app` ESLint setup, plus a shared root `.prettierignore`; RED confirmed via new `tests/structure/test_lint_format.sh` (12/14 assertions failing pre-implementation, since none of the config files/scripts existed at commit `6e4f6ed`), GREEN confirmed (14/14) after; `npm run lint`/`npm run format:check` verified exit 0 in both projects (one non-blocking pre-existing warning in Strapi-generated `backend/config/plugins.ts`, left untouched as out of scope); task-scoped reviewer subagent independently re-ran the RED/GREEN check from scratch, diffed every Prettier-reformatted file to confirm style-only changes, re-ran `test_backend_init.sh`/`test_frontend_init.sh`/`test_layout.sh` regressions, and reproduced both `npm run build`s — verdict PASS, no blocking defects)*
- [X] T005 Create `.env.example` documenting DB, JWT and SMTP variables per plan.md Constraints (Principe IV — aucun secret en clair) *(added project-wide root `.env.example` distinct from `backend/.env.example` (T002), covering DB/JWT/SMTP per `database.ts`/`admin.ts`/`server.ts` plus `NEXT_PUBLIC_API_BASE_URL` per T053; RED confirmed via `tests/structure/test_env_example.sh` (0/25 passing without the file), GREEN (25/25) after; all pre-existing regression scripts (`test_layout.sh`, `test_backend_init.sh`, `test_frontend_init.sh`, `test_lint_format.sh`) still pass; task-scoped reviewer subagent independently reproduced RED via file-move and confirmed no real secrets, correct scope (backend/frontend untouched) — verdict PASS, no blocking defects)*

**Checkpoint**: Setup terminé — la phase Foundational peut commencer.

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: Aucune user story ne peut démarrer avant la fin de cette phase.

- [X] T006 Configure PostgreSQL connection in `backend/config/database.ts` per research.md (Storage: PostgreSQL en CI/production, SQLite en dev) *(implementer subagent found `backend/config/database.ts`, already scaffolded in T002, correctly implements the multi-client decision — `DATABASE_CLIENT` defaults to `sqlite`, postgres branch reads `DATABASE_URL`/host-port-etc/`DATABASE_SSL`/`DATABASE_SCHEMA`/pool vars, `DATABASE_URL` correctly takes precedence via `pg`'s own connection-string merge — so left it untouched; found and fixed the real gap instead: the `pg` npm driver was never installed, so `DATABASE_CLIENT=postgres` would crash at runtime with "Cannot find module 'pg'" despite the config code being correct, fixed via `"pg": "^8.16.3"` in `backend/package.json` + `npm install`; also documented `DATABASE_CLIENT`/`DATABASE_FILENAME` in `backend/.env.example` for local `strapi develop` DX; RED confirmed via new `tests/structure/test_database_config.sh` (15/18 passing pre-fix, failing exactly on the pg-dependency and env-example assertions), GREEN (18/18) after; all pre-existing `tests/structure/*.sh` regressions and `npm run build` still pass; task-scoped reviewer subagent independently re-read `database.ts`, verified the `pg` connection-string precedence claim directly against `pg`'s installed source, independently reproduced RED by reverting the two changed files and re-running the test (15/18, same 3 failures) then restored GREEN (18/18), reran the full regression suite and `npm run build` from scratch, and confirmed scope discipline (only `backend/package.json`, `backend/package-lock.json`, `backend/.env.example`, `tests/structure/test_database_config.sh` touched) — verdict PASS, no blocking or non-blocking issues)*
- [X] T007 [P] Extend the Strapi `users-permissions` User content-type with `role` (enum: auteur, répondant, administrateur) in `backend/src/extensions/users-permissions/content-types/user/schema.json` per data-model.md Utilisateur *(implementer subagent added `backend/src/extensions/users-permissions/content-types/user/schema.json` with `role: enumeration, required, enum: [auteur, repondant, administrateur]` (ASCII-normalized from `répondant` per Strapi enum conventions); since Strapi 5's plugin content-type extension merge (`@strapi/core` `applyUserExtension`) shallow-spreads top-level schema keys, `attributes` is replaced wholesale rather than deep-merged per field, so the extension file also copies the 8 base `users-permissions` User attributes (username, email, provider, password, resetPasswordToken, confirmationToken, confirmed, blocked) verbatim to avoid deleting them — verified empirically by booting compiled Strapi against a disposable SQLite DB and inspecting the effective merged schema; RED confirmed via new `tests/structure/test_user_role.sh` (0/9 passing pre-implementation), GREEN (9/9) after; full `tests/structure/*.sh` regression suite (93/93 across all 7 scripts) and `npm run build` still pass; task-scoped reviewer subagent independently reproduced RED by moving the schema.json aside and re-running the test (0/9, same failures) then restored GREEN (9/9), independently verified the shallow-merge claim and the byte-for-byte correctness of the copied base attributes against `@strapi/core`/`@strapi/plugin-users-permissions` source, reran the full regression suite and `npm run build` from scratch, and confirmed scope discipline (only the schema.json and `tests/structure/test_user_role.sh` touched, `tasks.md` untouched) — verdict PASS, no Critical/blocking or Minor findings. **Flagged risk carried forward, not a T007 defect**: Strapi's built-in `users-permissions` User schema already uses the attribute name `role` for its native RBAC relation to `plugin::users-permissions.role`, populated by the auth strategy (`populate(['role'])`) and consumed as `user.role.id` in `findRolePermissions` on every authenticated request; overwriting it with the FR-016 business-role enum (both `tasks.md` and `data-model.md` specify the field name `role` verbatim, so renaming here would have been an undocumented scope deviation) means `user.role.id` becomes `undefined` and authenticated-permission resolution silently breaks. This must be reconciled — rename (e.g. `rolePlateforme`) or an explicit `data-model.md` amendment with a `plan.md` Complexity Tracking justification — before any future login/auth/permission-gated task (not T008 health-route or T009 logger) is implemented.)*
- [X] T008 [P] Implement `GET /health` route + controller in `backend/src/api/health/routes/health.ts` and `backend/src/api/health/controllers/health.ts` returning `{"status":"ok"}` (200) or `{"status":"degraded","reason":<cause>}` (503) per contracts/api.md *(implementer subagent added `backend/src/api/health/controllers/health.ts` (try/catch around `strapi.db.connection.raw('SELECT 1')`, 200 `{"status":"ok"}` on success, 503 `{"status":"degraded","reason":<error.message>}` on failure) and `backend/src/api/health/routes/health.ts` (public, `auth: false`); discovered via source-reading (`@strapi/core` loaders/server services) that Strapi 5's content-API router unconditionally applies an `/api` prefix to anything loaded from `src/api/*/routes`, with no per-route opt-out, so the contract's literal bare `/health` path required also registering the same handler on the raw top-level router via `strapi.server.routes([...])` in `backend/src/index.ts`'s `register({ strapi })` lifecycle — an in-scope necessity, not a deviation. RED confirmed via new `tests/structure/test_health_route.sh` (0/14 passing pre-implementation), GREEN (14/14) after; full `tests/structure/*.sh` regression suite (107/107 across 8 scripts) and `npm run build`/`npm run lint` (clean, 1 pre-existing out-of-scope T004 warning only) still pass. Live-verified end-to-end against a compiled build: `GET /health` → 200 `{"status":"ok"}` at the bare path (not just `/api/health`), no auth required; 503 path verified twice — once via a temporary forced-failure hook removed before commit, and independently by the reviewer stopping a real local PostgreSQL instance mid-run (`GET /health` → 503 `{"status":"degraded","reason":"connect ECONNREFUSED ..."}`, safe `.message`-only reason, no stack trace/credentials leaked). Task-scoped reviewer subagent independently re-derived the `/api`-prefix claim by reading `@strapi/core`'s `register-routes.js`/`content-api.js`/`server/index.js` source directly (confirmed accurate, `index.ts` change genuinely necessary and correctly scoped), independently reproduced RED (0/14) → GREEN (14/14), reran the full regression suite (107/107) and build/lint from scratch, and ran its own live Postgres-down 503 test — verdict PASS, no Critical findings. One **Important, non-blocking** finding carried forward: `test_health_route.sh` is purely static/grep-based and never boots the app or inspects `index.ts`, so it would not catch a future regression that silently broke the bare `/health` path (e.g. reverting the `strapi.server.routes()` registration) while leaving `/api/health` working — worth addressing whenever this repo adds a live-boot smoke-test tier, not a T008 defect since live behavior was independently verified correct today.)*
- [X] T009 [P] Configure structured JSON logging on stdout in `backend/config/logger.ts` (Principe V — Observabilité) *(implementer subagent added `backend/config/logger.ts` (winston via `@strapi/logger`'s re-export: `errors({stack:true})` + ISO-8601 `timestamp` + `json()` format, single `Console` transport, level `env('LOG_LEVEL','http')`), declared `@strapi/logger@5.54.0` as a direct dependency (pinned like the other `@strapi/*` packages, no new logging library, `npm ls` shows a single deduped copy with `winston@3.10.0`), and documented `LOG_LEVEL` in both `.env.example` and `backend/.env.example`; config shape verified against installed source (`@strapi/core` `Strapi.js` builds `createLogger({ level:'http', ...config.get('logger'), ...config.get('server.logger.config') })`, `@strapi/logger` merges via `Object.assign`); default level `http` rather than `info` is a deliberate ruling — it is Strapi's own default and keeps `strapi::logger` per-request access logs, overridable via `LOG_LEVEL`; timestamp is always rewritten as an ISO string because `@strapi/database`'s migration logger passes `timestamp: Date.now()`, which would otherwise mix number/string types in one field (caught in a second RED→GREEN cycle). RED confirmed via new behavioural (not grep-based) `tests/structure/test_json_logger.sh`, which transpiles the real `logger.ts`, builds a logger through `@strapi/logger.createLogger` in a child process and parses actual stdout (1/17 passing pre-implementation; the only pass was the vacuous no-ANSI check), GREEN (18/18) after; full `tests/structure/*.sh` regression suite (125/125 across 9 scripts), `npm run build`, `npm run lint` (1 pre-existing out-of-scope T004 warning only) and `npm run format:check` pass. Live boot (`strapi start`, disposable SQLite) emitted only JSON lines from the logger, `GET /health` → 200. Task-scoped reviewer subagent independently reproduced RED (1/18, rc=1, with `logger.ts` moved aside and both `.env.example` files reverted) → GREEN (18/18), re-verified the config-merge and migration-timestamp claims against `node_modules` source, reran the full regression suite and build/lint/format, and ran its own live boot (37/37 logger lines parse as JSON, including `http` request logs; stderr empty) — verdict PASS, no Critical findings. **Carried forward, not T009 defects**: (1) *Important* — at `http` level `strapi::logger` logs `ctx.url` including the query string, and `contracts/api.md` carries the signed invitation token (FR-017) in the query string, so tokens would reach stdout logs (Principe IV) — the invitation/access-token tasks must log `ctx.path` only or move the token out of the URL; (2) Strapi's startup banner (`@strapi/core` `startup-logger.js`) uses plain `console.log` and is not JSON — address in T010/T055 if strict JSON-only stdout is required; (3) `backend/config/database.ts` joins `DATABASE_FILENAME` onto `__dirname` so absolute paths get nested under `backend/` — relevant to T010 volume paths; (4) Minor: `test_json_logger.sh` leaves `${TMPDIR:-/tmp}/t009_stderr` behind (should use `mktemp` + `trap`), its no-ANSI check passes vacuously on empty output, and `npm run format:check` fails when the gitignored `backend/.strapi-updater.json` exists because `.prettierignore` (T004) doesn't exclude it.)*
- [X] T010 Create `docker-compose.yml` at repository root wiring `db` (PostgreSQL), `backend`, `frontend` services per plan.md Constraints (Principe III — IaC) *(first task run through the installed Superpowers plugin (`subagent-driven-development` v6.4.1) via the superpowers-bridge `before_implement` hook; ledger `.superpowers/sdd/tasks/progress.md`. Controller rulings recorded before dispatch: (1) Dockerfiles are T055's scope, so `backend`/`frontend` run the official `node:20` image (Node 20 LTS per plan.md) with the source bind-mounted and `npm ci && npm run develop|dev`, container `node_modules` isolated in named volumes — T055 later swaps `image:`+`command:` for `build:`; (2) the backend service sets `DATABASE_URL` empty so `DATABASE_HOST=db` wins over the placeholder URL in the root `.env.example`. Implementer subagent (commit `c59f382`) added `docker-compose.yml` — `db` (`postgres:16`, named volume, 5432 published for quickstart's native backend, `pg_isready` healthcheck), `backend` (`DATABASE_CLIENT=postgres`, depends on `db` `service_healthy`, healthcheck on bare `GET /health`, 1337), `frontend` (depends on `backend`, 3000, `NEXT_PUBLIC_API_BASE_URL=http://localhost:1337`); every credential is a `${VAR}` reference to variables already documented in `.env.example` (Principe IV). RED confirmed via new behavioural `tests/structure/test_docker_compose.sh` (asserts on the parsed `docker compose config --format json` model with python3, not on YAML text; failing with the file absent), GREEN 30/30; full `tests/structure/*.sh` suite 155/155 (re-run by the controller with Node on PATH). Live-verified: `docker compose up -d` → db and backend healthy, `GET /health` → 200 `{"status":"ok"}` through Postgres, backend logger lines JSON (T009), frontend 200 on :3000, host `backend/node_modules` untouched, `docker compose down -v` clean. Task-scoped reviewer subagent independently re-verified the `DATABASE_URL` neutralisation against `@strapi/utils` `env-helper.js` and `pg` `connection-parameters.js` source and every `${VAR}` against `.env.example` — verdict Spec ✅ / quality Approved, no Critical or Important findings. **Deferred minors**: `DATABASE_PORT: 5432` is the only non-interpolated DB var (container-internal port); `restart: unless-stopped` on `db` was not requested; and the container bind mount leaves root-owned, un-gitignored `backend/types/generated/` files on the host after `docker compose up` — needs a follow-up (gitignore + non-root container user or volume).)*

**Checkpoint**: Fondations prêtes — les user stories peuvent démarrer (en parallèle si staffé).

---

## Phase 3: User Story 1 - Créer et publier un questionnaire (Priority: P1) 🎯 MVP

**Goal**: Un auteur crée un questionnaire, y ajoute des questions typées, définit sa visibilité,
et le publie.

**Independent Test**: Créer un compte auteur, composer un questionnaire de plusieurs questions,
le publier, vérifier la transition de statut brouillon → publié et la présence d'un lien d'accès
(quickstart.md Scénario 1).

### Tests for User Story 1 ⚠️

> Écrire ces tests en premier, confirmer qu'ils échouent avant toute implémentation (Principe I).

- [ ] T011 [P] [US1] Contract test `POST /api/questionnaires` in `backend/tests/contract/test_questionnaires_create.ts`
- [ ] T012 [P] [US1] Contract test `PATCH /api/questionnaires/:id/questions` in `backend/tests/contract/test_questions_add.ts`
- [ ] T013 [P] [US1] Contract test `POST /api/questionnaires/:id/publish` (incl. rejet 422 si aucune question — edge case spec.md) in `backend/tests/contract/test_questionnaire_publish.ts`
- [ ] T014 [P] [US1] Contract test `POST /api/questionnaires/:id/close` in `backend/tests/contract/test_questionnaire_close.ts`
- [ ] T015 [P] [US1] Integration test quickstart.md Scénario 1 in `backend/tests/integration/test_create_publish.ts`

### Implementation for User Story 1

- [ ] T016 [P] [US1] Create `Questionnaire` content-type (`titre`: string requis, `description`: text optionnel, `statut`: enum brouillon/publié/fermé défaut brouillon, `visibilite`: enum publique/privée requis, `auteur`: relation many-to-one Utilisateur) in `backend/src/api/questionnaire` per data-model.md
- [ ] T017 [P] [US1] Create `Question` content-type (`texte`: string requis, `type`: enum likert/choix_multiple/texte_libre requis, `position`: integer requis unique par questionnaire, `obligatoire`: boolean défaut false, `image`: media optionnel, `questionnaire`: relation many-to-one) in `backend/src/api/question` per data-model.md
- [ ] T018 [US1] Implement `POST /api/questionnaires` controller + route in `backend/src/api/questionnaire/controllers/questionnaire.ts` (depends on T016)
- [ ] T019 [US1] Implement `PATCH /api/questionnaires/:id/questions` controller + route in `backend/src/api/question/controllers/question.ts` (depends on T017, T018)
- [ ] T020 [US1] Implement `POST /api/questionnaires/:id/publish` with "au moins une question" validation (422 sinon) in `backend/src/api/questionnaire/controllers/questionnaire.ts` (depends on T018, T019)
- [ ] T021 [US1] Implement `POST /api/questionnaires/:id/close` transition (statut → fermé) in `backend/src/api/questionnaire/controllers/questionnaire.ts` (depends on T020)
- [ ] T022 [P] [US1] [UI] Frontend: questionnaire creation page in `frontend/app/questionnaires/create/page.tsx`
- [ ] T023 [P] [US1] [UI] Frontend: question editor component (ajout/réordre/suppression, types Likert/choix multiple/texte libre) in `frontend/components/QuestionEditor.tsx`
- [ ] T024 [US1] Frontend: API client + publish/close actions in `frontend/services/questionnaireService.ts` (depends on T022, T023)

**Checkpoint**: User Story 1 fonctionnelle et testable indépendamment (MVP).

---

## Phase 4: User Story 2 - Répondre à un questionnaire (Priority: P2)

**Goal**: Un répondant accède à un questionnaire publié (public ou privé sur invitation), le
remplit à son rythme, et reçoit confirmation à la soumission.

**Independent Test**: Ouvrir un questionnaire publié existant via son lien, répondre aux questions
obligatoires, soumettre, vérifier la confirmation et le statut "complète" (quickstart.md
Scénario 2) ; pour un questionnaire privé, vérifier l'accès restreint et le pré-remplissage via
invitation (quickstart.md Scénario 3).

### Tests for User Story 2 ⚠️

- [ ] T025 [P] [US2] Contract test `GET /api/questionnaires/:id` (accès public sans auth, refus si privé sans jeton — FR-007/FR-008) in `backend/tests/contract/test_questionnaire_get.ts`
- [ ] T026 [P] [US2] Contract test `POST /api/questionnaires/:id/reponses` (upsert, statut en_cours) in `backend/tests/contract/test_reponses_create.ts`
- [ ] T027 [P] [US2] Contract test `POST /api/questionnaires/:id/reponses/:reponseId/submit` (422 si question obligatoire manquante — FR-010) in `backend/tests/contract/test_reponse_submit.ts`
- [ ] T028 [P] [US2] Contract test `POST /api/questionnaires/:id/invitations` (création + envoi email) in `backend/tests/contract/test_invitations_create.ts`
- [ ] T029 [P] [US2] Integration test quickstart.md Scénario 2 (public) in `backend/tests/integration/test_repondre_public.ts`
- [ ] T030 [P] [US2] Integration test quickstart.md Scénario 3 (privé, pré-remplissage nom/prénom/email) in `backend/tests/integration/test_repondre_prive.ts`

### Implementation for User Story 2

- [ ] T031 [P] [US2] Create `Reponse` content-type (`nom`/`prenom`/`email`: requis si questionnaire privé sinon optionnels — FR-019, `statut`: enum en_cours/complète défaut en_cours, `dateSoumission`, `questionnaire`: relation) in `backend/src/api/response` per data-model.md
- [ ] T032 [P] [US2] Create `ReponseQuestion` content-type (jonction `reponse`/`question`/`valeur` JSON) in `backend/src/api/response-question` per data-model.md
- [ ] T033 [P] [US2] Create `Invitation` content-type (`nom`, `prenom`, `email` requis, `jeton` unique signé, `statut` dérivé) in `backend/src/api/invitation` per data-model.md
- [ ] T034 [US2] Implement `GET /api/questionnaires/:id` with public/private + signed-token access rule (depends on T016, T033)
- [ ] T035 [US2] Implement `POST /api/questionnaires/:id/invitations` (création + envoi email SMTP via plugin Email Strapi — research.md) (depends on T033)
- [ ] T036 [US2] Implement `POST /api/questionnaires/:id/reponses` upsert, pré-remplissage nom/prénom/email depuis l'invitation si présent (depends on T031, T032, T034)
- [ ] T037 [US2] Implement `POST /api/questionnaires/:id/reponses/:reponseId/submit` with obligatoire-fields validation (FR-010) and unicité (questionnaire, email) pour questionnaire privé — edge case double soumission (depends on T036)
- [ ] T038 [P] [US2] [UI] Frontend: public/private questionnaire fill page (pré-remplissage si invitation) in `frontend/app/q/[token]/page.tsx`
- [ ] T039 [US2] [UI] Frontend: submission + confirmation UI, message d'erreur sur question obligatoire manquante in `frontend/app/q/[token]/page.tsx` (depends on T038)

**Checkpoint**: User Stories 1 et 2 fonctionnelles indépendamment.

---

## Phase 5: User Story 3 - Consulter et exporter les résultats (Priority: P3)

**Goal**: Un auteur/administrateur consulte les résultats agrégés d'un questionnaire, les exporte
en CSV, identifie les non-répondants d'un questionnaire privé et déclenche une relance.

**Independent Test**: Charger un questionnaire disposant déjà de réponses, vérifier
l'affichage de statistiques par question, déclencher un export CSV, vérifier la liste des
non-répondants et la relance pour un questionnaire privé (quickstart.md Scénario 4).

### Tests for User Story 3 ⚠️

- [ ] T040 [P] [US3] Contract test `GET /api/questionnaires/:id/resultats` in `backend/tests/contract/test_resultats.ts`
- [ ] T041 [P] [US3] Contract test `GET /api/questionnaires/:id/export.csv` in `backend/tests/contract/test_export_csv.ts`
- [ ] T042 [P] [US3] Contract test `GET /api/questionnaires/:id/non-repondants` (questionnaire privé uniquement — FR-018) in `backend/tests/contract/test_non_repondants.ts`
- [ ] T043 [P] [US3] Contract test `POST /api/questionnaires/:id/relance` in `backend/tests/contract/test_relance.ts`
- [ ] T044 [P] [US3] Integration test quickstart.md Scénario 4 in `backend/tests/integration/test_resultats_export.ts`

### Implementation for User Story 3

- [ ] T045 [US3] Implement `GET /api/questionnaires/:id/resultats` aggregation service (distribution Likert/choix multiple, liste texte libre) in `backend/src/api/questionnaire/services/resultats.ts` (depends on T031, T032)
- [ ] T046 [US3] Implement `GET /api/questionnaires/:id/export.csv` (une ligne par réponse complète) in `backend/src/api/questionnaire/services/export.ts` (depends on T045)
- [ ] T047 [US3] Implement `GET /api/questionnaires/:id/non-repondants` (invitations sans réponse liée, questionnaire privé uniquement — FR-018) (depends on T033, T031)
- [ ] T048 [US3] Implement `POST /api/questionnaires/:id/relance` (renvoi de l'email d'invitation) (depends on T035, T047)
- [ ] T049 [P] [US3] [UI] Frontend: results page with charts (statistiques par question) in `frontend/app/questionnaires/[id]/results/page.tsx`
- [ ] T050 [US3] [UI] Frontend: CSV export action + non-répondants/relance UI in `frontend/app/questionnaires/[id]/results/page.tsx` (depends on T049)

**Checkpoint**: Les trois user stories sont fonctionnelles indépendamment.

---

## Phase 6: Déploiement V1 (managé — Vercel + Strapi Cloud)

**Purpose**: Mettre le projet en ligne rapidement sur des plateformes managées, per constitution
v1.1.0 et plan.md Target Platform (amendement 2026-09-19 (c)). C'est la cible de référence
courante — la Phase 7 (Docker/CI/Kubernetes) est une migration ultérieure, pas un prérequis.

- [ ] T051 [P] Configure Vercel project for `frontend/`: link the Git repository, verify the
  auto-detected Next.js build (`next build`), connect the production deploy to the main branch
- [ ] T052 [P] Configure Strapi Cloud project for `backend/`: link the Git repository, enable
  the managed PostgreSQL add-on, verify the build/deploy pipeline triggers on push
- [ ] T053 Configure production environment variables in the Vercel and Strapi Cloud dashboards
  (DB connection, JWT secret, SMTP credentials — FR-017, API base URL) per `.env.example` (T005)
  — no secret committed to the repo (Principe IV)
- [ ] T054 [P] Configure a custom domain (or platform subdomain) for the Vercel deployment and
  verify the frontend reaches the Strapi Cloud API in production (`GET /health` from T008
  reachable publicly)

**Checkpoint**: V1 en ligne sur Vercel + Strapi Cloud — utilisable pour un vrai questionnaire de
fin de séance.

---

## Phase 7: Migration auto-hébergée (Docker / CI / Kubernetes — S5-S11, ultérieure)

**Purpose**: Objectif pédagogique du module (constitution, "Contraintes Techniques et
Pédagogiques") — introduit progressivement selon le calendrier de séances, comme migration
depuis la V1 managée (Phase 6), pas comme condition pour livrer V1.

- [ ] T055 [P] Write `backend/Dockerfile` and `frontend/Dockerfile` (Principe III — S5-S7)
- [ ] T056 [P] Write initial CI pipeline (`.gitlab-ci.yml` or `Jenkinsfile`) running lint + tests on push (Principe III — S4, S8-S10)
- [ ] T057 [P] Write Kubernetes manifests (Deployment + Service for backend/frontend, readiness/liveness probe on `GET /health`) in `k8s/` (Principe III/V — S11)

**Checkpoint**: Déploiement auto-hébergé disponible en parallèle de V1, pour la démonstration
pédagogique Docker/CI/Kubernetes du module.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T058 Run quickstart.md end-to-end validation against the live V1 deployment (Vercel +
  Strapi Cloud) — update quickstart.md prerequisites/URLs if they still assume only a local
  docker-compose stack
- [ ] T059 Security hardening pass: confirm no secret committed, `.env.example` matches
  `.gitignore` coverage, and Vercel/Strapi Cloud dashboard environment variables reviewed
  (Principe IV)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: aucune dépendance.
- **Foundational (Phase 2)**: dépend de Setup — bloque toutes les user stories.
- **User Stories (Phase 3-5)**: dépendent toutes de Foundational. US1 est indépendante ; US2
  dépend de US1 pour disposer d'un questionnaire publié à tester mais son code (T025-T039) est
  indépendant des fichiers de US1 ; US3 dépend de données produites par US1+US2 pour être
  démontrée mais son code (T040-T050) est indépendant.
- **Déploiement V1 (Phase 6)**: dépend de l'achèvement d'au moins US1 (idéalement les trois user
  stories) pour avoir quelque chose à déployer. Indépendante de la Phase 7.
- **Migration auto-hébergée (Phase 7)**: indépendante de la Phase 6 — peut démarrer dès que
  Foundational est prêt, en parallèle de V1, selon le calendrier de séances S5-S11. Ne bloque
  pas et n'est pas bloquée par la Phase 6.
- **Polish (Phase 8)**: dépend de l'achèvement de la Phase 6 (T058 valide le déploiement V1 en
  ligne) ; ne dépend pas de la Phase 7.

### Parallel Opportunities

- T003, T004 (Setup) en parallèle.
- T007, T008, T009 (Foundational) en parallèle.
- Tests T011-T015 (US1) en parallèle entre eux ; T016, T017 (modèles US1) en parallèle.
- Tests T025-T030 (US2) en parallèle ; T031, T032, T033 (modèles US2) en parallèle.
- Tests T040-T044 (US3) en parallèle.
- T051, T052, T054 (Déploiement V1) en parallèle ; T053 dépend de T051+T052.
- T055, T056, T057 (Migration auto-hébergée) en parallèle entre elles, et en parallèle de la
  Phase 6.

---

## Implementation Strategy

### MVP First (User Story 1 uniquement)

1. Phase 1 (Setup) → Phase 2 (Foundational) → Phase 3 (US1).
2. Valider indépendamment (quickstart.md Scénario 1), démontrer.

### Incremental Delivery

1. Setup + Foundational → fondation prête.
2. US1 → validation indépendante → démo (MVP).
3. US2 → validation indépendante → démo.
4. US3 → validation indépendante → démo.
5. Déploiement V1 (Phase 6) → mise en ligne réelle sur Vercel + Strapi Cloud, utilisable pour
   les questionnaires de fin de séance dès que possible.
6. Migration auto-hébergée (Phase 7), en parallèle et selon le calendrier de séances S5-S11 de
   la constitution — n'attend pas la fin de la Phase 6.
7. Polish (Phase 8), après validation du déploiement V1 en ligne.
