import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AnnotationErreur } from '@/components/AnnotationErreur';
import { Feuille } from '@/components/Feuille';
import { currentAuthorGate } from '@/lib/current-author';
import { LOGIN_MESSAGES } from '@/lib/login-state';
import { logoutAction } from './actions';

export default async function QuestionnairesLayout({ children }: LayoutProps<'/questionnaires'>) {
  const gate = await currentAuthorGate();
  if (gate.kind === 'login') redirect('/login');
  if (gate.kind === 'unavailable') {
    return (
      <Feuille marge="Espace auteur">
        <AnnotationErreur id="espace-indisponible">
          {LOGIN_MESSAGES.unavailable}{' '}
          <Link
            href="/questionnaires"
            className="entoure font-bold text-encre underline transition-colors duration-[120ms] hover:text-encre-sombre"
          >
            Réessayer
          </Link>
        </AnnotationErreur>
      </Feuille>
    );
  }
  const { author } = gate;
  return (
    <Feuille marge="Espace auteur">
      <div className="flex items-baseline justify-between gap-4 leading-[32px]">
        <p className="truncate text-graphite-doux">{author.nom}</p>
        <form action={logoutAction}>
          <button
            type="submit"
            className="entoure text-encre underline underline-offset-4 transition-colors duration-[120ms] hover:text-encre-sombre"
          >
            Se déconnecter
          </button>
        </form>
      </div>
      {children}
    </Feuille>
  );
}
