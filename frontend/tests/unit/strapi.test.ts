import { afterEach, describe, expect, it, vi } from 'vitest';
import { StrapiUnavailableError, strapiFetch } from '@/services/strapi';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('strapiFetch', () => {
  it('calls STRAPI_URL without caching and returns the response', async () => {
    vi.stubEnv('STRAPI_URL', 'http://backend:1337');
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await strapiFetch('/api/users/me?populate=role', { headers: { A: 'b' } });

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend:1337/api/users/me?populate=role',
      expect.objectContaining({ cache: 'no-store', headers: { A: 'b' } }),
    );
  });

  it('passes 4xx responses through', async () => {
    vi.stubEnv('STRAPI_URL', 'http://backend:1337');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 400 })));

    expect((await strapiFetch('/api/auth/local')).status).toBe(400);
  });

  it('throws StrapiUnavailableError with the status on 429 and 5xx', async () => {
    vi.stubEnv('STRAPI_URL', 'http://backend:1337');
    for (const status of [429, 500, 503]) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status })));

      const error = await strapiFetch('/api/auth/local').catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(StrapiUnavailableError);
      expect((error as StrapiUnavailableError).status).toBe(status);
    }
  });

  it('throws StrapiUnavailableError on a network failure and without STRAPI_URL', async () => {
    vi.stubEnv('STRAPI_URL', 'http://backend:1337');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    await expect(strapiFetch('/api/auth/local')).rejects.toBeInstanceOf(StrapiUnavailableError);

    vi.stubEnv('STRAPI_URL', '');
    await expect(strapiFetch('/api/auth/local')).rejects.toBeInstanceOf(StrapiUnavailableError);
  });
});
