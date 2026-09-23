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

function post(jwt: string | null, data: Record<string, unknown>) {
  const call = request(strapi.server.httpServer).post('/api/questionnaires').send({ data });
  return jwt ? call.set('Authorization', `Bearer ${jwt}`) : call;
}

describe('POST /api/questionnaires (T011, FR-001, FR-004)', () => {
  it('creates a brouillon questionnaire owned by the calling auteur', async () => {
    const { user, jwt } = await createUserWithRole(strapi, 'auteur');

    const res = await post(jwt, {
      titre: 'Retour S1',
      description: 'Séance 1',
      visibilite: 'privee',
    });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      titre: 'Retour S1',
      description: 'Séance 1',
      visibilite: 'privee',
      statut: 'brouillon',
    });
    expect(typeof res.body.data.documentId).toBe('string');
    const stored = await strapi.documents('api::questionnaire.questionnaire').findOne({
      documentId: res.body.data.documentId,
      populate: ['auteur'],
    });
    expect((stored as unknown as { auteur: { id: number } }).auteur.id).toBe(user.id);
  });

  it('forces statut and auteur whatever the body says', async () => {
    const { user, jwt } = await createUserWithRole(strapi, 'auteur');
    const { user: other } = await createUserWithRole(strapi, 'auteur');

    const res = await post(jwt, {
      titre: 'Forcé',
      visibilite: 'publique',
      statut: 'publie',
      auteur: other.id,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.statut).toBe('brouillon');
    const stored = await strapi.documents('api::questionnaire.questionnaire').findOne({
      documentId: res.body.data.documentId,
      populate: ['auteur'],
    });
    expect((stored as unknown as { auteur: { id: number } }).auteur.id).toBe(user.id);
  });

  it('never exposes the author in the response', async () => {
    const { jwt } = await createUserWithRole(strapi, 'auteur');

    const res = await post(jwt, { titre: 'Discret', visibilite: 'publique' });

    expect(res.status).toBe(201);
    expect(JSON.stringify(res.body)).not.toContain('@example.test');
    expect(JSON.stringify(res.body)).not.toContain('password');
  });

  it('rejects a missing titre and an unknown visibilite with 400', async () => {
    const { jwt } = await createUserWithRole(strapi, 'auteur');

    const missing = await post(jwt, { visibilite: 'publique' });
    const accented = await post(jwt, { titre: 'Accent', visibilite: 'privée' });

    expect(missing.status).toBe(400);
    expect(missing.body.error.name).toBe('ValidationError');
    expect(accented.status).toBe(400);
    expect(accented.body.error.name).toBe('ValidationError');
  });

  it('refuses a repondant, an administrateur and an unauthenticated caller with 403', async () => {
    const { jwt: repondant } = await createUserWithRole(strapi, 'repondant');
    const { jwt: administrateur } = await createUserWithRole(strapi, 'administrateur');
    const body = { titre: 'Refusé', visibilite: 'publique' };

    expect((await post(repondant, body)).status).toBe(403);
    expect((await post(administrateur, body)).status).toBe(403);
    expect((await post(null, body)).status).toBe(403);
  });

  it("does not move another auteur's question into the created questionnaire", async () => {
    const { jwt } = await createUserWithRole(strapi, 'auteur');
    const { user: otherOwner } = await createUserWithRole(strapi, 'auteur');
    const otherQuestionnaire = await createQuestionnaire(strapi, otherOwner);
    const otherQuestion = await addQuestion(strapi, otherQuestionnaire);

    const res = await post(jwt, {
      titre: 'Vol de question',
      visibilite: 'publique',
      questions: [otherQuestion.documentId],
    });

    expect(res.status).toBe(201);
    const stored = await strapi.documents('api::question.question').findOne({
      documentId: otherQuestion.documentId,
      populate: ['questionnaire'],
    });
    expect(
      (stored as unknown as { questionnaire: { documentId: string } | null }).questionnaire
        ?.documentId,
    ).toBe(otherQuestionnaire.documentId);
  });

  it("still keeps another auteur's question in place even when the caller role can read questions", async () => {
    const { jwt } = await createUserWithRole(strapi, 'auteur');
    const { user: otherOwner } = await createUserWithRole(strapi, 'auteur');
    const otherQuestionnaire = await createQuestionnaire(strapi, otherOwner);
    const otherQuestion = await addQuestion(strapi, otherQuestionnaire);
    const role = await strapi.db
      .query('plugin::users-permissions.role')
      .findOne({ where: { type: 'auteur' } });
    await strapi.db.query('plugin::users-permissions.permission').create({
      data: { action: 'api::question.question.find', role: role.id },
    });

    try {
      const res = await post(jwt, {
        titre: 'Vol de question, permission accordée',
        visibilite: 'publique',
        questions: [otherQuestion.documentId],
      });

      expect(res.status).toBe(201);
      const stored = await strapi.documents('api::question.question').findOne({
        documentId: otherQuestion.documentId,
        populate: ['questionnaire'],
      });
      expect(
        (stored as unknown as { questionnaire: { documentId: string } | null }).questionnaire
          ?.documentId,
      ).toBe(otherQuestionnaire.documentId);
    } finally {
      await strapi.db.query('plugin::users-permissions.permission').deleteMany({
        where: { action: 'api::question.question.find', role: role.id },
      });
    }
  });
});
