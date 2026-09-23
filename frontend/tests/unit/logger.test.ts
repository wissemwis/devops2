import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '../../lib/logger';

let write: ReturnType<typeof vi.spyOn>;
const originalLevel = process.env.LOG_LEVEL;

beforeEach(() => {
  write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  delete process.env.LOG_LEVEL;
});

afterEach(() => {
  write.mockRestore();
  if (originalLevel === undefined) delete process.env.LOG_LEVEL;
  else process.env.LOG_LEVEL = originalLevel;
});

function lines(): string[] {
  return write.mock.calls.map((call: unknown[]) => String(call[0]));
}

function entries(): Record<string, unknown>[] {
  return lines().map((line) => JSON.parse(line));
}

describe('frontend JSON logger (T060, Principe V)', () => {
  it('writes one JSON line with level, message and an ISO timestamp', () => {
    logger.info('Frontend started');

    expect(lines()).toHaveLength(1);
    expect(lines()[0].endsWith('\n')).toBe(true);
    expect(lines()[0].trimEnd().includes('\n')).toBe(false);
    const [entry] = entries();
    expect(entry.level).toBe('info');
    expect(entry.message).toBe('Frontend started');
    expect(new Date(String(entry.timestamp)).toISOString()).toBe(entry.timestamp);
  });

  it('includes extra fields, and core keys win over fields with the same name', () => {
    logger.warn('Backend slow', {
      durationMs: 1200,
      level: 'debug',
      message: 'spoofed',
      timestamp: 'yesterday',
    });

    const [entry] = entries();
    expect(entry.durationMs).toBe(1200);
    expect(entry.level).toBe('warn');
    expect(entry.message).toBe('Backend slow');
    expect(entry.timestamp).not.toBe('yesterday');
  });

  it('serialises an Error field as name, message and stack', () => {
    const failure = new TypeError('bad input');

    logger.error('Request failed', { error: failure });

    const [entry] = entries();
    expect(entry.error).toEqual({
      name: 'TypeError',
      message: 'bad input',
      stack: failure.stack,
    });
  });

  it('filters by LOG_LEVEL', () => {
    process.env.LOG_LEVEL = 'warn';

    logger.error('e');
    logger.warn('w');
    logger.info('i');
    logger.debug('d');

    expect(entries().map((entry) => entry.level)).toEqual(['error', 'warn']);
  });

  it('falls back to info when LOG_LEVEL is unset or unknown', () => {
    logger.info('unset-info');
    logger.debug('unset-debug');
    process.env.LOG_LEVEL = 'http';
    logger.info('http-info');
    logger.debug('http-debug');

    expect(entries().map((entry) => entry.message)).toEqual(['unset-info', 'http-info']);
  });
});
