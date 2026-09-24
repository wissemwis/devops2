import request from 'supertest';
import type { Core } from '@strapi/strapi';
import { setupStrapi, teardownStrapi } from '../helpers/strapi';
import { createUserWithRole } from '../helpers/users';

type BusinessRole = 'auteur' | 'administrateur' | 'repondant';

let strapi: Core.Strapi;

beforeAll(async () => {
  strapi = await setupStrapi();
});

afterAll(async () => {
  await teardownStrapi();
});

function refreshCookieOf(res: request.Response): string {
  const header = res.headers['set-cookie'] as string[] | string | undefined;
  const cookies = Array.isArray(header) ? header : header ? [header] : [];
  const found = cookies.find((cookie) => cookie.startsWith('strapi_up_refresh='));
  if (!found) throw new Error('no strapi_up_refresh cookie in the response');
  return found.split(';')[0];
}

async function signIn(type: BusinessRole): Promise<{ jwt: string; cookie: string }> {
  const { email, password } = await createUserWithRole(strapi, type);
  const res = await request(strapi.server.httpServer)
    .post('/api/auth/local')
    .send({ identifier: email, password });
  expect(res.status).toBe(200);
  expect(typeof res.body.jwt).toBe('string');
  expect(res.body).not.toHaveProperty('refreshToken');
  return { jwt: res.body.jwt, cookie: refreshCookieOf(res) };
}

function refresh(cookie: string) {
  return request(strapi.server.httpServer).post('/api/auth/refresh').set('Cookie', cookie).send({});
}

describe('session endpoints used by the frontend BFF (T063)', () => {
  it('returns the role type from GET /api/users/me?populate=role', async () => {
    for (const type of ['auteur', 'administrateur'] as const) {
      const { jwt } = await signIn(type);

      const res = await request(strapi.server.httpServer)
        .get('/api/users/me?populate=role')
        .set('Authorization', `Bearer ${jwt}`);

      expect(res.status).toBe(200);
      expect(res.body.role.type).toBe(type);
      expect(typeof res.body.nom).toBe('string');
      expect(res.body).not.toHaveProperty('password');
    }
  });

  it('rotates the refresh cookie on POST /api/auth/refresh', async () => {
    const { cookie } = await signIn('auteur');

    const res = await refresh(cookie);

    expect(res.status).toBe(200);
    expect(typeof res.body.jwt).toBe('string');
    expect(refreshCookieOf(res)).not.toBe(cookie);
  });

  it('lets each business role log out, after which its refresh token is refused', async () => {
    for (const type of ['auteur', 'administrateur', 'repondant'] as const) {
      const { jwt, cookie } = await signIn(type);

      const logout = await request(strapi.server.httpServer)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${jwt}`)
        .set('Cookie', cookie)
        .send({});

      expect(logout.status).toBe(200);
      expect(logout.body).toEqual({ ok: true });
      expect((await refresh(cookie)).status).toBe(401);
    }
  });
});
