import type { SommaireState } from '@/services/mesQuestionnaires';
import { AnnotationErreur } from './AnnotationErreur';
import { TamponStatut } from './TamponStatut';

const DATE = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/Paris',
});

export function Sommaire({ state }: { state: SommaireState }) {
  if (state.kind === 'error') {
    return (
      <AnnotationErreur id="sommaire-erreur">
        Impossible de charger vos questionnaires.{' '}
        <a
          href="/questionnaires"
          className="entoure font-bold text-encre underline transition-colors duration-[120ms] hover:text-encre-sombre"
        >
          Réessayer
        </a>
      </AnnotationErreur>
    );
  }
  if (state.items.length === 0) {
    return (
      <p className="mt-ligne leading-[32px] text-crayon">Vos questionnaires apparaîtront ici.</p>
    );
  }
  return (
    <ol className="mt-ligne">
      {state.items.map((item, index) => (
        <li key={item.documentId} className="relative flex items-center gap-3 leading-[32px]">
          <span className="tabular-nums text-graphite-doux sm:absolute sm:right-[calc(100%+3.25rem)] sm:text-right">
            {index + 1}.
          </span>
          <span className="min-w-0 truncate">{item.titre}</span>
          <span
            aria-hidden="true"
            className="min-w-4 flex-1 translate-y-2 border-b-2 border-dotted border-reglure-forte"
          />
          <TamponStatut statut={item.statut} />
          <span className="hidden text-sm tabular-nums text-graphite-doux sm:inline">
            modifié le{' '}
            <time dateTime={item.updatedAt}>{DATE.format(new Date(item.updatedAt))}</time>
          </span>
        </li>
      ))}
    </ol>
  );
}
