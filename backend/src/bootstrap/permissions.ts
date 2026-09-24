import type { Core } from '@strapi/strapi';
import { BUSINESS_ROLES } from './roles';

export type BusinessRoleType = (typeof BUSINESS_ROLES)[number]['type'];

export const ROLE_PERMISSIONS: Record<BusinessRoleType, readonly string[]> = {
  auteur: [
    'plugin::users-permissions.user.me',
    'plugin::users-permissions.role.find',
    'plugin::users-permissions.auth.logout',
    'api::questionnaire.questionnaire.create',
    'api::questionnaire.questionnaire.publish',
    'api::questionnaire.questionnaire.close',
    'api::questionnaire.questionnaire.findMine',
    'api::questionnaire.questionnaire.findOneMine',
    'api::question.question.add',
  ],
  repondant: ['plugin::users-permissions.auth.logout'],
  administrateur: [
    'plugin::users-permissions.user.me',
    'plugin::users-permissions.role.find',
    'plugin::users-permissions.auth.logout',
    'api::questionnaire.questionnaire.close',
    'api::questionnaire.questionnaire.findMine',
    'api::questionnaire.questionnaire.findOneMine',
  ],
};

const ROLE_UID = 'plugin::users-permissions.role';
const PERMISSION_UID = 'plugin::users-permissions.permission';

type ControllerOwners = Record<string, { controllers?: Record<string, object> }>;

function controllerActions(prefix: 'api' | 'plugin', owners: ControllerOwners): string[] {
  return Object.entries(owners).flatMap(([ownerName, owner]) =>
    Object.entries(owner.controllers ?? {}).flatMap(([controllerName, controller]) =>
      Object.keys(controller).map(
        (actionName) => `${prefix}::${ownerName}.${controllerName}.${actionName}`,
      ),
    ),
  );
}

export function listControllerActions(strapi: Core.Strapi): Set<string> {
  return new Set([
    ...controllerActions('api', strapi.apis as unknown as ControllerOwners),
    ...controllerActions('plugin', strapi.plugins as unknown as ControllerOwners),
  ]);
}

export async function grantRolePermissions(
  strapi: Core.Strapi,
  table: Record<BusinessRoleType, readonly string[]> = ROLE_PERMISSIONS,
): Promise<void> {
  const known = listControllerActions(strapi);
  const permissions = strapi.db.query(PERMISSION_UID);
  for (const [type, actions] of Object.entries(table)) {
    const role = await strapi.db.query(ROLE_UID).findOne({ where: { type } });
    if (!role) {
      strapi.log.warn(`Skipped permissions of missing role "${type}"`);
      continue;
    }
    for (const action of actions) {
      if (!known.has(action)) {
        strapi.log.warn(`Skipped unknown action "${action}" for role "${type}"`);
        continue;
      }
      const existing = await permissions.findOne({ where: { action, role: { id: role.id } } });
      if (existing) continue;
      await permissions.create({ data: { action, role: role.id } });
      strapi.log.info(`Granted "${action}" to role "${type}"`);
    }
  }
}
