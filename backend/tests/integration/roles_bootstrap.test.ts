import request from 'supertest';
import type { Core } from '@strapi/strapi';
import { setupStrapi, teardownStrapi } from '../helpers/strapi';
import { closePublicRegistration, ensureBusinessRoles } from '../../src/bootstrap/roles';

const ROLE_UID = 'plugin::users-permissions.role';
const BUSINESS_TYPES = ['administrateur', 'auteur', 'repondant'];

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

describe('business roles bootstrap (T061, FR-016)', () => {
  it('creates the three FR-016 roles at boot', async () => {
    const roles = await strapi.db
      .query(ROLE_UID)
      .findMany({ where: { type: { $in: BUSINESS_TYPES } } });
    expect(roles.map((r: { type: string }) => r.type).sort()).toEqual(BUSINESS_TYPES);
  });

  it('is idempotent and never overwrites an existing role', async () => {
    const roles = strapi.db.query(ROLE_UID);
    await roles.update({
      where: { type: 'auteur' },
      data: { description: 'edited in the admin panel' },
    });

    await ensureBusinessRoles(strapi);

    expect(await roles.count({ where: { type: { $in: BUSINESS_TYPES } } })).toBe(3);
    const auteur = await roles.findOne({ where: { type: 'auteur' } });
    expect(auteur.description).toBe('edited in the admin panel');
  });

  it('closes public registration at boot', async () => {
    const advanced = (await pluginStore().get({ key: 'advanced' })) as Record<string, unknown>;
    expect(advanced.allow_register).toBe(false);

    const res = await request(strapi.server.httpServer)
      .post('/api/auth/local/register')
      .send({ username: 'self-signup', email: 'self-signup@example.test', password: 'Passw0rd!' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Register action is currently disabled');
  });

  it('re-closes registration re-enabled in the admin panel, keeping the other settings', async () => {
    const before = (await pluginStore().get({ key: 'advanced' })) as Record<string, unknown>;
    await pluginStore().set({ key: 'advanced', value: { ...before, allow_register: true } });

    await closePublicRegistration(strapi);

    const after = await pluginStore().get({ key: 'advanced' });
    expect(after).toEqual({ ...before, allow_register: false });
  });
});
