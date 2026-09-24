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
