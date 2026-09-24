import { describe, expect, it, vi } from 'vitest';
import { gateAuthor } from '@/lib/author-gate';
import type { Author } from '@/services/authService';
import { StrapiUnavailableError } from '@/services/strapi';

const author: Author = { id: 7, nom: 'Prof', email: 'prof@example.test', role: 'auteur' };

describe('gateAuthor', () => {
  it('sends a missing access token to login without calling currentUser', async () => {
    const currentUser = vi.fn();

    const gate = await gateAuthor(undefined, { currentUser });

    expect(gate).toEqual({ kind: 'login' });
    expect(currentUser).not.toHaveBeenCalled();
  });

  it('sends a null author to login', async () => {
    const gate = await gateAuthor('access-1', { currentUser: vi.fn().mockResolvedValue(null) });

    expect(gate).toEqual({ kind: 'login' });
  });

  it('returns the author when currentUser resolves one', async () => {
    const gate = await gateAuthor('access-1', {
      currentUser: vi.fn().mockResolvedValue(author),
    });

    expect(gate).toEqual({ kind: 'author', author });
  });

  it('returns unavailable when Strapi is unreachable', async () => {
    const currentUser = vi.fn().mockRejectedValue(new StrapiUnavailableError(503));

    const gate = await gateAuthor('access-1', { currentUser });

    expect(gate).toEqual({ kind: 'unavailable' });
  });

  it('rethrows any other error', async () => {
    const boom = new Error('boom');
    const currentUser = vi.fn().mockRejectedValue(boom);

    await expect(gateAuthor('access-1', { currentUser })).rejects.toThrow(boom);
  });
});
