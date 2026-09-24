import { currentAuthorGate } from '@/lib/current-author';
import { CreationForm } from './CreationForm';

export default async function NouveauQuestionnairePage() {
  const gate = await currentAuthorGate();
  if (gate.kind !== 'author') return null;
  return (
    <div className="max-w-md">
      <h1 className="mt-ligne text-[28px] font-bold leading-[64px] tracking-[-0.02em]">
        Nouveau questionnaire
      </h1>
      {gate.author.role === 'auteur' ? (
        <CreationForm />
      ) : (
        <>
          <p className="mt-ligne leading-[32px] text-crayon">
            La création de questionnaires est réservée aux auteurs.
          </p>
          <p className="leading-[32px]">
            <a
              href="/questionnaires"
              className="entoure text-encre underline underline-offset-4 transition-colors duration-[120ms] hover:text-encre-sombre"
            >
              Retour à mes questionnaires
            </a>
          </p>
        </>
      )}
    </div>
  );
}
