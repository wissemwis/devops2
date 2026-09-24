import type { Author } from '@/services/authService';
import { StrapiUnavailableError } from '@/services/strapi';

export type AuthorGate =
  { kind: 'author'; author: Author } | { kind: 'login' } | { kind: 'unavailable' };

export type SessionCookies = { access?: string; refresh?: string };

export async function gateAuthor(
  session: SessionCookies,
  deps: { currentUser: (access: string) => Promise<Author | null> },
): Promise<AuthorGate> {
  if (!session.access) return session.refresh ? { kind: 'unavailable' } : { kind: 'login' };
  try {
    const author = await deps.currentUser(session.access);
    return author === null ? { kind: 'login' } : { kind: 'author', author };
  } catch (error) {
    if (error instanceof StrapiUnavailableError) return { kind: 'unavailable' };
    throw error;
  }
}
