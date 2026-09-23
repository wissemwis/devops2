import type { Instrumentation } from 'next';
import { logger } from './lib/logger';

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  logger.error('Request failed', {
    method: request.method,
    path: request.path,
    routePath: context.routePath,
    routeType: context.routeType,
    error: error instanceof Error ? error : String(error),
  });
};
