import request from 'supertest';
import type { Core } from '@strapi/strapi';
import { setupStrapi, teardownStrapi } from '../helpers/strapi';
import { ensureDevAuteurAccount } from '../../src/bootstrap/dev-account';

const USER_UID = 'plugin::users-permissions.user';
const PASSWORD = 'Dev-Passw0rd!';

let strapi: Core.Strapi;

beforeAll(async () => {
  strapi = await setupStrapi();
});

afterAll(async () => {
  await teardownStrapi();
});

function devEnv(email: string, extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'development',
    DEV_AUTEUR_EMAIL: email,
    DEV_AUTEUR_PASSWORD: PASSWORD,
    ...extra,
  };
}

async function findUser(email: string) {
  return strapi.db.query(USER_UID).findOne({ where: { email }, populate: ['role'] });
}

async function login(identifier: string, password: string) {
  return request(strapi.server.httpServer).post('/api/auth/local').send({ identifier, password });
}

describe('development auteur account (T062, quickstart Scénario 1)', () => {
  it('creates an auteur account that can log in and read its profile', async () => {
    await ensureDevAuteurAccount(strapi, devEnv('dev.auteur@example.test'));

    const user = await findUser('dev.auteur@example.test');
    expect(user.role.type).toBe('auteur');
    expect(user.nom).toBe('Auteur de test');
    expect(user.confirmed).toBe(true);
    expect(user.password).not.toBe(PASSWORD);

    const auth = await login('dev.auteur@example.test', PASSWORD);
    expect(auth.status).toBe(200);
    const me = await request(strapi.server.httpServer)
      .get('/api/users/me?populate=role')
      .set('Authorization', `Bearer ${auth.body.jwt}`);
    expect(me.status).toBe(200);
    expect(me.body.role.type).toBe('auteur');
  });

  it('uses DEV_AUTEUR_NOM when given', async () => {
    await ensureDevAuteurAccount(
      strapi,
      devEnv('named.auteur@example.test', { DEV_AUTEUR_NOM: 'Wissem Hamza' }),
    );

    expect((await findUser('named.auteur@example.test')).nom).toBe('Wissem Hamza');
  });

  it('leaves an existing account untouched', async () => {
    const user = await findUser('dev.auteur@example.test');
    await strapi
      .plugin('users-permissions')
      .service('user')
      .edit(user.id, { password: 'Changed-Passw0rd!' });

    await ensureDevAuteurAccount(strapi, devEnv('dev.auteur@example.test'));

    expect(
      await strapi.db.query(USER_UID).count({ where: { email: 'dev.auteur@example.test' } }),
    ).toBe(1);
    expect((await login('dev.auteur@example.test', 'Changed-Passw0rd!')).status).toBe(200);
  });

  it('normalises the email', async () => {
    await ensureDevAuteurAccount(strapi, devEnv('  Upper.Auteur@Example.Test '));

    expect(await findUser('upper.auteur@example.test')).not.toBeNull();
    expect((await login('upper.auteur@example.test', PASSWORD)).status).toBe(200);
  });

  it('does nothing outside development', async () => {
    await ensureDevAuteurAccount(
      strapi,
      devEnv('prod.auteur@example.test', { NODE_ENV: 'production' }),
    );
    await ensureDevAuteurAccount(strapi, devEnv('test.auteur@example.test', { NODE_ENV: 'test' }));

    expect(await findUser('prod.auteur@example.test')).toBeNull();
    expect(await findUser('test.auteur@example.test')).toBeNull();
  });

  it('skips with a warning when a credential is missing', async () => {
    const warn = jest.spyOn(strapi.log, 'warn');

    await ensureDevAuteurAccount(strapi, {
      NODE_ENV: 'development',
      DEV_AUTEUR_EMAIL: 'nopass.auteur@example.test',
    });

    expect(warn).toHaveBeenCalledWith(
      'Dev auteur account skipped: DEV_AUTEUR_EMAIL/DEV_AUTEUR_PASSWORD not set',
    );
    expect(await findUser('nopass.auteur@example.test')).toBeNull();
    warn.mockRestore();
  });

  it('never logs the password', async () => {
    const spies = (['info', 'warn', 'error', 'debug'] as const).map((level) =>
      jest.spyOn(strapi.log, level),
    );

    await ensureDevAuteurAccount(strapi, devEnv('quiet.auteur@example.test'));
    await ensureDevAuteurAccount(strapi, devEnv('quiet.auteur@example.test'));

    const logged = JSON.stringify(spies.flatMap((spy) => spy.mock.calls));
    expect(logged).toContain('quiet.auteur@example.test');
    expect(logged).not.toContain(PASSWORD);
    spies.forEach((spy) => spy.mockRestore());
  });
});
