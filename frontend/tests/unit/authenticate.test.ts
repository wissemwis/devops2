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
