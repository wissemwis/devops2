/**
 * `health` router.
 *
 * Public, unauthenticated route per contracts/api.md
 * ("## Santé (Principe V — Observabilité)" / "### GET /health"):
 *   - Auth: aucune.
 *   - 200 `{"status": "ok"}`
 *   - 503 `{"status": "degraded", "reason": "<cause>"}` si la base de données
 *     est injoignable.
 */

import type { Core } from '@strapi/strapi';

const healthRouter: Core.RouterInput = {
  type: 'content-api',
  routes: [
    {
      method: 'GET',
      path: '/health',
      handler: 'health.health',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};

export default healthRouter;
