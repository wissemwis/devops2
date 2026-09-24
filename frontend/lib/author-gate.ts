import type { Author } from '@/services/authService';
import { StrapiUnavailableError } from '@/services/strapi';

export type AuthorGate =
  { kind: 'author'; author: Author } | { kind: 'login' } | { kind: 'unavailable' };

export async function gateAuthor(
  access: string | undefined,
  deps: { currentUser: (access: string) => Promise<Author | null> },
): Promise<AuthorGate> {
  if (!access) return { kind: 'login' };
  try {
    const author = await deps.currentUser(access);
    return author === null ? { kind: 'login' } : { kind: 'author', author };
  } catch (error) {
    if (error instanceof StrapiUnavailableError) return { kind: 'unavailable' };
    throw error;
  }
}
