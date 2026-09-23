# T062 (Jira D2-72) — Role permissions seed and development `auteur` account

**Date:** 2026-09-23 · **Status:** approved in brainstorming, pending written-spec review
**Task:** `specs/001-questionnaire-platform/tasks.md` T062 (Phase 9 Convergence) — "Seed role
permissions (which role may call which contracts/api.md endpoint) and, in development only
(env-driven, no secret in the repository), a test `auteur` account used by quickstart.md
Scénario 1, in `backend/src/index.ts` bootstrap per US1/AC1 (missing) (depends on T061)".
**Binding context:** `spec.md` FR-016 and US1/AC1, `contracts/api.md`, `quickstart.md`
Scénario 1, `data-model.md` Utilisateur, `.specify/memory/constitution.md` v1.2.0 (I Test-First,
II YAGNI, III IaC, IV Sécurité par défaut, V Observabilité), T061 design
(`docs/superpowers/specs/2026-09-23-T061-native-roles-design.md`).

## 1. Problem

T061 created the FR-016 roles `auteur`, `repondant`, `administrateur` as native
users-permissions roles, but with no permission at all: an authenticated `auteur` cannot even
read its own profile (`GET /api/users/me` → 403), and `quickstart.md` Scénario 1 step 1
("Se connecter en tant qu'auteur (compte de test seedé)") has no account to log in with. T063
(login page) needs both.

T062 as written asks to seed a permission for every `contracts/api.md` endpoint, but none of
the business endpoints exists yet (`backend/src/api/questionnaire|question|response` hold only
`.gitkeep`; content-types and controllers come with T016–T021). The users-permissions plugin
resynchronises permissions at every boot and deletes every permission whose action is not a
controller action of a loaded API or plugin
(`@strapi/plugin-users-permissions` `services/users-permissions.js` `syncPermissions`,
`_.difference(permissionsFoundInDB, allActions)`). A permission seeded today for
`api::questionnaire.*` would be deleted at the next boot.

## 2. Goals and success criteria

- A declarative role → actions table lives in the code and is applied at every boot, on every
  environment, with no manual step (Principe III).
- An `auteur` or `administrateur` that logs in gets `200` on `GET /api/users/me?populate=role`
  with its `role.type`; a `repondant` holds no permission.
- Each later endpoint task grants its action by adding one entry to that table.
- In development only, a test `auteur` account exists at boot when its credentials are given
  through environment variables; no credential is in the repository (Principe IV).
- No business role can write the `role` relation of a user (T061 final review carry-forward).

**Out of scope:** the login page (T063); permissions of business endpoints (added by each
endpoint task, T018 onwards); the "propriétaire" ownership rule of `contracts/api.md` (a
controller/policy check in each endpoint task, not a role permission); FR-016 authorization
contract tests (T069).

## 3. Decisions taken in brainstorming

| # | Question | Decision |
|---|---|---|
| D1 | What T062 covers for permissions | The mechanism plus only the actions that exist today; each endpoint task adds its own entry. No speculative entries for future controller actions (Principe II). |
| D2 | When the dev account is created | Only when `NODE_ENV=development` and both `DEV_AUTEUR_EMAIL` and `DEV_AUTEUR_PASSWORD` are set; an existing account is never modified. |
| D3 | Where the table lives | TypeScript module `backend/src/bootstrap/permissions.ts`, next to `roles.ts` (typed, testable). Not a JSON file, not admin-panel-only configuration. |

## 4. Design

### 4.1 Role permissions — `backend/src/bootstrap/permissions.ts`

```ts
export const ROLE_PERMISSIONS: Record<BusinessRoleType, readonly string[]> = {
  auteur: ['plugin::users-permissions.user.me', 'plugin::users-permissions.role.find'],
  administrateur: ['plugin::users-permissions.user.me', 'plugin::users-permissions.role.find'],
  repondant: [],
};

export async function grantRolePermissions(strapi: Core.Strapi): Promise<void>;
```

- `BusinessRoleType` is derived from `BUSINESS_ROLES` in `roles.ts`, so a role missing from the
  table is a compile error.
- `user.me` lets a logged-in user read its own profile (T063). `role.find` is required for
  `GET /api/users/me?populate=role` to return the role: the content-API sanitizer strips a
  relation the caller cannot `find` (observed in T061's `users_schema.test.ts`). It exposes only
  role names and descriptions.
- `repondant` gets nothing: a respondent reaches questionnaires through a public link or a
  signed invitation token (FR-007, FR-017), not an account (`roles.ts` description: "aucun
  droit par défaut").
- `grantRolePermissions`, for each role and action: if the permission row
  (`plugin::users-permissions.permission`, `{ action, role }`) is missing, create it and log
  `info` `Granted "<action>" to role "<type>"`. It never deletes or disables anything: a
  permission added in the admin panel survives reboots.
- An action that is not a controller action of a loaded API or plugin (typo, endpoint not built
  yet) is skipped with a `warn` log (`Skipped unknown action "<action>" for role "<type>"`); boot
  does not fail. The action list is computed the way `syncPermissions` does
  (`strapi.apis` / `strapi.plugins` controllers). A test makes an unknown action in the table
  fail CI (§5).
- A role absent from the database (should not happen after `ensureBusinessRoles`) is skipped
  with a `warn` log.

### 4.2 Development `auteur` account — `backend/src/bootstrap/dev-account.ts`

```ts
export async function ensureDevAuteurAccount(
  strapi: Core.Strapi,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void>;
```

- `env.NODE_ENV !== 'development'` → return, no log. `npm run develop` (hence
  `docker compose`) runs in `development`; Strapi Cloud runs in `production`; Jest runs in
  `test`. `env` is a parameter so tests do not mutate `process.env`.
- `DEV_AUTEUR_EMAIL` or `DEV_AUTEUR_PASSWORD` missing or empty → `warn`
  `Dev auteur account skipped: DEV_AUTEUR_EMAIL/DEV_AUTEUR_PASSWORD not set`, return.
- A user with that email already exists → `info` `Dev auteur account "<email>" already exists`,
  return. The account is never updated: a password changed by hand is kept.
- Otherwise create it through the plugin user service
  (`strapi.plugin('users-permissions').service('user').add`, which goes through the Document
  Service and hashes the password): `username` = email, `email`, `password`,
  `nom` = `DEV_AUTEUR_NOM` or `Auteur de test`, `provider: 'local'`, `confirmed: true`,
  `blocked: false`, `role` = id of the `auteur` role. Log `info`
  `Created dev auteur account "<email>"`.
- The password never appears in any log line or error message.

### 4.3 Wiring — `backend/src/index.ts`

`bootstrap` order: `ensureBusinessRoles` → `grantRolePermissions` → `closePublicRegistration`
→ `setDefaultRespondentRole` → `subscribeDefaultRespondentRole` → `ensureDevAuteurAccount`
(roles exist before permissions and before the account; the lifecycle is subscribed before any
user is created).

### 4.4 Configuration and documentation

- `.env.example`: `DEV_AUTEUR_EMAIL`, `DEV_AUTEUR_PASSWORD`, `DEV_AUTEUR_NOM` with empty
  values and a note that they are read only in development.
- `docker-compose.yml` `backend.environment`: `DEV_AUTEUR_EMAIL: ${DEV_AUTEUR_EMAIL:-}`,
  `DEV_AUTEUR_PASSWORD: ${DEV_AUTEUR_PASSWORD:-}`, `DEV_AUTEUR_NOM: ${DEV_AUTEUR_NOM:-}` (the
  stack still starts without them); `tests/structure/test_docker_compose.sh` updated if it
  asserts the exact variable list.
- `quickstart.md` Scénario 1 step 1: log in with `DEV_AUTEUR_EMAIL` / `DEV_AUTEUR_PASSWORD`
  set in the local env file.
- `tasks.md`: T062 annotated on completion; T018, T019, T020, T021, T034 and the other
  endpoint tasks get "grant the action in `ROLE_PERMISSIONS` (`backend/src/bootstrap/permissions.ts`)".
- `data-model.md` Utilisateur: one sentence pointing to the role permission table.

## 5. Testing (Jest harness from T061, test-first)

`backend/tests/integration/role_permissions.test.ts`:
- after boot, `auteur` and `administrateur` hold exactly the table's actions as enabled
  permissions, `repondant` holds none;
- a permission added by hand to `auteur` is still present after `grantRolePermissions` runs
  again, and no duplicate row is created;
- every action in `ROLE_PERMISSIONS` is a real controller action of the loaded app;
- no business role holds `plugin::users-permissions.user.update`, `user.create` or
  `user.destroy` (self-promotion guard).

`backend/tests/integration/dev_account.test.ts`:
- with `NODE_ENV=development` and the variables, the account is created with role `auteur`;
  `POST /api/auth/local` returns a JWT and `GET /api/users/me?populate=role` with it returns
  `200` and `role.type = 'auteur'`;
- a second run changes nothing and keeps a password changed by hand;
- with `NODE_ENV=production` and the variables, nothing is created;
- without the variables, nothing is created and a warning is logged;
- the password appears in no log call (spy on `strapi.log`).

Live check: `docker compose` on PostgreSQL with the three variables set, JSON log lines for the
grants and the account, then `POST /api/auth/local` and `GET /api/users/me?populate=role` with
`curl` (`200`, `role.type = auteur`).

Regression gate: all `tests/structure/*.sh`, `npm test`, `npm run build`, `npm run lint`,
`npm run format:check`.

## 6. Risks

- **Action names of future endpoints.** Each endpoint task must add its action to the table;
  the unknown-action test only catches typos, not omissions. The `tasks.md` notes and T069's
  authorization tests cover omissions.
- **`NODE_ENV` on Strapi Cloud.** The dev account depends on Strapi Cloud not running in
  `development`; it runs `strapi start` with `NODE_ENV=production`. If the variables are set
  there by mistake, nothing happens.
- **`role.find` exposure.** Any logged-in `auteur`/`administrateur` can list role names and
  descriptions; nothing sensitive is stored there.
