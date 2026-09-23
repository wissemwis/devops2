import { describe, expect, it } from 'vitest';
import { GET, dynamic } from '../../app/health/route';

describe('GET /health (T060, Principe V)', () => {
  it('answers 200 with status ok', async () => {
    const response = GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('is rendered per request, never prerendered', () => {
    expect(dynamic).toBe('force-dynamic');
  });
});
