'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { logger } from '@/lib/logger';
import { ACCESS_COOKIE, REFRESH_COOKIE, clearSession } from '@/lib/session-cookies';
import { logout } from '@/services/authService';

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  const access = store.get(ACCESS_COOKIE)?.value;
  const refreshToken = store.get(REFRESH_COOKIE)?.value;
  if (access && refreshToken) await logout({ access, refresh: refreshToken });
  else if (refreshToken) logger.info('auth.logout.skipped', {});
  clearSession(store);
  redirect('/login');
}
