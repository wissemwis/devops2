'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { submitCreation } from '@/lib/create-questionnaire';
import type { CreationFormState } from '@/lib/creation-state';
import { ACCESS_COOKIE } from '@/lib/session-cookies';
import { createQuestionnaire } from '@/services/questionnaireService';

export async function createAction(
  _previous: CreationFormState,
  formData: FormData,
): Promise<CreationFormState> {
  const access = (await cookies()).get(ACCESS_COOKIE)?.value;
  const outcome = await submitCreation(formData, { access, create: createQuestionnaire });
  if (outcome.kind === 'redirect') redirect(outcome.to);
  return outcome.state;
}
