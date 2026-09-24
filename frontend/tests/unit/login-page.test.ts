import { describe, expect, it, vi } from 'vitest';
import { shouldLeaveLogin } from '@/lib/login-page';
import type { Author } from '@/services/authService';
import { StrapiUnavailableError } from '@/services/strapi';

const NOW = 1_800_000_000;
const author: Author = { id: 7, nom: 'Prof', email: 'prof@example.test', role: 'auteur' };

function token(exp: number): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256' })}.${encode({ exp })}.signature`;
}

describe('shouldLeaveLogin', () => {
  it('stays on the login form without any cookie', async () => {
    const currentUser = vi.fn();

    expect(await shouldLeaveLogin({ now: NOW }, { currentUser })).toBe(false);
    expect(currentUser).not.toHaveBeenCalled();
  });

  it('leaves the login form for a valid author session', async () => {
    const currentUser = vi.fn().mockResolvedValue(author);

    const leave = await shouldLeaveLogin(
      { access: token(NOW + 600), refresh: 'refresh-1', now: NOW },
      { currentUser },
    );

    expect(leave).toBe(true);
  });

  it('stays on the login form for a valid session that is not an author', async () => {
    const currentUser = vi.fn().mockResolvedValue(null);

    const leave = await shouldLeaveLogin(
      { access: token(NOW + 600), refresh: 'refresh-1', now: NOW },
      { currentUser },
    );

    expect(leave).toBe(false);
  });

  it('stays on the login form when Strapi is unavailable', async () => {
    const currentUser = vi.fn().mockRejectedValue(new StrapiUnavailableError(503));

    const leave = await shouldLeaveLogin(
      { access: token(NOW + 600), refresh: 'refresh-1', now: NOW },
      { currentUser },
    );

    expect(leave).toBe(false);
  });

  it('stays on the login form when only the refresh cookie remains', async () => {
    const currentUser = vi.fn();

    const leave = await shouldLeaveLogin({ refresh: 'refresh-1', now: NOW }, { currentUser });

    expect(leave).toBe(false);
    expect(currentUser).not.toHaveBeenCalled();
  });

  it('stays on the login form when the access token has expired', async () => {
    const currentUser = vi.fn();

    const leave = await shouldLeaveLogin(
      { access: token(NOW - 5), refresh: 'refresh-1', now: NOW },
      { currentUser },
    );

    expect(leave).toBe(false);
    expect(currentUser).not.toHaveBeenCalled();
  });
});
