/**
 * `health` controller.
 *
 * Implements contracts/api.md's GET /health contract:
 *   - 200 `{"status": "ok"}` when the database is reachable.
 *   - 503 `{"status": "degraded", "reason": "<cause>"}` when it is not.
 *
 * The database connectivity probe is a lightweight `SELECT 1` run through
 * Strapi's own Knex connection (works for both the SQLite dev client and the
 * PostgreSQL client configured in backend/config/database.ts), so this
 * reflects real DB reachability rather than merely "the process is up".
 */

import type { Core } from '@strapi/strapi';

const healthController: Core.Controller = {
  async health(ctx) {
    try {
      await strapi.db.connection.raw('SELECT 1');

      ctx.status = 200;
      ctx.body = { status: 'ok' };
    } catch (error) {
      // Keep the cause safe to expose publicly: the error message only,
      // never the full stack trace or connection credentials.
      const reason = error instanceof Error ? error.message : 'unknown error';

      ctx.status = 503;
      ctx.body = { status: 'degraded', reason };
    }
  },
};

export default healthController;
