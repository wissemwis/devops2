import type { Core } from '@strapi/strapi';

export const BUSINESS_ROLES = [
  {
    type: 'auteur',
    name: 'Auteur',
    description: 'Crée, publie et suit ses propres questionnaires (FR-016).',
  },
  {
    type: 'repondant',
    name: 'Répondant',
    description: 'Répond aux questionnaires ; aucun droit par défaut (FR-016).',
  },
  {
    type: 'administrateur',
    name: 'Administrateur',
    description: "Gère l'ensemble des questionnaires (FR-016).",
  },
] as const;

const ROLE_UID = 'plugin::users-permissions.role';

export async function ensureBusinessRoles(strapi: Core.Strapi): Promise<void> {
  const roles = strapi.db.query(ROLE_UID);
  for (const role of BUSINESS_ROLES) {
    const existing = await roles.findOne({ where: { type: role.type } });
    if (existing) continue;
    await roles.create({ data: { ...role } });
    strapi.log.info(`Created users-permissions role "${role.type}"`);
  }
}

export async function closePublicRegistration(strapi: Core.Strapi): Promise<void> {
  const store = strapi.store({ type: 'plugin', name: 'users-permissions' });
  const advanced = ((await store.get({ key: 'advanced' })) ?? {}) as Record<string, unknown>;
  if (advanced.allow_register === false) return;
  await store.set({ key: 'advanced', value: { ...advanced, allow_register: false } });
  strapi.log.info('Closed public registration (users-permissions allow_register=false)');
}

const DEFAULT_ROLE_TYPE = 'repondant';

export async function setDefaultRespondentRole(strapi: Core.Strapi): Promise<void> {
  const store = strapi.store({ type: 'plugin', name: 'users-permissions' });
  const advanced = ((await store.get({ key: 'advanced' })) ?? {}) as Record<string, unknown>;
  if (advanced.default_role === DEFAULT_ROLE_TYPE) return;
  await store.set({ key: 'advanced', value: { ...advanced, default_role: DEFAULT_ROLE_TYPE } });
  strapi.log.info(`Set users-permissions default_role to "${DEFAULT_ROLE_TYPE}"`);
}

export function subscribeDefaultRespondentRole(strapi: Core.Strapi): void {
  strapi.db.lifecycles.subscribe({
    models: ['plugin::users-permissions.user'],
    async beforeCreate(event) {
      const { data } = event.params;
      if (data.role) return;
      const role = await strapi.db.query(ROLE_UID).findOne({ where: { type: DEFAULT_ROLE_TYPE } });
      if (role) data.role = role.id;
    },
  });
}
