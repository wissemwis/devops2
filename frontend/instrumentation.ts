import type { Instrumentation } from 'next';

function serialiseNonError(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    const json = JSON.stringify(value);
    if (typeof json === 'string') return json;
  } catch {}
  return Object.prototype.toString.call(value);
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME === 'edge') return;

  const { logger } = await import('./lib/logger');

  logger.error('Request failed', {
    method: request.method,
    path: request.path,
    routePath: context.routePath,
    routeType: context.routeType,
    error: error instanceof Error ? error : serialiseNonError(error),
  });
};
