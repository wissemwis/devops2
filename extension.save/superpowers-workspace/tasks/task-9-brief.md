# Task Brief — T009

Source: specs/001-questionnaire-platform/tasks.md, Phase 2: Foundational

- [ ] T009 [P] Configure structured JSON logging on stdout in `backend/config/logger.ts` (Principe V — Observabilité)

Working branch: `claude/task-t009-json-logger` (already checked out, based on `main` @ 12e0c76).

## Required reading before implementing

Read these before proposing an approach — this brief does not replace them:

- `/project/devops2/.specify/memory/constitution.md` — binding. Principe I (Test-First,
  NON-NEGOTIABLE), Principe II (Simplicité/YAGNI), Principe V (Observabilité: "Chaque service
  déployé ... expose des logs structurés").
- `/project/devops2/specs/001-questionnaire-platform/plan.md` — Constitution Check row for
  Principe V: "les logs applicatifs sont structurés (JSON) sur stdout pour être collectés par
  la CI/les conteneurs". Treat dated amendments at the top as current.
- `/project/devops2/specs/001-questionnaire-platform/research.md` — § "Observabilité
  (Principe V)": "logs applicatifs en JSON structuré sur stdout".
- `/project/devops2/specs/001-questionnaire-platform/spec.md` — context only.
- `/project/devops2/specs/001-questionnaire-platform/tasks.md` — T009 in context (T008 health
  route just landed; T010 docker-compose and T055-T057 containers/K8s will consume stdout logs).

## Scope

Create `backend/config/logger.ts` so that the Strapi 5 backend emits application logs as
structured JSON (one JSON object per line) on stdout. Strapi 5 uses `@strapi/logger`
(winston-based); `config/logger.ts` is the supported override point. Verify the exact
config shape (e.g. `transports`, `format`, `level`) against the installed
`@strapi/logger`/`@strapi/core` source rather than guessing — `backend/node_modules` is not
installed in this checkout, so run `npm install` in `backend/` first (do not commit
anything under node_modules).

Keep it minimal (YAGNI): JSON format, console/stdout transport, sensible level (e.g. `info`,
optionally overridable by an env var — if you add one, document it in both
`/project/devops2/.env.example` and `backend/.env.example`). Keep timestamps and include
errors' stack/message in a JSON-safe way. Do not add new logging libraries if winston
(already a Strapi dependency) suffices; if you must reference winston directly, check
whether it needs to be a declared dependency in `backend/package.json`.

Do NOT modify: `backend/config/middlewares.ts` (unless strictly necessary — justify it),
T007/T008 files, `tasks.md` (the controller marks the task after review).

## TDD (Superpowers `test-driven-development`, mandatory)

1. RED first: add `tests/structure/test_json_logger.sh`, matching the style of existing
   `tests/structure/*.sh` scripts (pass/fail counters, `✓ PASS`/`✗ FAIL`, non-zero exit on
   failure). Run it and record the failing output BEFORE writing `logger.ts`.
   Strongly preferred: in addition to static checks, include a behavioural check that
   actually exercises the logger config — e.g. load the compiled config
   (`npm run build` produces `backend/dist/config/logger.js`) with node, create a winston
   logger from it, log a message, and assert that stdout is a single line that parses as JSON
   with `level`, `message`, `timestamp` fields. (The T008 review flagged that purely
   grep-based tests are weak; don't repeat that.) Boot-level verification (starting Strapi and
   confirming its own startup logs are JSON lines) is a good manual live check to report.
2. GREEN: minimal `backend/config/logger.ts` to pass.
3. REFACTOR, then run the full regression suite: every `tests/structure/*.sh`, plus
   `npm run build`, `npm run lint`, `npm run format:check` in `backend/`.

## Deliverables / report

Commit your work on the current branch (message `T009: Configure structured JSON logging on
stdout`, ending with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`). Do not
push. Report back: status (DONE / DONE_WITH_CONCERNS / BLOCKED), files changed, RED output
(count), GREEN output (count), regression results, live-boot evidence if obtained, commit SHA,
and any judgment calls you made.
