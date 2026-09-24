'use client';

import { useActionState } from 'react';
import { CreationFormView } from '@/components/CreationFormView';
import { INITIAL_CREATION_STATE } from '@/lib/creation-state';
import { createAction } from './actions';

export function CreationForm() {
  const [state, action, pending] = useActionState(createAction, INITIAL_CREATION_STATE);
  return <CreationFormView state={state} action={action} pending={pending} />;
}
