import type { Author } from '@/services/authService';
import { gateAuthor, type SessionCookies } from './author-gate';
import { decide } from './session-decision';

export async function shouldLeaveLogin(
  session: SessionCookies & { now: number },
  deps: { currentUser: (access: string) => Promise<Author | null> },
): Promise<boolean> {
  if (decide(session) !== 'pass') return false;
  const gate = await gateAuthor(session, deps);
  return gate.kind === 'author';
}
