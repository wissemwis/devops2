import type { Core } from '@strapi/strapi';
import { errors } from '@strapi/utils';

export type QuestionnaireStatut = 'brouillon' | 'publie' | 'ferme';

export type QuestionnaireRecord = {
  id: number;
  documentId: string;
  statut: QuestionnaireStatut;
  positions: number[];
};

type Caller = { id: number; role?: { type?: string } };

type Loaded = {
  id: number;
  documentId: string;
  statut: QuestionnaireStatut;
  auteur?: { id: number } | null;
  questions?: { position: number }[];
};

export async function loadForAction(
  strapi: Core.Strapi,
  documentId: string,
  user: Caller,
  options: { allowAdministrateur?: boolean } = {},
): Promise<QuestionnaireRecord> {
  const found = (await strapi.documents('api::questionnaire.questionnaire').findOne({
    documentId,
    populate: ['auteur', 'questions'],
  })) as unknown as Loaded | null;
  if (!found) throw new errors.NotFoundError('questionnaire not found');
  const isOwner = found.auteur?.id === user.id;
  const isAdministrateur =
    options.allowAdministrateur === true && user.role?.type === 'administrateur';
  if (!isOwner && !isAdministrateur) {
    throw new errors.PolicyError('only the author of this questionnaire can do this');
  }
  return {
    id: found.id,
    documentId: found.documentId,
    statut: found.statut,
    positions: (found.questions ?? []).map((question) => question.position),
  };
}
