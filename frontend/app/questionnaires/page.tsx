import { cookies } from 'next/headers';
import { Sommaire } from '@/components/Sommaire';
import { ACCESS_COOKIE } from '@/lib/session-cookies';
import { listMine } from '@/services/mesQuestionnaires';

export default async function MesQuestionnairesPage() {
  const access = (await cookies()).get(ACCESS_COOKIE)?.value ?? '';
  const state = await listMine(access);
  return (
    <>
      <h1 className="mt-ligne text-[28px] font-bold leading-[64px] tracking-[-0.02em]">
        Mes questionnaires
      </h1>
      <Sommaire state={state} />
    </>
  );
}
