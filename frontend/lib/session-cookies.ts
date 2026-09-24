import { accessTokenExpiry } from './jwt';

export const ACCESS_COOKIE = 'qp_access';
export const REFRESH_COOKIE = 'qp_refresh';
export const REFRESH_MAX_AGE = 30 * 24 * 60 * 60;
const DEFAULT_ACCESS_MAX_AGE = 10 * 60;

export type SessionTokens = { access: string; refresh: string };

export type CookieOptions = {
  httpOnly: true;
  sameSite: 'lax';
  path: '/';
  secure: boolean;
  maxAge: number;
};

export type CookieWriter = { set(name: string, value: string, options: CookieOptions): unknown };

function options(maxAge: number): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge,
  };
}

function accessMaxAge(access: string, now: number): number {
  const expiry = accessTokenExpiry(access);
  return expiry === null ? DEFAULT_ACCESS_MAX_AGE : Math.max(0, expiry - now);
}

export function nowInSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function writeSession(store: CookieWriter, tokens: SessionTokens, now: number): void {
  store.set(ACCESS_COOKIE, tokens.access, options(accessMaxAge(tokens.access, now)));
  store.set(REFRESH_COOKIE, tokens.refresh, options(REFRESH_MAX_AGE));
}

export function clearSession(store: CookieWriter): void {
  store.set(ACCESS_COOKIE, '', options(0));
  store.set(REFRESH_COOKIE, '', options(0));
}
