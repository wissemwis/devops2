import { accessTokenExpiry } from './jwt';

export type SessionDecision = 'pass' | 'refresh' | 'login';

export const EXPIRY_SKEW_SECONDS = 30;

export function decide(input: { access?: string; refresh?: string; now: number }): SessionDecision {
  if (!input.refresh) return 'login';
  if (input.access) {
    const expiry = accessTokenExpiry(input.access);
    if (expiry !== null && expiry - EXPIRY_SKEW_SECONDS > input.now) return 'pass';
  }
  return 'refresh';
}
