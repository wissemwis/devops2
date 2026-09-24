# T063 Author Login and Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an `auteur` or `administrateur` sign in at `/login`, keep a refreshable server-side session in httpOnly cookies, land on a protected `/questionnaires` home listing their questionnaires, and sign out — in the "Cahier Seyès" visual world.

**Architecture:** Next.js is a BFF: server actions, the Next 16 `proxy.ts` and server components call Strapi through `services/strapi.ts` (server-only `STRAPI_URL`); the Strapi access token (10 min) and rotating refresh token live in two httpOnly cookies owned by Next.js. Pure modules (`lib/jwt`, `lib/session-decision`, `lib/session-cookies`, `lib/authenticate`) carry the logic and are unit-tested; pages and the proxy are thin wrappers. Presentational components render the Seyès world from Tailwind v4 theme tokens.

**Tech Stack:** Next.js 16.3.5 (App Router, `proxy.ts`, server actions, `useActionState`), React 19.2, Tailwind CSS v4, Vitest 4.1.11 (node environment, `react-dom/server` for components), Strapi 5.54 users-permissions in refresh mode, Jest + Supertest (backend).

**Spec:** `docs/superpowers/specs/2026-09-24-T063-author-login-session-design.md`

## Global Constraints

- **No comments in code**: no `//`, `/* */`, JSDoc, `{/* */}` or `#` in any source, test, configuration or script file you write (CLAUDE.md "Code conventions"). Existing comments may stay.
- Test-first: every test is run and seen failing for the expected reason before the implementation is written (constitution Principe I).
- Node is not on PATH: `export PATH=/tmp/claude-1000/-project-devops2/f0c0f41e-6d12-45e7-a390-b175e6f2473f/scratchpad/node-v22.12.0-linux-x64/bin:$PATH`
- No new npm dependency in either project.
- Strapi facts (verified in 5.54 source): `POST /api/auth/local` → `{ jwt, user }`, access token 10 minutes, refresh token only in `Set-Cookie: strapi_up_refresh=…` (httpOnly); `POST /api/auth/refresh` reads cookie `strapi_up_refresh`, rotates it (new `Set-Cookie`), returns `{ jwt }`, 401 when invalid; `POST /api/auth/logout` needs `Authorization: Bearer <access>`, revokes the session, answers `{ ok: true }`.
- Cookie names (exact): `qp_access`, `qp_refresh`; options `httpOnly: true`, `sameSite: 'lax'`, `path: '/'`, `secure: process.env.NODE_ENV === 'production'`; access `maxAge` = JWT `exp` − now (600 when unreadable); refresh `maxAge` = 2592000.
- Allowed author roles (exact): `auteur`, `administrateur`.
- Messages (exact, French): missing `Renseignez votre email et votre mot de passe.`; invalid `Email ou mot de passe incorrect.`; forbidden-role `Ce compte n'a pas accès à l'espace auteur.`; unavailable `Le service est momentanément indisponible. Réessayez dans un instant.`; list error `Impossible de charger vos questionnaires.` + link `Réessayer`; empty list `Vos questionnaires apparaîtront ici.`
- Log events (exact names, status codes only, never a token, password or email): `auth.login.unavailable`, `auth.login.unexpected-response`, `auth.refresh.failed`, `auth.logout.failed`, `questionnaires.list.failed`.
- Palette tokens (exact hex): papier `#fbfbf8`, reglure `#dce3f3`, reglure-forte `#b9c6e8`, marge `#d8343a`, encre `#1f3fa8`, encre-sombre `#182f7e`, graphite `#2b2b2b`, graphite-doux `#5b5f6b`, crayon `#616161`, tampon `#707070`, stylo-rouge `#c62828`. Font: Atkinson Hyperlegible Next via `next/font/google`. Light theme only. `<html lang="fr">`, title `Espace auteur — Questionnaires`.
- The impeccable direction contract lives only in the surface brief (never in source, DOM, attributes or anything served).
- Stage files by path only (never `git add -A` / `git add .`); never stage `.env*` (except `.env.example`) or `.superpowers/`. Commit messages end with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_018oex3Jpgz8jfd3XAQ58F4t
  ```
- Regression gate (every task): `cd /project/devops2 && for t in tests/structure/*.sh; do echo "== $t"; bash "$t" | grep -E '^Total'; done`; in `backend/`: `npm test && npm run build && npm run lint && npm run format:check`; in `frontend/`: `npm test && npm run build && npm run lint && npm run format:check`. Known pre-existing noise only: backend lint warning in `config/plugins.ts`, backend Prettier warning on `.strapi-updater.json`. Run `npx prettier --write <files>` on files you create or modify when `format:check` flags them.
- If an installed Next.js, React, Vitest or Strapi type or API differs from the code below, adjust only typing or the call shape, never an assertion, and record it in the report.

## Review Focus

- A `repondant` (the default role of every account) signs in → refused with `Ce compte n'a pas accès à l'espace auteur.` **and** its fresh Strapi session revoked, which needs the `auth.logout` grant on `repondant` (Task 1 test "lets each business role log out"; Task 3 test "refuses a repondant and revokes its fresh session").
- The access token expires while the author prepares a questionnaire → the next navigation refreshes transparently and the page renders with the new token, not a login redirect (Task 5 proxy test "refreshes an expired access token and forwards it to the render").
- Strapi is down or rate-limits the login (429) → the form shows the unavailable message, never "incorrect password" and never a crash (Task 3 tests "maps 429 and 5xx to unavailable" and "maps a network failure to unavailable").
- An author submits with the email filled and the password empty (or whitespace-only email) → the missing message, the typed email kept, and no Strapi call (Task 5 test "refuses empty fields without calling Strapi").
- Logout while Strapi is unreachable → cookies are still cleared and the author lands on `/login` (Task 3 test "logout never throws when Strapi is unreachable"; Task 5 logoutAction relies on it).

---

### Task 1: Backend — logout grant and the session endpoints the BFF relies on

**Files:**
- Modify: `backend/src/bootstrap/permissions.ts` (add `plugin::users-permissions.auth.logout` to `auteur`, `administrateur`, `repondant`)
- Create: `backend/tests/contract/auth_session.test.ts`

**Interfaces:**
- Consumes: `createUserWithRole(strapi, type)` → `{ user, jwt, email, password }` (`backend/tests/helpers/users.ts`); `setupStrapi`/`teardownStrapi` (`backend/tests/helpers/strapi.ts`).
- Produces: the three business roles hold `plugin::users-permissions.auth.logout`; `role_permissions.test.ts` checks the table against the database automatically.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/contract/auth_session.test.ts`:

```ts
import request from 'supertest';
import type { Core } from '@strapi/strapi';
import { setupStrapi, teardownStrapi } from '../helpers/strapi';
import { createUserWithRole } from '../helpers/users';

type BusinessRole = 'auteur' | 'administrateur' | 'repondant';

let strapi: Core.Strapi;

beforeAll(async () => {
  strapi = await setupStrapi();
});

afterAll(async () => {
  await teardownStrapi();
});

function refreshCookieOf(res: request.Response): string {
  const header = res.headers['set-cookie'] as string[] | string | undefined;
  const cookies = Array.isArray(header) ? header : header ? [header] : [];
  const found = cookies.find((cookie) => cookie.startsWith('strapi_up_refresh='));
  if (!found) throw new Error('no strapi_up_refresh cookie in the response');
  return found.split(';')[0];
}

async function signIn(type: BusinessRole): Promise<{ jwt: string; cookie: string }> {
  const { email, password } = await createUserWithRole(strapi, type);
  const res = await request(strapi.server.httpServer)
    .post('/api/auth/local')
    .send({ identifier: email, password });
  expect(res.status).toBe(200);
  expect(typeof res.body.jwt).toBe('string');
  expect(res.body).not.toHaveProperty('refreshToken');
  return { jwt: res.body.jwt, cookie: refreshCookieOf(res) };
}

function refresh(cookie: string) {
  return request(strapi.server.httpServer).post('/api/auth/refresh').set('Cookie', cookie).send({});
}

describe('session endpoints used by the frontend BFF (T063)', () => {
  it('returns the role type from GET /api/users/me?populate=role', async () => {
    for (const type of ['auteur', 'administrateur'] as const) {
      const { jwt } = await signIn(type);

      const res = await request(strapi.server.httpServer)
        .get('/api/users/me?populate=role')
        .set('Authorization', `Bearer ${jwt}`);

      expect(res.status).toBe(200);
      expect(res.body.role.type).toBe(type);
      expect(typeof res.body.nom).toBe('string');
      expect(res.body).not.toHaveProperty('password');
    }
  });

  it('rotates the refresh cookie on POST /api/auth/refresh', async () => {
    const { cookie } = await signIn('auteur');

    const res = await refresh(cookie);

    expect(res.status).toBe(200);
    expect(typeof res.body.jwt).toBe('string');
    expect(refreshCookieOf(res)).not.toBe(cookie);
  });

  it('lets each business role log out, after which its refresh token is refused', async () => {
    for (const type of ['auteur', 'administrateur', 'repondant'] as const) {
      const { jwt, cookie } = await signIn(type);

      const logout = await request(strapi.server.httpServer)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${jwt}`)
        .set('Cookie', cookie)
        .send({});

      expect(logout.status).toBe(200);
      expect(logout.body).toEqual({ ok: true });
      expect((await refresh(cookie)).status).toBe(401);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /project/devops2/backend && npx jest tests/contract/auth_session.test.ts`
Expected: FAIL — the logout test gets 403 (no business role holds `auth.logout`). The two other tests may pass already; that is expected and pins behaviour the frontend relies on. If the login itself answers 429 (Strapi's auth rate limit), report it rather than weakening the test.

- [ ] **Step 3: Grant the action**

In `backend/src/bootstrap/permissions.ts`, add `'plugin::users-permissions.auth.logout'` right after `'plugin::users-permissions.role.find'` in the `auteur` and `administrateur` lists, and make `repondant` read `repondant: ['plugin::users-permissions.auth.logout'],`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd /project/devops2/backend && npx jest tests/contract/auth_session.test.ts tests/integration/role_permissions.test.ts tests/integration/users_default_role.test.ts`
Expected: PASS. If `users_default_role.test.ts` or `role_permissions.test.ts` asserts that `repondant` has no permission at all, update only the expected table value there to the new `ROLE_PERMISSIONS` (never remove a test) and record it.

- [ ] **Step 5: Regression gate, then commit**

Run the full gate from Global Constraints, then:

```bash
cd /project/devops2
git add backend/src/bootstrap/permissions.ts backend/tests/contract/auth_session.test.ts
git commit -F - <<'EOF'
T063: grant auth.logout to the business roles

The frontend BFF revokes Strapi sessions on logout and when it refuses a
non-author account; users-permissions grants auth.logout only to the unused
authenticated role by default.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018oex3Jpgz8jfd3XAQ58F4t
EOF
```

(Also stage any test file adjusted in Step 4.)

---

### Task 2: Frontend foundations — JWT expiry, session decision, cookies, Strapi fetch, `STRAPI_URL`

**Files:**
- Modify: `frontend/vitest.config.ts` (alias `@`, `.test.tsx`)
- Create: `frontend/lib/jwt.ts`, `frontend/lib/session-decision.ts`, `frontend/lib/session-cookies.ts`, `frontend/services/strapi.ts`
- Delete: `frontend/services/.gitkeep`
- Create: `frontend/tests/unit/session.test.ts`, `frontend/tests/unit/strapi.test.ts`
- Modify: `.env.example` (add `STRAPI_URL=https://your-backend.example.com` on the line after `NEXT_PUBLIC_API_BASE_URL=…`, no comment)
- Modify: `docker-compose.yml` (`frontend.environment` gains `STRAPI_URL: http://backend:1337`, no comment)
- Modify: `tests/structure/test_env_example.sh`, `tests/structure/test_docker_compose.sh` (one assertion each)

**Interfaces:**
- Produces:
  - `accessTokenExpiry(token: string): number | null` (`lib/jwt.ts`)
  - `type SessionDecision = 'pass' | 'refresh' | 'login'`; `EXPIRY_SKEW_SECONDS = 30`; `decide(input: { access?: string; refresh?: string; now: number }): SessionDecision` (`lib/session-decision.ts`, `now` in seconds)
  - `ACCESS_COOKIE = 'qp_access'`, `REFRESH_COOKIE = 'qp_refresh'`, `REFRESH_MAX_AGE = 2592000`, `type SessionTokens = { access: string; refresh: string }`, `type CookieOptions`, `type CookieWriter = { set(name: string, value: string, options: CookieOptions): unknown }`, `writeSession(store: CookieWriter, tokens: SessionTokens, now: number): void`, `clearSession(store: CookieWriter): void`, `nowInSeconds(): number` (`lib/session-cookies.ts`)
  - `class StrapiUnavailableError extends Error { status?: number }`, `strapiFetch(path: string, init?: RequestInit): Promise<Response>` (`services/strapi.ts`)

- [ ] **Step 1: Let Vitest resolve `@/` and run `.test.tsx`**

Replace `frontend/vitest.config.ts` with:

```ts
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname) },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
```

Run `cd /project/devops2/frontend && npm test` — the existing 19 tests still pass.

- [ ] **Step 2: Write the failing tests**

Create `frontend/tests/unit/session.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { accessTokenExpiry } from '@/lib/jwt';
import { decide } from '@/lib/session-decision';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  REFRESH_MAX_AGE,
  clearSession,
  writeSession,
} from '@/lib/session-cookies';

const NOW = 1_800_000_000;

function token(payload: Record<string, unknown>): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

function recorder() {
  const calls: [string, string, Record<string, unknown>][] = [];
  return {
    calls,
    set(name: string, value: string, options: Record<string, unknown>) {
      calls.push([name, value, options]);
    },
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('accessTokenExpiry', () => {
  it('reads the exp claim', () => {
    expect(accessTokenExpiry(token({ exp: NOW + 600 }))).toBe(NOW + 600);
  });

  it('returns null for malformed tokens or a missing or non-numeric exp', () => {
    for (const bad of ['', 'abc', 'a.b', 'a.!!!.c', token({ sub: 1 }), token({ exp: '600' })]) {
      expect(accessTokenExpiry(bad)).toBeNull();
    }
  });
});

describe('decide', () => {
  it('asks for login without a refresh token', () => {
    expect(decide({ access: token({ exp: NOW + 600 }), refresh: undefined, now: NOW })).toBe(
      'login',
    );
  });

  it('passes an access token valid for more than 30 seconds', () => {
    expect(decide({ access: token({ exp: NOW + 31 }), refresh: 'r', now: NOW })).toBe('pass');
  });

  it('refreshes a missing, expired, nearly expired or malformed access token', () => {
    for (const access of [
      undefined,
      token({ exp: NOW - 1 }),
      token({ exp: NOW + 30 }),
      token({ exp: NOW + 29 }),
      'garbage',
    ]) {
      expect(decide({ access, refresh: 'r', now: NOW })).toBe('refresh');
    }
  });
});

describe('session cookies', () => {
  it('writes httpOnly lax cookies: access for its remaining life, refresh for 30 days', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const store = recorder();
    const access = token({ exp: NOW + 600 });

    writeSession(store, { access, refresh: 'refresh-token' }, NOW);

    expect(REFRESH_MAX_AGE).toBe(2592000);
    expect(store.calls).toEqual([
      [ACCESS_COOKIE, access, { httpOnly: true, sameSite: 'lax', path: '/', secure: false, maxAge: 600 }],
      [
        REFRESH_COOKIE,
        'refresh-token',
        { httpOnly: true, sameSite: 'lax', path: '/', secure: false, maxAge: REFRESH_MAX_AGE },
      ],
    ]);
    expect(ACCESS_COOKIE).toBe('qp_access');
    expect(REFRESH_COOKIE).toBe('qp_refresh');
  });

  it('marks both cookies secure in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const store = recorder();

    writeSession(store, { access: token({ exp: NOW + 600 }), refresh: 'r' }, NOW);

    expect(store.calls.map(([, , options]) => options.secure)).toEqual([true, true]);
  });

  it('keeps an unreadable access token for 10 minutes', () => {
    const store = recorder();

    writeSession(store, { access: 'garbage', refresh: 'r' }, NOW);

    expect(store.calls[0][2].maxAge).toBe(600);
  });

  it('clears both cookies', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const store = recorder();

    clearSession(store);

    expect(store.calls).toEqual([
      [ACCESS_COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/', secure: false, maxAge: 0 }],
      [REFRESH_COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/', secure: false, maxAge: 0 }],
    ]);
  });
});
```

Create `frontend/tests/unit/strapi.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StrapiUnavailableError, strapiFetch } from '@/services/strapi';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('strapiFetch', () => {
  it('calls STRAPI_URL without caching and returns the response', async () => {
    vi.stubEnv('STRAPI_URL', 'http://backend:1337');
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await strapiFetch('/api/users/me?populate=role', { headers: { A: 'b' } });

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend:1337/api/users/me?populate=role',
      expect.objectContaining({ cache: 'no-store', headers: { A: 'b' } }),
    );
  });

  it('passes 4xx responses through', async () => {
    vi.stubEnv('STRAPI_URL', 'http://backend:1337');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 400 })));

    expect((await strapiFetch('/api/auth/local')).status).toBe(400);
  });

  it('throws StrapiUnavailableError with the status on 429 and 5xx', async () => {
    vi.stubEnv('STRAPI_URL', 'http://backend:1337');
    for (const status of [429, 500, 503]) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status })));

      const error = await strapiFetch('/api/auth/local').catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(StrapiUnavailableError);
      expect((error as StrapiUnavailableError).status).toBe(status);
    }
  });

  it('throws StrapiUnavailableError on a network failure and without STRAPI_URL', async () => {
    vi.stubEnv('STRAPI_URL', 'http://backend:1337');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    await expect(strapiFetch('/api/auth/local')).rejects.toBeInstanceOf(StrapiUnavailableError);

    vi.stubEnv('STRAPI_URL', '');
    await expect(strapiFetch('/api/auth/local')).rejects.toBeInstanceOf(StrapiUnavailableError);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd /project/devops2/frontend && npx vitest run tests/unit/session.test.ts tests/unit/strapi.test.ts`
Expected: FAIL — modules `@/lib/jwt`, `@/lib/session-decision`, `@/lib/session-cookies`, `@/services/strapi` do not exist.

- [ ] **Step 4: Implement**

`frontend/lib/jwt.ts`:

```ts
export function accessTokenExpiry(token: string): number | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as {
      exp?: unknown;
    };
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}
```

`frontend/lib/session-decision.ts`:

```ts
import { accessTokenExpiry } from './jwt';

export type SessionDecision = 'pass' | 'refresh' | 'login';

export const EXPIRY_SKEW_SECONDS = 30;

export function decide(input: { access?: string; refresh?: string; now: number }): SessionDecision {
  if (!input.refresh) return 'login';
  if (input.access) {
    const expiry = accessTokenExpiry(input.access);
    if (expiry !== null && expiry - EXPIRY_SKEW_SECONDS > input.now) return 'pass';
  }
  return 'refresh';
}
```

`frontend/lib/session-cookies.ts`:

```ts
import { accessTokenExpiry } from './jwt';

export const ACCESS_COOKIE = 'qp_access';
export const REFRESH_COOKIE = 'qp_refresh';
export const REFRESH_MAX_AGE = 30 * 24 * 60 * 60;
const DEFAULT_ACCESS_MAX_AGE = 10 * 60;

export type SessionTokens = { access: string; refresh: string };

export type CookieOptions = {
  httpOnly: true;
  sameSite: 'lax';
  path: '/';
  secure: boolean;
  maxAge: number;
};

export type CookieWriter = { set(name: string, value: string, options: CookieOptions): unknown };

function options(maxAge: number): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge,
  };
}

function accessMaxAge(access: string, now: number): number {
  const expiry = accessTokenExpiry(access);
  return expiry === null ? DEFAULT_ACCESS_MAX_AGE : Math.max(0, expiry - now);
}

export function nowInSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function writeSession(store: CookieWriter, tokens: SessionTokens, now: number): void {
  store.set(ACCESS_COOKIE, tokens.access, options(accessMaxAge(tokens.access, now)));
  store.set(REFRESH_COOKIE, tokens.refresh, options(REFRESH_MAX_AGE));
}

export function clearSession(store: CookieWriter): void {
  store.set(ACCESS_COOKIE, '', options(0));
  store.set(REFRESH_COOKIE, '', options(0));
}
```

`frontend/services/strapi.ts`:

```ts
export class StrapiUnavailableError extends Error {
  readonly status?: number;

  constructor(status?: number, cause?: unknown) {
    super('Strapi is unavailable', { cause });
    this.name = 'StrapiUnavailableError';
    this.status = status;
  }
}

export async function strapiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const base = process.env.STRAPI_URL;
  if (!base) throw new StrapiUnavailableError(undefined, new Error('STRAPI_URL is not set'));
  let response: Response;
  try {
    response = await fetch(new URL(path, base).toString(), { ...init, cache: 'no-store' });
  } catch (error) {
    throw new StrapiUnavailableError(undefined, error);
  }
  if (response.status === 429 || response.status >= 500) {
    throw new StrapiUnavailableError(response.status);
  }
  return response;
}
```

Delete `frontend/services/.gitkeep`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd /project/devops2/frontend && npx vitest run tests/unit/session.test.ts tests/unit/strapi.test.ts`
Expected: PASS.

- [ ] **Step 6: `STRAPI_URL` configuration, structure tests first**

In `tests/structure/test_env_example.sh`, right after the existing `NEXT_PUBLIC_API_BASE_URL` assertion, add:

```bash
assert_contains "$ENV_FILE" "^STRAPI_URL=" "$ENV_FILE documents STRAPI_URL"
```

In `tests/structure/test_docker_compose.sh`, right after the `frontend depends_on backend` check, add:

```bash
check_model "data['services']['frontend'].get('environment', {}).get('STRAPI_URL') == 'http://backend:1337'" \
    "frontend reaches Strapi server-side at http://backend:1337 (STRAPI_URL)"
```

Run both scripts and see the two new checks fail. Then add `STRAPI_URL=https://your-backend.example.com` to `.env.example` on the line after `NEXT_PUBLIC_API_BASE_URL=…`, and `STRAPI_URL: http://backend:1337` under `frontend.environment` in `docker-compose.yml` (after `NEXT_PUBLIC_API_BASE_URL`). Run both scripts again: all checks pass. If a structure test asserts the exact set of `.env.example` keys, add `STRAPI_URL` to that expected set.

- [ ] **Step 7: Regression gate, then commit**

```bash
cd /project/devops2
git add frontend/vitest.config.ts frontend/lib/jwt.ts frontend/lib/session-decision.ts frontend/lib/session-cookies.ts frontend/services/strapi.ts frontend/tests/unit/session.test.ts frontend/tests/unit/strapi.test.ts .env.example docker-compose.yml tests/structure/test_env_example.sh tests/structure/test_docker_compose.sh
git rm -q frontend/services/.gitkeep
git commit -F - <<'EOF'
T063: session primitives for the frontend BFF

JWT expiry reading, the pass/refresh/login decision, httpOnly session
cookies and a server-only Strapi fetch on STRAPI_URL (http://backend:1337
in Docker Compose).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018oex3Jpgz8jfd3XAQ58F4t
EOF
```

---

### Task 3: `authService` and the "Mes questionnaires" read

**Files:**
- Create: `frontend/services/authService.ts`, `frontend/services/mesQuestionnaires.ts`
- Create: `frontend/tests/unit/authService.test.ts`, `frontend/tests/unit/mesQuestionnaires.test.ts`

**Interfaces:**
- Consumes: `strapiFetch`, `StrapiUnavailableError` (`services/strapi.ts`); `SessionTokens` (`lib/session-cookies.ts`); `logger` (`lib/logger.ts`).
- Produces (`services/authService.ts`):
  - `STRAPI_REFRESH_COOKIE = 'strapi_up_refresh'`
  - `type AuthorRole = 'auteur' | 'administrateur'`; `type Author = { id: number; nom: string; email: string; role: AuthorRole }`
  - `type LoginFailure = 'invalid' | 'forbidden-role' | 'unavailable'`
  - `type LoginResult = { ok: true; tokens: SessionTokens; author: Author } | { ok: false; reason: LoginFailure }`
  - `type RefreshResult = { ok: true; tokens: SessionTokens } | { ok: false; reason: 'rejected' | 'unavailable' }`
  - `login(email: string, password: string): Promise<LoginResult>`; `refresh(refreshToken: string): Promise<RefreshResult>`; `logout(tokens: SessionTokens): Promise<void>` (never throws for Strapi unavailability); `currentUser(access: string): Promise<Author | null>` (throws `StrapiUnavailableError` when Strapi is down)
- Produces (`services/mesQuestionnaires.ts`):
  - `type Statut = 'brouillon' | 'publie' | 'ferme'`; `type SommaireItem = { documentId: string; titre: string; statut: Statut; updatedAt: string }`; `type SommaireState = { kind: 'list'; items: SommaireItem[] } | { kind: 'error' }`
  - `listMine(access: string): Promise<SommaireState>`

- [ ] **Step 1: Write the failing tests**

Create `frontend/tests/unit/authService.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { currentUser, login, logout, refresh } from '@/services/authService';

type Call = { method: string; path: string; headers: Record<string, string>; body: unknown };
type Route = () => Response | Promise<Response>;

let write: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.stubEnv('STRAPI_URL', 'http://backend:1337');
  write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  write.mockRestore();
});

function logged(): string {
  return write.mock.calls.map(([line]) => String(line)).join('');
}

function stubStrapi(routes: Record<string, Route>): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const target = new URL(url);
      const method = init.method ?? 'GET';
      const path = `${target.pathname}${target.search}`;
      calls.push({
        method,
        path,
        headers: Object.fromEntries(new Headers(init.headers).entries()),
        body: init.body ? JSON.parse(String(init.body)) : undefined,
      });
      const route = routes[`${method} ${path}`];
      if (!route) throw new Error(`unexpected ${method} ${path}`);
      return route();
    }),
  );
  return calls;
}

function json(body: unknown, status = 200, setCookie?: string): Response {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (setCookie) headers.append('Set-Cookie', setCookie);
  return new Response(JSON.stringify(body), { status, headers });
}

const REFRESH_SET_COOKIE = 'strapi_up_refresh=refresh-1; Path=/; HttpOnly; SameSite=Lax';

function me(type: string) {
  return () => json({ id: 7, email: 'prof@example.test', nom: 'Prof Dupont', role: { type } });
}

describe('login', () => {
  it('returns the tokens and the author for an auteur', async () => {
    const calls = stubStrapi({
      'POST /api/auth/local': () => json({ jwt: 'access-1', user: { id: 7 } }, 200, REFRESH_SET_COOKIE),
      'GET /api/users/me?populate=role': me('auteur'),
    });

    const result = await login('prof@example.test', 'Passw0rd!');

    expect(result).toEqual({
      ok: true,
      tokens: { access: 'access-1', refresh: 'refresh-1' },
      author: { id: 7, email: 'prof@example.test', nom: 'Prof Dupont', role: 'auteur' },
    });
    expect(calls[0].body).toEqual({ identifier: 'prof@example.test', password: 'Passw0rd!' });
    expect(calls[1].headers.authorization).toBe('Bearer access-1');
  });

  it('accepts an administrateur', async () => {
    stubStrapi({
      'POST /api/auth/local': () => json({ jwt: 'access-1' }, 200, REFRESH_SET_COOKIE),
      'GET /api/users/me?populate=role': me('administrateur'),
    });

    const result = await login('admin@example.test', 'Passw0rd!');

    expect(result.ok && result.author.role).toBe('administrateur');
  });

  it('maps a rejected login to invalid', async () => {
    for (const status of [400, 401, 403]) {
      stubStrapi({ 'POST /api/auth/local': () => json({ error: { status } }, status) });

      expect(await login('prof@example.test', 'wrong')).toEqual({ ok: false, reason: 'invalid' });
    }
  });

  it('refuses a repondant and revokes its fresh session', async () => {
    const calls = stubStrapi({
      'POST /api/auth/local': () => json({ jwt: 'access-1' }, 200, REFRESH_SET_COOKIE),
      'GET /api/users/me?populate=role': () => json({ error: { status: 403 } }, 403),
      'POST /api/auth/logout': () => json({ ok: true }),
    });

    const result = await login('etudiant@example.test', 'Passw0rd!');

    expect(result).toEqual({ ok: false, reason: 'forbidden-role' });
    const revoke = calls.find((call) => call.path === '/api/auth/logout');
    expect(revoke?.headers.authorization).toBe('Bearer access-1');
    expect(revoke?.headers.cookie).toBe('strapi_up_refresh=refresh-1');
  });

  it('refuses an account whose role is readable but not an author role', async () => {
    const calls = stubStrapi({
      'POST /api/auth/local': () => json({ jwt: 'access-1' }, 200, REFRESH_SET_COOKIE),
      'GET /api/users/me?populate=role': me('repondant'),
      'POST /api/auth/logout': () => json({ ok: true }),
    });

    expect(await login('etudiant@example.test', 'Passw0rd!')).toEqual({
      ok: false,
      reason: 'forbidden-role',
    });
    expect(calls.map((call) => call.path)).toContain('/api/auth/logout');
  });

  it('maps 429 and 5xx to unavailable and logs the status only', async () => {
    for (const status of [429, 500, 503]) {
      stubStrapi({ 'POST /api/auth/local': () => json({}, status) });

      expect(await login('prof@example.test', 'Passw0rd!')).toEqual({
        ok: false,
        reason: 'unavailable',
      });
    }
    expect(logged()).toContain('auth.login.unavailable');
    expect(logged()).not.toContain('Passw0rd!');
    expect(logged()).not.toContain('prof@example.test');
  });

  it('maps a network failure to unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

    expect(await login('prof@example.test', 'Passw0rd!')).toEqual({
      ok: false,
      reason: 'unavailable',
    });
  });

  it('treats a login response without refresh cookie as unavailable', async () => {
    stubStrapi({ 'POST /api/auth/local': () => json({ jwt: 'access-1' }) });

    expect(await login('prof@example.test', 'Passw0rd!')).toEqual({
      ok: false,
      reason: 'unavailable',
    });
    expect(logged()).toContain('auth.login.unexpected-response');
    expect(logged()).not.toContain('access-1');
  });
});

describe('refresh', () => {
  it('returns the new access token and the rotated refresh token', async () => {
    const calls = stubStrapi({
      'POST /api/auth/refresh': () =>
        json({ jwt: 'access-2' }, 200, 'strapi_up_refresh=refresh-2; Path=/; HttpOnly'),
    });

    expect(await refresh('refresh-1')).toEqual({
      ok: true,
      tokens: { access: 'access-2', refresh: 'refresh-2' },
    });
    expect(calls[0].headers.cookie).toBe('strapi_up_refresh=refresh-1');
  });

  it('reports a refused refresh token as rejected', async () => {
    stubStrapi({ 'POST /api/auth/refresh': () => json({ error: { status: 401 } }, 401) });

    expect(await refresh('revoked')).toEqual({ ok: false, reason: 'rejected' });
  });

  it('reports an unreachable Strapi as unavailable and logs it', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

    expect(await refresh('refresh-1')).toEqual({ ok: false, reason: 'unavailable' });
    expect(logged()).toContain('auth.refresh.failed');
    expect(logged()).not.toContain('refresh-1');
  });
});

describe('logout', () => {
  it('sends the bearer token and the refresh cookie', async () => {
    const calls = stubStrapi({ 'POST /api/auth/logout': () => json({ ok: true }) });

    await logout({ access: 'access-1', refresh: 'refresh-1' });

    expect(calls[0].headers.authorization).toBe('Bearer access-1');
    expect(calls[0].headers.cookie).toBe('strapi_up_refresh=refresh-1');
  });

  it('logout never throws when Strapi is unreachable or refuses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    await expect(logout({ access: 'a', refresh: 'r' })).resolves.toBeUndefined();

    stubStrapi({ 'POST /api/auth/logout': () => json({}, 401) });
    await expect(logout({ access: 'a', refresh: 'r' })).resolves.toBeUndefined();
    expect(logged()).toContain('auth.logout.failed');
  });
});

describe('currentUser', () => {
  it('returns the author for a valid author token', async () => {
    stubStrapi({ 'GET /api/users/me?populate=role': me('auteur') });

    expect(await currentUser('access-1')).toEqual({
      id: 7,
      email: 'prof@example.test',
      nom: 'Prof Dupont',
      role: 'auteur',
    });
  });

  it('returns null for a refused token or a non-author role', async () => {
    stubStrapi({ 'GET /api/users/me?populate=role': () => json({}, 401) });
    expect(await currentUser('expired')).toBeNull();

    stubStrapi({ 'GET /api/users/me?populate=role': me('repondant') });
    expect(await currentUser('access-1')).toBeNull();
  });
});
```

Create `frontend/tests/unit/mesQuestionnaires.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listMine } from '@/services/mesQuestionnaires';

let write: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.stubEnv('STRAPI_URL', 'http://backend:1337');
  write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  write.mockRestore();
});

describe('listMine', () => {
  it('returns the list in the order Strapi sends it, with the bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            { id: 2, documentId: 'b', titre: 'Séance 4', statut: 'brouillon', updatedAt: '2026-09-24T08:00:00.000Z', description: null, visibilite: 'publique', createdAt: '2026-09-24T08:00:00.000Z' },
            { id: 1, documentId: 'a', titre: 'Séance 3', statut: 'publie', updatedAt: '2026-09-20T08:00:00.000Z', description: null, visibilite: 'privee', createdAt: '2026-09-20T08:00:00.000Z' },
          ],
          meta: {},
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    expect(await listMine('access-1')).toEqual({
      kind: 'list',
      items: [
        { documentId: 'b', titre: 'Séance 4', statut: 'brouillon', updatedAt: '2026-09-24T08:00:00.000Z' },
        { documentId: 'a', titre: 'Séance 3', statut: 'publie', updatedAt: '2026-09-20T08:00:00.000Z' },
      ],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend:1337/api/mes-questionnaires',
      expect.objectContaining({ headers: { Authorization: 'Bearer access-1' } }),
    );
  });

  it('returns an empty list', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [], meta: {} }), { status: 200 })),
    );

    expect(await listMine('access-1')).toEqual({ kind: 'list', items: [] });
  });

  it('returns the error state on a refused call or an unreachable Strapi, and logs it', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 403 })));
    expect(await listMine('access-1')).toEqual({ kind: 'error' });

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    expect(await listMine('access-1')).toEqual({ kind: 'error' });

    const logged = write.mock.calls.map(([line]) => String(line)).join('');
    expect(logged).toContain('questionnaires.list.failed');
    expect(logged).not.toContain('access-1');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /project/devops2/frontend && npx vitest run tests/unit/authService.test.ts tests/unit/mesQuestionnaires.test.ts`
Expected: FAIL — `@/services/authService` and `@/services/mesQuestionnaires` do not exist.

- [ ] **Step 3: Implement `services/authService.ts`**

```ts
import { logger } from '@/lib/logger';
import type { SessionTokens } from '@/lib/session-cookies';
import { StrapiUnavailableError, strapiFetch } from './strapi';

export const STRAPI_REFRESH_COOKIE = 'strapi_up_refresh';

const AUTHOR_ROLES = ['auteur', 'administrateur'] as const;

export type AuthorRole = (typeof AUTHOR_ROLES)[number];
export type Author = { id: number; nom: string; email: string; role: AuthorRole };
export type LoginFailure = 'invalid' | 'forbidden-role' | 'unavailable';
export type LoginResult =
  | { ok: true; tokens: SessionTokens; author: Author }
  | { ok: false; reason: LoginFailure };
export type RefreshResult =
  | { ok: true; tokens: SessionTokens }
  | { ok: false; reason: 'rejected' | 'unavailable' };

type MeBody = { id?: unknown; nom?: unknown; email?: unknown; role?: { type?: unknown } | null };

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function refreshTokenFrom(response: Response): string | null {
  for (const header of response.headers.getSetCookie()) {
    const [pair] = header.split(';');
    const separator = pair.indexOf('=');
    if (separator > 0 && pair.slice(0, separator).trim() === STRAPI_REFRESH_COOKIE) {
      const value = pair.slice(separator + 1).trim();
      return value === '' ? null : value;
    }
  }
  return null;
}

function isAuthorRole(value: unknown): value is AuthorRole {
  return typeof value === 'string' && (AUTHOR_ROLES as readonly string[]).includes(value);
}

function toAuthor(body: MeBody): Author | null {
  const role = body.role?.type;
  if (typeof body.id !== 'number' || typeof body.email !== 'string' || !isAuthorRole(role)) {
    return null;
  }
  return { id: body.id, email: body.email, nom: typeof body.nom === 'string' ? body.nom : body.email, role };
}

async function readAuthor(access: string): Promise<Author | null> {
  const response = await strapiFetch('/api/users/me?populate=role', {
    headers: { Authorization: `Bearer ${access}` },
  });
  if (!response.ok) return null;
  return toAuthor((await response.json()) as MeBody);
}

async function sessionTokensFrom(response: Response): Promise<SessionTokens | null> {
  const body = (await response.json()) as { jwt?: unknown };
  const refreshToken = refreshTokenFrom(response);
  if (typeof body.jwt !== 'string' || refreshToken === null) return null;
  return { access: body.jwt, refresh: refreshToken };
}

export async function login(email: string, password: string): Promise<LoginResult> {
  try {
    const response = await strapiFetch('/api/auth/local', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ identifier: email, password }),
    });
    if (!response.ok) return { ok: false, reason: 'invalid' };
    const tokens = await sessionTokensFrom(response);
    if (tokens === null) {
      logger.error('auth.login.unexpected-response', { status: response.status });
      return { ok: false, reason: 'unavailable' };
    }
    const author = await readAuthor(tokens.access);
    if (author === null) {
      await logout(tokens);
      return { ok: false, reason: 'forbidden-role' };
    }
    return { ok: true, tokens, author };
  } catch (error) {
    if (!(error instanceof StrapiUnavailableError)) throw error;
    logger.error('auth.login.unavailable', { status: error.status });
    return { ok: false, reason: 'unavailable' };
  }
}

export async function refresh(refreshToken: string): Promise<RefreshResult> {
  try {
    const response = await strapiFetch('/api/auth/refresh', {
      method: 'POST',
      headers: { ...JSON_HEADERS, Cookie: `${STRAPI_REFRESH_COOKIE}=${refreshToken}` },
      body: '{}',
    });
    if (!response.ok) return { ok: false, reason: 'rejected' };
    const tokens = await sessionTokensFrom(response);
    return tokens === null ? { ok: false, reason: 'rejected' } : { ok: true, tokens };
  } catch (error) {
    if (!(error instanceof StrapiUnavailableError)) throw error;
    logger.warn('auth.refresh.failed', { status: error.status });
    return { ok: false, reason: 'unavailable' };
  }
}

export async function logout(tokens: SessionTokens): Promise<void> {
  try {
    const response = await strapiFetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        ...JSON_HEADERS,
        Authorization: `Bearer ${tokens.access}`,
        Cookie: `${STRAPI_REFRESH_COOKIE}=${tokens.refresh}`,
      },
      body: '{}',
    });
    if (!response.ok) logger.warn('auth.logout.failed', { status: response.status });
  } catch (error) {
    if (!(error instanceof StrapiUnavailableError)) throw error;
    logger.warn('auth.logout.failed', { status: error.status });
  }
}

export async function currentUser(access: string): Promise<Author | null> {
  return readAuthor(access);
}
```

- [ ] **Step 4: Implement `services/mesQuestionnaires.ts`**

```ts
import { logger } from '@/lib/logger';
import { StrapiUnavailableError, strapiFetch } from './strapi';

export type Statut = 'brouillon' | 'publie' | 'ferme';
export type SommaireItem = { documentId: string; titre: string; statut: Statut; updatedAt: string };
export type SommaireState = { kind: 'list'; items: SommaireItem[] } | { kind: 'error' };

type ListBody = { data?: SommaireItem[] };

export async function listMine(access: string): Promise<SommaireState> {
  try {
    const response = await strapiFetch('/api/mes-questionnaires', {
      headers: { Authorization: `Bearer ${access}` },
    });
    if (!response.ok) {
      logger.warn('questionnaires.list.failed', { status: response.status });
      return { kind: 'error' };
    }
    const body = (await response.json()) as ListBody;
    const items = (body.data ?? []).map(({ documentId, titre, statut, updatedAt }) => ({
      documentId,
      titre,
      statut,
      updatedAt,
    }));
    return { kind: 'list', items };
  } catch (error) {
    if (!(error instanceof StrapiUnavailableError)) throw error;
    logger.warn('questionnaires.list.failed', { status: error.status });
    return { kind: 'error' };
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd /project/devops2/frontend && npx vitest run tests/unit/authService.test.ts tests/unit/mesQuestionnaires.test.ts`
Expected: PASS.

- [ ] **Step 6: Regression gate, then commit**

```bash
cd /project/devops2
git add frontend/services/authService.ts frontend/services/mesQuestionnaires.ts frontend/tests/unit/authService.test.ts frontend/tests/unit/mesQuestionnaires.test.ts
git commit -F - <<'EOF'
T063: authService (login, refresh, logout, current author) and listMine

Login keeps only auteur and administrateur accounts and revokes any other
fresh session; 429 and 5xx read as "unavailable", never as a wrong
password. Logs carry status codes only.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018oex3Jpgz8jfd3XAQ58F4t
EOF
```

---

### Task 4: The "Cahier Seyès" world — direction contract, theme, root layout, components

**Files:**
- Create (impeccable, not source): the surface brief via `impeccable surface-brief write` (the script decides its path; it must not be under `frontend/app`, `frontend/public` or anything served)
- Modify: `frontend/app/globals.css`, `frontend/app/layout.tsx`
- Create: `frontend/lib/login-state.ts`
- Create: `frontend/components/Feuille.tsx`, `frontend/components/ChampLigne.tsx`, `frontend/components/AnnotationErreur.tsx`, `frontend/components/TamponStatut.tsx`, `frontend/components/Sommaire.tsx`, `frontend/components/LoginFormView.tsx`
- Delete: `frontend/components/.gitkeep`
- Create: `frontend/tests/unit/components.test.tsx`

**Interfaces:**
- Consumes: `Statut`, `SommaireItem`, `SommaireState` (`services/mesQuestionnaires.ts`, type-only).
- Produces:
  - `lib/login-state.ts`: `type LoginFormState = { message: string | null; email: string }`, `INITIAL_LOGIN_STATE: LoginFormState = { message: null, email: '' }`, `LOGIN_MESSAGES` = `{ missing, invalid, 'forbidden-role', unavailable }` (exact strings from Global Constraints)
  - `Feuille({ marge, children })`, `ChampLigne({ id, name, label, type, autoComplete, defaultValue?, invalid?, describedBy? })`, `AnnotationErreur({ id, children })`, `TamponStatut({ statut })`, `Sommaire({ state })`, `LoginFormView({ state, action, pending })` — all default-free named exports, presentational only (no data fetching, no `next/headers`).

This task is design work. Before editing any UI file, read `/project/devops2/.claude/skills/impeccable/reference/craft-floor.md` in full and apply it (browser surfaces themed: selection, caret, focus, underline offset, tabular numerals). The code below is the required structure and behaviour; you may refine class lists for craft (spacing, sizes, states) as long as every test below passes unchanged, every token stays in the palette, and nothing is added outside the spec.

- [ ] **Step 1: Record the direction contract in the surface brief (before any UI code)**

Write this body to a scratch file (e.g. `/tmp/claude-1000/-project-devops2/f0c0f41e-6d12-45e7-a390-b175e6f2473f/scratchpad/brief-t063.md`), then run from `/project/devops2`:
`/project/devops2/.claude/skills/impeccable/scripts/impeccable surface-brief write frontend/app/login/page.tsx <scratch-file> frontend/app/questionnaires/page.tsx frontend/app/questionnaires/layout.tsx`
then `/project/devops2/.claude/skills/impeccable/scripts/impeccable surface-brief read frontend/app/login/page.tsx` and check the six blocks and the seed key are present. Stage the brief file the script wrote (report its path).

```markdown
# Espace auteur — connexion et « Mes questionnaires »

Scope: `/login` and the protected `/questionnaires` home of the author space (T063). Visitor mode: Operate. Audience: the instructor (auteur) or an administrateur, preparing at a desk, laptop, daylight. Job: sign in, see their questionnaires and their statut, sign out. Constraints: French only, light theme only, no « hacker » look, no Google Forms clone; T022–T024 extend this world, they do not reinvent it.

## Direction contract

THESIS: The author space is a course notebook: every questionnaire is written in ink on a Seyès-ruled page and the red margin holds the structure. It refuses the category default of a centred white card on a grey dashboard.

OWN-WORLD: Near-white paper #fbfbf8, pale Seyès ruling (#dce3f3 every 8 px, #b9c6e8 every 32 px, faint verticals), a 2 px red margin rule #d8343a as the structural rail, ink blue #1f3fa8 for actions and focus, graphite #2b2b2b text, red pen #c62828 for errors only. Fields are written on a ruling line; focus circles the control in ink; statuts are stamps (pencil dashed « brouillon », ink tilted « PUBLIÉ », grey « FERMÉ »). Atkinson Hyperlegible Next, 17 px on 32 px lines.

STORY: The author recognises their own notebook, signs in without friction, and reads their questionnaires like a table of contents: what exists, in which state, most recent first.

FIRST VIEWPORT: `/login` — one full-viewport ruled sheet; « Espace auteur » in the margin at top; a ~28 rem column with « Connexion » written on a line, Email and Mot de passe on ruling lines, « Se connecter » in solid ink two lines below. `/questionnaires` — margin « Espace auteur »; a header line with the author's name and « Se déconnecter »; « Mes questionnaires »; numbered entries with the number in the margin, dotted leader, statut stamp, « modifié le … ».

FORM: Cahier Seyès, assigned direction (position 3 of the ordered grounded list), seed key 8d74740c; raises: lifecycle steps stay visible (Orizuru), state marked with a pen (convention catalog), empty state as invitation (drum machine), total palette commitment (Datamatics), one colour law per statut (rain garden).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
```

- [ ] **Step 2: Write the failing component tests**

Create `frontend/tests/unit/components.test.tsx`:

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LoginFormView } from '@/components/LoginFormView';
import { Sommaire } from '@/components/Sommaire';
import { TamponStatut } from '@/components/TamponStatut';
import { INITIAL_LOGIN_STATE, LOGIN_MESSAGES } from '@/lib/login-state';

function text(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

describe('LOGIN_MESSAGES', () => {
  it('holds the exact French messages', () => {
    expect(LOGIN_MESSAGES).toEqual({
      missing: 'Renseignez votre email et votre mot de passe.',
      invalid: 'Email ou mot de passe incorrect.',
      'forbidden-role': "Ce compte n'a pas accès à l'espace auteur.",
      unavailable: 'Le service est momentanément indisponible. Réessayez dans un instant.',
    });
    expect(INITIAL_LOGIN_STATE).toEqual({ message: null, email: '' });
  });
});

describe('TamponStatut', () => {
  it('labels each statut', () => {
    expect(text(renderToStaticMarkup(<TamponStatut statut="brouillon" />))).toBe('brouillon');
    expect(text(renderToStaticMarkup(<TamponStatut statut="publie" />))).toBe('PUBLIÉ');
    expect(text(renderToStaticMarkup(<TamponStatut statut="ferme" />))).toBe('FERMÉ');
  });

  it('gives each statut its own colour law', () => {
    const brouillon = renderToStaticMarkup(<TamponStatut statut="brouillon" />);
    const publie = renderToStaticMarkup(<TamponStatut statut="publie" />);
    const ferme = renderToStaticMarkup(<TamponStatut statut="ferme" />);

    expect(brouillon).toContain('border-dashed');
    expect(brouillon).toContain('text-crayon');
    expect(publie).toContain('text-encre');
    expect(ferme).toContain('text-tampon');
  });
});

describe('Sommaire', () => {
  const items = [
    { documentId: 'b', titre: 'Retour séance 4', statut: 'brouillon' as const, updatedAt: '2026-09-24T08:00:00.000Z' },
    { documentId: 'a', titre: 'Retour séance 3', statut: 'publie' as const, updatedAt: '2026-09-20T08:00:00.000Z' },
  ];

  it('lists the questionnaires in the given order, numbered, with statut and date', () => {
    const html = renderToStaticMarkup(<Sommaire state={{ kind: 'list', items }} />);
    const content = text(html);

    expect(html).toContain('<ol');
    expect(content.indexOf('Retour séance 4')).toBeLessThan(content.indexOf('Retour séance 3'));
    expect(content).toContain('1.');
    expect(content).toContain('2.');
    expect(content).toContain('brouillon');
    expect(content).toContain('PUBLIÉ');
    expect(content).toContain('modifié le 24 septembre 2026');
  });

  it('shows the empty state as an invitation', () => {
    const content = text(renderToStaticMarkup(<Sommaire state={{ kind: 'list', items: [] }} />));

    expect(content).toBe('Vos questionnaires apparaîtront ici.');
  });

  it('shows the error with a retry link', () => {
    const html = renderToStaticMarkup(<Sommaire state={{ kind: 'error' }} />);

    expect(text(html)).toContain('Impossible de charger vos questionnaires.');
    expect(html).toMatch(/<a[^>]*href="\/questionnaires"[^>]*>Réessayer<\/a>/);
    expect(html).toContain('role="alert"');
  });
});

describe('LoginFormView', () => {
  const noop = () => undefined;

  it('renders labelled email and password fields and the submit button', () => {
    const html = renderToStaticMarkup(
      <LoginFormView state={INITIAL_LOGIN_STATE} action={noop} pending={false} />,
    );

    expect(html).toMatch(/<label[^>]*for="email"[^>]*>Email<\/label>/);
    expect(html).toMatch(/<input[^>]*id="email"[^>]*>/);
    expect(html).toMatch(/<label[^>]*for="password"[^>]*>Mot de passe<\/label>/);
    expect(html).toMatch(/<input[^>]*type="password"[^>]*>/);
    expect(html).toContain('autocomplete="current-password"');
    expect(text(html)).toContain('Se connecter');
    expect(html).not.toContain('role="alert"');
  });

  it('shows each error message as an alert tied to the fields and keeps the email', () => {
    for (const message of Object.values(LOGIN_MESSAGES)) {
      const html = renderToStaticMarkup(
        <LoginFormView state={{ message, email: 'prof@example.test' }} action={noop} pending={false} />,
      );

      expect(html).toContain('role="alert"');
      expect(text(html).replaceAll('&#x27;', "'")).toContain(message);
      expect(html).toContain('aria-invalid="true"');
      expect(html).toMatch(/aria-describedby="connexion-erreur"/);
      expect(html).toContain('value="prof@example.test"');
    }
  });

  it('disables the button while pending', () => {
    const html = renderToStaticMarkup(
      <LoginFormView state={INITIAL_LOGIN_STATE} action={noop} pending={true} />,
    );

    expect(html).toMatch(/<button[^>]*disabled=""/);
  });
});
```

`renderToStaticMarkup` writes `autoComplete` as `autocomplete` and escapes `'` as `&#x27;`, hence those two assertions' forms.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd /project/devops2/frontend && npx vitest run tests/unit/components.test.tsx`
Expected: FAIL — the component and `login-state` modules do not exist. If Vitest cannot transform JSX at all, fix the transform in `vitest.config.ts` (e.g. `oxc: { jsx: { runtime: 'automatic' } }` or `esbuild: { jsx: 'automatic' }` depending on what the installed Vitest accepts) and record it.

- [ ] **Step 4: Theme and root layout**

Replace `frontend/app/globals.css` with:

```css
@import 'tailwindcss';

@theme {
  --color-papier: #fbfbf8;
  --color-reglure: #dce3f3;
  --color-reglure-forte: #b9c6e8;
  --color-marge: #d8343a;
  --color-encre: #1f3fa8;
  --color-encre-sombre: #182f7e;
  --color-graphite: #2b2b2b;
  --color-graphite-doux: #5b5f6b;
  --color-crayon: #616161;
  --color-tampon: #707070;
  --color-stylo-rouge: #c62828;
  --font-sans: var(--font-atkinson), ui-sans-serif, system-ui, sans-serif;
  --spacing-ligne: 32px;
}

:root {
  color-scheme: light;
  --marge-x: 96px;
}

@media (max-width: 639px) {
  :root {
    --marge-x: 20px;
  }
}

html {
  background: var(--color-papier);
}

body {
  background: var(--color-papier);
  color: var(--color-graphite);
  font-family: var(--font-sans);
  font-size: 17px;
  line-height: 32px;
  caret-color: var(--color-encre);
  scrollbar-color: var(--color-reglure-forte) var(--color-papier);
}

::selection {
  background: var(--color-reglure-forte);
  color: var(--color-graphite);
}

a {
  text-underline-offset: 4px;
}

.feuille {
  background-color: var(--color-papier);
  background-image:
    linear-gradient(
      to right,
      transparent calc(var(--marge-x) - 1px),
      var(--color-marge) calc(var(--marge-x) - 1px),
      var(--color-marge) calc(var(--marge-x) + 1px),
      transparent calc(var(--marge-x) + 1px)
    ),
    repeating-linear-gradient(
      to bottom,
      transparent 0 31px,
      var(--color-reglure-forte) 31px 32px
    ),
    repeating-linear-gradient(to bottom, transparent 0 7px, var(--color-reglure) 7px 8px),
    repeating-linear-gradient(
      to right,
      transparent 0 31px,
      color-mix(in srgb, var(--color-reglure) 55%, transparent) 31px 32px
    );
}

.entoure:focus-visible {
  outline: 2px solid var(--color-encre);
  outline-offset: 6px;
  border-radius: 999px;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    transition-duration: 0ms !important;
  }
}
```

Replace `frontend/app/layout.tsx` with:

```tsx
import type { Metadata } from 'next';
import { Atkinson_Hyperlegible_Next } from 'next/font/google';
import './globals.css';

const atkinson = Atkinson_Hyperlegible_Next({
  variable: '--font-atkinson',
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '700'],
});

export const metadata: Metadata = {
  title: 'Espace auteur — Questionnaires',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="fr" className={`${atkinson.variable} antialiased`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
```

- [ ] **Step 5: `lib/login-state.ts` and the components**

`frontend/lib/login-state.ts`:

```ts
export type LoginFormState = { message: string | null; email: string };

export const INITIAL_LOGIN_STATE: LoginFormState = { message: null, email: '' };

export const LOGIN_MESSAGES = {
  missing: 'Renseignez votre email et votre mot de passe.',
  invalid: 'Email ou mot de passe incorrect.',
  'forbidden-role': "Ce compte n'a pas accès à l'espace auteur.",
  unavailable: 'Le service est momentanément indisponible. Réessayez dans un instant.',
} as const;
```

`frontend/components/Feuille.tsx`:

```tsx
import type { ReactNode } from 'react';

export function Feuille({ marge, children }: { marge: ReactNode; children: ReactNode }) {
  return (
    <div className="feuille min-h-dvh">
      <div className="grid min-h-dvh grid-cols-1 sm:grid-cols-[var(--marge-x)_1fr]">
        <div className="px-8 pt-ligne text-sm font-bold uppercase tracking-wide text-graphite-doux sm:px-3 sm:text-right">
          {marge}
        </div>
        <main className="px-8 pb-[calc(var(--spacing-ligne)*3)] sm:pt-ligne sm:pr-10 sm:pl-10">
          {children}
        </main>
      </div>
    </div>
  );
}
```

`frontend/components/AnnotationErreur.tsx`:

```tsx
import type { ReactNode } from 'react';

export function AnnotationErreur({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="relative mt-ligne leading-[32px] text-stylo-rouge">
      <span aria-hidden="true" className="absolute -left-5 font-bold sm:-left-14">
        !
      </span>
      {children}
    </p>
  );
}
```

`frontend/components/ChampLigne.tsx`:

```tsx
type ChampLigneProps = {
  id: string;
  name: string;
  label: string;
  type: 'email' | 'password';
  autoComplete: string;
  defaultValue?: string;
  invalid?: boolean;
  describedBy?: string;
};

export function ChampLigne({
  id,
  name,
  label,
  type,
  autoComplete,
  defaultValue,
  invalid,
  describedBy,
}: ChampLigneProps) {
  return (
    <div className="mt-ligne">
      <label htmlFor={id} className="block h-ligne leading-[32px] text-graphite-doux">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        required
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        className="entoure block h-ligne w-full border-b-2 border-graphite bg-papier px-1 leading-[30px] text-graphite transition-colors duration-[120ms] focus:border-encre aria-invalid:border-stylo-rouge"
      />
    </div>
  );
}
```

`frontend/components/TamponStatut.tsx`:

```tsx
import type { Statut } from '@/services/mesQuestionnaires';

const TAMPONS: Record<Statut, { label: string; className: string }> = {
  brouillon: { label: 'brouillon', className: 'border border-dashed border-crayon text-crayon' },
  publie: { label: 'PUBLIÉ', className: 'border-2 border-encre font-bold text-encre -rotate-2' },
  ferme: { label: 'FERMÉ', className: 'border-2 border-tampon font-bold text-tampon' },
};

export function TamponStatut({ statut }: { statut: Statut }) {
  const tampon = TAMPONS[statut];
  return (
    <span className={`inline-block shrink-0 rounded-sm px-2 text-sm leading-6 tracking-wide ${tampon.className}`}>
      {tampon.label}
    </span>
  );
}
```

`frontend/components/Sommaire.tsx`:

```tsx
import type { SommaireState } from '@/services/mesQuestionnaires';
import { AnnotationErreur } from './AnnotationErreur';
import { TamponStatut } from './TamponStatut';

const DATE = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/Paris',
});

export function Sommaire({ state }: { state: SommaireState }) {
  if (state.kind === 'error') {
    return (
      <AnnotationErreur id="sommaire-erreur">
        Impossible de charger vos questionnaires.{' '}
        <a href="/questionnaires" className="text-encre underline">
          Réessayer
        </a>
      </AnnotationErreur>
    );
  }
  if (state.items.length === 0) {
    return <p className="mt-ligne leading-[32px] text-crayon">Vos questionnaires apparaîtront ici.</p>;
  }
  return (
    <ol className="mt-ligne">
      {state.items.map((item, index) => (
        <li key={item.documentId} className="relative flex items-center gap-3 leading-[32px]">
          <span className="tabular-nums text-graphite-doux sm:absolute sm:-left-16 sm:w-10 sm:text-right">
            {index + 1}.
          </span>
          <span className="min-w-0 truncate">{item.titre}</span>
          <span aria-hidden="true" className="min-w-4 flex-1 translate-y-2 border-b-2 border-dotted border-reglure-forte" />
          <TamponStatut statut={item.statut} />
          <span className="hidden text-sm text-graphite-doux sm:inline">
            modifié le {DATE.format(new Date(item.updatedAt))}
          </span>
        </li>
      ))}
    </ol>
  );
}
```

If `@next/next/no-html-link-for-pages` flags the `<a>`, use `next/link`'s `Link` with the same `href` and text, and keep the test's `href="/questionnaires"` assertion.

`frontend/components/LoginFormView.tsx`:

```tsx
import type { LoginFormState } from '@/lib/login-state';
import { AnnotationErreur } from './AnnotationErreur';
import { ChampLigne } from './ChampLigne';

type LoginFormViewProps = {
  state: LoginFormState;
  action: (formData: FormData) => void;
  pending: boolean;
};

const ERREUR_ID = 'connexion-erreur';

export function LoginFormView({ state, action, pending }: LoginFormViewProps) {
  const invalid = state.message !== null;
  const describedBy = invalid ? ERREUR_ID : undefined;
  return (
    <form action={action}>
      {invalid && <AnnotationErreur id={ERREUR_ID}>{state.message}</AnnotationErreur>}
      <ChampLigne
        id="email"
        name="email"
        label="Email"
        type="email"
        autoComplete="username"
        defaultValue={state.email}
        invalid={invalid}
        describedBy={describedBy}
      />
      <ChampLigne
        id="password"
        name="password"
        label="Mot de passe"
        type="password"
        autoComplete="current-password"
        invalid={invalid}
        describedBy={describedBy}
      />
      <button
        type="submit"
        disabled={pending}
        className="entoure mt-[calc(var(--spacing-ligne)*2)] h-ligne rounded-sm bg-encre px-6 font-bold text-papier transition-[background-color,transform] duration-[120ms] hover:bg-encre-sombre active:translate-y-px disabled:cursor-wait disabled:bg-encre-sombre"
      >
        {pending ? 'Connexion…' : 'Se connecter'}
      </button>
    </form>
  );
}
```

Delete `frontend/components/.gitkeep`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd /project/devops2/frontend && npx vitest run tests/unit/components.test.tsx`
Expected: PASS. Then `npm run build` (the default `app/page.tsx` still builds; it is replaced in Task 5).

- [ ] **Step 7: Regression gate, then commit**

```bash
cd /project/devops2
git add <surface-brief-path> frontend/app/globals.css frontend/app/layout.tsx frontend/lib/login-state.ts frontend/components/Feuille.tsx frontend/components/ChampLigne.tsx frontend/components/AnnotationErreur.tsx frontend/components/TamponStatut.tsx frontend/components/Sommaire.tsx frontend/components/LoginFormView.tsx frontend/tests/unit/components.test.tsx
git rm -q frontend/components/.gitkeep
git commit -F - <<'EOF'
T063: Cahier Seyès world — theme tokens, root layout, author-space components

Direction contract recorded in the surface brief (seed 8d74740c) before
any UI code; presentational components only.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018oex3Jpgz8jfd3XAQ58F4t
EOF
```

---

### Task 5: Login flow, proxy and the protected author home

**Files:**
- Create: `frontend/lib/authenticate.ts`, `frontend/app/login/page.tsx`, `frontend/app/login/actions.ts`, `frontend/app/login/LoginForm.tsx`, `frontend/proxy.ts`, `frontend/app/questionnaires/layout.tsx`, `frontend/app/questionnaires/page.tsx`, `frontend/app/questionnaires/actions.ts`
- Modify: `frontend/app/page.tsx` (replace the create-next-app page)
- Create: `frontend/tests/unit/authenticate.test.ts`, `frontend/tests/unit/proxy.test.ts`

**Interfaces:**
- Consumes: `login`, `refresh`, `logout`, `currentUser`, `LoginResult` (`services/authService.ts`); `listMine` (`services/mesQuestionnaires.ts`); `decide` (`lib/session-decision.ts`); `ACCESS_COOKIE`, `REFRESH_COOKIE`, `SessionTokens`, `writeSession`, `clearSession`, `nowInSeconds` (`lib/session-cookies.ts`); `LoginFormState`, `INITIAL_LOGIN_STATE`, `LOGIN_MESSAGES` (`lib/login-state.ts`); `Feuille`, `Sommaire`, `LoginFormView` (`components/`).
- Produces: `authenticate(formData: FormData, deps: AuthenticateDeps): Promise<AuthenticateOutcome>` with `type AuthenticateDeps = { login: (email: string, password: string) => Promise<LoginResult>; saveSession: (tokens: SessionTokens) => Promise<void> }` and `type AuthenticateOutcome = { kind: 'form'; state: LoginFormState } | { kind: 'redirect'; to: '/questionnaires' }`; `proxy(request: NextRequest): Promise<NextResponse>` with `config.matcher = ['/questionnaires', '/questionnaires/:path*']`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/tests/unit/authenticate.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { authenticate } from '@/lib/authenticate';
import { LOGIN_MESSAGES } from '@/lib/login-state';

function form(email: string, password: string): FormData {
  const data = new FormData();
  data.set('email', email);
  data.set('password', password);
  return data;
}

const tokens = { access: 'access-1', refresh: 'refresh-1' };
const author = { id: 7, nom: 'Prof', email: 'prof@example.test', role: 'auteur' as const };

describe('authenticate', () => {
  it('refuses empty fields without calling Strapi, keeping the typed email', async () => {
    const login = vi.fn();
    const saveSession = vi.fn();

    for (const [email, password] of [
      ['', 'Passw0rd!'],
      ['prof@example.test', ''],
      ['   ', 'Passw0rd!'],
    ]) {
      const outcome = await authenticate(form(email, password), { login, saveSession });

      expect(outcome).toEqual({
        kind: 'form',
        state: { message: LOGIN_MESSAGES.missing, email: email.trim() },
      });
    }
    expect(login).not.toHaveBeenCalled();
    expect(saveSession).not.toHaveBeenCalled();
  });

  it('shows the message of each login failure and keeps the email', async () => {
    for (const reason of ['invalid', 'forbidden-role', 'unavailable'] as const) {
      const saveSession = vi.fn();
      const outcome = await authenticate(form(' prof@example.test ', 'x'), {
        login: vi.fn().mockResolvedValue({ ok: false, reason }),
        saveSession,
      });

      expect(outcome).toEqual({
        kind: 'form',
        state: { message: LOGIN_MESSAGES[reason], email: 'prof@example.test' },
      });
      expect(saveSession).not.toHaveBeenCalled();
    }
  });

  it('saves the session and redirects to /questionnaires on success', async () => {
    const login = vi.fn().mockResolvedValue({ ok: true, tokens, author });
    const saveSession = vi.fn().mockResolvedValue(undefined);

    const outcome = await authenticate(form('prof@example.test', 'Passw0rd!'), {
      login,
      saveSession,
    });

    expect(login).toHaveBeenCalledWith('prof@example.test', 'Passw0rd!');
    expect(saveSession).toHaveBeenCalledWith(tokens);
    expect(outcome).toEqual({ kind: 'redirect', to: '/questionnaires' });
  });
});
```

Create `frontend/tests/unit/proxy.test.ts`:

```ts
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const refresh = vi.fn();

vi.mock('@/services/authService', () => ({ refresh: (token: string) => refresh(token) }));

const { proxy, config } = await import('@/proxy');

const NOW = 1_800_000_000;

function token(exp: number): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256' })}.${encode({ exp })}.signature`;
}

function requestWith(cookies: Record<string, string>): NextRequest {
  const cookie = Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
  return new NextRequest('http://localhost:3000/questionnaires', {
    headers: cookie ? { cookie } : {},
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW * 1000);
  refresh.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('proxy', () => {
  it('guards /questionnaires and everything below it', () => {
    expect(config.matcher).toEqual(['/questionnaires', '/questionnaires/:path*']);
  });

  it('redirects to /login without a refresh cookie and clears the session', async () => {
    const response = await proxy(requestWith({ qp_access: token(NOW + 600) }));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost:3000/login');
    expect(response.cookies.get('qp_access')?.value).toBe('');
    expect(response.cookies.get('qp_refresh')?.value).toBe('');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('lets a valid session through untouched', async () => {
    const response = await proxy(requestWith({ qp_access: token(NOW + 600), qp_refresh: 'r' }));

    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(response.cookies.getAll()).toEqual([]);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('refreshes an expired access token and forwards it to the render', async () => {
    const renewed = token(NOW + 600);
    refresh.mockResolvedValue({ ok: true, tokens: { access: renewed, refresh: 'r2' } });

    const response = await proxy(requestWith({ qp_access: token(NOW - 5), qp_refresh: 'r1' }));

    expect(refresh).toHaveBeenCalledWith('r1');
    expect(response.headers.get('location')).toBeNull();
    expect(response.cookies.get('qp_access')?.value).toBe(renewed);
    expect(response.cookies.get('qp_refresh')?.value).toBe('r2');
    expect(response.cookies.get('qp_access')?.httpOnly).toBe(true);
    const forwarded = response.headers.get('x-middleware-request-cookie') ?? '';
    expect(forwarded).toContain(`qp_access=${renewed}`);
    expect(forwarded).toContain('qp_refresh=r2');
  });

  it('sends a rejected session to /login and clears it', async () => {
    refresh.mockResolvedValue({ ok: false, reason: 'rejected' });

    const response = await proxy(requestWith({ qp_refresh: 'revoked' }));

    expect(response.headers.get('location')).toBe('http://localhost:3000/login');
    expect(response.cookies.get('qp_refresh')?.value).toBe('');
  });

  it('keeps the session when Strapi is unreachable during refresh', async () => {
    refresh.mockResolvedValue({ ok: false, reason: 'unavailable' });

    const response = await proxy(requestWith({ qp_refresh: 'r1' }));

    expect(response.headers.get('location')).toBeNull();
    expect(response.cookies.getAll()).toEqual([]);
  });
});
```

If the installed Next.js exposes the forwarded request cookies under a different internal header than `x-middleware-request-cookie`, find it by printing `[...response.headers.keys()]` once, use that header name, and record it — the assertion (the render sees the renewed token) must stay.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /project/devops2/frontend && npx vitest run tests/unit/authenticate.test.ts tests/unit/proxy.test.ts`
Expected: FAIL — `@/lib/authenticate` and `@/proxy` do not exist.

- [ ] **Step 3: Implement `lib/authenticate.ts` and `proxy.ts`**

`frontend/lib/authenticate.ts`:

```ts
import type { LoginResult } from '@/services/authService';
import { LOGIN_MESSAGES, type LoginFormState } from './login-state';
import type { SessionTokens } from './session-cookies';

export type AuthenticateDeps = {
  login: (email: string, password: string) => Promise<LoginResult>;
  saveSession: (tokens: SessionTokens) => Promise<void>;
};

export type AuthenticateOutcome =
  | { kind: 'form'; state: LoginFormState }
  | { kind: 'redirect'; to: '/questionnaires' };

export async function authenticate(
  formData: FormData,
  deps: AuthenticateDeps,
): Promise<AuthenticateOutcome> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  if (email === '' || password === '') {
    return { kind: 'form', state: { message: LOGIN_MESSAGES.missing, email } };
  }
  const result = await deps.login(email, password);
  if (!result.ok) {
    return { kind: 'form', state: { message: LOGIN_MESSAGES[result.reason], email } };
  }
  await deps.saveSession(result.tokens);
  return { kind: 'redirect', to: '/questionnaires' };
}
```

`frontend/proxy.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearSession,
  nowInSeconds,
  writeSession,
} from '@/lib/session-cookies';
import { decide } from '@/lib/session-decision';
import { refresh } from '@/services/authService';

function toLogin(request: NextRequest): NextResponse {
  const response = NextResponse.redirect(new URL('/login', request.url));
  clearSession(response.cookies);
  return response;
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const now = nowInSeconds();
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  const decision = decide({
    access: request.cookies.get(ACCESS_COOKIE)?.value,
    refresh: refreshToken,
    now,
  });
  if (decision === 'pass') return NextResponse.next();
  if (decision === 'login' || !refreshToken) return toLogin(request);
  const result = await refresh(refreshToken);
  if (!result.ok) {
    return result.reason === 'unavailable' ? NextResponse.next() : toLogin(request);
  }
  request.cookies.set(ACCESS_COOKIE, result.tokens.access);
  request.cookies.set(REFRESH_COOKIE, result.tokens.refresh);
  const response = NextResponse.next({ request: { headers: request.headers } });
  writeSession(response.cookies, result.tokens, now);
  return response;
}

export const config = {
  matcher: ['/questionnaires', '/questionnaires/:path*'],
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd /project/devops2/frontend && npx vitest run tests/unit/authenticate.test.ts tests/unit/proxy.test.ts`
Expected: PASS.

- [ ] **Step 5: Pages and server actions (verified by build and the live check)**

`frontend/app/login/actions.ts`:

```ts
'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authenticate } from '@/lib/authenticate';
import type { LoginFormState } from '@/lib/login-state';
import { nowInSeconds, writeSession } from '@/lib/session-cookies';
import { login } from '@/services/authService';

export async function loginAction(
  _previous: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const outcome = await authenticate(formData, {
    login,
    saveSession: async (tokens) => writeSession(await cookies(), tokens, nowInSeconds()),
  });
  if (outcome.kind === 'redirect') redirect(outcome.to);
  return outcome.state;
}
```

`frontend/app/login/LoginForm.tsx`:

```tsx
'use client';

import { useActionState } from 'react';
import { LoginFormView } from '@/components/LoginFormView';
import { INITIAL_LOGIN_STATE } from '@/lib/login-state';
import { loginAction } from './actions';

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, INITIAL_LOGIN_STATE);
  return <LoginFormView state={state} action={action} pending={pending} />;
}
```

`frontend/app/login/page.tsx`:

```tsx
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Feuille } from '@/components/Feuille';
import { ACCESS_COOKIE, REFRESH_COOKIE, nowInSeconds } from '@/lib/session-cookies';
import { decide } from '@/lib/session-decision';
import { LoginForm } from './LoginForm';

export default async function LoginPage() {
  const store = await cookies();
  const decision = decide({
    access: store.get(ACCESS_COOKIE)?.value,
    refresh: store.get(REFRESH_COOKIE)?.value,
    now: nowInSeconds(),
  });
  if (decision !== 'login') redirect('/questionnaires');
  return (
    <Feuille marge="Espace auteur">
      <div className="max-w-md">
        <h1 className="text-[28px] font-bold leading-[64px] tracking-[-0.02em]">Connexion</h1>
        <LoginForm />
      </div>
    </Feuille>
  );
}
```

`frontend/app/questionnaires/actions.ts`:

```ts
'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ACCESS_COOKIE, REFRESH_COOKIE, clearSession } from '@/lib/session-cookies';
import { logout } from '@/services/authService';

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  const access = store.get(ACCESS_COOKIE)?.value;
  const refreshToken = store.get(REFRESH_COOKIE)?.value;
  if (access && refreshToken) await logout({ access, refresh: refreshToken });
  clearSession(store);
  redirect('/login');
}
```

`frontend/app/questionnaires/layout.tsx`:

```tsx
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Feuille } from '@/components/Feuille';
import { ACCESS_COOKIE } from '@/lib/session-cookies';
import { currentUser } from '@/services/authService';
import { logoutAction } from './actions';

export default async function QuestionnairesLayout({ children }: LayoutProps<'/questionnaires'>) {
  const access = (await cookies()).get(ACCESS_COOKIE)?.value;
  const author = access ? await currentUser(access) : null;
  if (author === null) redirect('/login');
  return (
    <Feuille marge="Espace auteur">
      <div className="flex items-baseline justify-between gap-4 leading-[32px]">
        <p className="truncate text-graphite-doux">{author.nom}</p>
        <form action={logoutAction}>
          <button
            type="submit"
            className="entoure text-encre underline transition-colors duration-[120ms] hover:text-encre-sombre"
          >
            Se déconnecter
          </button>
        </form>
      </div>
      {children}
    </Feuille>
  );
}
```

`frontend/app/questionnaires/page.tsx`:

```tsx
import { cookies } from 'next/headers';
import { Sommaire } from '@/components/Sommaire';
import { ACCESS_COOKIE } from '@/lib/session-cookies';
import { listMine } from '@/services/mesQuestionnaires';

export default async function MesQuestionnairesPage() {
  const access = (await cookies()).get(ACCESS_COOKIE)?.value ?? '';
  const state = await listMine(access);
  return (
    <>
      <h1 className="mt-ligne text-[28px] font-bold leading-[64px] tracking-[-0.02em]">
        Mes questionnaires
      </h1>
      <Sommaire state={state} />
    </>
  );
}
```

Replace `frontend/app/page.tsx` with:

```tsx
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/questionnaires');
}
```

If `frontend/public/next.svg`, `vercel.svg`, `file.svg`, `globe.svg`, `window.svg` are no longer referenced anywhere, delete them (`git rm`).

- [ ] **Step 6: Build and gate**

Run: `cd /project/devops2/frontend && npm test && npm run build && npm run lint && npm run format:check`
Expected: all green; the build lists `/login`, `/questionnaires` (dynamic) and `Proxy (Middleware)`. Then the full regression gate from Global Constraints.

- [ ] **Step 7: Commit**

```bash
cd /project/devops2
git add frontend/lib/authenticate.ts frontend/proxy.ts frontend/app/login/page.tsx frontend/app/login/actions.ts frontend/app/login/LoginForm.tsx frontend/app/questionnaires/layout.tsx frontend/app/questionnaires/page.tsx frontend/app/questionnaires/actions.ts frontend/app/page.tsx frontend/tests/unit/authenticate.test.ts frontend/tests/unit/proxy.test.ts
git commit -F - <<'EOF'
T063: login page, refreshing proxy and the protected author home

/login signs in through a server action; proxy.ts refreshes the 10-minute
access token before rendering and forwards it to the render; /questionnaires
shows the author's name, logout and Mes questionnaires.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018oex3Jpgz8jfd3XAQ58F4t
EOF
```

(Also `git rm` any unused `public/*.svg` removed in Step 5, in the same commit.)

---

### Task 6: Live check, impeccable finish, DESIGN.md and project documents

**Files:**
- Create: `DESIGN.md` (repo root, where impeccable's `context` looks for it — confirm with `impeccable context` output `designPath` after writing)
- Modify: `specs/001-questionnaire-platform/tasks.md` (T063 `[X]` + annotation), `specs/001-questionnaire-platform/contracts/api.md` (short amendment), `CLAUDE.md` ("Current state")
- Possibly modify: files flagged by `impeccable detect` (only to fix real findings)

**Interfaces:**
- Consumes: everything from Tasks 1–5.

- [ ] **Step 1: Live check under an isolated compose project**

Only if ports 1337, 3000 and 5432 are all free (`ss -ltn | grep -E ':(1337|3000|5432) '` prints nothing); otherwise skip and report it. Never touch any other compose project or volume.

```bash
cd /project/devops2
cp .env.example /tmp/claude-1000/-project-devops2/f0c0f41e-6d12-45e7-a390-b175e6f2473f/scratchpad/check.env
```

Edit that scratch env file: set random values for `APP_KEYS`, `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`, `TRANSFER_TOKEN_SALT`, `JWT_SECRET`, `ENCRYPTION_KEY` (e.g. `openssl rand -base64 24`), keep the DB values usable by the `db` service, and set `DEV_AUTEUR_EMAIL=auteur-check@example.test`, `DEV_AUTEUR_PASSWORD=Check-Passw0rd!`, `DEV_AUTEUR_NOM=Auteur Check`. Then:

```bash
docker compose -p devops2-check --env-file <scratch>/check.env up -d
```

Wait until `docker compose -p devops2-check ps` shows backend and frontend healthy (up to ~5 minutes), then verify and record the output:

1. `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/login` → `200`, and the HTML contains `Connexion` and `lang="fr"`.
2. `curl -s -o /dev/null -w '%{http_code} %{redirect_url}' http://127.0.0.1:3000/questionnaires` → `307 http://127.0.0.1:3000/login`.
3. `curl -s -o /dev/null -w '%{http_code} %{redirect_url}' http://127.0.0.1:3000/` → redirect to `/questionnaires`.
4. Strapi session round trip with the dev account: `POST http://127.0.0.1:1337/api/auth/local` (capture `jwt` and the `strapi_up_refresh` cookie), `GET /api/users/me?populate=role` → `role.type` = `auteur`, `POST /api/auth/refresh` with the cookie → 200 and a new cookie, `POST /api/auth/logout` → 200, refresh again with the last cookie → 401.
5. With the cookie values from a fresh login in (4), call the protected page through Next.js: `curl -s -H "Cookie: qp_access=<jwt>; qp_refresh=<refresh>" http://127.0.0.1:3000/questionnaires` → 200 and the HTML contains `Mes questionnaires` and `Auteur Check`; the same with only `qp_refresh=<refresh>` → 200 and a `Set-Cookie: qp_access=` in the response headers (`curl -si`), proving the proxy refresh.

Always finish with `docker compose -p devops2-check down -v` (this project only) and delete the scratch env file. Report every command's result.

- [ ] **Step 2: impeccable detect (once)**

Run from `/project/devops2`:
`/project/devops2/.claude/skills/impeccable/scripts/impeccable detect --json frontend/app/globals.css frontend/app/layout.tsx frontend/app/login frontend/app/questionnaires frontend/components`
Fix every real finding in one batch (keep all tests green), rerun once to confirm, and report findings with their resolution. Do not loop further.

- [ ] **Step 3: DESIGN.md from the built world**

Read `/project/devops2/.claude/skills/impeccable/reference/document.md` and follow it to write `DESIGN.md` from the code as built (tokens from `globals.css`, components, states, the ruling, the margin, statut stamps, focus, errors, empty state, responsive rule, light-only scene). Then run `/project/devops2/.claude/skills/impeccable/scripts/impeccable context` once and confirm it now reports the `DESIGN.md` path.

- [ ] **Step 4: Project documents**

- `specs/001-questionnaire-platform/tasks.md`: change `- [ ] T063` to `- [X] T063` and append to that line: ` *(Done 2026-09-24: BFF session — Strapi refresh mode, access (10 min) and refresh tokens in httpOnly cookies qp_access/qp_refresh, proxy.ts refreshes before rendering, logout revokes in Strapi (auth.logout granted to the three business roles); /login, protected /questionnaires home with Mes questionnaires; Cahier Seyès world recorded in DESIGN.md — see docs/superpowers/specs/2026-09-24-T063-author-login-session-design.md.)*`
- `specs/001-questionnaire-platform/contracts/api.md`: under the opening paragraph (after the line mentioning `session/JWT Strapi standard`), add:

```markdown
> **Amendement 2026-09-24 (T063)** — Strapi fonctionne en mode `refresh` : `POST /api/auth/local`
> renvoie un jeton d'accès de 10 minutes (`jwt`) et pose le jeton de rafraîchissement dans le cookie
> httpOnly `strapi_up_refresh` ; `POST /api/auth/refresh` le fait tourner ; `POST /api/auth/logout`
> (accordé à `auteur`, `administrateur` et `repondant`) révoque la session. Le frontend appelle ces
> routes uniquement côté serveur (BFF) et garde les jetons dans ses propres cookies httpOnly ; le
> navigateur n'appelle jamais Strapi pour l'authentification.
```

- `CLAUDE.md` "Current state":
  - opening line: add `**T063**` to the done list (keep the existing order, e.g. `…, **T062**, **T063**, **T071** and **T077** of 77 tasks`);
  - `ROLE_PERMISSIONS` sentence: `auteur` and `administrateur` gain `auth.logout`; `repondant: auth.logout` (instead of none);
  - `frontend/` bullet: replace "No application pages yet." with a sentence stating: `/login` (server action) and a protected `/questionnaires` home ("Mes questionnaires", logout); BFF session in httpOnly cookies `qp_access`/`qp_refresh` with `proxy.ts` refreshing the 10-minute Strapi access token; server-only `STRAPI_URL` (`http://backend:1337` in Compose); visual world "Cahier Seyès" documented in `DESIGN.md` (T063).

- [ ] **Step 5: Regression gate, then commit**

Run the full gate. Then:

```bash
cd /project/devops2
git add DESIGN.md specs/001-questionnaire-platform/tasks.md specs/001-questionnaire-platform/contracts/api.md CLAUDE.md <files fixed after detect>
git commit -F - <<'EOF'
T063: DESIGN.md for the Cahier Seyès world, contract amendment, current state

Live check under docker compose -p devops2-check: login page, redirects,
Strapi session round trip and proxy refresh verified.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018oex3Jpgz8jfd3XAQ58F4t
EOF
```
