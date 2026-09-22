# T061 (Jira D2-71) — Native `users-permissions` roles replace the T007 `role` enum

**Date:** 2026-09-23 · **Status:** approved in brainstorming, pending written-spec review
**Task:** `specs/001-questionnaire-platform/tasks.md` T061 (Phase 9 Convergence, CRITICAL) —
"Replace the T007 `role` enum with native `users-permissions` roles `auteur`, `repondant`,
`administrateur` (…) and amend `data-model.md` Utilisateur.role accordingly, per FR-016
(contradicts)".
**Binding context:** `spec.md` FR-016 and Key Entities (Utilisateur), `data-model.md`
Utilisateur, `.specify/memory/constitution.md` v1.2.0 (I Test-First, II YAGNI, III IaC,
IV Sécurité par défaut, V Observabilité).

## 1. Problem

T007 added `backend/src/extensions/users-permissions/content-types/user/schema.json`, which
copies the 8 native User attributes and replaces `role` with an enumeration
(`auteur`, `repondant`, `administrateur`). Strapi's users-permissions plugin relies on the
native `role` relation (`plugin::users-permissions.role`): the auth strategy populates it and
permission resolution reads `user.role.id` on every authenticated request. With the enum,
authenticated permission resolution breaks — every author-only endpoint of US1 is blocked.

A second, older gap: the spec (Key Entities) and `data-model.md` define Utilisateur with a
required `nom`, which T007 never added.

## 2. Goals and success criteria

- A user holding the `auteur` role authenticates with a JWT and Strapi resolves that user's
  permissions without error.
- The three FR-016 roles exist as native users-permissions roles on every environment (local
  SQLite, compose Postgres, Strapi Cloud) with no manual step (Principe III).
- Public self-registration is closed; accounts are created by an administrator (Principe IV).
- The User has a required `nom`.
- `data-model.md` describes what the code does.

**Out of scope (later tasks):** per-endpoint permissions and the dev test author account
(T062), the login page (T063), FR-016 authorization tests on business endpoints (T069).

## 3. Decisions taken in brainstorming

| # | Question | Decision |
|---|---|---|
| D1 | How are author accounts created? | **By an administrator only** (Strapi admin panel; T062's dev seed). Public `/api/auth/local/register` is closed. |
| D2 | Where does `nom` go? | **In T061**, in a corrected User extension that also restores the native `role` relation. |
| D3 | How do roles exist reproducibly? | **Idempotent code in `bootstrap()`** (no config-sync plugin, no manual admin step). |
| D4 | Test harness (T061 now precedes T011) | **T061 introduces the minimal Jest harness** designed for T011; T011 reuses it. |

## 4. Design

### 4.1 User schema (extension, corrected)

File: `backend/src/extensions/users-permissions/content-types/user/schema.json`
(Strapi 5 shallow-merges plugin content-type extensions: an extension's `attributes` block
replaces the plugin's wholesale, so the native attributes must be copied.)

- The 8 native attributes (`username`, `email`, `provider`, `password`,
  `resetPasswordToken`, `confirmationToken`, `confirmed`, `blocked`) — unchanged from today.
- `role` restored **verbatim** from `@strapi/plugin-users-permissions` 5.54.0
  (`dist/server/content-types/user/index.js`):
  `{ "type": "relation", "relation": "manyToOne", "target": "plugin::users-permissions.role", "inversedBy": "users", "configurable": false }`.
  The T007 enumeration is removed.
- New: `nom` — `{ "type": "string", "required": true }`.
- `dateInscription` is **not** added: it is the native `createdAt`.
- No data migration: no user was ever created with the enum.

### 4.2 Roles bootstrap and registration

New module `backend/src/bootstrap/roles.ts`, called from `bootstrap({ strapi })` in
`backend/src/index.ts` (the application bootstrap runs after the plugin's, so the plugin's
store and default roles already exist):

- `ensureBusinessRoles(strapi)` — for each of
  `{ type: 'auteur', name: 'Auteur' }`, `{ type: 'repondant', name: 'Répondant' }`,
  `{ type: 'administrateur', name: 'Administrateur' }`: find by `type` in
  `plugin::users-permissions.role`; create it (with a one-line description) only if absent.
  Never updates an existing role, so permissions/descriptions edited in the admin panel
  survive restarts. Grants **no** permission (T062). Logs each creation via `strapi.log.info`
  (JSON, T009).
- `closePublicRegistration(strapi)` — reads the plugin store key `advanced`
  (`strapi.store({ type: 'plugin', name: 'users-permissions' })`); if `allow_register` is not
  already `false`, writes it back as `false`, preserving every other value. Configuration as
  code: re-enabling registration in the admin panel is reverted at the next start — stated in
  the module comment.
- Native roles kept as they are: `Public` (future anonymous access, FR-007) and
  `Authenticated` (still `default_role`, no longer assigned since registration is closed).
- `repondant` is created for FR-016 but gets no permission: respondents answer without an
  account (public link or invitation token).
- Errors propagate: Strapi refuses to start rather than running without its roles.

### 4.3 Test harness (introduced here, reused by T011)

As designed for T011 (recorded in `extension.save/superpowers-workspace/pending-brainstorm-T011.md`):

- devDependencies in `backend/`: `jest`, `ts-jest`, `@types/jest`, `supertest`,
  `@types/supertest`; `backend/jest.config.ts` (`testMatch: tests/**/*.test.ts`,
  `testEnvironment: node`, `maxWorkers: 1`, a `globalSetup` that compiles TypeScript so
  Strapi can load `dist/`); script `npm test`.
- `backend/tests/helpers/strapi.ts`: `setupStrapi()` / `teardownStrapi()` boot the compiled
  app in-process (`createStrapi({ appDir, distDir }).load()`) with test-only environment:
  `DATABASE_CLIENT=sqlite`, `DATABASE_FILENAME=.tmp/test.db` (deleted before each run), dummy
  secrets, `LOG_LEVEL=error`. Supertest targets `strapi.server.httpServer`.

## 5. Tests (written first, observed failing)

1. `tests/structure/test_user_schema.sh` — drift test: loads the installed plugin's native
   User schema and asserts every native attribute (including the `role` relation) is present
   and identical in the extension; asserts `nom` is a required string; asserts no enum `role`.
   Replaces `tests/structure/test_user_role.sh` (T007), which asserts the enum.
2. `backend/tests/integration/roles_bootstrap.test.ts`:
   - after boot, roles of type `auteur`, `repondant`, `administrateur` exist; calling
     `ensureBusinessRoles` again creates no duplicate;
   - the plugin's `advanced.allow_register === false`, and `POST /api/auth/local/register`
     returns `400` with the error message `Register action is currently disabled` (the
     plugin throws an `ApplicationError` — `dist/server/controllers/auth.js`, 5.54.0);
   - permission resolution (the T007 bug): create a user with role `auteur` and a `nom`, issue
     their JWT, grant the `auteur` role the native `plugin::users-permissions.user.me`
     permission inside the test, then `GET /api/users/me` returns `200`;
   - creating a user without `nom` fails validation.

The full `tests/structure/*.sh` suite, `npm run build`, `npm run lint` and
`npm run format:check` must still pass.

## 6. Documentation and tracking

- `data-model.md` — dated amendment of Utilisateur: `role` = relation to a users-permissions
  role (types `auteur`, `repondant`, `administrateur`); `nom` via the User extension;
  `dateInscription` = `createdAt`; accounts created by an administrator, public registration
  closed.
- `CLAUDE.md` — the T007 open risk is marked resolved by T061; Current state mentions the
  roles, the closed registration and the Jest harness.
- `tasks.md` — T061 `[X]` with an annotation (tests, evidence); a note on T007 ("superseded
  by T061") and on T011 ("harness introduced by T061").
- Jira D2-71 — `En cours` when implementation starts, `Terminé` with a summary comment when
  done.

## 7. Risks

- **Strapi upgrades**: the copied native attributes can drift from the plugin — caught by the
  drift test (5.1).
- **Admin-panel edits to registration** are reverted at restart — intended, documented.
- **Test boot time**: in-process Strapi adds seconds per test file; `maxWorkers: 1` keeps one
  SQLite file consistent.
