import request from 'supertest';
import type { Core, Modules } from '@strapi/strapi';
import { setupStrapi, teardownStrapi } from '../helpers/strapi';

const ROLE_UID = 'plugin::users-permissions.role';
const USER_UID = 'plugin::users-permissions.user';
type UserInput = Modules.Documents.Params.Data.Input<typeof USER_UID>;

let strapi: Core.Strapi;

beforeAll(async () => {
  strapi = await setupStrapi();
});

afterAll(async () => {
  await teardownStrapi();
});

async function findOrCreateRole(type: string): Promise<{ id: number; type: string }> {
  const roles = strapi.db.query(ROLE_UID);
  const existing = await roles.findOne({ where: { type } });
  if (existing) return existing;
  return roles.create({ data: { type, name: type, description: 'created by test' } });
}

describe('User content-type (T061, FR-016)', () => {
  it('resolves the permissions of a user authenticated with a business role', async () => {
    const auteur = await findOrCreateRole('auteur');
    const user = await strapi.plugin('users-permissions').service('user').add({
      username: 'auteur-t061',
      email: 'auteur-t061@example.test',
      password: 'Passw0rd!',
      provider: 'local',
      confirmed: true,
      blocked: false,
      nom: 'Auteur T061',
      role: auteur.id,
    });
    const jwt = await strapi.plugin('users-permissions').service('jwt').issue({ id: user.id });

    const res = await request(strapi.server.httpServer)
      .get('/api/users/me?populate=role')
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body.role.type).toBe('auteur');
  });

  it('rejects a user without nom', async () => {
    const auteur = await findOrCreateRole('auteur');
    const dataWithoutNom = {
      username: 'sans-nom',
      email: 'sans-nom@example.test',
      password: 'Passw0rd!',
      provider: 'local',
      role: auteur.id,
    } as Partial<UserInput> as UserInput;
    await expect(strapi.documents(USER_UID).create({ data: dataWithoutNom })).rejects.toThrow(
      /nom/,
    );
  });
});
