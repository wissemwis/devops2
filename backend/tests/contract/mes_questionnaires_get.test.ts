import request from 'supertest';
import type { Core } from '@strapi/strapi';
import { setupStrapi, teardownStrapi } from '../helpers/strapi';
import { createUserWithRole } from '../helpers/users';
import { addQuestion, createQuestionnaire } from '../helpers/questionnaires';

let strapi: Core.Strapi;

beforeAll(async () => {
  strapi = await setupStrapi();
});

afterAll(async () => {
  await teardownStrapi();
});

function get(jwt: string | null, documentId: string, query = '') {
  const pending = request(strapi.server.httpServer).get(
    `/api/mes-questionnaires/${documentId}${query}`,
  );
  return jwt ? pending.set('Authorization', `Bearer ${jwt}`) : pending;
}

describe('GET /api/mes-questionnaires/:id (T077, US1, FR-016)', () => {
  it('answers 403 without a JWT and to a repondant', async () => {
    const { user: owner } = await createUserWithRole(strapi, 'auteur');
    const { jwt: repondant } = await createUserWithRole(strapi, 'repondant');
    const questionnaire = await createQuestionnaire(strapi, owner);

    expect((await get(null, questionnaire.documentId)).status).toBe(403);
    expect((await get(repondant, questionnaire.documentId)).status).toBe(403);
  });

  it('answers 404 for an unknown documentId', async () => {
    const { jwt } = await createUserWithRole(strapi, 'auteur');

    const res = await get(jwt, 'unknown-document-id');

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('questionnaire not found');
  });

  it('answers 404 to an administrateur too', async () => {
    const { jwt } = await createUserWithRole(strapi, 'administrateur');

    expect((await get(jwt, 'unknown-document-id')).status).toBe(404);
  });

  it('answers 403 to another auteur', async () => {
    const { user: owner } = await createUserWithRole(strapi, 'auteur');
    const { jwt: intruder } = await createUserWithRole(strapi, 'auteur');
    const questionnaire = await createQuestionnaire(strapi, owner);

    const res = await get(intruder, questionnaire.documentId);

    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe('only the author of this questionnaire can do this');
  });

  it('lets the owner read its questionnaire in every statut', async () => {
    const { user, jwt } = await createUserWithRole(strapi, 'auteur');

    for (const statut of ['brouillon', 'publie', 'ferme']) {
      const questionnaire = await createQuestionnaire(strapi, user, {
        statut,
        description: 'Séance 3',
        visibilite: 'privee',
      });

      const res = await get(jwt, questionnaire.documentId);

      expect(res.status).toBe(200);
      expect(res.body.meta).toEqual({});
      expect(res.body.data).toMatchObject({
        documentId: questionnaire.documentId,
        titre: 'Retour de séance',
        description: 'Séance 3',
        statut,
        visibilite: 'privee',
      });
      expect(res.body.data.createdAt).toEqual(expect.any(String));
      expect(res.body.data.updatedAt).toEqual(expect.any(String));
    }
  });

  it('lets an administrateur read a questionnaire it does not own', async () => {
    const { user: owner } = await createUserWithRole(strapi, 'auteur');
    const { jwt: administrateur } = await createUserWithRole(strapi, 'administrateur');
    const questionnaire = await createQuestionnaire(strapi, owner, { statut: 'publie' });

    const res = await get(administrateur, questionnaire.documentId);

    expect(res.status).toBe(200);
    expect(res.body.data.documentId).toBe(questionnaire.documentId);
  });

  it('returns an empty questions list for a questionnaire without question', async () => {
    const { user, jwt } = await createUserWithRole(strapi, 'auteur');
    const questionnaire = await createQuestionnaire(strapi, user);

    const res = await get(jwt, questionnaire.documentId);

    expect(res.status).toBe(200);
    expect(res.body.data.questions).toEqual([]);
  });

  it('orders questions by position with their options', async () => {
    const { user, jwt } = await createUserWithRole(strapi, 'auteur');
    const questionnaire = await createQuestionnaire(strapi, user);
    await addQuestion(strapi, questionnaire, { position: 3, texte: 'Troisième' });
    await addQuestion(strapi, questionnaire, {
      position: 1,
      texte: 'Première',
      type: 'choix_multiple',
      options: ['Oui', 'Non'],
    });
    await addQuestion(strapi, questionnaire, {
      position: 2,
      texte: 'Deuxième',
      type: 'texte_libre',
      obligatoire: false,
    });

    const res = await get(jwt, questionnaire.documentId);

    expect(res.status).toBe(200);
    expect(res.body.data.questions).toHaveLength(3);
    expect(res.body.data.questions).toEqual([
      expect.objectContaining({
        texte: 'Première',
        type: 'choix_multiple',
        position: 1,
        options: ['Oui', 'Non'],
      }),
      expect.objectContaining({
        texte: 'Deuxième',
        type: 'texte_libre',
        position: 2,
        obligatoire: false,
      }),
      expect.objectContaining({ texte: 'Troisième', type: 'likert', position: 3 }),
    ]);
    for (const question of res.body.data.questions) {
      expect(question.documentId).toEqual(expect.any(String));
      expect(question.image).toBeNull();
      expect(question).not.toHaveProperty('questionnaire');
    }
  });

  it('never exposes the author, even when the client asks for it', async () => {
    const { user, jwt } = await createUserWithRole(strapi, 'auteur');
    const questionnaire = await createQuestionnaire(strapi, user);

    for (const query of ['', '?populate=auteur', '?populate=*', '?fields[0]=titre']) {
      const res = await get(jwt, questionnaire.documentId, query);

      expect(res.status).toBe(200);
      expect(res.body.data).not.toHaveProperty('auteur');
      expect(res.body.data.statut).toBe('brouillon');
      expect(res.body.data.questions).toEqual([]);
    }
  });
});
