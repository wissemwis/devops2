import type { RefreshResult } from '@/services/authService';

type Entry = { result: Promise<RefreshResult>; expiresAt: number };

export function createRefreshOnce(
  refresh: (token: string) => Promise<RefreshResult>,
  ttlMs = 10_000,
): (token: string) => Promise<RefreshResult> {
  const entries = new Map<string, Entry>();

  function forgetExpired(now: number): void {
    for (const [token, entry] of entries) {
      if (entry.expiresAt <= now) entries.delete(token);
    }
  }

  return (token: string) => {
    const now = Date.now();
    forgetExpired(now);
    const existing = entries.get(token);
    if (existing) return existing.result;
    const result = refresh(token);
    const entry: Entry = { result, expiresAt: now + ttlMs };
    entries.set(token, entry);
    result.then(
      (settled) => {
        if (!settled.ok && settled.reason === 'unavailable' && entries.get(token) === entry) {
          entries.delete(token);
        }
      },
      () => {
        if (entries.get(token) === entry) entries.delete(token);
      },
    );
    return result;
  };
}
