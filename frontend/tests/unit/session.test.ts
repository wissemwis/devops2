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
      [
        ACCESS_COOKIE,
        access,
        { httpOnly: true, sameSite: 'lax', path: '/', secure: false, maxAge: 600 },
      ],
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
      [
        REFRESH_COOKIE,
        '',
        { httpOnly: true, sameSite: 'lax', path: '/', secure: false, maxAge: 0 },
      ],
    ]);
  });
});
