import type { Core } from '@strapi/strapi';

let position = 0;

export async function createQuestionnaire(
  strapi: Core.Strapi,
  owner: { id: number },
  overrides: Record<string, unknown> = {},
): Promise<{ id: number; documentId: string; statut: string }> {
  return strapi.documents('api::questionnaire.questionnaire').create({
    data: {
      titre: 'Retour de séance',
      visibilite: 'publique',
      statut: 'brouillon',
      auteur: owner.id,
      ...overrides,
    } as never,
  }) as unknown as Promise<{ id: number; documentId: string; statut: string }>;
}

export async function addQuestion(
  strapi: Core.Strapi,
  questionnaire: { documentId: string },
  overrides: Record<string, unknown> = {},
): Promise<{ id: number; documentId: string; position: number }> {
  position += 1;
  return strapi.documents('api::question.question').create({
    data: {
      texte: 'La séance était-elle claire ?',
      type: 'likert',
      position,
      obligatoire: true,
      questionnaire: questionnaire.documentId,
      ...overrides,
    } as never,
  }) as unknown as Promise<{ id: number; documentId: string; position: number }>;
}
