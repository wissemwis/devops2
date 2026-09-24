import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listMine } from '@/services/mesQuestionnaires';

let write: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.stubEnv('STRAPI_URL', 'http://backend:1337');
  write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  write.mockRestore();
});

describe('listMine', () => {
  it('returns the list in the order Strapi sends it, with the bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              id: 2,
              documentId: 'b',
              titre: 'Séance 4',
              statut: 'brouillon',
              updatedAt: '2026-09-24T08:00:00.000Z',
              description: null,
              visibilite: 'publique',
              createdAt: '2026-09-24T08:00:00.000Z',
            },
            {
              id: 1,
              documentId: 'a',
              titre: 'Séance 3',
              statut: 'publie',
              updatedAt: '2026-09-20T08:00:00.000Z',
              description: null,
              visibilite: 'privee',
              createdAt: '2026-09-20T08:00:00.000Z',
            },
          ],
          meta: {},
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    expect(await listMine('access-1')).toEqual({
      kind: 'list',
      items: [
        {
          documentId: 'b',
          titre: 'Séance 4',
          statut: 'brouillon',
          updatedAt: '2026-09-24T08:00:00.000Z',
        },
        {
          documentId: 'a',
          titre: 'Séance 3',
          statut: 'publie',
          updatedAt: '2026-09-20T08:00:00.000Z',
        },
      ],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend:1337/api/mes-questionnaires',
      expect.objectContaining({ headers: { Authorization: 'Bearer access-1' } }),
    );
  });

  it('returns an empty list', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ data: [], meta: {} }), { status: 200 })),
    );

    expect(await listMine('access-1')).toEqual({ kind: 'list', items: [] });
  });

  it('returns the error state on a refused call or an unreachable Strapi, and logs it', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 403 })));
    expect(await listMine('access-1')).toEqual({ kind: 'error' });

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    expect(await listMine('access-1')).toEqual({ kind: 'error' });

    const logged = write.mock.calls.map((call: unknown[]) => String(call[0])).join('');
    expect(logged).toContain('questionnaires.list.failed');
    expect(logged).not.toContain('access-1');
  });
});
