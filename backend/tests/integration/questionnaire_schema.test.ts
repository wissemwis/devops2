import type { Core } from '@strapi/strapi';
import { setupStrapi, teardownStrapi } from '../helpers/strapi';

let strapi: Core.Strapi;

beforeAll(async () => {
  strapi = await setupStrapi();
});

afterAll(async () => {
  await teardownStrapi();
});

function attributes(uid: string): Record<string, Record<string, unknown>> {
  const contentType = strapi.contentType(uid as never) as unknown as {
    attributes: Record<string, Record<string, unknown>>;
    options?: { draftAndPublish?: boolean };
  };
  return contentType.attributes;
}

function draftAndPublish(uid: string): boolean | undefined {
  const contentType = strapi.contentType(uid as never) as unknown as {
    options?: { draftAndPublish?: boolean };
  };
  return contentType.options?.draftAndPublish;
}

describe('Questionnaire and Question content-types (T016, T017)', () => {
  it('defines the Questionnaire attributes of the data model', () => {
    const attrs = attributes('api::questionnaire.questionnaire');
    expect(attrs.titre).toMatchObject({ type: 'string', required: true });
    expect(attrs.description).toMatchObject({ type: 'text' });
    expect(attrs.statut).toMatchObject({
      type: 'enumeration',
      enum: ['brouillon', 'publie', 'ferme'],
      default: 'brouillon',
      required: true,
    });
    expect(attrs.visibilite).toMatchObject({
      type: 'enumeration',
      enum: ['publique', 'privee'],
      required: true,
    });
    expect(attrs.auteur).toMatchObject({
      type: 'relation',
      relation: 'manyToOne',
      target: 'plugin::users-permissions.user',
    });
    expect(attrs.questions).toMatchObject({
      type: 'relation',
      relation: 'oneToMany',
      target: 'api::question.question',
      mappedBy: 'questionnaire',
    });
    expect(draftAndPublish('api::questionnaire.questionnaire')).toBe(false);
  });

  it('defines the Question attributes of the data model', () => {
    const attrs = attributes('api::question.question');
    expect(attrs.texte).toMatchObject({ type: 'string', required: true });
    expect(attrs.type).toMatchObject({
      type: 'enumeration',
      enum: ['likert', 'choix_multiple', 'texte_libre'],
      required: true,
    });
    expect(attrs.position).toMatchObject({ type: 'integer', required: true, min: 1 });
    expect(attrs.obligatoire).toMatchObject({ type: 'boolean', default: false, required: true });
    expect(attrs.options).toMatchObject({ type: 'json' });
    expect(attrs.image).toMatchObject({ type: 'media', multiple: false, allowedTypes: ['images'] });
    expect(attrs.questionnaire).toMatchObject({
      type: 'relation',
      relation: 'manyToOne',
      target: 'api::questionnaire.questionnaire',
      inversedBy: 'questions',
    });
    expect(draftAndPublish('api::question.question')).toBe(false);
  });

  it('exposes no core route for either API', () => {
    const paths = strapi.server.listRoutes().map((route) => route.path);
    expect(paths).not.toContain('/api/questionnaires/:id');
    expect(paths).not.toContain('/api/questions');
    expect(paths).not.toContain('/api/questions/:id');
  });
});
