import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const jar = new Map<string, string>();
const set = vi.fn();
const logout = vi.fn();
const redirect = vi.fn();

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { value: jar.get(name) } : undefined),
    set,
  }),
}));
vi.mock('next/navigation', () => ({ redirect: (path: string) => redirect(path) }));
vi.mock('@/services/authService', () => ({ logout: (tokens: unknown) => logout(tokens) }));

const { logoutAction } = await import('@/app/questionnaires/actions');

let write: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  jar.clear();
  set.mockReset();
  logout.mockReset();
  redirect.mockReset();
  write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
});

afterEach(() => {
  write.mockRestore();
});

function logged(): string {
  return write.mock.calls.map((call: unknown[]) => String(call[0])).join('');
}

describe('logoutAction', () => {
  it('revokes the session, clears the cookies and redirects to /login', async () => {
    jar.set('qp_access', 'access-1');
    jar.set('qp_refresh', 'refresh-1');

    await logoutAction();

    expect(logout).toHaveBeenCalledWith({ access: 'access-1', refresh: 'refresh-1' });
    expect(set).toHaveBeenCalledWith('qp_refresh', '', expect.objectContaining({ maxAge: 0 }));
    expect(redirect).toHaveBeenCalledWith('/login');
  });

  it('logs a skipped revocation when only the refresh cookie remains', async () => {
    jar.set('qp_refresh', 'refresh-1');

    await logoutAction();

    expect(logout).not.toHaveBeenCalled();
    expect(logged()).toContain('auth.logout.skipped');
    expect(logged()).not.toContain('refresh-1');
    expect(set).toHaveBeenCalledWith('qp_refresh', '', expect.objectContaining({ maxAge: 0 }));
    expect(redirect).toHaveBeenCalledWith('/login');
  });
});
