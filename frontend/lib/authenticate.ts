import type { LoginResult } from '@/services/authService';
import { LOGIN_MESSAGES, type LoginFormState } from './login-state';
import type { SessionTokens } from './session-cookies';

export type AuthenticateDeps = {
  login: (email: string, password: string) => Promise<LoginResult>;
  saveSession: (tokens: SessionTokens) => Promise<void>;
};

export type AuthenticateOutcome =
  { kind: 'form'; state: LoginFormState } | { kind: 'redirect'; to: '/questionnaires' };

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
