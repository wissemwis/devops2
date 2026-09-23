import type { Core } from '@strapi/strapi';

import healthController from './api/health/controllers/health';
import { closePublicRegistration, ensureBusinessRoles } from './bootstrap/roles';

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   *
   * `GET /health` (contracts/api.md — "Santé (Principe V — Observabilité)")
   * is registered here, directly on the raw server router via
   * `strapi.server.routes()`, rather than only through the conventional
   * `src/api/health/routes/health.ts` file: Strapi 5's content-API router
   * always mounts `src/api/<name>/routes` under the `api.rest.prefix`
   * (`/api` by default — see contracts/api.md's own opening line, "Toutes
   * les routes sont préfixées par `/api` sauf mention contraire"), so a
   * route declared only that way would resolve at `/api/health`, not the
   * unprefixed `/health` the contract requires (confirmed by booting
   * Strapi and observing a 404 on `/health` before adding this). The
   * `routes/health.ts` file is kept too, for the conventional per-API
   * layout and its structural test — it exposes the same behavior,
   * additionally, at `/api/health`.
   */
  register({ strapi }: { strapi: Core.Strapi }) {
    strapi.server.routes([
      {
        method: 'GET',
        path: '/health',
        handler: healthController.health,
        config: {
          auth: false,
          policies: [],
          middlewares: [],
        },
      },
    ]);
  },

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await ensureBusinessRoles(strapi);
    await closePublicRegistration(strapi);
  },
};
