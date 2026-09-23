import request from 'supertest';
import type { Core } from '@strapi/strapi';
import { setupStrapi, teardownStrapi } from '../helpers/strapi';
import { createUserWithRole } from '../helpers/users';

let strapi: Core.Strapi;

beforeAll(async () => {
  strapi = await setupStrapi();
});

afterAll(async () => {
  await teardownStrapi();
});

describe('quickstart Scénario 1 — créer et publier (T015, US1)', () => {
  it('lets a logged-in auteur create, fill, publish and close a questionnaire', async () => {
    const { email, password } = await createUserWithRole(strapi, 'auteur');
    const server = strapi.server.httpServer;

    const login = await request(server)
      .post('/api/auth/local')
      .send({ identifier: email, password });
    const jwt = login.body.jwt ?? '';
    const auth = { Authorization: `Bearer ${jwt}` };

    const created = await request(server)
      .post('/api/questionnaires')
      .set(auth)
      .send({ data: { titre: 'Retour S1', visibilite: 'publique' } });
    const id = created.body.data?.documentId;

    const questions = [
      { texte: 'Clarté', type: 'likert', position: 1, obligatoire: true },
      { texte: 'Format', type: 'choix_multiple', position: 2, options: ['Cours', 'TP'] },
      { texte: 'Remarques', type: 'texte_libre', position: 3 },
    ];
    const added = [];
    for (const data of questions) {
      added.push(
        await request(server).patch(`/api/questionnaires/${id}/questions`).set(auth).send({ data }),
      );
    }
    const published = await request(server)
      .post(`/api/questionnaires/${id}/publish`)
      .set(auth)
      .send();
    const closed = await request(server).post(`/api/questionnaires/${id}/close`).set(auth).send();

    expect(login.status).toBe(200);
    expect(created.status).toBe(201);
    expect(created.body.data.statut).toBe('brouillon');
    expect(added.map((res) => res.status)).toEqual([200, 200, 200]);
    expect(published.status).toBe(200);
    expect(published.body.data).toMatchObject({ documentId: id, statut: 'publie' });
    expect(closed.status).toBe(200);
    expect(closed.body.data.statut).toBe('ferme');
  });
});
