import { cookies } from 'next/headers';
import Link from 'next/link';
import { Sommaire } from '@/components/Sommaire';
import { currentAuthorGate } from '@/lib/current-author';
import { ACCESS_COOKIE } from '@/lib/session-cookies';
import { listMine } from '@/services/mesQuestionnaires';

export default async function MesQuestionnairesPage() {
  const gate = await currentAuthorGate();
  const access = (await cookies()).get(ACCESS_COOKIE)?.value ?? '';
  const state = await listMine(access);
  const peutCreer = gate.kind === 'author' && gate.author.role === 'auteur';
  return (
    <>
      <h1 className="mt-ligne text-[28px] font-bold leading-[64px] tracking-[-0.02em]">
        Mes questionnaires
      </h1>
      {peutCreer && (
        <p className="leading-[32px]">
          <Link
            href="/questionnaires/create"
            className="entoure font-bold text-encre underline underline-offset-4 transition-colors duration-[120ms] hover:text-encre-sombre"
          >
            + Nouveau questionnaire
          </Link>
        </p>
      )}
      <Sommaire state={state} />
    </>
  );
}
