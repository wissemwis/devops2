import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { onRequestError } from '../../instrumentation';

type RequestInfo = Parameters<typeof onRequestError>[1];
type ErrorContext = Parameters<typeof onRequestError>[2];

let write: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
});

afterEach(() => {
  write.mockRestore();
});

const request: RequestInfo = {
  path: '/q/abc',
  method: 'GET',
  headers: { authorization: 'Bearer secret-jwt', cookie: 'session=secret-cookie' },
};

const context: ErrorContext = {
  routerKind: 'App Router',
  routePath: '/q/[token]',
  routeType: 'render',
  renderSource: 'react-server-components',
  revalidateReason: undefined,
};

function logged(): string[] {
  return write.mock.calls.map((call: unknown[]) => String(call[0]));
}

describe('onRequestError (T060, Principe V)', () => {
  it('logs one error line with the route and the error, never the headers', async () => {
    await onRequestError(new Error('boom'), request, context);

    expect(logged()).toHaveLength(1);
    const entry = JSON.parse(logged()[0]);
    expect(entry.level).toBe('error');
    expect(entry.message).toBe('Request failed');
    expect(entry.method).toBe('GET');
    expect(entry.path).toBe('/q/abc');
    expect(entry.routePath).toBe('/q/[token]');
    expect(entry.routeType).toBe('render');
    expect(entry.error.message).toBe('boom');
    expect(logged()[0]).not.toContain('secret-jwt');
    expect(logged()[0]).not.toContain('secret-cookie');
  });

  it('logs a non-Error value as a string', async () => {
    await onRequestError('plain failure', request, context);

    expect(JSON.parse(logged()[0]).error).toBe('plain failure');
  });
});
