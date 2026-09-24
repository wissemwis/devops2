import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { AnnotationErreur } from '@/components/AnnotationErreur';
import { BrouillonView } from '@/components/BrouillonView';
import { LOGIN_MESSAGES } from '@/lib/login-state';
import { ACCESS_COOKIE } from '@/lib/session-cookies';
import { getMine } from '@/services/questionnaireService';

export default async function BrouillonPage({ params }: PageProps<'/questionnaires/[id]'>) {
  const { id } = await params;
  const access = (await cookies()).get(ACCESS_COOKIE)?.value ?? '';
  const lecture = await getMine(access, id);
  if (lecture.kind === 'not-found') notFound();
  if (lecture.kind === 'session') redirect('/login');
  if (lecture.kind === 'unavailable') {
    return (
      <>
        <h1 className="mt-ligne text-[28px] font-bold leading-[64px] tracking-[-0.02em]">
          Questionnaire
        </h1>
        <AnnotationErreur id="brouillon-erreur">
          {LOGIN_MESSAGES.unavailable}{' '}
          <Link
            href={`/questionnaires/${id}`}
            className="entoure font-bold text-encre underline transition-colors duration-[120ms] hover:text-encre-sombre"
          >
            Réessayer
          </Link>
        </AnnotationErreur>
      </>
    );
  }
  return <BrouillonView questionnaire={lecture.questionnaire} />;
}
