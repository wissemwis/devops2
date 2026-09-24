import { factories } from '@strapi/strapi';
import createError from 'http-errors';
import { loadForAction } from '../services/questionnaire-access';

const UID = 'api::questionnaire.questionnaire';

type Body = { data?: Record<string, unknown> };

const CREATE_FIELDS = ['titre', 'description', 'visibilite'] as const;

const READ_FIELDS = [
  'titre',
  'description',
  'statut',
  'visibilite',
  'createdAt',
  'updatedAt',
] as const;

function pick<T extends readonly string[]>(
  input: Record<string, unknown>,
  keys: T,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    if (key in input) result[key] = input[key];
  }
  return result;
}

const baseController = factories.createCoreController(UID);

export default factories.createCoreController(UID, ({ strapi }) => {
  const { sanitizeInput, sanitizeOutput, transformResponse } = baseController({ strapi });

  return {
    async create(ctx) {
      const input = (await sanitizeInput((ctx.request.body as Body)?.data ?? {}, ctx)) as Record<
        string,
        unknown
      >;
      const fields = pick(input, CREATE_FIELDS);
      const created = await strapi.documents(UID).create({
        data: { ...fields, statut: 'brouillon', auteur: ctx.state.user.id } as never,
      });
      const output = await sanitizeOutput(created, ctx);
      ctx.status = 201;
      return transformResponse(output);
    },

    async publish(ctx) {
      const questionnaire = await loadForAction(strapi, ctx.params.id, ctx.state.user);
      if (questionnaire.statut !== 'brouillon') {
        throw createError(409, 'only a brouillon questionnaire can be published');
      }
      if (questionnaire.positions.length === 0) {
        throw createError(422, 'a questionnaire needs at least one question to be published');
      }
      const updated = await strapi.documents(UID).update({
        documentId: questionnaire.documentId,
        data: { statut: 'publie' } as never,
      });
      const output = await sanitizeOutput(updated, ctx);
      return transformResponse(output);
    },

    async close(ctx) {
      const questionnaire = await loadForAction(strapi, ctx.params.id, ctx.state.user, {
        allowAdministrateur: true,
      });
      if (questionnaire.statut !== 'publie') {
        throw createError(409, 'only a publie questionnaire can be closed');
      }
      const updated = await strapi.documents(UID).update({
        documentId: questionnaire.documentId,
        data: { statut: 'ferme' } as never,
      });
      const output = await sanitizeOutput(updated, ctx);
      return transformResponse(output);
    },

    async findMine(ctx) {
      const found = await strapi.documents(UID).findMany({
        filters: { auteur: { id: ctx.state.user.id } },
        sort: 'updatedAt:desc',
        fields: READ_FIELDS,
      } as never);
      const output = await sanitizeOutput(found, ctx);
      return transformResponse(output);
    },

    async findOneMine(ctx) {
      const questionnaire = await loadForAction(strapi, ctx.params.id, ctx.state.user, {
        allowAdministrateur: true,
      });
      const found = await strapi.documents(UID).findOne({
        documentId: questionnaire.documentId,
        fields: READ_FIELDS,
        populate: { questions: { sort: 'position:asc', populate: ['image'] } },
      } as never);
      const output = await strapi.contentAPI.sanitize.output(found, strapi.getModel(UID));
      return transformResponse(output);
    },
  };
});
