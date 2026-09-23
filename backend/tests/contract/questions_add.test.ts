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

function patch(jwt: string, documentId: string, data: Record<string, unknown>) {
  return request(strapi.server.httpServer)
    .patch(`/api/questionnaires/${documentId}/questions`)
    .set('Authorization', `Bearer ${jwt}`)
    .send({ data });
}

describe('PATCH /api/questionnaires/:id/questions (T012, FR-002)', () => {
  it('adds a question of each type to a brouillon questionnaire of its auteur', async () => {
    const { user, jwt } = await createUserWithRole(strapi, 'auteur');
    const questionnaire = await createQuestionnaire(strapi, user);

    const likert = await patch(jwt, questionnaire.documentId, {
      texte: 'Clarté',
      type: 'likert',
      position: 1,
      obligatoire: true,
    });
    const choix = await patch(jwt, questionnaire.documentId, {
      texte: 'Format préféré',
      type: 'choix_multiple',
      position: 2,
      options: ['Cours', 'TP', 'Projet'],
    });
    const libre = await patch(jwt, questionnaire.documentId, {
      texte: 'Remarques',
      type: 'texte_libre',
      position: 3,
    });

    expect(likert.status).toBe(200);
    expect(likert.body.data).toMatchObject({
      texte: 'Clarté',
      type: 'likert',
      position: 1,
      obligatoire: true,
    });
    expect(choix.status).toBe(200);
    expect(choix.body.data.options).toEqual(['Cours', 'TP', 'Projet']);
    expect(libre.status).toBe(200);
    expect(libre.body.data.obligatoire).toBe(false);
    const stored = await strapi.documents('api::questionnaire.questionnaire').findOne({
      documentId: questionnaire.documentId,
      populate: ['questions'],
    });
    expect((stored as unknown as { questions: unknown[] }).questions).toHaveLength(3);
  });

  it('rejects wrong options with 400', async () => {
    const { user, jwt } = await createUserWithRole(strapi, 'auteur');
    const questionnaire = await createQuestionnaire(strapi, user);

    const none = await patch(jwt, questionnaire.documentId, {
      texte: 'Choix',
      type: 'choix_multiple',
      position: 1,
    });
    const single = await patch(jwt, questionnaire.documentId, {
      texte: 'Choix',
      type: 'choix_multiple',
      position: 1,
      options: ['Seul'],
    });
    const onLikert = await patch(jwt, questionnaire.documentId, {
      texte: 'Échelle',
      type: 'likert',
      position: 1,
      options: ['1', '2'],
    });

    for (const res of [none, single, onLikert]) {
      expect(res.status).toBe(400);
      expect(res.body.error.name).toBe('ValidationError');
    }
    expect(single.body.error.message).toBe(
      'options must list at least 2 distinct non-empty labels for a choix_multiple question',
    );
    expect(onLikert.body.error.message).toBe(
      'options are only allowed for a choix_multiple question',
    );
  });

  it('rejects a position already used in the questionnaire with 400', async () => {
    const { user, jwt } = await createUserWithRole(strapi, 'auteur');
    const questionnaire = await createQuestionnaire(strapi, user);
    const existing = await addQuestion(strapi, questionnaire);

    const res = await patch(jwt, questionnaire.documentId, {
      texte: 'Doublon',
      type: 'texte_libre',
      position: existing.position,
    });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe(
      `position ${existing.position} is already used in this questionnaire`,
    );
  });

  it('answers 403 to another auteur and 404 to an unknown questionnaire', async () => {
    const { user: owner } = await createUserWithRole(strapi, 'auteur');
    const { jwt: intruder } = await createUserWithRole(strapi, 'auteur');
    const questionnaire = await createQuestionnaire(strapi, owner);
    const body = { texte: 'Intrus', type: 'texte_libre', position: 1 };

    const forbidden = await patch(intruder, questionnaire.documentId, body);
    const missing = await patch(intruder, 'unknown-document-id', body);

    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.message).toBe('only the author of this questionnaire can do this');
    expect(missing.status).toBe(404);
    expect(missing.body.error.message).toBe('questionnaire not found');
  });

  it('answers 409 when the questionnaire is no longer brouillon', async () => {
    const { user, jwt } = await createUserWithRole(strapi, 'auteur');
    const questionnaire = await createQuestionnaire(strapi, user, { statut: 'publie' });

    const res = await patch(jwt, questionnaire.documentId, {
      texte: 'Trop tard',
      type: 'texte_libre',
      position: 1,
    });

    expect(res.status).toBe(409);
    expect(res.body.error.status).toBe(409);
    expect(res.body.error.message).toBe('questions can only be added to a brouillon questionnaire');
  });

  it('ignores a spoofed questionnaire relation and a spoofed createdAt in the body', async () => {
    const { user, jwt } = await createUserWithRole(strapi, 'auteur');
    const questionnaire = await createQuestionnaire(strapi, user);
    const { user: otherOwner } = await createUserWithRole(strapi, 'auteur');
    const otherQuestionnaire = await createQuestionnaire(strapi, otherOwner);

    const res = await patch(jwt, questionnaire.documentId, {
      texte: 'Intégrité du corps de la requête',
      type: 'texte_libre',
      position: 1,
      questionnaire: otherQuestionnaire.documentId,
      createdAt: '2000-01-01T00:00:00.000Z',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.createdAt).not.toBe('2000-01-01T00:00:00.000Z');
    const stored = await strapi.documents('api::question.question').findOne({
      documentId: res.body.data.documentId,
      populate: ['questionnaire'],
    });
    expect(
      (stored as unknown as { questionnaire: { documentId: string } | null }).questionnaire
        ?.documentId,
    ).toBe(questionnaire.documentId);
  });
});
