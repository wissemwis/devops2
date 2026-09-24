export type LoginFormState = { message: string | null; email: string };

export const INITIAL_LOGIN_STATE: LoginFormState = { message: null, email: '' };

export const LOGIN_MESSAGES = {
  missing: 'Renseignez votre email et votre mot de passe.',
  invalid: 'Email ou mot de passe incorrect.',
  'forbidden-role': "Ce compte n'a pas accès à l'espace auteur.",
  unavailable: 'Le service est momentanément indisponible. Réessayez dans un instant.',
} as const;
