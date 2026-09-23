import type { Instrumentation } from 'next';

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME === 'edge') return;

  const { logger } = await import('./lib/logger');

  logger.error('Request failed', {
    method: request.method,
    path: request.path,
    routePath: context.routePath,
    routeType: context.routeType,
    error: error instanceof Error ? error : String(error),
  });
};
