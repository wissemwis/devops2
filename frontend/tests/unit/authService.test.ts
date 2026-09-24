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
  return write.mock.calls.map((call: unknown[]) => String(call[0])).join('');
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
      'POST /api/auth/local': () =>
        json({ jwt: 'access-1', user: { id: 7 } }, 200, REFRESH_SET_COOKIE),
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
