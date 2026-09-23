# T011 (Jira D2-19) — brainstorming decisions taken before the Jira-driven bridge switch

Paused 2026-09-23 when the human partner switched task selection to Jira. Resume the
brainstorming for D2-19/T011 from these decisions (already approved in chat):

- Classification: architectural (T011 introduces the backend's first test harness —
  reused by T012-T015 and every later backend test).
- Q1 roles (FR-016): option A — the three roles become native `users-permissions` roles
  (auteur, repondant, administrateur); the T007 `role` enum extension (which overwrites the
  native `role` relation) is to be undone. Needs a dated `data-model.md` amendment
  (Utilisateur.role → relation to a users-permissions role) and a corrective task in
  tasks.md + Jira. T011 itself does not change the schema.
- Q2 file naming: follow plan.md's `.test.ts` convention —
  `backend/tests/contract/questionnaires_create.test.ts` (same convention for T012-T015);
  amend the paths in tasks.md.
- Approach: 1 — Strapi booted in-process by Jest (`createStrapi({appDir, distDir}).load()`),
  Supertest on `strapi.server.httpServer`, throwaway SQLite `.tmp/test.db`, `globalSetup`
  compiles TS first, `maxWorkers: 1`.
- Section 1 (harness architecture) presented, NOT yet approved: devDeps jest, ts-jest,
  @types/jest, supertest, @types/supertest; `backend/jest.config.ts`; `npm test`;
  `tests/helpers/strapi.ts` (setupStrapi/teardownStrapi, test env: DATABASE_CLIENT=sqlite,
  DATABASE_FILENAME=.tmp/test.db, dummy secrets, LOG_LEVEL=error);
  `tests/helpers/auth.ts` createUserWithRole('auteur'|'repondant') find-or-create role,
  create user, issue JWT via users-permissions `jwt` service.
- Next: get section 1 approved, then section 2 (test content: 201 + statut brouillon +
  auteur = caller, 401 unauthenticated, 403 repondant, 400 validation), then design doc.
