import request from 'supertest';
import type { Core } from '@strapi/strapi';
import { setupStrapi, teardownStrapi } from '../helpers/strapi';
import {
  ROLE_PERMISSIONS,
  grantRolePermissions,
  listControllerActions,
} from '../../src/bootstrap/permissions';

const ROLE_UID = 'plugin::users-permissions.role';
const PERMISSION_UID = 'plugin::users-permissions.permission';
const BUSINESS_TYPES = ['auteur', 'repondant', 'administrateur'];
const USER_WRITE_ACTIONS = [
  'plugin::users-permissions.user.update',
  'plugin::users-permissions.user.create',
  'plugin::users-permissions.user.destroy',
  'plugin::users-permissions.role.createRole',
  'plugin::users-permissions.role.updateRole',
  'plugin::users-permissions.role.deleteRole',
];

let strapi: Core.Strapi;

beforeAll(async () => {
  strapi = await setupStrapi();
});

afterAll(async () => {
  await teardownStrapi();
});

async function findRole(type: string): Promise<{ id: number; type: string }> {
  return strapi.db.query(ROLE_UID).findOne({ where: { type } });
}

async function actionsOfRole(type: string): Promise<string[]> {
  const permissions = await strapi.db.query(PERMISSION_UID).findMany({ where: { role: { type } } });
  return permissions.map((permission: { action: string }) => permission.action).sort();
}

describe('role permissions (T062, FR-016)', () => {
  it('grants each business role exactly its table actions at boot', async () => {
    for (const [type, actions] of Object.entries(ROLE_PERMISSIONS)) {
      expect(await actionsOfRole(type)).toEqual([...actions].sort());
    }
  });

  it('only lists actions the loaded app exposes', () => {
    const known = listControllerActions(strapi);
    const unknown = Object.values(ROLE_PERMISSIONS)
      .flat()
      .filter((action) => !known.has(action));
    expect(unknown).toEqual([]);
  });

  it('never lets a business role write users', async () => {
    const tableWrites = Object.values(ROLE_PERMISSIONS)
      .flat()
      .filter((action) => USER_WRITE_ACTIONS.includes(action));
    expect(tableWrites).toEqual([]);

    const granted = await strapi.db.query(PERMISSION_UID).findMany({
      where: { action: { $in: USER_WRITE_ACTIONS }, role: { type: { $in: BUSINESS_TYPES } } },
    });
    expect(granted).toEqual([]);
  });

  it('denies a repondant its own profile', async () => {
    const repondant = await findRole('repondant');
    const user = await strapi.plugin('users-permissions').service('user').add({
      username: 'repondant-t062',
      email: 'repondant-t062@example.test',
      password: 'Passw0rd!',
      provider: 'local',
      confirmed: true,
      blocked: false,
      nom: 'Répondant T062',
      role: repondant.id,
    });
    const jwt = await strapi.plugin('users-permissions').service('jwt').issue({ id: user.id });

    const res = await request(strapi.server.httpServer)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(403);
  });

  it('keeps a permission added by hand and creates no duplicate', async () => {
    const auteur = await findRole('auteur');
    await strapi.db.query(PERMISSION_UID).create({
      data: { action: 'plugin::users-permissions.user.find', role: auteur.id },
    });

    await grantRolePermissions(strapi);

    expect(await actionsOfRole('auteur')).toEqual(
      [...ROLE_PERMISSIONS.auteur, 'plugin::users-permissions.user.find'].sort(),
    );
  });

  it('skips an unknown action with a warning and writes no row', async () => {
    const warn = jest.spyOn(strapi.log, 'warn');

    await grantRolePermissions(strapi, {
      auteur: ['api::nope.nope.find'],
      repondant: [],
      administrateur: [],
    });

    expect(warn).toHaveBeenCalledWith(
      'Skipped unknown action "api::nope.nope.find" for role "auteur"',
    );
    expect(
      await strapi.db.query(PERMISSION_UID).count({ where: { action: 'api::nope.nope.find' } }),
    ).toBe(0);
    warn.mockRestore();
  });
});
