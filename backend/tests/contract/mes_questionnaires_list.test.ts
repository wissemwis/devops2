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

function list(jwt: string | null, query = '') {
  const pending = request(strapi.server.httpServer).get(`/api/mes-questionnaires${query}`);
  return jwt ? pending.set('Authorization', `Bearer ${jwt}`) : pending;
}

function pause() {
  return new Promise((resolve) => setTimeout(resolve, 20));
}

function documentIds(res: { body: { data: { documentId: string }[] } }) {
  return res.body.data.map((item) => item.documentId);
}

describe('GET /api/mes-questionnaires (T077, US1, FR-016)', () => {
  it('answers 403 without a JWT and to a repondant', async () => {
    const { jwt: repondant } = await createUserWithRole(strapi, 'repondant');

    expect((await list(null)).status).toBe(403);
    expect((await list(repondant)).status).toBe(403);
  });

  it('returns an empty list to an auteur without questionnaire', async () => {
    const { jwt } = await createUserWithRole(strapi, 'auteur');

    const res = await list(jwt);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [], meta: {} });
  });

  it('returns an empty list to an administrateur', async () => {
    const { user: owner } = await createUserWithRole(strapi, 'auteur');
    const { jwt } = await createUserWithRole(strapi, 'administrateur');
    await createQuestionnaire(strapi, owner);

    const res = await list(jwt);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('shows each auteur only its own questionnaires', async () => {
    const alice = await createUserWithRole(strapi, 'auteur');
    const bob = await createUserWithRole(strapi, 'auteur');
    const aliceOne = await createQuestionnaire(strapi, alice.user);
    const aliceTwo = await createQuestionnaire(strapi, alice.user);
    const bobOne = await createQuestionnaire(strapi, bob.user);

    const aliceRes = await list(alice.jwt);
    const bobRes = await list(bob.jwt);

    expect(aliceRes.status).toBe(200);
    expect(documentIds(aliceRes).sort()).toEqual([aliceOne.documentId, aliceTwo.documentId].sort());
    expect(documentIds(bobRes)).toEqual([bobOne.documentId]);
  });

  it('lists every statut', async () => {
    const { user, jwt } = await createUserWithRole(strapi, 'auteur');
    for (const statut of ['brouillon', 'publie', 'ferme']) {
      await createQuestionnaire(strapi, user, { statut });
    }

    const res = await list(jwt);

    expect(res.body.data.map((item: { statut: string }) => item.statut).sort()).toEqual([
      'brouillon',
      'ferme',
      'publie',
    ]);
  });

  it('puts the most recently updated questionnaire first', async () => {
    const { user, jwt } = await createUserWithRole(strapi, 'auteur');
    const older = await createQuestionnaire(strapi, user, { titre: 'Ancien' });
    await pause();
    const newer = await createQuestionnaire(strapi, user, { titre: 'Récent' });
    await pause();

    expect(documentIds(await list(jwt))).toEqual([newer.documentId, older.documentId]);

    await strapi.documents('api::questionnaire.questionnaire').update({
      documentId: older.documentId,
      data: { titre: 'Ancien modifié' } as never,
    });

    expect(documentIds(await list(jwt))).toEqual([older.documentId, newer.documentId]);
  });

  it('returns the summary fields, never the author nor the questions', async () => {
    const { user, jwt } = await createUserWithRole(strapi, 'auteur');
    const questionnaire = await createQuestionnaire(strapi, user, {
      description: 'Séance 4',
      visibilite: 'privee',
    });
    await addQuestion(strapi, questionnaire);

    const res = await list(jwt);

    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({});
    expect(res.body.data).toHaveLength(1);
    const [item] = res.body.data;
    expect(item).toMatchObject({
      documentId: questionnaire.documentId,
      titre: 'Retour de séance',
      description: 'Séance 4',
      statut: 'brouillon',
      visibilite: 'privee',
    });
    expect(item.createdAt).toEqual(expect.any(String));
    expect(item.updatedAt).toEqual(expect.any(String));
    expect(item).not.toHaveProperty('auteur');
    expect(item).not.toHaveProperty('questions');
  });

  it('ignores client query parameters', async () => {
    const alice = await createUserWithRole(strapi, 'auteur');
    const bob = await createUserWithRole(strapi, 'auteur');
    const aliceOlder = await createQuestionnaire(strapi, alice.user, { titre: 'A première vue' });
    await addQuestion(strapi, aliceOlder);
    await pause();
    const aliceNewer = await createQuestionnaire(strapi, alice.user, { titre: 'B seconde vue' });
    await pause();
    await createQuestionnaire(strapi, bob.user);

    for (const query of [
      `?filters[auteur][id]=${bob.user.id}`,
      '?populate=*',
      '?populate=auteur',
      '?sort=titre:asc',
      '?pagination[pageSize]=0',
    ]) {
      const res = await list(alice.jwt, query);

      expect(res.status).toBe(200);
      expect(documentIds(res)).toEqual([aliceNewer.documentId, aliceOlder.documentId]);
      expect(res.body.data[0]).not.toHaveProperty('auteur');
      expect(res.body.data[0]).not.toHaveProperty('questions');
      expect(res.body.meta).toEqual({});
    }
  });
});
