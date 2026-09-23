import type { Core } from '@strapi/strapi';

const USER_UID = 'plugin::users-permissions.user';
const ROLE_UID = 'plugin::users-permissions.role';
const DEFAULT_NOM = 'Auteur de test';

export async function ensureDevAuteurAccount(
  strapi: Core.Strapi,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  if (env.NODE_ENV !== 'development') return;
  const email = env.DEV_AUTEUR_EMAIL?.trim().toLowerCase();
  const password = env.DEV_AUTEUR_PASSWORD;
  if (!email || !password) {
    strapi.log.warn('Dev auteur account skipped: DEV_AUTEUR_EMAIL/DEV_AUTEUR_PASSWORD not set');
    return;
  }
  const existing = await strapi.db.query(USER_UID).findOne({ where: { email } });
  if (existing) {
    strapi.log.info(`Dev auteur account "${email}" already exists`);
    return;
  }
  const auteur = await strapi.db.query(ROLE_UID).findOne({ where: { type: 'auteur' } });
  await strapi
    .plugin('users-permissions')
    .service('user')
    .add({
      username: email,
      email,
      password,
      nom: env.DEV_AUTEUR_NOM || DEFAULT_NOM,
      provider: 'local',
      confirmed: true,
      blocked: false,
      role: auteur.id,
    });
  strapi.log.info(`Created dev auteur account "${email}"`);
}
