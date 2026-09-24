import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQuestionnaire, getMine } from '@/services/questionnaireService';

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

function logged(): string {
  return write.mock.calls.map((call: unknown[]) => String(call[0])).join('');
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function stubFetch(response: Response | Error) {
  const fetchMock =
    response instanceof Error
      ? vi.fn().mockRejectedValue(response)
      : vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const INPUT = {
  titre: 'Retour séance 5',
  description: 'Dix minutes.',
  visibilite: 'publique' as const,
};

describe('createQuestionnaire', () => {
  it('posts the questionnaire with the bearer token and returns its documentId on 201', async () => {
    const fetchMock = stubFetch(
      json({ data: { id: 3, documentId: 'abc123', titre: 'Retour séance 5' }, meta: {} }, 201),
    );

    expect(await createQuestionnaire('access-1', INPUT)).toEqual({
      ok: true,
      documentId: 'abc123',
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://backend:1337/api/questionnaires');
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer access-1');
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json');
    expect(JSON.parse(String(init.body))).toEqual({ data: INPUT });
  });

  it('omits an empty description', async () => {
    const fetchMock = stubFetch(json({ data: { documentId: 'abc123' } }, 201));

    await createQuestionnaire('access-1', { ...INPUT, description: '' });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      data: { titre: 'Retour séance 5', visibilite: 'publique' },
    });
  });

  it('maps 400, 401 and 403 to their reasons', async () => {
    stubFetch(json({ error: { status: 400 } }, 400));
    expect(await createQuestionnaire('access-1', INPUT)).toEqual({ ok: false, reason: 'invalid' });

    stubFetch(json({ error: { status: 401 } }, 401));
    expect(await createQuestionnaire('access-1', INPUT)).toEqual({ ok: false, reason: 'session' });

    stubFetch(json({ error: { status: 403 } }, 403));
    expect(await createQuestionnaire('access-1', INPUT)).toEqual({
      ok: false,
      reason: 'forbidden',
    });
  });

  it('returns unavailable on 5xx, network failure, an unexpected status or a 201 without documentId, and logs it', async () => {
    for (const response of [
      json({}, 503),
      new TypeError('fetch failed'),
      json({}, 404),
      json({ data: {} }, 201),
    ]) {
      stubFetch(response);
      expect(await createQuestionnaire('access-1', INPUT)).toEqual({
        ok: false,
        reason: 'unavailable',
      });
    }
    expect(logged()).toContain('questionnaire.create.failed');
    expect(logged()).not.toContain('access-1');
  });
});

describe('getMine', () => {
  const body = {
    data: {
      id: 3,
      documentId: 'abc123',
      titre: 'Retour séance 5',
      description: 'Ligne 1\nLigne 2',
      statut: 'brouillon',
      visibilite: 'privee',
      createdAt: '2026-09-24T08:00:00.000Z',
      updatedAt: '2026-09-24T08:00:00.000Z',
      questions: [
        {
          id: 1,
          documentId: 'q1',
          texte: 'Rythme ?',
          type: 'likert',
          position: 1,
          obligatoire: true,
          options: null,
          image: null,
        },
        {
          id: 2,
          documentId: 'q2',
          texte: 'Remarques',
          type: 'texte_libre',
          position: 2,
          obligatoire: false,
          options: null,
          image: null,
        },
      ],
    },
    meta: {},
  };

  it('reads the questionnaire with the bearer token and keeps the question order', async () => {
    const fetchMock = stubFetch(json(body, 200));

    expect(await getMine('access-1', 'abc123')).toEqual({
      kind: 'found',
      questionnaire: {
        documentId: 'abc123',
        titre: 'Retour séance 5',
        description: 'Ligne 1\nLigne 2',
        statut: 'brouillon',
        visibilite: 'privee',
        questions: [
          { documentId: 'q1', texte: 'Rythme ?', type: 'likert', position: 1, obligatoire: true },
          {
            documentId: 'q2',
            texte: 'Remarques',
            type: 'texte_libre',
            position: 2,
            obligatoire: false,
          },
        ],
      },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend:1337/api/mes-questionnaires/abc123',
      expect.objectContaining({ headers: { Authorization: 'Bearer access-1' } }),
    );
  });

  it('reads a missing description as null and missing questions as an empty list', async () => {
    stubFetch(
      json(
        {
          data: {
            documentId: 'abc123',
            titre: 'T',
            statut: 'publie',
            visibilite: 'publique',
          },
        },
        200,
      ),
    );

    expect(await getMine('access-1', 'abc123')).toEqual({
      kind: 'found',
      questionnaire: {
        documentId: 'abc123',
        titre: 'T',
        description: null,
        statut: 'publie',
        visibilite: 'publique',
        questions: [],
      },
    });
  });

  it('treats 404 and 403 as not found and 401 as an expired session', async () => {
    stubFetch(json({}, 404));
    expect(await getMine('access-1', 'abc123')).toEqual({ kind: 'not-found' });

    stubFetch(json({}, 403));
    expect(await getMine('access-1', 'abc123')).toEqual({ kind: 'not-found' });

    stubFetch(json({}, 401));
    expect(await getMine('access-1', 'abc123')).toEqual({ kind: 'session' });
  });

  it('returns unavailable on 5xx, network failure or an unexpected status, and logs it', async () => {
    for (const response of [json({}, 500), new TypeError('fetch failed'), json({}, 418)]) {
      stubFetch(response);
      expect(await getMine('access-1', 'abc123')).toEqual({ kind: 'unavailable' });
    }
    expect(logged()).toContain('questionnaire.read.failed');
    expect(logged()).not.toContain('access-1');
  });

  it('never calls Strapi for an id that is not alphanumeric', async () => {
    const fetchMock = stubFetch(json(body, 200));

    for (const id of ['..', 'a/b', '%2e%2e', 'abc 123', '']) {
      expect(await getMine('access-1', id)).toEqual({ kind: 'not-found' });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
