import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Feuille } from '@/components/Feuille';
import { ACCESS_COOKIE } from '@/lib/session-cookies';
import { currentUser } from '@/services/authService';
import { logoutAction } from './actions';

export default async function QuestionnairesLayout({ children }: LayoutProps<'/questionnaires'>) {
  const access = (await cookies()).get(ACCESS_COOKIE)?.value;
  const author = access ? await currentUser(access) : null;
  if (author === null) redirect('/login');
  return (
    <Feuille marge="Espace auteur">
      <div className="flex items-baseline justify-between gap-4 leading-[32px]">
        <p className="truncate text-graphite-doux">{author.nom}</p>
        <form action={logoutAction}>
          <button
            type="submit"
            className="entoure text-encre underline transition-colors duration-[120ms] hover:text-encre-sombre"
          >
            Se déconnecter
          </button>
        </form>
      </div>
      {children}
    </Feuille>
  );
}
