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
