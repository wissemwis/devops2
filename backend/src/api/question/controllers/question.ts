import { factories } from '@strapi/strapi';
import { errors } from '@strapi/utils';
import createError from 'http-errors';
import { loadForAction } from '../../questionnaire/services/questionnaire-access';
import { optionsError, positionTaken } from '../services/question-rules';

const UID = 'api::question.question';

type Body = { data?: Record<string, unknown> };

const ADD_FIELDS = ['texte', 'type', 'position', 'obligatoire', 'options', 'image'] as const;

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
    async add(ctx) {
      const questionnaire = await loadForAction(strapi, ctx.params.id, ctx.state.user);
      if (questionnaire.statut !== 'brouillon') {
        throw createError(409, 'questions can only be added to a brouillon questionnaire');
      }
      const input = (await sanitizeInput((ctx.request.body as Body)?.data ?? {}, ctx)) as Record<
        string,
        unknown
      >;
      const fields = pick(input, ADD_FIELDS);
      const invalidOptions = optionsError(String(fields.type), fields.options);
      if (invalidOptions) throw new errors.ValidationError(invalidOptions);
      if (positionTaken(Number(fields.position), questionnaire.positions)) {
        throw new errors.ValidationError(
          `position ${fields.position} is already used in this questionnaire`,
        );
      }
      const created = await strapi.documents(UID).create({
        data: { ...fields, questionnaire: questionnaire.documentId } as never,
      });
      const output = await sanitizeOutput(created, ctx);
      return transformResponse(output);
    },
  };
});
