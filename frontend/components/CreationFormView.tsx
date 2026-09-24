import Link from 'next/link';
import { CREATION_MESSAGES, type CreationFormState, titreInvalide } from '@/lib/creation-state';
import { AnnotationErreur } from './AnnotationErreur';
import { ChampLigne } from './ChampLigne';
import { ChampLignes } from './ChampLignes';
import { type Choix, ChoixCases } from './ChoixCases';

type CreationFormViewProps = {
  state: CreationFormState;
  action: (formData: FormData) => void;
  pending: boolean;
};

const ERREUR_ID = 'creation-erreur';

export const VISIBILITES: readonly Choix[] = [
  { value: 'publique', label: 'Publique — toute personne ayant le lien' },
  { value: 'privee', label: 'Privée — uniquement les personnes invitées' },
];

export function CreationFormView({ state, action, pending }: CreationFormViewProps) {
  const message = state.message === null ? null : CREATION_MESSAGES[state.message];
  const invalid = titreInvalide(state.message);
  return (
    <form action={action}>
      {message && <AnnotationErreur id={ERREUR_ID}>{message}</AnnotationErreur>}
      <ChampLigne
        id="titre"
        name="titre"
        label="Titre"
        type="text"
        autoComplete="off"
        maxLength={255}
        defaultValue={state.titre}
        invalid={invalid}
        describedBy={invalid ? ERREUR_ID : undefined}
      />
      <ChampLignes
        id="description"
        name="description"
        label="Description (facultatif)"
        defaultValue={state.description}
      />
      <ChoixCases
        name="visibilite"
        legend="Visibilité"
        choix={VISIBILITES}
        defaultValue={state.visibilite}
      />
      <div className="mt-[calc(var(--spacing-ligne)*2)] flex items-center gap-6">
        <button
          type="submit"
          disabled={pending}
          className="entoure h-ligne rounded-sm bg-encre px-6 font-bold text-papier transition-[background-color,transform] duration-[120ms] hover:bg-encre-sombre active:translate-y-px disabled:cursor-wait disabled:bg-encre-sombre"
        >
          {pending ? 'Création…' : 'Créer le brouillon'}
        </button>
        <Link
          href="/questionnaires"
          className="entoure text-encre underline underline-offset-4 transition-colors duration-[120ms] hover:text-encre-sombre"
        >
          Annuler
        </Link>
      </div>
    </form>
  );
}
