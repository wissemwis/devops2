import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRefreshOnce } from '@/lib/refresh-once';
import type { RefreshResult } from '@/services/authService';

const renewed: RefreshResult = { ok: true, tokens: { access: 'access-2', refresh: 'refresh-2' } };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_800_000_000_000);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createRefreshOnce', () => {
  it('shares one refresh between concurrent calls with the same token', async () => {
    const refresh = vi.fn().mockResolvedValue(renewed);
    const refreshOnce = createRefreshOnce(refresh);

    const [first, second] = await Promise.all([refreshOnce('r1'), refreshOnce('r1')]);

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(first).toEqual(renewed);
    expect(second).toBe(first);
  });

  it('refreshes each distinct token separately', async () => {
    const refresh = vi.fn().mockResolvedValue(renewed);
    const refreshOnce = createRefreshOnce(refresh);

    await Promise.all([refreshOnce('r1'), refreshOnce('r2')]);

    expect(refresh).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledWith('r1');
    expect(refresh).toHaveBeenCalledWith('r2');
  });

  it('reuses a settled result within the ttl and refreshes again after it', async () => {
    const refresh = vi.fn().mockResolvedValue(renewed);
    const refreshOnce = createRefreshOnce(refresh, 1_000);

    await refreshOnce('r1');
    vi.setSystemTime(1_800_000_000_999);
    await refreshOnce('r1');
    expect(refresh).toHaveBeenCalledTimes(1);

    vi.setSystemTime(1_800_000_001_001);
    await refreshOnce('r1');
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('does not reuse an unavailable result once it has settled', async () => {
    const refresh = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, reason: 'unavailable' })
      .mockResolvedValueOnce(renewed);
    const refreshOnce = createRefreshOnce(refresh);

    expect(await refreshOnce('r1')).toEqual({ ok: false, reason: 'unavailable' });
    expect(await refreshOnce('r1')).toEqual(renewed);
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
