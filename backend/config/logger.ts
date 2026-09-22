import type { Core } from '@strapi/strapi';
import { winston } from '@strapi/logger';

// Structured JSON logs on stdout (constitution Principe V — Observabilité):
// one JSON object per line ({ level, message, timestamp, ...metadata }), so
// CI, containers and Strapi Cloud can collect and parse them. Merged by
// Strapi into its winston logger ({ level: 'http', ...this }).
const config = ({ env }: Core.Config.Shared.ConfigParams) => ({
  // Default "http" keeps Strapi's per-request logs (strapi::logger middleware).
  level: env('LOG_LEVEL', 'http'),
  format: winston.format.combine(
    winston.format.errors({ stack: true }),
    // Always overwrite: some Strapi internals pass their own epoch-ms
    // `timestamp`, which would otherwise leave the field's type inconsistent.
    winston.format.timestamp({ format: () => new Date().toISOString() }),
    winston.format.json(),
  ),
  transports: [new winston.transports.Console()],
});

export default config;
