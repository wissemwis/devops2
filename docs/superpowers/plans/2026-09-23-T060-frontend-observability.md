# T060 Frontend Health Endpoint and JSON Logs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Next.js frontend a liveness endpoint `GET /health` and single-line JSON application logs on stdout (including every server-side request error), test-first on a new Vitest harness, and a compose healthcheck.

**Architecture:** A dependency-free logger (`frontend/lib/logger.ts`) writes JSON lines to `process.stdout`; Next.js's `onRequestError` hook in `frontend/instrumentation.ts` routes request errors through it without headers; `frontend/app/health/route.ts` is a force-dynamic route handler returning `{"status":"ok"}`; the compose `frontend` service probes it like `backend` probes its own `/health`.

**Tech Stack:** Next.js 16.3.5 (App Router, TypeScript), Vitest (new devDependency, `node` environment), Docker Compose, bash structure tests.

**Spec:** `docs/superpowers/specs/2026-09-23-T060-frontend-observability-design.md`

## Global Constraints

- **No comments in code**: no `//`, `/* */`, JSDoc or `#` in any source, test, configuration or script file you write, including `vitest.config.ts`, `docker-compose.yml` and `.sh` additions (CLAUDE.md "Code conventions"). Existing comments may stay.
- Test-first: every test is run and seen failing for the expected reason before the implementation is written (constitution Principe I).
- Node is not on PATH: `export PATH=/tmp/claude-1000/-project-devops2/f0c0f41e-6d12-45e7-a390-b175e6f2473f/scratchpad/node-v22.12.0-linux-x64/bin:$PATH`
- Health: path `/health` only, file `frontend/app/health/route.ts`, response `200` with body `{"status":"ok"}`, `export const dynamic = 'force-dynamic'`, no log per call, no backend check.
- Logger: levels and severities `error` 0, `warn` 1, `info` 2, `debug` 3; threshold from `LOG_LEVEL` read at call time; unset or unknown value (including `http`) → `info`; one line `JSON.stringify({ ...fields, level, message, timestamp })` + `\n` on `process.stdout`, `timestamp` = `new Date().toISOString()`; an `Error` field value → `{ name, message, stack }`.
- Request errors: message `Request failed`, fields `method`, `path`, `routePath`, `routeType`, `error`; request headers are never logged.
- `npm run build` type-checks every `.ts` file in `frontend/`, tests included: if a test's TypeScript typing (never its assertions) fails that check against the installed Next.js/Vitest types, adjust only the typing and record it in the report.
- Test files: `frontend/tests/**/*.test.ts` (plan.md Testing); Vitest `environment: 'node'`; `"test": "vitest run"`. No Testing Library in this task.
- Compose checks run only under project name `devops2-check` (`docker compose -p devops2-check …`) and only when host ports 1337, 3000 and 5432 are all free; never start, stop or remove anything of another compose project; never `docker volume rm` by hand.
- Stage files by path only (never `git add -A` / `git add .`); never stage `.env*` or `.superpowers/`. Commit messages end with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_018oex3Jpgz8jfd3XAQ58F4t
  ```
- Regression gate (every task): `cd /project/devops2 && for t in tests/structure/*.sh; do echo "== $t"; bash "$t" | grep -E '^Total'; done`; in `backend/`: `npm test && npm run build && npm run lint && npm run format:check`; in `frontend/`: `npm test && npm run build && npm run lint && npm run format:check`. Known pre-existing noise only: lint warning in `backend/config/plugins.ts`, Prettier warning on `backend/.strapi-updater.json`.

## Review Focus

- `LOG_LEVEL=http` copied from the backend's env into the frontend → treated as `info`, not as "log nothing" nor "log everything" (Task 1 test "falls back to info").
- A caller passes a field named `level` or `timestamp` (e.g. an upstream API error body) → the log line keeps its own core keys (Task 1 test "core keys win").
- An error thrown with a JWT or cookie in the incoming request → the log line carries method and path but no header value (Task 2 test "never logs headers").
- Something non-`Error` thrown (a string, an object) → logged as a string, no crash in the hook (Task 2 test "non-Error value").
- The production build prerendering `/health` into a static file → probe would lie; the build output must show `ƒ /health` and `next start` must serve it (Task 3 production check).

---

### Task 1: Vitest harness and JSON logger

**Files:**
- Modify: `frontend/package.json` (script `test`, devDependency `vitest`), `frontend/package-lock.json`
- Create: `frontend/vitest.config.ts`
- Create: `frontend/lib/logger.ts`
- Create: `frontend/tests/unit/logger.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `LogLevel`, `LogFields`, `logger: Record<LogLevel, (message: string, fields?: LogFields) => void>` from `frontend/lib/logger.ts`; the `npm test` script and Vitest config used by Tasks 2–3.

- [ ] **Step 1: Install dependencies and Vitest**

`frontend/node_modules` on this host is an empty root-owned directory left by Docker (the compose volume mountpoint). Remove it and install:

```bash
export PATH=/tmp/claude-1000/-project-devops2/f0c0f41e-6d12-45e7-a390-b175e6f2473f/scratchpad/node-v22.12.0-linux-x64/bin:$PATH
cd /project/devops2/frontend
[ -d node_modules ] && [ -z "$(ls -A node_modules)" ] && rmdir node_modules
npm install
npm install --save-dev vitest
```

If `node_modules` is not empty or `rmdir` fails, stop and report BLOCKED with `ls -la node_modules | head`. Add to `frontend/package.json` `scripts`: `"test": "vitest run"`.

`frontend/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 2: Write the failing test**

`frontend/tests/unit/logger.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '../../lib/logger';

let write: ReturnType<typeof vi.spyOn>;
const originalLevel = process.env.LOG_LEVEL;

beforeEach(() => {
  write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  delete process.env.LOG_LEVEL;
});

afterEach(() => {
  write.mockRestore();
  if (originalLevel === undefined) delete process.env.LOG_LEVEL;
  else process.env.LOG_LEVEL = originalLevel;
});

function lines(): string[] {
  return write.mock.calls.map((call) => String(call[0]));
}

function entries(): Record<string, unknown>[] {
  return lines().map((line) => JSON.parse(line));
}

describe('frontend JSON logger (T060, Principe V)', () => {
  it('writes one JSON line with level, message and an ISO timestamp', () => {
    logger.info('Frontend started');

    expect(lines()).toHaveLength(1);
    expect(lines()[0].endsWith('\n')).toBe(true);
    expect(lines()[0].trimEnd().includes('\n')).toBe(false);
    const [entry] = entries();
    expect(entry.level).toBe('info');
    expect(entry.message).toBe('Frontend started');
    expect(new Date(String(entry.timestamp)).toISOString()).toBe(entry.timestamp);
  });

  it('includes extra fields, and core keys win over fields with the same name', () => {
    logger.warn('Backend slow', {
      durationMs: 1200,
      level: 'debug',
      message: 'spoofed',
      timestamp: 'yesterday',
    });

    const [entry] = entries();
    expect(entry.durationMs).toBe(1200);
    expect(entry.level).toBe('warn');
    expect(entry.message).toBe('Backend slow');
    expect(entry.timestamp).not.toBe('yesterday');
  });

  it('serialises an Error field as name, message and stack', () => {
    const failure = new TypeError('bad input');

    logger.error('Request failed', { error: failure });

    const [entry] = entries();
    expect(entry.error).toEqual({
      name: 'TypeError',
      message: 'bad input',
      stack: failure.stack,
    });
  });

  it('filters by LOG_LEVEL', () => {
    process.env.LOG_LEVEL = 'warn';

    logger.error('e');
    logger.warn('w');
    logger.info('i');
    logger.debug('d');

    expect(entries().map((entry) => entry.level)).toEqual(['error', 'warn']);
  });

  it('falls back to info when LOG_LEVEL is unset or unknown', () => {
    logger.info('unset-info');
    logger.debug('unset-debug');
    process.env.LOG_LEVEL = 'http';
    logger.info('http-info');
    logger.debug('http-debug');

    expect(entries().map((entry) => entry.message)).toEqual(['unset-info', 'http-info']);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

```bash
cd /project/devops2/frontend && npx vitest run tests/unit/logger.test.ts
```

Expected: FAIL — cannot resolve `../../lib/logger`.

- [ ] **Step 4: Implement the logger**

`frontend/lib/logger.ts`:

```ts
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';
export type LogFields = Record<string, unknown>;

const SEVERITY: Record<LogLevel, number> = { error: 0, warn: 1, info: 2, debug: 3 };
const DEFAULT_LEVEL: LogLevel = 'info';

function isLogLevel(value: string | undefined): value is LogLevel {
  return value !== undefined && Object.hasOwn(SEVERITY, value);
}

function threshold(): number {
  const configured = process.env.LOG_LEVEL;
  return SEVERITY[isLogLevel(configured) ? configured : DEFAULT_LEVEL];
}

function serialise(value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  return value;
}

function write(level: LogLevel, message: string, fields: LogFields = {}): void {
  if (SEVERITY[level] > threshold()) return;
  const extra = Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, serialise(value)]),
  );
  const entry = { ...extra, level, message, timestamp: new Date().toISOString() };
  process.stdout.write(`${JSON.stringify(entry)}\n`);
}

export const logger: Record<LogLevel, (message: string, fields?: LogFields) => void> = {
  error: (message, fields) => write('error', message, fields),
  warn: (message, fields) => write('warn', message, fields),
  info: (message, fields) => write('info', message, fields),
  debug: (message, fields) => write('debug', message, fields),
};
```

- [ ] **Step 5: Run it to verify it passes**

Same command as Step 3. Expected: `5 passed`.

- [ ] **Step 6: Regression gate**

Run the regression gate from Global Constraints (`npx prettier --write` the new files first if `format:check` flags them). Expected: all green apart from the known pre-existing warnings; `frontend` `npm test` → 1 file, 5 tests.

- [ ] **Step 7: Commit**

```bash
cd /project/devops2
git add frontend/package.json frontend/package-lock.json frontend/vitest.config.ts frontend/lib/logger.ts frontend/tests/unit/logger.test.ts
git commit -m "T060 (D2-70): Vitest harness and dependency-free JSON logger for the frontend"
```

(with the two trailer lines from Global Constraints)

---

### Task 2: Request errors logged through `onRequestError`

**Files:**
- Create: `frontend/instrumentation.ts`
- Create: `frontend/tests/unit/instrumentation.test.ts`

**Interfaces:**
- Consumes: `logger` from `frontend/lib/logger.ts` (Task 1), Vitest harness (Task 1).
- Produces: `onRequestError` exported from `frontend/instrumentation.ts`, typed with Next.js's own `Instrumentation.onRequestError` type (`import type { Instrumentation } from 'next'`).

- [ ] **Step 1: Write the failing test**

`frontend/tests/unit/instrumentation.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { onRequestError } from '../../instrumentation';

type RequestInfo = Parameters<typeof onRequestError>[1];
type ErrorContext = Parameters<typeof onRequestError>[2];

let write: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
});

afterEach(() => {
  write.mockRestore();
});

const request: RequestInfo = {
  path: '/q/abc',
  method: 'GET',
  headers: { authorization: 'Bearer secret-jwt', cookie: 'session=secret-cookie' },
};

const context: ErrorContext = {
  routerKind: 'App Router',
  routePath: '/q/[token]',
  routeType: 'render',
  renderSource: 'react-server-components',
  revalidateReason: undefined,
};

function logged(): string[] {
  return write.mock.calls.map((call) => String(call[0]));
}

describe('onRequestError (T060, Principe V)', () => {
  it('logs one error line with the route and the error, never the headers', async () => {
    await onRequestError(new Error('boom'), request, context);

    expect(logged()).toHaveLength(1);
    const entry = JSON.parse(logged()[0]);
    expect(entry.level).toBe('error');
    expect(entry.message).toBe('Request failed');
    expect(entry.method).toBe('GET');
    expect(entry.path).toBe('/q/abc');
    expect(entry.routePath).toBe('/q/[token]');
    expect(entry.routeType).toBe('render');
    expect(entry.error.message).toBe('boom');
    expect(logged()[0]).not.toContain('secret-jwt');
    expect(logged()[0]).not.toContain('secret-cookie');
  });

  it('logs a non-Error value as a string', async () => {
    await onRequestError('plain failure', request, context);

    expect(JSON.parse(logged()[0]).error).toBe('plain failure');
  });
});
```

If the installed Next.js types require different or additional fields in `RequestInfo` / `ErrorContext` (the `context` literal above follows the Next.js 15/16 documentation), adjust only the two literals so they type-check against `Parameters<typeof onRequestError>`; never change the assertions. Record any adjustment in the report.

- [ ] **Step 2: Run it to verify it fails**

```bash
export PATH=/tmp/claude-1000/-project-devops2/f0c0f41e-6d12-45e7-a390-b175e6f2473f/scratchpad/node-v22.12.0-linux-x64/bin:$PATH
cd /project/devops2/frontend && npx vitest run tests/unit/instrumentation.test.ts
```

Expected: FAIL — cannot resolve `../../instrumentation`.

- [ ] **Step 3: Implement the hook**

`frontend/instrumentation.ts`:

```ts
import type { Instrumentation } from 'next';
import { logger } from './lib/logger';

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  logger.error('Request failed', {
    method: request.method,
    path: request.path,
    routePath: context.routePath,
    routeType: context.routeType,
    error: error instanceof Error ? error : String(error),
  });
};
```

- [ ] **Step 4: Run it to verify it passes**

Same command as Step 2. Expected: `2 passed`. Then `npm test` → 2 files, 7 tests.

- [ ] **Step 5: Regression gate**

Run the regression gate from Global Constraints. `npm run build` must succeed (it type-checks `instrumentation.ts` and the tests against the installed Next.js types).

- [ ] **Step 6: Commit**

```bash
cd /project/devops2
git add frontend/instrumentation.ts frontend/tests/unit/instrumentation.test.ts
git commit -m "T060 (D2-70): log server-side request errors as JSON through onRequestError"
```

(with the two trailer lines from Global Constraints)

---

### Task 3: `GET /health` route and compose healthcheck

**Files:**
- Create: `frontend/app/health/route.ts`
- Create: `frontend/tests/integration/health.test.ts`
- Modify: `docker-compose.yml` (`services.frontend.healthcheck`)
- Modify: `tests/structure/test_docker_compose.sh` (frontend healthcheck assertion)

**Interfaces:**
- Consumes: Vitest harness (Task 1).
- Produces: `GET` and `dynamic` exported from `frontend/app/health/route.ts`; the compose `frontend` healthcheck used by later deployment tasks (T057).

- [ ] **Step 1: Write the failing tests**

`frontend/tests/integration/health.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { GET, dynamic } from '../../app/health/route';

describe('GET /health (T060, Principe V)', () => {
  it('answers 200 with status ok', async () => {
    const response = GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('is rendered per request, never prerendered', () => {
    expect(dynamic).toBe('force-dynamic');
  });
});
```

In `tests/structure/test_docker_compose.sh`, right after the backend healthcheck block (the `pass "backend healthcheck probes GET /health on port 1337"` / `fail …` pair), add:

```bash
hc_frontend="$(python3 -c "
import json
with open('$TMP_JSON') as f:
    data = json.load(f)
t = data['services']['frontend'].get('healthcheck', {}).get('test', [])
print(' '.join(t))
")"
if echo "$hc_frontend" | grep -q "3000" && echo "$hc_frontend" | grep -q "/health"; then
    pass "frontend healthcheck probes GET /health on port 3000"
else
    fail "frontend healthcheck probes GET /health on port 3000" "healthcheck test was: $hc_frontend"
fi
```

- [ ] **Step 2: Run them to verify they fail**

```bash
export PATH=/tmp/claude-1000/-project-devops2/f0c0f41e-6d12-45e7-a390-b175e6f2473f/scratchpad/node-v22.12.0-linux-x64/bin:$PATH
cd /project/devops2/frontend && npx vitest run tests/integration/health.test.ts
cd /project/devops2 && bash tests/structure/test_docker_compose.sh | grep -E 'frontend healthcheck|^Total'
```

Expected: Vitest FAIL — cannot resolve `../../app/health/route`; structure script `Failed: 1` on "frontend healthcheck probes GET /health on port 3000".

- [ ] **Step 3: Implement**

`frontend/app/health/route.ts`:

```ts
export const dynamic = 'force-dynamic';

export function GET(): Response {
  return Response.json({ status: 'ok' });
}
```

In `docker-compose.yml`, `services.frontend`, add after `depends_on` (no comment line):

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

- [ ] **Step 4: Run them to verify they pass**

Same commands as Step 2. Expected: Vitest `2 passed`; structure script `Failed: 0`. Then `npm test` → 3 files, 9 tests.

- [ ] **Step 5: Production check**

```bash
export PATH=/tmp/claude-1000/-project-devops2/f0c0f41e-6d12-45e7-a390-b175e6f2473f/scratchpad/node-v22.12.0-linux-x64/bin:$PATH
cd /project/devops2/frontend
npm run build 2>&1 | tee /tmp/claude-1000/-project-devops2/f0c0f41e-6d12-45e7-a390-b175e6f2473f/scratchpad/t060-build.txt | grep -E 'health'
npx next start -p 3100 > /tmp/claude-1000/-project-devops2/f0c0f41e-6d12-45e7-a390-b175e6f2473f/scratchpad/t060-start.txt 2>&1 &
START_PID=$!
for i in $(seq 1 30); do curl -s -o /dev/null http://127.0.0.1:3100/health && break; sleep 1; done
curl -s -w '%{http_code}\n' http://127.0.0.1:3100/health
kill $START_PID
```

Expected: the build route table lists `/health` with the dynamic marker `ƒ` (not `○` static); curl prints `{"status":"ok"}200`. Put both outputs in the report. If port 3100 is taken, use another free port above 3100 and say which.

- [ ] **Step 6: Live compose check (dedicated project, only if ports are free)**

```bash
cd /project/devops2
if ss -ltn | grep -qE ':(1337|3000|5432)\s'; then
  echo "SKIPPED: a host port among 1337/3000/5432 is in use"
else
  TMP_ENV=$(mktemp)
  cp .env.example "$TMP_ENV"
  sed -i -e 's/^DATABASE_NAME=.*/DATABASE_NAME=questionnaire/' \
         -e 's/^DATABASE_USERNAME=.*/DATABASE_USERNAME=questionnaire/' \
         -e 's/^DATABASE_PASSWORD=.*/DATABASE_PASSWORD=live-check-db/' "$TMP_ENV"
  docker compose -p devops2-check --env-file "$TMP_ENV" up -d
  for i in $(seq 1 60); do
    [ "$(docker compose -p devops2-check --env-file "$TMP_ENV" ps --format '{{.Health}}' frontend)" = healthy ] && break
    sleep 10
  done
  docker compose -p devops2-check --env-file "$TMP_ENV" ps --format '{{.Service}} {{.Health}}'
  curl -s -w '%{http_code}\n' http://127.0.0.1:3000/health
  docker compose -p devops2-check --env-file "$TMP_ENV" down -v
  rm -f "$TMP_ENV"
fi
```

Expected: `frontend healthy` (and `backend healthy`), curl prints `{"status":"ok"}200`, then everything of project `devops2-check` removed. If skipped, write "SKIPPED" and the `ss` line that caused it in the report — do not stop or change any other compose project. Always run the `down -v` of `devops2-check` if `up` was attempted, even on failure.

- [ ] **Step 7: Regression gate**

Run the regression gate from Global Constraints.

- [ ] **Step 8: Commit**

```bash
cd /project/devops2
git add frontend/app/health/route.ts frontend/tests/integration/health.test.ts docker-compose.yml tests/structure/test_docker_compose.sh
git commit -m "T060 (D2-70): frontend GET /health liveness route and compose healthcheck"
```

(with the two trailer lines from Global Constraints)

---

### Task 4: Record completion

**Files:**
- Modify: `CLAUDE.md`, `specs/001-questionnaire-platform/plan.md`, `specs/001-questionnaire-platform/tasks.md`

**Interfaces:**
- Consumes: the commits of Tasks 1–3 and their evidence.
- Produces: nothing for later tasks.

- [ ] **Step 1: `CLAUDE.md`**

In "Current state": change "**T001–T010**, **T061** and **T062** of 76 tasks" to "**T001–T010**, **T060**, **T061** and **T062** of 76 tasks"; replace the `frontend/` bullet's "No application pages yet." with "No application pages yet. `GET /health` → 200 `{\"status\":\"ok\"}` (liveness, `app/health/route.ts`); server-side JSON logs on stdout via `lib/logger.ts` (`LOG_LEVEL`, default `info`), request errors logged by `onRequestError` in `instrumentation.ts`; Next.js's own banner/dev lines stay plain text (T060)."; in the `docker-compose.yml` bullet, mention that `frontend` also has a healthcheck on `/health`; in the Tests bullet add "and a Vitest harness in `frontend/` (`npm test`, `tests/**/*.test.ts`, T060)".

- [ ] **Step 2: `plan.md`**

In the Constitution Check table, row "V. Observabilité", append to the justification: "Le frontend Next.js expose aussi `GET /health` (vivacité) et des logs applicatifs JSON sur stdout (T060)."

- [ ] **Step 3: `tasks.md`**

Correct T060's text: `GET /api/health` → `GET /health` and `frontend/app/api/health/route.ts` → `frontend/app/health/route.ts`. Mark `T060` `[X]` with an inline annotation in the style of T062: design and plan paths, Jira `D2-70`, decisions D1–D3, files, RED/GREEN evidence of each task, production check output (`ƒ /health`, `{"status":"ok"}200`), live compose check result (or SKIPPED with reason), reviewer verdicts, and the known gaps: Next.js's own plain-text banner and dev request lines are not JSON; `lib/logger.ts` is server-only (never import it from a client component).

- [ ] **Step 4: Verify and commit**

```bash
export PATH=/tmp/claude-1000/-project-devops2/f0c0f41e-6d12-45e7-a390-b175e6f2473f/scratchpad/node-v22.12.0-linux-x64/bin:$PATH
cd /project/devops2 && for t in tests/structure/*.sh; do bash "$t" | grep -E '^Total'; done
git add CLAUDE.md specs/001-questionnaire-platform/plan.md specs/001-questionnaire-platform/tasks.md
git commit -m "T060 (D2-70): record completion"
```

(with the two trailer lines from Global Constraints)

- [ ] **Step 5: Jira**

After the final whole-branch review passes: comment on D2-70 (summary, decisions, test evidence, commit range, known gaps) and move it to `Terminé` (transition id `41`).
