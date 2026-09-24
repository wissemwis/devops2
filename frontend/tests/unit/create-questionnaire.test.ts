import { describe, expect, it, vi } from 'vitest';
import { submitCreation } from '@/lib/create-questionnaire';
import {
  CREATION_MESSAGES,
  INITIAL_CREATION_STATE,
  titreInvalide,
} from '@/lib/creation-state';
import type { CreateResult } from '@/services/questionnaireService';

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

function creating(result: CreateResult) {
  return vi.fn().mockResolvedValue(result);
}

const FIELDS = { titre: '  Retour séance 5  ', description: '  Dix minutes.  ', visibilite: 'privee' };

describe('creation state', () => {
  it('holds the exact French messages and a public default', () => {
    expect(CREATION_MESSAGES).toEqual({
      'missing-titre': 'Donnez un titre à votre questionnaire.',
      invalid: 'Vérifiez le titre et la visibilité.',
      forbidden: 'Seuls les auteurs peuvent créer un questionnaire.',
      unavailable: 'Le service est momentanément indisponible. Réessayez dans un instant.',
    });
    expect(INITIAL_CREATION_STATE).toEqual({
      message: null,
      titre: '',
      description: '',
      visibilite: 'publique',
    });
  });

  it('marks the title invalid only for a title problem', () => {
    expect(titreInvalide('missing-titre')).toBe(true);
    expect(titreInvalide('invalid')).toBe(true);
    expect(titreInvalide('forbidden')).toBe(false);
    expect(titreInvalide('unavailable')).toBe(false);
    expect(titreInvalide(null)).toBe(false);
  });
});

describe('submitCreation', () => {
  it('creates the trimmed questionnaire and redirects to its draft page', async () => {
    const create = creating({ ok: true, documentId: 'abc123' });

    expect(await submitCreation(form(FIELDS), { access: 'access-1', create })).toEqual({
      kind: 'redirect',
      to: '/questionnaires/abc123',
    });
    expect(create).toHaveBeenCalledWith('access-1', {
      titre: 'Retour séance 5',
      description: 'Dix minutes.',
      visibilite: 'privee',
    });
  });

  it('refuses a title made only of spaces without calling Strapi, keeping what was typed', async () => {
    const create = creating({ ok: true, documentId: 'abc123' });

    expect(
      await submitCreation(form({ ...FIELDS, titre: '   ' }), { access: 'access-1', create }),
    ).toEqual({
      kind: 'form',
      state: {
        message: 'missing-titre',
        titre: '',
        description: 'Dix minutes.',
        visibilite: 'privee',
      },
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('refuses an unknown visibility without calling Strapi', async () => {
    const create = creating({ ok: true, documentId: 'abc123' });

    expect(
      await submitCreation(form({ ...FIELDS, visibilite: 'secrete' }), { access: 'access-1', create }),
    ).toEqual({
      kind: 'form',
      state: {
        message: 'invalid',
        titre: 'Retour séance 5',
        description: 'Dix minutes.',
        visibilite: 'publique',
      },
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('redirects to /login without a session or on an expired one', async () => {
    const create = creating({ ok: true, documentId: 'abc123' });
    expect(await submitCreation(form(FIELDS), { access: undefined, create })).toEqual({
      kind: 'redirect',
      to: '/login',
    });
    expect(create).not.toHaveBeenCalled();

    expect(
      await submitCreation(form(FIELDS), {
        access: 'access-1',
        create: creating({ ok: false, reason: 'session' }),
      }),
    ).toEqual({ kind: 'redirect', to: '/login' });
  });

  it('turns every other refusal into its message, keeping what was typed', async () => {
    for (const reason of ['invalid', 'forbidden', 'unavailable'] as const) {
      expect(
        await submitCreation(form(FIELDS), {
          access: 'access-1',
          create: creating({ ok: false, reason }),
        }),
      ).toEqual({
        kind: 'form',
        state: {
          message: reason,
          titre: 'Retour séance 5',
          description: 'Dix minutes.',
          visibilite: 'privee',
        },
      });
    }
  });
});
