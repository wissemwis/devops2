import type { Core } from '@strapi/strapi';

let sequence = 0;

export async function createUserWithRole(
  strapi: Core.Strapi,
  type: 'auteur' | 'repondant' | 'administrateur',
): Promise<{
  user: { id: number; documentId: string };
  jwt: string;
  email: string;
  password: string;
}> {
  sequence += 1;
  const email = `${type}-${sequence}@example.test`;
  const password = 'Passw0rd!';
  const role = await strapi.db.query('plugin::users-permissions.role').findOne({ where: { type } });
  const user = await strapi
    .plugin('users-permissions')
    .service('user')
    .add({
      username: `${type}-${sequence}`,
      email,
      password,
      provider: 'local',
      confirmed: true,
      blocked: false,
      nom: `${type} ${sequence}`,
      role: role.id,
    });
  const jwt = await strapi.plugin('users-permissions').service('jwt').issue({ id: user.id });
  return { user, jwt, email, password };
}
