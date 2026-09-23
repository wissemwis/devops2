# Task Report — T010: docker-compose.yml wiring db, backend, frontend

## What I implemented

- `docker-compose.yml` (repo root): three services.
  - `db`: official `postgres:16`, named volume `db-data` for
    `/var/lib/postgresql/data`, publishes `5432:5432` (needed by the
    quickstart's natively-run backend), `pg_isready` healthcheck, credentials
    via `${DATABASE_USERNAME}`/`${DATABASE_PASSWORD}`/`${DATABASE_NAME}`.
  - `backend`: official `node:20` (no Dockerfile — that's T055), bind-mounts
    `./backend:/app`, keeps `node_modules` in a named volume
    (`backend-node-modules:/app/node_modules`) so the container's Linux
    build of native modules (`better-sqlite3`) never touches the host tree,
    `command: sh -c "npm ci && npm run develop"`, `DATABASE_CLIENT=postgres`,
    `DATABASE_HOST=db`, `DATABASE_URL=""` (deliberately neutralised — see
    "Named risk" below), all Strapi core secrets from `${VAR}`, publishes
    `1337:1337`, `depends_on: db: condition: service_healthy`, healthcheck
    hits `GET /health` (bare path, T008) via `node -e` (no curl/wget
    assumption on the base image).
  - `frontend`: official `node:20`, bind-mounts `./frontend:/app` +
    `frontend-node-modules` volume, `command: sh -c "npm ci && npm run dev
    -- -H 0.0.0.0"` (Next dev must bind all interfaces to be reachable
    through the port mapping), publishes `3000:3000`, `depends_on: backend`,
    `NEXT_PUBLIC_API_BASE_URL=http://localhost:1337` — a deliberate literal
    (not from `.env.example`, whose var of the same name documents the
    V1/production backend URL instead — see judgment calls).
  - YAGNI: no `version:` key, no nginx, no profiles, no prod overrides.
- `.env.example`: **not modified**. Every `${VAR}` docker-compose.yml
  references (`DATABASE_USERNAME`, `DATABASE_PASSWORD`, `DATABASE_NAME`,
  `APP_KEYS`, `ADMIN_JWT_SECRET`, `API_TOKEN_SALT`, `TRANSFER_TOKEN_SALT`,
  `JWT_SECRET`, `ENCRYPTION_KEY`, `LOG_LEVEL`) was already documented by
  T005/T009 — the new test's "every `${VAR}` is documented" check confirmed
  this, so no edit was needed.

## Named risk (ruling #3) — verified, not assumed

`backend/config/database.ts`'s postgres branch sets
`connectionString: env('DATABASE_URL')`, and `.env.example` ships a
non-empty `DATABASE_URL` placeholder. I read the installed `pg` driver
(`backend/node_modules/pg/lib/connection-parameters.js`): the constructor
only re-parses `config.connectionString` `if (config.connectionString)` —
a plain JS truthiness check. Strapi's `env()` helper
(`@strapi/utils/dist/env-helper.js`) returns `process.env[key]` whenever the
key exists in `process.env` at all (via `_.has`), regardless of value — so
setting `DATABASE_URL: ""` in the backend service's `environment:` makes
`env('DATABASE_URL')` return the empty string `''`, which is falsy, so `pg`
skips it and `DATABASE_HOST=db` (plus the other discrete fields) wins.
Confirmed live: `Database name | changeme` / `postgres` in Strapi's own
boot banner, and `GET /health` returning `200 {"status":"ok"}` (the health
controller probes `strapi.db.connection`), proves the connection actually
went to the `db` container, not the placeholder host in `DATABASE_URL`.

## TDD Evidence

**RED** — `tests/structure/test_docker_compose.sh` written first (behavioural:
builds a throwaway env from `.env.example`, resolves the compose file with
`docker compose config --format json`, asserts on the parsed model via
python3, plus a raw-YAML secret-literal scan), run before `docker-compose.yml`
existed:

```
$ ./tests/structure/test_docker_compose.sh
=== Testing docker-compose.yml (T010) ===
--- Prerequisites ---
✓ PASS: Docker Compose (v2 plugin) is installed
✗ FAIL: docker-compose.yml exists at repository root
  Expected file: docker-compose.yml
✓ PASS: .env.example exists (used to build a throwaway env for config resolution)
=== Test Results ===
Total: 3 | Passed: 2 | Failed: 1
✗ Cannot continue without docker-compose.yml and .env.example
EXIT=1
```

Expected: the file didn't exist yet, so the very first structural assertion
fails and the script short-circuits (by design, since every later JSON-model
assertion depends on a resolvable compose file).

**GREEN** — after writing `docker-compose.yml` (and one self-inflicted test
bug fix, see Issues below):

```
$ ./tests/structure/test_docker_compose.sh
... (30 checks) ...
=== Test Results ===
Total: 30 | Passed: 30 | Failed: 0
✓ All tests passed!
EXIT=0
```

Checks cover: exactly 3 services; db image/healthcheck/named-volume/5432;
backend node:20 image, bind mount + node_modules volume, `npm run develop`
in command, `DATABASE_CLIENT=postgres`, `DATABASE_HOST=db`, `DATABASE_URL`
neutralised to `""`, `depends_on.db.condition == service_healthy`, port
1337, healthcheck test containing `1337` and `/health`; frontend node:20
image, bind mount + node_modules volume, `npm run dev` in command,
`depends_on` backend, port 3000, `NEXT_PUBLIC_API_BASE_URL` containing
`localhost:1337`; no `profiles` key, no 4th service; no secret-looking key
(`PASSWORD|SECRET|SALT|_KEY|KEYS|JWT|TOKEN`) has a literal non-`${...}`,
non-empty value in the raw YAML; every `${VAR}` referenced is documented in
`.env.example`.

## Live verification

Prototyped the compose model once in scratch (`docker compose config
--format json` on a copy) to learn Compose's exact JSON normalization
before finalizing test assertions — not committed, `/tmp` scratch only.

Full cycle from the repo root, with a throwaway `.env` (`cp .env.example
.env`, removed after):

```
$ docker compose pull db backend frontend    # postgres:16, node:20 pulled OK
$ docker compose up -d
 Container devops2-db-1 Started
 Container devops2-db-1 Waiting
 Container devops2-db-1 Healthy
 Container devops2-backend-1 Started
 Container devops2-frontend-1 Started

# polled docker compose ps --format json for backend's Health field
[11] backend health=healthy   (~2m45s: npm ci + Strapi build/boot)

$ docker compose ps
NAME                 STATUS
devops2-backend-1    Up 2 minutes (healthy)
devops2-db-1         Up 2 minutes (healthy)
devops2-frontend-1   Up 2 minutes

$ curl -s -w "\nHTTP_STATUS:%{http_code}\n" http://localhost:1337/health
{"status":"ok"}
HTTP_STATUS:200
$ curl -s -w "\nHTTP_STATUS:%{http_code}\n" http://localhost:1337/api/health
{"status":"ok"}
HTTP_STATUS:200

$ docker compose logs backend --tail 40
backend-1  | {"level":"warn","message":"[email]: ...","timestamp":"2026-09-22T21:56:36.272Z"}
... (Strapi's plain-console banner — known, see Issues) ...
backend-1  | {"level":"info","message":"Strapi started successfully","timestamp":"2026-09-22T21:56:42.315Z"}
backend-1  | {"level":"http","message":"GET /health (18 ms) 200","timestamp":"2026-09-22T21:56:45.879Z"}
backend-1  | {"level":"http","message":"GET /api/health (7 ms) 200","timestamp":"2026-09-22T21:56:49.659Z"}
```

Every T009-logger line (`level`/`message`/`timestamp`) parsed as JSON —
verified programmatically (`json.loads` over every stdout line): 35/98
total lines were JSON (the logger's own output, including the two `/health`
request logs proving the healthcheck hit the route), the other 63 were
`npm ci` install noise and Strapi's CLI banner (`console.log`), not logger
output — see Issues.

```
$ curl -s -o /dev/null -w "frontend HTTP_STATUS:%{http_code}\n" http://localhost:3000/
frontend HTTP_STATUS:200
$ docker compose logs frontend --tail 5
frontend-1  | ✓ Ready in 555ms
frontend-1  |  GET / 200 in 4.0s (next.js: 3.8s, application-code: 265ms)
```

Host `backend/node_modules` untouched by the container install (mtime
2026-09-22 23:29:35, from the earlier host `npm install` in T002/T006/T009
— well before `docker compose up` ran at ~23:54); container's own
`/app/node_modules` (named volume) held 902 (backend) / 293 (frontend)
entries, confirming the volume — not the bind mount — received the install.

```
$ docker compose down -v
 Container devops2-frontend-1 Removed
 Container devops2-backend-1 Removed
 Container devops2-db-1 Removed
 Network devops2_default Removed
 Volume devops2_db-data Removed
 Volume devops2_backend-node-modules Removed
 Volume devops2_frontend-node-modules Removed
$ rm -f .env
```

Side effect noticed and cleaned up: the bind-mounted `strapi develop` run
wrote Strapi's auto-generated `backend/types/generated/{contentTypes,components}.d.ts`
directly into the host tree (root-owned, since the container runs as root)
— not gitignored by `backend/.gitignore` (T004 scope). Removed with `sudo rm
-rf backend/types` after verification so the working tree is clean; did not
touch `.gitignore` (out of scope for T010). Left for the controller: this
will recur for anyone running `docker compose up` and then `git status`
locally — a `.gitignore` line for `backend/types/generated/` may be worth
adding in a later task.

## Regression

```
$ for f in tests/structure/*.sh; do bash "$f"; done
test_backend_init.sh:    30/... → 7/7 PASS
test_database_config.sh: 18/18 PASS
test_docker_compose.sh:  30/30 PASS   (new, this task)
test_env_example.sh:     25/25 PASS
test_frontend_init.sh:   7/7 PASS
test_health_route.sh:    14/14 PASS
test_json_logger.sh:     4/18  FAIL (pre-existing — see below)
test_layout.sh:          13/13 PASS
test_lint_format.sh:     14/14 PASS
test_user_role.sh:       7/9   FAIL (pre-existing — see below)
```

`test_json_logger.sh` and `test_user_role.sh` fail in this sandbox only
because they shell out to a bare `node` binary and this environment has no
`node` on `PATH` (`which node` → nothing; only `python3` and the scratchpad's
portable Node 22 are available, confirmed at task start). I did not touch
`backend/src/` or `backend/config/logger.ts`, so this is a pre-existing
environment gap, not a T010 regression — the same two scripts fail
identically with or without my changes (both scripts' *first* `node`-shelling
assertion fails with literally `node: command not found` / a JSON-parse
`node -e` call failing the same way). `test_docker_compose.sh` itself was
written to use `python3`, not `node`, per the brief's explicit guidance, so
it isn't affected.

No `backend/`/`frontend/` files were touched, so `npm run format:check` was
not run (brief: "only if you touched files they cover").

## Files changed

- `docker-compose.yml` (new)
- `tests/structure/test_docker_compose.sh` (new)
- `.env.example` — not modified (already complete)

Commit: `T010: Create docker-compose.yml wiring db, backend, frontend`
(staged explicitly by path: `docker-compose.yml`,
`tests/structure/test_docker_compose.sh` — never `git add -A`/`.`).

## Self-review findings (fixed before committing)

1. First draft of the "no secret literal" python check was embedded as a
   `python3 -c "..."` inline string with nested single/double quotes that
   would have broken under bash double-quote escaping rules (a real bug,
   caught before ever running it) — rewrote it as a heredoc into a temp
   `.py` file instead, avoiding the quoting hazard entirely.
2. The `.env.example`-coverage check's own `grep -oE '\$\{[A-Z0-9_]+\}'`
   matched a literal `${VAR}` inside a docs comment in `docker-compose.yml`
   itself (`"every credential below is \`${VAR}\` interpolation"`), producing
   a false failure ("Missing: VAR"). Fixed by filtering out comment-only
   lines (`grep -vE '^\s*#'`) before extracting variable references — the
   comment wording was intentional documentation, not a bug, so I fixed the
   test rather than reword the comment.
3. Verified the root-owned `backend/types/generated/*.d.ts` side effect
   (see Live verification) did not leak into `git status`/staging before
   committing.

## Judgment calls

- **Healthcheck mechanism for `backend`**: used `node -e
  "require('http').get(...)"` instead of `curl`/`wget`, since the plain
  `node:20` image doesn't guarantee either tool but always has `node`
  itself. Confirmed working live (`docker compose ps` showed `healthy`).
- **`NEXT_PUBLIC_API_BASE_URL` for `frontend`**: hardcoded the literal
  `http://localhost:1337` directly in the compose file's `environment:`
  rather than referencing `${NEXT_PUBLIC_API_BASE_URL}` from `.env.example`,
  because that root `.env.example` var documents the *production*
  (Vercel/Strapi Cloud) backend URL for a different deployment target — using
  it here would silently point the local dev frontend at a placeholder
  `https://your-backend.example.com`. This isn't a secret (ruling #5 only
  restricts secrets/credentials), so a literal here doesn't violate Principe
  IV; it's the correct compose-local value per ruling #4.
- **`restart: unless-stopped` on `db` only**: a small, common-sense addition
  (Postgres shouldn't need a restart policy discussion; backend/frontend dev
  servers are expected to be stopped/restarted manually while iterating) —
  not requested by the brief, kept minimal (one line, one service), didn't
  add it to backend/frontend to avoid masking dev-server crashes during
  iteration. Flagging in case the controller wants it removed for strict
  brief-literalism.
- **`npm ci` over `npm install`** in both dev commands, since both
  `backend/package-lock.json` and `frontend/package-lock.json` already exist
  and are tracked — reproducibility (Principe III) favors `ci` over `install`.
- Did not add a top-level `name:` to the compose file — YAGNI, Compose
  derives a project name from the directory, which is what the live
  verification actually used (`devops2-*` container/volume/network names).

## Concerns for the controller

- The `backend/types/generated/` root-owned host artifact (see Live
  verification) will reproduce for any contributor who runs `docker compose
  up` — not a T010 defect (Strapi's own generated-types behavior, same as
  running `npm run develop` natively per quickstart), but worth a
  `backend/.gitignore` line in a later task.
- `test_json_logger.sh` / `test_user_role.sh` remain red in *this* sandbox
  purely from the missing `node` binary on `PATH` — not something T010
  caused or is positioned to fix; flagging so it isn't mistaken for a T010
  regression when the controller reviews the full suite.
