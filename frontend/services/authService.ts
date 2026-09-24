import { logger } from '@/lib/logger';
import type { SessionTokens } from '@/lib/session-cookies';
import { StrapiUnavailableError, strapiFetch } from './strapi';

export const STRAPI_REFRESH_COOKIE = 'strapi_up_refresh';

const AUTHOR_ROLES = ['auteur', 'administrateur'] as const;

export type AuthorRole = (typeof AUTHOR_ROLES)[number];
export type Author = { id: number; nom: string; email: string; role: AuthorRole };
export type LoginFailure = 'invalid' | 'forbidden-role' | 'unavailable';
export type LoginResult =
  { ok: true; tokens: SessionTokens; author: Author } | { ok: false; reason: LoginFailure };
export type RefreshResult =
  { ok: true; tokens: SessionTokens } | { ok: false; reason: 'rejected' | 'unavailable' };

type MeBody = { id?: unknown; nom?: unknown; email?: unknown; role?: { type?: unknown } | null };

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function refreshTokenFrom(response: Response): string | null {
  for (const header of response.headers.getSetCookie()) {
    const [pair] = header.split(';');
    const separator = pair.indexOf('=');
    if (separator > 0 && pair.slice(0, separator).trim() === STRAPI_REFRESH_COOKIE) {
      const value = pair.slice(separator + 1).trim();
      return value === '' ? null : value;
    }
  }
  return null;
}

function isAuthorRole(value: unknown): value is AuthorRole {
  return typeof value === 'string' && (AUTHOR_ROLES as readonly string[]).includes(value);
}

function toAuthor(body: MeBody): Author | null {
  const role = body.role?.type;
  if (typeof body.id !== 'number' || typeof body.email !== 'string' || !isAuthorRole(role)) {
    return null;
  }
  return {
    id: body.id,
    email: body.email,
    nom: typeof body.nom === 'string' ? body.nom : body.email,
    role,
  };
}

async function readAuthor(access: string): Promise<Author | null> {
  const response = await strapiFetch('/api/users/me?populate=role', {
    headers: { Authorization: `Bearer ${access}` },
  });
  if (!response.ok) return null;
  return toAuthor((await response.json()) as MeBody);
}

async function readAuthorOrRevoke(tokens: SessionTokens): Promise<Author | null> {
  try {
    return await readAuthor(tokens.access);
  } catch (error) {
    if (error instanceof StrapiUnavailableError) await logout(tokens);
    throw error;
  }
}

async function sessionTokensFrom(response: Response): Promise<SessionTokens | null> {
  const body = (await response.json()) as { jwt?: unknown };
  const refreshToken = refreshTokenFrom(response);
  if (typeof body.jwt !== 'string' || refreshToken === null) return null;
  return { access: body.jwt, refresh: refreshToken };
}

export async function login(email: string, password: string): Promise<LoginResult> {
  try {
    const response = await strapiFetch('/api/auth/local', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ identifier: email, password }),
    });
    if (!response.ok) return { ok: false, reason: 'invalid' };
    const tokens = await sessionTokensFrom(response);
    if (tokens === null) {
      logger.error('auth.login.unexpected-response', { status: response.status });
      return { ok: false, reason: 'unavailable' };
    }
    const author = await readAuthorOrRevoke(tokens);
    if (author === null) {
      await logout(tokens);
      return { ok: false, reason: 'forbidden-role' };
    }
    return { ok: true, tokens, author };
  } catch (error) {
    if (!(error instanceof StrapiUnavailableError)) throw error;
    logger.error('auth.login.unavailable', { status: error.status });
    return { ok: false, reason: 'unavailable' };
  }
}

export async function refresh(refreshToken: string): Promise<RefreshResult> {
  try {
    const response = await strapiFetch('/api/auth/refresh', {
      method: 'POST',
      headers: { ...JSON_HEADERS, Cookie: `${STRAPI_REFRESH_COOKIE}=${refreshToken}` },
      body: '{}',
    });
    if (!response.ok) return { ok: false, reason: 'rejected' };
    const tokens = await sessionTokensFrom(response);
    return tokens === null ? { ok: false, reason: 'rejected' } : { ok: true, tokens };
  } catch (error) {
    if (!(error instanceof StrapiUnavailableError)) throw error;
    logger.warn('auth.refresh.failed', { status: error.status });
    return { ok: false, reason: 'unavailable' };
  }
}

export async function logout(tokens: SessionTokens): Promise<void> {
  try {
    const response = await strapiFetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        ...JSON_HEADERS,
        Authorization: `Bearer ${tokens.access}`,
        Cookie: `${STRAPI_REFRESH_COOKIE}=${tokens.refresh}`,
      },
      body: '{}',
    });
    if (!response.ok) logger.warn('auth.logout.failed', { status: response.status });
  } catch (error) {
    if (!(error instanceof StrapiUnavailableError)) throw error;
    logger.warn('auth.logout.failed', { status: error.status });
  }
}

export async function currentUser(access: string): Promise<Author | null> {
  return readAuthor(access);
}
