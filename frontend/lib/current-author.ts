import { cookies } from 'next/headers';
import { cache } from 'react';
import { currentUser } from '@/services/authService';
import { type AuthorGate, gateAuthor } from './author-gate';
import { ACCESS_COOKIE, REFRESH_COOKIE } from './session-cookies';

export const currentAuthorGate = cache(async (): Promise<AuthorGate> => {
  const store = await cookies();
  return gateAuthor(
    { access: store.get(ACCESS_COOKIE)?.value, refresh: store.get(REFRESH_COOKIE)?.value },
    { currentUser },
  );
});
