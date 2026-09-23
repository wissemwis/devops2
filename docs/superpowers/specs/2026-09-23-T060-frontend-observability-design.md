# T060 (Jira D2-70) — Frontend health endpoint and structured JSON logs

**Date:** 2026-09-23 · **Status:** approved (written spec reviewed by the owner on 2026-09-23)
**Task:** `specs/001-questionnaire-platform/tasks.md` T060 (Phase 9 Convergence, CRITICAL) —
"Expose a health endpoint (`GET /api/health` → `{"status":"ok"}`) and structured JSON logs on
stdout for the Next.js frontend in `frontend/app/api/health/route.ts` and the frontend logging
setup, so both deployed services meet Principe V (T057 probes need it) per Constitution V
(contradicts)".
**Binding context:** `.specify/memory/constitution.md` v1.2.0 Principe V (Observabilité: logs
structurés et endpoint de santé) and I (Test-First); `plan.md` Constitution Check row V and
Technical Context "Testing" (Vitest + Testing Library, `.test.ts`/`.test.tsx`, for the
frontend); `tasks.md` T057 (Kubernetes probes on `GET /health` for backend and frontend);
backend precedents T008 (`GET /health`) and T009 (winston JSON logs, `config/logger.ts`).

## 1. Problem

Principe V requires every deployed service to expose structured logs and a health endpoint.
The backend does (T008, T009); the Next.js frontend has neither — it is still the
`create-next-app` scaffold. The frontend also has no test harness at all, so nothing can be
built test-first on it yet.

`tasks.md` is inconsistent on the path: T060 says `GET /api/health`, T057 says the Kubernetes
probes hit `GET /health` on both services.

## 2. Goals and success criteria

- `GET /health` on the frontend returns `200` `{"status":"ok"}` whenever the Next.js server is
  up, in development and in a production build (never a build-time static snapshot).
- Frontend server-side log lines written by the application are single-line JSON on stdout
  with the backend's core keys (`level`, `message`, `timestamp`).
- Every server-side request error Next.js reports is logged as one JSON `error` line, without
  request headers (cookies, JWT).
- A frontend test harness exists and the three units above are covered test-first.
- The compose `frontend` service reports its health like `backend` does.

**Out of scope:** checking the backend from the frontend health endpoint (decision D1); an
access log per request (D3); Next.js's own plain-text output — startup banner and dev-server
request lines — which Next.js offers no way to format (recorded as a known gap, like T072 for
Strapi's banner); Testing Library (added by the first UI task, T022); Kubernetes probes (T057);
isolating the owner's local compose stack from development work (the owner handles it).

## 3. Decisions taken in brainstorming

| # | Question | Decision |
|---|---|---|
| D1 | What the frontend health checks | Liveness only: `200 {"status":"ok"}` when the Next.js server answers; no backend check (a backend outage must not restart or de-route the frontend; the backend has its own probe). |
| D2 | Path | `/health` only (`frontend/app/health/route.ts`), same path as the backend and as T057's probes; T060's text in `tasks.md` is corrected. |
| D3 | How JSON logs are produced | A dependency-free logger `frontend/lib/logger.ts`, wired into Next.js's `onRequestError` hook in `frontend/instrumentation.ts`. Not pino (extra dependency, bundling quirks); no per-request access log (status unavailable in `proxy.ts`, Vercel already logs requests). |

## 4. Design

### 4.1 Health — `frontend/app/health/route.ts`

```ts
export const dynamic = 'force-dynamic';

export function GET(): Response;
```

- Returns `Response.json({ status: 'ok' }, { status: 200 })`.
- `dynamic = 'force-dynamic'` guarantees the handler runs per request: a prerendered snapshot
  would stay `200` even if the server could not serve requests, defeating the probe. The build
  output must list `/health` as dynamic (`ƒ`).
- No log line per call (probes hit it every few seconds); no dependency on the backend or on
  any environment variable.

### 4.2 Logger — `frontend/lib/logger.ts`

```ts
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';
export type LogFields = Record<string, unknown>;

export const logger: Record<LogLevel, (message: string, fields?: LogFields) => void>;
```

- Each call writes exactly one line to `process.stdout`: `JSON.stringify({ ...fields, level,
  message, timestamp })` + `\n`, where `timestamp` is `new Date().toISOString()`. Core keys are
  written last, so a field named `level`, `message` or `timestamp` never overrides them.
- A call never throws. Field serialisation and `JSON.stringify(entry)` both run inside the same
  try/catch; if either fails (a circular field, a `BigInt` field), the line written instead is
  `JSON.stringify({ level, message, timestamp, logError: <the stringify error's message> })` —
  still one valid JSON line, still carrying the original level, message and timestamp.
- A field whose value is an `Error` is serialised as `{ name, message, stack }` (plain
  `JSON.stringify` would produce `{}`). When the `Error` has a `cause`, it is included as
  `cause`, serialised the same way (recursively, if the cause is itself an `Error`), tracking
  visited `Error`s so a self-referencing or cyclic `cause` chain (`e.cause = e`, or
  `a.cause = b; b.cause = a`) terminates instead of overflowing the call stack: an `Error`
  already visited in the current chain serialises to the string `'[Circular]'` instead of
  recursing again. When the `Error` carries a string `digest` property (Next.js stamps
  `err.digest` on render errors), it
  is copied to `digest`.
- Severity order follows winston's npm levels as the backend does: `error` (0) < `warn` (1) <
  `info` (2) < `debug` (3). A call is written when its level is at or below the threshold read
  from `LOG_LEVEL` at call time; an unset or unknown `LOG_LEVEL` (including the backend-only
  `http`) means `info`.
- Server-side only: it writes to `process.stdout`, so it is imported only by server code
  (route handlers, `instrumentation.ts`, future server services such as T024's API client).

### 4.3 Request errors — `frontend/instrumentation.ts`

```ts
export async function onRequestError(
  error: unknown,
  request: { path: string; method: string; headers: Record<string, string | string[] | undefined> },
  context: { routerKind: string; routePath: string; routeType: string },
): Promise<void>;
```

- Writes one `logger.error('Request failed', { method, path, routePath, routeType, error })`
  line; `error` goes through the logger's `Error` serialisation, which carries `err.digest`
  through when Next.js has set it. A non-`Error` value is logged safely instead of with
  `String(value)`: a string is passed through unchanged; otherwise `JSON.stringify(value)` is
  tried first and `Object.prototype.toString.call(value)` is the fallback if that throws (e.g.
  `Object.create(null)`, which `String()` cannot coerce).
- `request.headers` is never logged (cookies and `Authorization` carry session tokens —
  spirit of T065).
- Next.js calls `onRequestError` for errors in server components, route handlers, server
  actions and the proxy; the file lives at `frontend/instrumentation.ts` (no `src/` directory
  in this project).
- Request errors in the Edge runtime are not logged: the hook returns early when
  `process.env.NEXT_RUNTIME === 'edge'` and loads `./lib/logger` (Node-only, uses
  `process.stdout`) with a dynamic `import()` so it is never bundled into the Edge build; Next
  16's proxy runs on the `nodejs` runtime by default, so this does not affect proxy error
  logging in practice.

### 4.4 Compose — `docker-compose.yml`

The `frontend` service gains a healthcheck built like the backend's (the `node:20` image has no
guaranteed `curl`/`wget`; `node` is there):

```yaml
    healthcheck:
      test:
        [
          "CMD",
          "node",
          "-e",
          "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));",
        ]
      interval: 10s
      timeout: 5s
      retries: 30
      start_period: 120s
```

`start_period` is longer than the backend's because the container runs `npm ci` before
`next dev`. No comment is added to the file (CLAUDE.md code conventions).
`tests/structure/test_docker_compose.sh` asserts the frontend healthcheck targets port 3000
and `/health`, as it already does for the backend.

### 4.5 Test harness — Vitest

- `vitest` as a `frontend` devDependency; `frontend/vitest.config.ts` with
  `test.environment: 'node'` and `test.include: ['tests/**/*.test.ts']`; `"test": "vitest run"`
  in `frontend/package.json`.
- Test files follow plan.md Testing: `tests/unit/logger.test.ts`,
  `tests/unit/instrumentation.test.ts`, `tests/integration/health.test.ts`.
- Testing Library is not installed yet: no React component is tested in this task (Principe
  II); T022, the first UI task, adds it.
- On this host, `frontend/node_modules` is an empty root-owned directory left by Docker as the
  mountpoint of the compose `frontend-node-modules` volume; it is removed with `rmdir` (the
  parent is user-owned) before `npm install`.

### 4.6 Documentation

- `tasks.md`: T060's text corrected to `GET /health` in `frontend/app/health/route.ts`; T060
  annotated on completion, including the known gap (Next.js's own plain-text banner and dev
  request lines).
- `CLAUDE.md` "Current state": the `frontend/` bullet mentions `/health`, the JSON logger and
  `npm test` (Vitest); the Tests bullet mentions the frontend harness.
- `plan.md` Constitution Check row V: add that the frontend exposes `GET /health` and JSON
  application logs (T060).

## 5. Testing (test-first)

`tests/unit/logger.test.ts` (spy on `process.stdout.write`):
- one call → exactly one line, valid JSON, ending with `\n`, with `level`, `message` and an ISO
  `timestamp`;
- extra fields are included; fields named `level`, `message`, `timestamp` do not override the
  core keys;
- an `Error` field becomes `{ name, message, stack }`;
- an `Error` field with an `Error` `cause` becomes `{ ..., cause: { name, message, stack } }`;
- an `Error` field with a string `digest` property becomes `{ ..., digest: 'abc123' }`;
- a circular field, and separately a `BigInt` field, each produce exactly one valid JSON line
  with the right `level`/`message` and a `logError`, and the call does not throw;
- an `Error` whose `cause` is itself (`e.cause = e`), and separately a two-`Error` cyclic
  `cause` chain (`a.cause = b; b.cause = a`), each produce exactly one valid JSON line without
  throwing, where the repeated `Error` serialises to `'[Circular]'` instead of recursing again;
- `LOG_LEVEL=warn`: `warn` and `error` are written, `info` and `debug` are not;
- `LOG_LEVEL` unset, and `LOG_LEVEL=http`: `info` is written, `debug` is not.

`tests/unit/instrumentation.test.ts`:
- `onRequestError(new Error('boom'), { path: '/q/abc', method: 'GET', headers: { authorization:
  'Bearer secret-jwt', cookie: 'session=secret-cookie' } }, { routerKind: 'App Router',
  routePath: '/q/[token]', routeType: 'render' })` writes one `error` line with `method`,
  `path`, `routePath`, `routeType` and `error.message = 'boom'`, and neither `secret-jwt` nor
  `secret-cookie` appears in it;
- an `Error` with a string `digest` property produces `error.digest` in the line;
- a non-`Error` value (`'plain failure'`) is logged as that string;
- a thrown plain object (`{ code: 42 }`) is logged as `'{"code":42}'`;
- a thrown `Object.create(null)` is logged without throwing;
- with `NEXT_RUNTIME=edge`, `onRequestError` writes nothing to stdout.

`tests/integration/health.test.ts`:
- `GET()` returns status `200` and JSON body `{ "status": "ok" }`;
- the module exports `dynamic === 'force-dynamic'`.

Structure: `tests/structure/test_docker_compose.sh` gains the frontend healthcheck assertion
(failing first).

Production check: `npm run build` lists `/health` as `ƒ` (dynamic); `next start -p 3100` then
`curl -s -w '%{http_code}' http://127.0.0.1:3100/health` → `{"status":"ok"}200`; the server is
stopped afterwards.

Live compose check: under a dedicated project name (`docker compose -p devops2-check …`), the
`frontend` service becomes `healthy`, then `docker compose -p devops2-check … down -v`. It runs
only if ports 1337, 3000 and 5432 are free; otherwise it is skipped and the skip is recorded —
the owner's own compose project is never started, stopped or modified.

Regression gate: all `tests/structure/*.sh`; `backend/`: `npm test`, `npm run build`,
`npm run lint`, `npm run format:check`; `frontend/`: `npm test`, `npm run build`,
`npm run lint`, `npm run format:check`.

## 6. Risks

- **Next.js 16 API drift.** `onRequestError`'s argument shape and the `dynamic` segment option
  are taken from the Next.js 15/16 documentation; the tests call them the way Next.js does, and
  the production check proves `/health` is dynamic in the real build. If Next.js 16 reports a
  different shape, the implementation follows the installed version's types, never the other
  way round.
- **Mixed stdout in development.** `next dev` prints plain-text lines next to the JSON ones; a
  log collector must tolerate non-JSON lines until a task like T072 addresses the framework
  output. Production (`next start`, Vercel) prints far less framework text.
- **Server-only logger.** Importing `lib/logger.ts` from a client component would break in
  the browser (no `process.stdout`); the constraint is recorded here and in the `tasks.md`
  annotation, not by a code comment, and no client code imports it in this task.
