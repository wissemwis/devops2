import { NextResponse, type NextRequest } from 'next/server';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearSession,
  nowInSeconds,
  writeSession,
} from '@/lib/session-cookies';
import { decide } from '@/lib/session-decision';
import { refresh } from '@/services/authService';

function toLogin(request: NextRequest): NextResponse {
  const response = NextResponse.redirect(new URL('/login', request.url));
  clearSession(response.cookies);
  return response;
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const now = nowInSeconds();
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  const decision = decide({
    access: request.cookies.get(ACCESS_COOKIE)?.value,
    refresh: refreshToken,
    now,
  });
  if (decision === 'pass') return NextResponse.next();
  if (decision === 'login' || !refreshToken) return toLogin(request);
  const result = await refresh(refreshToken);
  if (!result.ok) {
    return result.reason === 'unavailable' ? NextResponse.next() : toLogin(request);
  }
  request.cookies.set(ACCESS_COOKIE, result.tokens.access);
  request.cookies.set(REFRESH_COOKIE, result.tokens.refresh);
  const response = NextResponse.next({ request: { headers: request.headers } });
  writeSession(response.cookies, result.tokens, now);
  return response;
}

export const config = {
  matcher: ['/questionnaires', '/questionnaires/:path*'],
};
