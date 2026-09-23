import request from 'supertest';
import type { Core } from '@strapi/strapi';
import { setupStrapi, teardownStrapi } from '../helpers/strapi';
import { createUserWithRole } from '../helpers/users';
import { createQuestionnaire } from '../helpers/questionnaires';

let strapi: Core.Strapi;

beforeAll(async () => {
  strapi = await setupStrapi();
});

afterAll(async () => {
  await teardownStrapi();
});

function close(jwt: string, documentId: string) {
  return request(strapi.server.httpServer)
    .post(`/api/questionnaires/${documentId}/close`)
    .set('Authorization', `Bearer ${jwt}`)
    .send();
}

describe('POST /api/questionnaires/:id/close (T014, FR-005, FR-016)', () => {
  it('lets the auteur close its publie questionnaire', async () => {
    const { user, jwt } = await createUserWithRole(strapi, 'auteur');
    const questionnaire = await createQuestionnaire(strapi, user, { statut: 'publie' });

    const res = await close(jwt, questionnaire.documentId);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ documentId: questionnaire.documentId, statut: 'ferme' });
  });

  it('lets an administrateur close a questionnaire it does not own', async () => {
    const { user: owner } = await createUserWithRole(strapi, 'auteur');
    const { jwt: administrateur } = await createUserWithRole(strapi, 'administrateur');
    const questionnaire = await createQuestionnaire(strapi, owner, { statut: 'publie' });

    const res = await close(administrateur, questionnaire.documentId);

    expect(res.status).toBe(200);
    expect(res.body.data.statut).toBe('ferme');
  });

  it('answers 403 to another auteur', async () => {
    const { user: owner } = await createUserWithRole(strapi, 'auteur');
    const { jwt: intruder } = await createUserWithRole(strapi, 'auteur');
    const questionnaire = await createQuestionnaire(strapi, owner, { statut: 'publie' });

    expect((await close(intruder, questionnaire.documentId)).status).toBe(403);
  });

  it('answers 409 from brouillon and from ferme', async () => {
    const { user, jwt } = await createUserWithRole(strapi, 'auteur');
    const draft = await createQuestionnaire(strapi, user);
    const closed = await createQuestionnaire(strapi, user, { statut: 'ferme' });

    for (const questionnaire of [draft, closed]) {
      const res = await close(jwt, questionnaire.documentId);
      expect(res.status).toBe(409);
      expect(res.body.error.message).toBe('only a publie questionnaire can be closed');
    }
  });
});
