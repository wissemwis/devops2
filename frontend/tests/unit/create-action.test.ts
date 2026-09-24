import { beforeEach, describe, expect, it, vi } from 'vitest';
import { INITIAL_CREATION_STATE } from '@/lib/creation-state';

const jar = new Map<string, string>();
const redirect = vi.fn();
const createQuestionnaire = vi.fn();

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { value: jar.get(name) } : undefined),
  }),
}));
vi.mock('next/navigation', () => ({ redirect: (path: string) => redirect(path) }));
vi.mock('@/services/questionnaireService', () => ({
  createQuestionnaire: (access: string, input: unknown) => createQuestionnaire(access, input),
}));

const { createAction } = await import('@/app/questionnaires/create/actions');

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

beforeEach(() => {
  jar.clear();
  redirect.mockReset();
  createQuestionnaire.mockReset();
});

describe('createAction', () => {
  it('creates with the access cookie and redirects to the draft page', async () => {
    jar.set('qp_access', 'access-1');
    createQuestionnaire.mockResolvedValue({ ok: true, documentId: 'abc123' });

    await createAction(
      INITIAL_CREATION_STATE,
      form({ titre: 'Retour', description: '', visibilite: 'publique' }),
    );

    expect(createQuestionnaire).toHaveBeenCalledWith('access-1', {
      titre: 'Retour',
      description: '',
      visibilite: 'publique',
    });
    expect(redirect).toHaveBeenCalledWith('/questionnaires/abc123');
  });

  it('returns the form state on a refusal', async () => {
    jar.set('qp_access', 'access-1');
    createQuestionnaire.mockResolvedValue({ ok: false, reason: 'forbidden' });

    const state = await createAction(
      INITIAL_CREATION_STATE,
      form({ titre: 'Retour', description: '', visibilite: 'publique' }),
    );

    expect(state).toEqual({
      message: 'forbidden',
      titre: 'Retour',
      description: '',
      visibilite: 'publique',
    });
    expect(redirect).not.toHaveBeenCalled();
  });

  it('redirects to /login without an access cookie', async () => {
    await createAction(INITIAL_CREATION_STATE, form({ titre: 'Retour', visibilite: 'publique' }));

    expect(createQuestionnaire).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith('/login');
  });
});
