import type { Visibilite } from '@/services/questionnaireService';
import { LOGIN_MESSAGES } from './login-state';

export type CreationMessage = 'missing-titre' | 'invalid' | 'forbidden' | 'unavailable';

export type CreationFormState = {
  message: CreationMessage | null;
  titre: string;
  description: string;
  visibilite: Visibilite;
};

export const INITIAL_CREATION_STATE: CreationFormState = {
  message: null,
  titre: '',
  description: '',
  visibilite: 'publique',
};

export const CREATION_MESSAGES: Record<CreationMessage, string> = {
  'missing-titre': 'Donnez un titre à votre questionnaire.',
  invalid: 'Vérifiez le titre et la visibilité.',
  forbidden: 'Seuls les auteurs peuvent créer un questionnaire.',
  unavailable: LOGIN_MESSAGES.unavailable,
};

export function titreInvalide(message: CreationMessage | null): boolean {
  return message === 'missing-titre' || message === 'invalid';
}
