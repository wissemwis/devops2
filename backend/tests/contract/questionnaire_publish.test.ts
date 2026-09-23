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

function publish(jwt: string, documentId: string) {
  return request(strapi.server.httpServer)
    .post(`/api/questionnaires/${documentId}/publish`)
    .set('Authorization', `Bearer ${jwt}`)
    .send();
}

describe('POST /api/questionnaires/:id/publish (T013, FR-005)', () => {
  it('publishes a brouillon that has at least one question', async () => {
    const { user, jwt } = await createUserWithRole(strapi, 'auteur');
    const questionnaire = await createQuestionnaire(strapi, user);
    await addQuestion(strapi, questionnaire);

    const res = await publish(jwt, questionnaire.documentId);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ documentId: questionnaire.documentId, statut: 'publie' });
  });

  it('answers 422 without any question and leaves it brouillon', async () => {
    const { user, jwt } = await createUserWithRole(strapi, 'auteur');
    const questionnaire = await createQuestionnaire(strapi, user);

    const res = await publish(jwt, questionnaire.documentId);

    expect(res.status).toBe(422);
    expect(res.body.error.status).toBe(422);
    expect(res.body.error.message).toBe(
      'a questionnaire needs at least one question to be published',
    );
    const stored = await strapi
      .documents('api::questionnaire.questionnaire')
      .findOne({ documentId: questionnaire.documentId });
    expect((stored as unknown as { statut: string }).statut).toBe('brouillon');
  });

  it('answers 409 when already publie or ferme', async () => {
    const { user, jwt } = await createUserWithRole(strapi, 'auteur');
    const published = await createQuestionnaire(strapi, user, { statut: 'publie' });
    const closed = await createQuestionnaire(strapi, user, { statut: 'ferme' });
    await addQuestion(strapi, published);
    await addQuestion(strapi, closed);

    for (const questionnaire of [published, closed]) {
      const res = await publish(jwt, questionnaire.documentId);
      expect(res.status).toBe(409);
      expect(res.body.error.message).toBe('only a brouillon questionnaire can be published');
    }
  });

  it('answers 403 to another auteur and 404 to an unknown questionnaire', async () => {
    const { user: owner } = await createUserWithRole(strapi, 'auteur');
    const { jwt: intruder } = await createUserWithRole(strapi, 'auteur');
    const questionnaire = await createQuestionnaire(strapi, owner);
    await addQuestion(strapi, questionnaire);

    expect((await publish(intruder, questionnaire.documentId)).status).toBe(403);
    expect((await publish(intruder, 'unknown-document-id')).status).toBe(404);
  });
});
