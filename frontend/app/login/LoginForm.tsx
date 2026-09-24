'use client';

import { useActionState } from 'react';
import { LoginFormView } from '@/components/LoginFormView';
import { INITIAL_LOGIN_STATE } from '@/lib/login-state';
import { loginAction } from './actions';

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, INITIAL_LOGIN_STATE);
  return <LoginFormView state={state} action={action} pending={pending} />;
}
