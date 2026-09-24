import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Feuille } from '@/components/Feuille';
import { gateAuthor } from '@/lib/author-gate';
import { ACCESS_COOKIE, REFRESH_COOKIE, nowInSeconds } from '@/lib/session-cookies';
import { decide } from '@/lib/session-decision';
import { currentUser } from '@/services/authService';
import { LoginForm } from './LoginForm';

export default async function LoginPage() {
  const store = await cookies();
  const access = store.get(ACCESS_COOKIE)?.value;
  const decision = decide({
    access,
    refresh: store.get(REFRESH_COOKIE)?.value,
    now: nowInSeconds(),
  });
  if (decision === 'refresh') redirect('/questionnaires');
  if (decision === 'pass') {
    const gate = await gateAuthor(access, { currentUser });
    if (gate.kind === 'author') redirect('/questionnaires');
  }
  return (
    <Feuille marge="Espace auteur">
      <div className="max-w-md">
        <h1 className="text-[28px] font-bold leading-[64px] tracking-[-0.02em]">Connexion</h1>
        <LoginForm />
      </div>
    </Feuille>
  );
}
