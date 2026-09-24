import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AnnotationErreur } from '@/components/AnnotationErreur';
import { currentAuthorGate } from '@/lib/current-author';
import { LOGIN_MESSAGES } from '@/lib/login-state';
import { CreationForm } from './CreationForm';

export default async function NouveauQuestionnairePage() {
  const gate = await currentAuthorGate();
  if (gate.kind === 'login') redirect('/login');
  const headline = (
    <h1 className="mt-ligne text-[28px] font-bold leading-[64px] tracking-[-0.02em]">
      Nouveau questionnaire
    </h1>
  );
  if (gate.kind === 'unavailable') {
    return (
      <div className="max-w-md">
        {headline}
        <AnnotationErreur id="creation-erreur">
          {LOGIN_MESSAGES.unavailable}{' '}
          <Link
            href="/questionnaires/create"
            className="entoure font-bold text-encre underline transition-colors duration-[120ms] hover:text-encre-sombre"
          >
            Réessayer
          </Link>
        </AnnotationErreur>
      </div>
    );
  }
  return (
    <div className="max-w-md">
      {headline}
      {gate.author.role === 'auteur' ? (
        <CreationForm />
      ) : (
        <>
          <p className="mt-ligne leading-[32px] text-crayon">
            La création de questionnaires est réservée aux auteurs.
          </p>
          <p className="leading-[32px]">
            <Link
              href="/questionnaires"
              className="entoure text-encre underline underline-offset-4 transition-colors duration-[120ms] hover:text-encre-sombre"
            >
              Retour à mes questionnaires
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
