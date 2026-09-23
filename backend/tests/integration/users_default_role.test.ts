import request from 'supertest';
import type { Core } from '@strapi/strapi';
import { setupStrapi, teardownStrapi } from '../helpers/strapi';
import { setDefaultRespondentRole } from '../../src/bootstrap/roles';

const ROLE_UID = 'plugin::users-permissions.role';
const USER_UID = 'plugin::users-permissions.user';

let strapi: Core.Strapi;

beforeAll(async () => {
  strapi = await setupStrapi();
});

afterAll(async () => {
  await teardownStrapi();
});

function pluginStore() {
  return strapi.store({ type: 'plugin', name: 'users-permissions' });
}

async function findRole(type: string): Promise<{ id: number; type: string }> {
  return strapi.db.query(ROLE_UID).findOne({ where: { type } });
}

describe('default FR-016 role for role-less users (fix wave)', () => {
  it('sets default_role to repondant and preserves the other advanced settings', async () => {
    const before = (await pluginStore().get({ key: 'advanced' })) as Record<string, unknown>;
    await pluginStore().set({
      key: 'advanced',
      value: { ...before, default_role: 'authenticated' },
    });

    await setDefaultRespondentRole(strapi);

    const after = await pluginStore().get({ key: 'advanced' });
    expect(after).toEqual({ ...before, default_role: 'repondant' });
  });

  it('is idempotent once default_role is already repondant', async () => {
    await setDefaultRespondentRole(strapi);
    const before = (await pluginStore().get({ key: 'advanced' })) as Record<string, unknown>;

    await setDefaultRespondentRole(strapi);

    const after = await pluginStore().get({ key: 'advanced' });
    expect(after).toEqual(before);
  });

  it('assigns the repondant role to a user created without a role', async () => {
    const repondant = await findRole('repondant');
    const user = await strapi.db.query(USER_UID).create({
      data: {
        username: 'sans-role-t061',
        email: 'sans-role-t061@example.test',
        password: 'Passw0rd!',
        provider: 'local',
        confirmed: true,
        blocked: false,
        nom: 'Sans Role',
      },
    });

    const withRole = await strapi.db
      .query(USER_UID)
      .findOne({ where: { id: user.id }, populate: ['role'] });

    expect(withRole.role.type).toBe('repondant');
    expect(withRole.role.id).toBe(repondant.id);
  });

  it('keeps an explicitly assigned role', async () => {
    const auteur = await findRole('auteur');
    const user = await strapi.db.query(USER_UID).create({
      data: {
        username: 'avec-role-t061',
        email: 'avec-role-t061@example.test',
        password: 'Passw0rd!',
        provider: 'local',
        confirmed: true,
        blocked: false,
        nom: 'Avec Role',
        role: auteur.id,
      },
    });

    const withRole = await strapi.db
      .query(USER_UID)
      .findOne({ where: { id: user.id }, populate: ['role'] });

    expect(withRole.role.type).toBe('auteur');
  });

  it('lets a role-less user log in and fetch /api/users/me without crashing', async () => {
    const repondant = await findRole('repondant');
    await strapi.db.query('plugin::users-permissions.permission').create({
      data: { action: 'plugin::users-permissions.user.me', role: repondant.id },
    });
    await strapi.plugin('users-permissions').service('user').add({
      username: 'repondant-login-t061',
      email: 'repondant-login-t061@example.test',
      password: 'Passw0rd!',
      provider: 'local',
      confirmed: true,
      blocked: false,
      nom: 'Repondant Login T061',
    });

    const loginRes = await request(strapi.server.httpServer)
      .post('/api/auth/local')
      .send({ identifier: 'repondant-login-t061@example.test', password: 'Passw0rd!' });

    expect(loginRes.status).toBe(200);

    const meRes = await request(strapi.server.httpServer)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${loginRes.body.jwt}`);

    expect(meRes.status).toBe(200);
  });
});
