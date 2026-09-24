import type {
  CreateResult,
  NewQuestionnaire,
  Visibilite,
} from '@/services/questionnaireService';
import type { CreationFormState, CreationMessage } from './creation-state';

export type SubmitCreationDeps = {
  access: string | undefined;
  create: (access: string, input: NewQuestionnaire) => Promise<CreateResult>;
};

export type CreationOutcome =
  | { kind: 'form'; state: CreationFormState }
  | { kind: 'redirect'; to: string };

function isVisibilite(value: string): value is Visibilite {
  return value === 'publique' || value === 'privee';
}

export async function submitCreation(
  formData: FormData,
  deps: SubmitCreationDeps,
): Promise<CreationOutcome> {
  const titre = String(formData.get('titre') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const choix = String(formData.get('visibilite') ?? '');
  const visibilite: Visibilite = isVisibilite(choix) ? choix : 'publique';
  const refuse = (message: CreationMessage): CreationOutcome => ({
    kind: 'form',
    state: { message, titre, description, visibilite },
  });
  if (!deps.access) return { kind: 'redirect', to: '/login' };
  if (titre === '') return refuse('missing-titre');
  if (!isVisibilite(choix)) return refuse('invalid');
  const result = await deps.create(deps.access, { titre, description, visibilite });
  if (result.ok) return { kind: 'redirect', to: `/questionnaires/${result.documentId}` };
  if (result.reason === 'session') return { kind: 'redirect', to: '/login' };
  return refuse(result.reason);
}
