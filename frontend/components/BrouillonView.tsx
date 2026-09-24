import type { QuestionnaireLu, QuestionType, Visibilite } from '@/services/questionnaireService';
import { TamponStatut } from './TamponStatut';

export const LIBELLES_VISIBILITE: Record<Visibilite, string> = {
  publique: 'Publique — lien ouvert',
  privee: 'Privée — sur invitation',
};

export const LIBELLES_TYPE: Record<QuestionType, string> = {
  likert: 'Échelle de Likert',
  choix_multiple: 'Choix multiple',
  texte_libre: 'Texte libre',
};

const DANS_LA_MARGE = 'sm:absolute sm:right-[calc(100%+3.25rem)] sm:text-right';

export function BrouillonView({ questionnaire }: { questionnaire: QuestionnaireLu }) {
  const { titre, description, statut, visibilite, questions } = questionnaire;
  return (
    <>
      <p className="mt-ligne leading-[32px]">
        <a
          href="/questionnaires"
          className="entoure text-encre underline underline-offset-4 transition-colors duration-[120ms] hover:text-encre-sombre"
        >
          ← Mes questionnaires
        </a>
      </p>
      <h1 className="text-[28px] font-bold leading-[64px] tracking-[-0.02em] break-words">
        {titre}
      </h1>
      <p className="flex flex-wrap items-center gap-3 leading-[32px]">
        <TamponStatut statut={statut} />
        <span className="text-graphite-doux">{LIBELLES_VISIBILITE[visibilite]}</span>
      </p>
      {description && (
        <p className="mt-ligne whitespace-pre-line break-words leading-[32px]">{description}</p>
      )}
      <section aria-labelledby="questions-titre" className="mt-ligne">
        <h2
          id="questions-titre"
          className="h-ligne text-sm font-bold uppercase leading-[32px] tracking-wide text-graphite-doux sm:relative"
        >
          <span className={`${DANS_LA_MARGE} sm:whitespace-nowrap`}>Questions</span>
        </h2>
        {questions.length === 0 ? (
          <p className="leading-[32px] text-crayon">Aucune question pour l&apos;instant.</p>
        ) : (
          <ol>
            {questions.map((question, index) => (
              <li key={question.documentId} className="relative leading-[32px]">
                <span className={`tabular-nums text-graphite-doux ${DANS_LA_MARGE}`}>
                  {index + 1}.
                </span>{' '}
                <span className="break-words">{question.texte}</span>
                <span className="block text-sm text-graphite-doux">
                  {LIBELLES_TYPE[question.type]}
                  {question.obligatoire ? ' · obligatoire' : ''}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
