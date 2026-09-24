import type { LoginFormState } from '@/lib/login-state';
import { AnnotationErreur } from './AnnotationErreur';
import { ChampLigne } from './ChampLigne';

type LoginFormViewProps = {
  state: LoginFormState;
  action: (formData: FormData) => void;
  pending: boolean;
};

const ERREUR_ID = 'connexion-erreur';

export function LoginFormView({ state, action, pending }: LoginFormViewProps) {
  const invalid = state.message !== null;
  const describedBy = invalid ? ERREUR_ID : undefined;
  return (
    <form action={action}>
      {invalid && <AnnotationErreur id={ERREUR_ID}>{state.message}</AnnotationErreur>}
      <ChampLigne
        id="email"
        name="email"
        label="Email"
        type="email"
        autoComplete="username"
        defaultValue={state.email}
        invalid={invalid}
        describedBy={describedBy}
      />
      <ChampLigne
        id="password"
        name="password"
        label="Mot de passe"
        type="password"
        autoComplete="current-password"
        invalid={invalid}
        describedBy={describedBy}
      />
      <button
        type="submit"
        disabled={pending}
        className="entoure mt-[calc(var(--spacing-ligne)*2)] h-ligne rounded-sm bg-encre px-6 font-bold text-papier transition-[background-color,transform] duration-[120ms] hover:bg-encre-sombre active:translate-y-px disabled:cursor-wait disabled:bg-encre-sombre"
      >
        {pending ? 'Connexion…' : 'Se connecter'}
      </button>
    </form>
  );
}
