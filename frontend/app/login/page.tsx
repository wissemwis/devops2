import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Feuille } from '@/components/Feuille';
import { shouldLeaveLogin } from '@/lib/login-page';
import { ACCESS_COOKIE, REFRESH_COOKIE, nowInSeconds } from '@/lib/session-cookies';
import { currentUser } from '@/services/authService';
import { LoginForm } from './LoginForm';

export default async function LoginPage() {
  const store = await cookies();
  const leave = await shouldLeaveLogin(
    {
      access: store.get(ACCESS_COOKIE)?.value,
      refresh: store.get(REFRESH_COOKIE)?.value,
      now: nowInSeconds(),
    },
    { currentUser },
  );
  if (leave) redirect('/questionnaires');
  return (
    <Feuille marge="Espace auteur">
      <div className="max-w-md">
        <h1 className="text-[28px] font-bold leading-[64px] tracking-[-0.02em]">Connexion</h1>
        <LoginForm />
      </div>
    </Feuille>
  );
}
