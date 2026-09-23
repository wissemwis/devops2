# T062 Role Permissions and Development Auteur Account Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grant the FR-016 roles their permissions from a declarative table applied at every boot, and create a development-only `auteur` test account from environment variables.

**Architecture:** Two new bootstrap modules next to `backend/src/bootstrap/roles.ts`: `permissions.ts` (the role → actions table and an idempotent, additive `grantRolePermissions`) and `dev-account.ts` (`ensureDevAuteurAccount`, a no-op outside `NODE_ENV=development`). Both are called from `bootstrap` in `backend/src/index.ts`. Compose passes the dev account variables through; `.env.example` documents them.

**Tech Stack:** Strapi 5.54.0 (TypeScript), `@strapi/plugin-users-permissions` 5.54.0, Jest 29 + ts-jest + Supertest (harness `backend/tests/helpers/strapi.ts`), Docker Compose.

**Spec:** `docs/superpowers/specs/2026-09-23-T062-role-permissions-dev-account-design.md`

## Global Constraints

- **No comments in code**: no `//`, `/* */`, JSDoc or `#` in any source, test, configuration or script file you write (CLAUDE.md "Code conventions"). Existing comments may stay.
- Test-first: every test is run and seen failing for the expected reason before the implementation is written (constitution Principe I).
- Node is not on PATH: `export PATH=/tmp/claude-1000/-project-devops2/f0c0f41e-6d12-45e7-a390-b175e6f2473f/scratchpad/node-v22.12.0-linux-x64/bin:$PATH`
- Permission actions: `plugin::users-permissions.user.me`, `plugin::users-permissions.role.find` for `auteur` and `administrateur`; nothing for `repondant`.
- Forbidden for every business role: `plugin::users-permissions.user.update`, `plugin::users-permissions.user.create`, `plugin::users-permissions.user.destroy`, `plugin::users-permissions.role.createRole`, `plugin::users-permissions.role.updateRole`, `plugin::users-permissions.role.deleteRole`.
- Environment variables: `DEV_AUTEUR_EMAIL`, `DEV_AUTEUR_PASSWORD`, `DEV_AUTEUR_NOM`; default `nom` is `Auteur de test`.
- Log messages (exact): `Granted "<action>" to role "<type>"`, `Skipped unknown action "<action>" for role "<type>"`, `Skipped permissions of missing role "<type>"`, `Dev auteur account skipped: DEV_AUTEUR_EMAIL/DEV_AUTEUR_PASSWORD not set`, `Dev auteur account "<email>" already exists`, `Created dev auteur account "<email>"`.
- The dev account password never appears in any log call. No real credential is committed (Principe IV); `.env`, `.env.local` and `.superpowers/` are never staged.
- Stage files by path only (never `git add -A` / `git add .`). Commit messages end with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_018oex3Jpgz8jfd3XAQ58F4t
  ```
- Regression gate (every task): `cd /project/devops2 && for t in tests/structure/*.sh; do echo "== $t"; bash "$t" | grep -E '^Total'; done`, then in `backend/`: `npm test && npm run build && npm run lint && npm run format:check`. Known pre-existing noise only: lint warning in `config/plugins.ts`, Prettier warning on `.strapi-updater.json`.

## Review Focus

- An action in the table that the app does not expose (typo, endpoint not built yet) → boot continues, a `warn` is logged, no row is written (Task 1 test "skips an unknown action").
- A permission granted by hand in the admin panel → still there after a reboot, never duplicated (Task 1 test "keeps a permission added by hand").
- A `repondant` holding a valid JWT → `403` on `GET /api/users/me`, not `200` or `500` (Task 1 test "denies a repondant").
- `DEV_AUTEUR_EMAIL` with capitals or surrounding spaces → the account is stored lower-cased and can log in with the lower-cased email (Task 2 test "normalises the email").
- A developer who changed the dev account password by hand → a reboot does not reset it (Task 2 test "leaves an existing account untouched").

---

### Task 1: Role permissions table applied at boot

**Files:**
- Create: `backend/src/bootstrap/permissions.ts`
- Create: `backend/tests/integration/role_permissions.test.ts`
- Modify: `backend/src/index.ts` (import and `bootstrap` body)
- Modify: `backend/tests/integration/users_schema.test.ts` (remove the two hand-made permission rows now granted at boot)
- Modify: `specs/001-questionnaire-platform/data-model.md` (one sentence appended to the T061 amendment of Utilisateur)

**Interfaces:**
- Consumes: `BUSINESS_ROLES` from `backend/src/bootstrap/roles.ts` (readonly array of `{ type, name, description }`, `type` ∈ `'auteur' | 'repondant' | 'administrateur'`); `setupStrapi()` / `teardownStrapi()` from `backend/tests/helpers/strapi.ts`.
- Produces: `BusinessRoleType`, `ROLE_PERMISSIONS: Record<BusinessRoleType, readonly string[]>`, `listControllerActions(strapi: Core.Strapi): Set<string>`, `grantRolePermissions(strapi: Core.Strapi, table?: Record<BusinessRoleType, readonly string[]>): Promise<void>`. Task 2 relies on `auteur` holding `user.me` and `role.find` after boot.

- [ ] **Step 1: Write the failing test**

`backend/tests/integration/role_permissions.test.ts`:

```ts
import request from 'supertest';
import type { Core } from '@strapi/strapi';
import { setupStrapi, teardownStrapi } from '../helpers/strapi';
import {
  ROLE_PERMISSIONS,
  grantRolePermissions,
  listControllerActions,
} from '../../src/bootstrap/permissions';

const ROLE_UID = 'plugin::users-permissions.role';
const PERMISSION_UID = 'plugin::users-permissions.permission';
const BUSINESS_TYPES = ['auteur', 'repondant', 'administrateur'];
const USER_WRITE_ACTIONS = [
  'plugin::users-permissions.user.update',
  'plugin::users-permissions.user.create',
  'plugin::users-permissions.user.destroy',
];

let strapi: Core.Strapi;

beforeAll(async () => {
  strapi = await setupStrapi();
});

afterAll(async () => {
  await teardownStrapi();
});

async function findRole(type: string): Promise<{ id: number; type: string }> {
  return strapi.db.query(ROLE_UID).findOne({ where: { type } });
}

async function actionsOfRole(type: string): Promise<string[]> {
  const permissions = await strapi.db
    .query(PERMISSION_UID)
    .findMany({ where: { role: { type } } });
  return permissions.map((permission: { action: string }) => permission.action).sort();
}

describe('role permissions (T062, FR-016)', () => {
  it('grants each business role exactly its table actions at boot', async () => {
    for (const [type, actions] of Object.entries(ROLE_PERMISSIONS)) {
      expect(await actionsOfRole(type)).toEqual([...actions].sort());
    }
  });

  it('only lists actions the loaded app exposes', () => {
    const known = listControllerActions(strapi);
    const unknown = Object.values(ROLE_PERMISSIONS)
      .flat()
      .filter((action) => !known.has(action));
    expect(unknown).toEqual([]);
  });

  it('never lets a business role write users', async () => {
    const tableWrites = Object.values(ROLE_PERMISSIONS)
      .flat()
      .filter((action) => USER_WRITE_ACTIONS.includes(action));
    expect(tableWrites).toEqual([]);

    const granted = await strapi.db.query(PERMISSION_UID).findMany({
      where: { action: { $in: USER_WRITE_ACTIONS }, role: { type: { $in: BUSINESS_TYPES } } },
    });
    expect(granted).toEqual([]);
  });

  it('denies a repondant its own profile', async () => {
    const repondant = await findRole('repondant');
    const user = await strapi.plugin('users-permissions').service('user').add({
      username: 'repondant-t062',
      email: 'repondant-t062@example.test',
      password: 'Passw0rd!',
      provider: 'local',
      confirmed: true,
      blocked: false,
      nom: 'Répondant T062',
      role: repondant.id,
    });
    const jwt = await strapi.plugin('users-permissions').service('jwt').issue({ id: user.id });

    const res = await request(strapi.server.httpServer)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(403);
  });

  it('keeps a permission added by hand and creates no duplicate', async () => {
    const auteur = await findRole('auteur');
    await strapi.db.query(PERMISSION_UID).create({
      data: { action: 'plugin::users-permissions.user.find', role: auteur.id },
    });

    await grantRolePermissions(strapi);

    expect(await actionsOfRole('auteur')).toEqual(
      [...ROLE_PERMISSIONS.auteur, 'plugin::users-permissions.user.find'].sort(),
    );
  });

  it('skips an unknown action with a warning and writes no row', async () => {
    const warn = jest.spyOn(strapi.log, 'warn');

    await grantRolePermissions(strapi, {
      auteur: ['api::nope.nope.find'],
      repondant: [],
      administrateur: [],
    });

    expect(warn).toHaveBeenCalledWith('Skipped unknown action "api::nope.nope.find" for role "auteur"');
    expect(await strapi.db.query(PERMISSION_UID).count({ where: { action: 'api::nope.nope.find' } })).toBe(0);
    warn.mockRestore();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
export PATH=/tmp/claude-1000/-project-devops2/f0c0f41e-6d12-45e7-a390-b175e6f2473f/scratchpad/node-v22.12.0-linux-x64/bin:$PATH
cd /project/devops2/backend && npx jest tests/integration/role_permissions.test.ts
```

Expected: FAIL — `Cannot find module '../../src/bootstrap/permissions'`.

- [ ] **Step 3: Implement the module**

`backend/src/bootstrap/permissions.ts`:

```ts
import type { Core } from '@strapi/strapi';
import { BUSINESS_ROLES } from './roles';

export type BusinessRoleType = (typeof BUSINESS_ROLES)[number]['type'];

export const ROLE_PERMISSIONS: Record<BusinessRoleType, readonly string[]> = {
  auteur: ['plugin::users-permissions.user.me', 'plugin::users-permissions.role.find'],
  repondant: [],
  administrateur: ['plugin::users-permissions.user.me', 'plugin::users-permissions.role.find'],
};

const ROLE_UID = 'plugin::users-permissions.role';
const PERMISSION_UID = 'plugin::users-permissions.permission';

type ControllerOwners = Record<string, { controllers?: Record<string, object> }>;

function controllerActions(prefix: 'api' | 'plugin', owners: ControllerOwners): string[] {
  return Object.entries(owners).flatMap(([ownerName, owner]) =>
    Object.entries(owner.controllers ?? {}).flatMap(([controllerName, controller]) =>
      Object.keys(controller).map(
        (actionName) => `${prefix}::${ownerName}.${controllerName}.${actionName}`,
      ),
    ),
  );
}

export function listControllerActions(strapi: Core.Strapi): Set<string> {
  return new Set([
    ...controllerActions('api', strapi.apis as unknown as ControllerOwners),
    ...controllerActions('plugin', strapi.plugins as unknown as ControllerOwners),
  ]);
}

export async function grantRolePermissions(
  strapi: Core.Strapi,
  table: Record<BusinessRoleType, readonly string[]> = ROLE_PERMISSIONS,
): Promise<void> {
  const known = listControllerActions(strapi);
  const permissions = strapi.db.query(PERMISSION_UID);
  for (const [type, actions] of Object.entries(table)) {
    const role = await strapi.db.query(ROLE_UID).findOne({ where: { type } });
    if (!role) {
      strapi.log.warn(`Skipped permissions of missing role "${type}"`);
      continue;
    }
    for (const action of actions) {
      if (!known.has(action)) {
        strapi.log.warn(`Skipped unknown action "${action}" for role "${type}"`);
        continue;
      }
      const existing = await permissions.findOne({ where: { action, role: { id: role.id } } });
      if (existing) continue;
      await permissions.create({ data: { action, role: role.id } });
      strapi.log.info(`Granted "${action}" to role "${type}"`);
    }
  }
}
```

In `backend/src/index.ts`, add the import after the `./bootstrap/roles` import:

```ts
import { grantRolePermissions } from './bootstrap/permissions';
```

and call it right after `ensureBusinessRoles`:

```ts
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await ensureBusinessRoles(strapi);
    await grantRolePermissions(strapi);
    await closePublicRegistration(strapi);
    await setDefaultRespondentRole(strapi);
    subscribeDefaultRespondentRole(strapi);
  },
```

- [ ] **Step 4: Run it to verify it passes**

Same command as Step 2. Expected: `6 passed`.

- [ ] **Step 5: Remove the now-redundant hand-made grants from `users_schema.test.ts`**

In `backend/tests/integration/users_schema.test.ts`, test "resolves the permissions of a user authenticated with a business role", delete the two `strapi.db.query('plugin::users-permissions.permission').create(...)` calls (for `user.me` and `role.find`): boot now grants them. Keep the rest of the test unchanged. Run `npx jest tests/integration/users_schema.test.ts` → `2 passed`. This proves the boot grants end to end (JWT → `200` with `role.type = 'auteur'`).

- [ ] **Step 6: Amend `data-model.md`**

Append to the T061 amendment paragraph of the Utilisateur section:

```markdown
Les permissions de chaque rôle sont déclarées dans `ROLE_PERMISSIONS`
(`backend/src/bootstrap/permissions.ts`) et accordées à chaque démarrage (T062) ; chaque
endpoint ajoute son action à cette table.
```

- [ ] **Step 7: Regression gate**

Run the regression gate from Global Constraints. Expected: every structure script `Failed: 0`; Jest 4 suites green; build OK; lint and Prettier show only the known pre-existing warnings (run `npx prettier --write` on the new files first if needed).

- [ ] **Step 8: Commit**

```bash
cd /project/devops2
git add backend/src/bootstrap/permissions.ts backend/src/index.ts backend/tests/integration/role_permissions.test.ts backend/tests/integration/users_schema.test.ts specs/001-questionnaire-platform/data-model.md
git commit -m "T062 (D2-72): grant FR-016 role permissions from a declarative table at boot"
```

(with the two trailer lines from Global Constraints)

---

### Task 2: Development `auteur` account from environment variables

**Controller note (before dispatch):** the working tree holds an uncommitted, unrelated owner change to `docker-compose.yml` (ports published on all interfaces). The controller stashes it (`git stash push docker-compose.yml -m owner-ports`) before dispatching this task and restores it (`git stash pop`) after the task's commit. The implementer never commits that change.

**Files:**
- Create: `backend/src/bootstrap/dev-account.ts`
- Create: `backend/tests/integration/dev_account.test.ts`
- Modify: `backend/src/index.ts` (import and last `bootstrap` call)
- Modify: `.env.example` (three variables, no comment)
- Modify: `docker-compose.yml` (`backend.environment`, three entries)
- Modify: `tests/structure/test_docker_compose.sh`, `tests/structure/test_env_example.sh` (assert the new variables)
- Modify: `specs/001-questionnaire-platform/quickstart.md` (Scénario 1 step 1)

**Interfaces:**
- Consumes: the `auteur` role from `ensureBusinessRoles` and its `user.me` / `role.find` grants from Task 1 (`grantRolePermissions`), `setupStrapi()` / `teardownStrapi()`.
- Produces: `ensureDevAuteurAccount(strapi: Core.Strapi, env?: NodeJS.ProcessEnv): Promise<void>`.

- [ ] **Step 1: Write the failing test**

`backend/tests/integration/dev_account.test.ts`:

```ts
import request from 'supertest';
import type { Core } from '@strapi/strapi';
import { setupStrapi, teardownStrapi } from '../helpers/strapi';
import { ensureDevAuteurAccount } from '../../src/bootstrap/dev-account';

const USER_UID = 'plugin::users-permissions.user';
const PASSWORD = 'Dev-Passw0rd!';

let strapi: Core.Strapi;

beforeAll(async () => {
  strapi = await setupStrapi();
});

afterAll(async () => {
  await teardownStrapi();
});

function devEnv(email: string, extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'development',
    DEV_AUTEUR_EMAIL: email,
    DEV_AUTEUR_PASSWORD: PASSWORD,
    ...extra,
  };
}

async function findUser(email: string) {
  return strapi.db.query(USER_UID).findOne({ where: { email }, populate: ['role'] });
}

async function login(identifier: string, password: string) {
  return request(strapi.server.httpServer)
    .post('/api/auth/local')
    .send({ identifier, password });
}

describe('development auteur account (T062, quickstart Scénario 1)', () => {
  it('creates an auteur account that can log in and read its profile', async () => {
    await ensureDevAuteurAccount(strapi, devEnv('dev.auteur@example.test'));

    const user = await findUser('dev.auteur@example.test');
    expect(user.role.type).toBe('auteur');
    expect(user.nom).toBe('Auteur de test');
    expect(user.confirmed).toBe(true);
    expect(user.password).not.toBe(PASSWORD);

    const auth = await login('dev.auteur@example.test', PASSWORD);
    expect(auth.status).toBe(200);
    const me = await request(strapi.server.httpServer)
      .get('/api/users/me?populate=role')
      .set('Authorization', `Bearer ${auth.body.jwt}`);
    expect(me.status).toBe(200);
    expect(me.body.role.type).toBe('auteur');
  });

  it('uses DEV_AUTEUR_NOM when given', async () => {
    await ensureDevAuteurAccount(
      strapi,
      devEnv('named.auteur@example.test', { DEV_AUTEUR_NOM: 'Wissem Hamza' }),
    );

    expect((await findUser('named.auteur@example.test')).nom).toBe('Wissem Hamza');
  });

  it('leaves an existing account untouched', async () => {
    const user = await findUser('dev.auteur@example.test');
    await strapi
      .plugin('users-permissions')
      .service('user')
      .edit(user.id, { password: 'Changed-Passw0rd!' });

    await ensureDevAuteurAccount(strapi, devEnv('dev.auteur@example.test'));

    expect(await strapi.db.query(USER_UID).count({ where: { email: 'dev.auteur@example.test' } })).toBe(1);
    expect((await login('dev.auteur@example.test', 'Changed-Passw0rd!')).status).toBe(200);
  });

  it('normalises the email', async () => {
    await ensureDevAuteurAccount(strapi, devEnv('  Upper.Auteur@Example.Test '));

    expect(await findUser('upper.auteur@example.test')).not.toBeNull();
    expect((await login('upper.auteur@example.test', PASSWORD)).status).toBe(200);
  });

  it('does nothing outside development', async () => {
    await ensureDevAuteurAccount(
      strapi,
      devEnv('prod.auteur@example.test', { NODE_ENV: 'production' }),
    );
    await ensureDevAuteurAccount(strapi, devEnv('test.auteur@example.test', { NODE_ENV: 'test' }));

    expect(await findUser('prod.auteur@example.test')).toBeNull();
    expect(await findUser('test.auteur@example.test')).toBeNull();
  });

  it('skips with a warning when a credential is missing', async () => {
    const warn = jest.spyOn(strapi.log, 'warn');

    await ensureDevAuteurAccount(strapi, {
      NODE_ENV: 'development',
      DEV_AUTEUR_EMAIL: 'nopass.auteur@example.test',
    });

    expect(warn).toHaveBeenCalledWith(
      'Dev auteur account skipped: DEV_AUTEUR_EMAIL/DEV_AUTEUR_PASSWORD not set',
    );
    expect(await findUser('nopass.auteur@example.test')).toBeNull();
    warn.mockRestore();
  });

  it('never logs the password', async () => {
    const spies = (['info', 'warn', 'error', 'debug'] as const).map((level) =>
      jest.spyOn(strapi.log, level),
    );

    await ensureDevAuteurAccount(strapi, devEnv('quiet.auteur@example.test'));
    await ensureDevAuteurAccount(strapi, devEnv('quiet.auteur@example.test'));

    const logged = JSON.stringify(spies.flatMap((spy) => spy.mock.calls));
    expect(logged).toContain('quiet.auteur@example.test');
    expect(logged).not.toContain(PASSWORD);
    spies.forEach((spy) => spy.mockRestore());
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
export PATH=/tmp/claude-1000/-project-devops2/f0c0f41e-6d12-45e7-a390-b175e6f2473f/scratchpad/node-v22.12.0-linux-x64/bin:$PATH
cd /project/devops2/backend && npx jest tests/integration/dev_account.test.ts
```

Expected: FAIL — `Cannot find module '../../src/bootstrap/dev-account'`.

- [ ] **Step 3: Implement the module**

`backend/src/bootstrap/dev-account.ts`:

```ts
import type { Core } from '@strapi/strapi';

const USER_UID = 'plugin::users-permissions.user';
const ROLE_UID = 'plugin::users-permissions.role';
const DEFAULT_NOM = 'Auteur de test';

export async function ensureDevAuteurAccount(
  strapi: Core.Strapi,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  if (env.NODE_ENV !== 'development') return;
  const email = env.DEV_AUTEUR_EMAIL?.trim().toLowerCase();
  const password = env.DEV_AUTEUR_PASSWORD;
  if (!email || !password) {
    strapi.log.warn('Dev auteur account skipped: DEV_AUTEUR_EMAIL/DEV_AUTEUR_PASSWORD not set');
    return;
  }
  const existing = await strapi.db.query(USER_UID).findOne({ where: { email } });
  if (existing) {
    strapi.log.info(`Dev auteur account "${email}" already exists`);
    return;
  }
  const auteur = await strapi.db.query(ROLE_UID).findOne({ where: { type: 'auteur' } });
  await strapi.plugin('users-permissions').service('user').add({
    username: email,
    email,
    password,
    nom: env.DEV_AUTEUR_NOM || DEFAULT_NOM,
    provider: 'local',
    confirmed: true,
    blocked: false,
    role: auteur.id,
  });
  strapi.log.info(`Created dev auteur account "${email}"`);
}
```

In `backend/src/index.ts`, add `import { ensureDevAuteurAccount } from './bootstrap/dev-account';` next to the other bootstrap imports and make it the last call of `bootstrap`:

```ts
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await ensureBusinessRoles(strapi);
    await grantRolePermissions(strapi);
    await closePublicRegistration(strapi);
    await setDefaultRespondentRole(strapi);
    subscribeDefaultRespondentRole(strapi);
    await ensureDevAuteurAccount(strapi);
  },
```

- [ ] **Step 4: Run it to verify it passes**

Same command as Step 2. Expected: `7 passed`. Then `npx jest` → all 5 suites pass.

- [ ] **Step 5: Structure tests for the configuration (failing first)**

In `tests/structure/test_env_example.sh`, after the "Frontend / cross-cutting variables" block, add:

```bash
echo ""
echo "--- Development auteur account (T062, development only) ---"
for var in DEV_AUTEUR_EMAIL DEV_AUTEUR_PASSWORD DEV_AUTEUR_NOM; do
    assert_contains "$ENV_FILE" "^${var}=$" "$ENV_FILE documents $var with an empty value"
done
```

In `tests/structure/test_docker_compose.sh`, after the `check_model` for `DATABASE_URL` in the backend section, add:

```bash
for var in DEV_AUTEUR_EMAIL DEV_AUTEUR_PASSWORD DEV_AUTEUR_NOM; do
    check_model "data['services']['backend']['environment'].get('$var', '__missing__') == ''" \
        "backend passes $var through, empty when unset (T062)"
done
```

Run both scripts: expected `Failed: 3` each.

- [ ] **Step 6: Configuration**

Append to `.env.example` (no comment line):

```
DEV_AUTEUR_EMAIL=
DEV_AUTEUR_PASSWORD=
DEV_AUTEUR_NOM=
```

In `docker-compose.yml`, `services.backend.environment`, after `LOG_LEVEL: ${LOG_LEVEL:-http}`:

```yaml
      DEV_AUTEUR_EMAIL: ${DEV_AUTEUR_EMAIL:-}
      DEV_AUTEUR_PASSWORD: ${DEV_AUTEUR_PASSWORD:-}
      DEV_AUTEUR_NOM: ${DEV_AUTEUR_NOM:-}
```

Re-run both scripts: expected `Failed: 0`.

- [ ] **Step 7: Quickstart**

In `specs/001-questionnaire-platform/quickstart.md`, replace Scénario 1 step 1 with:

```markdown
1. Se connecter en tant qu'auteur (compte de test seedé) : définir `DEV_AUTEUR_EMAIL` et
   `DEV_AUTEUR_PASSWORD` (et optionnellement `DEV_AUTEUR_NOM`) dans le fichier d'environnement
   local avant `docker compose up` ; le backend crée ce compte `auteur` au démarrage, uniquement
   en développement (`NODE_ENV=development`). Ne jamais définir ces variables dans un
   déploiement.
```

- [ ] **Step 8: Regression gate**

Run the regression gate from Global Constraints. Expected: all green apart from the known pre-existing warnings.

- [ ] **Step 9: Live check on PostgreSQL (compose)**

```bash
cd /project/devops2
TMP_ENV=$(mktemp)
cp .env.example "$TMP_ENV"
sed -i -e 's/^DATABASE_NAME=.*/DATABASE_NAME=questionnaire/' \
       -e 's/^DATABASE_USERNAME=.*/DATABASE_USERNAME=questionnaire/' \
       -e 's/^DATABASE_PASSWORD=.*/DATABASE_PASSWORD=live-check-db/' \
       -e 's/^DEV_AUTEUR_EMAIL=.*/DEV_AUTEUR_EMAIL=live.auteur@example.test/' \
       -e 's/^DEV_AUTEUR_PASSWORD=.*/DEV_AUTEUR_PASSWORD=Live-Passw0rd!/' "$TMP_ENV"
docker compose --env-file "$TMP_ENV" up -d
until [ "$(docker compose --env-file "$TMP_ENV" ps --format '{{.Health}}' backend)" = healthy ]; do sleep 5; done
docker compose --env-file "$TMP_ENV" logs backend | grep -E 'Granted|dev auteur account'
JWT=$(curl -s -X POST http://127.0.0.1:1337/api/auth/local -H 'Content-Type: application/json' \
  -d '{"identifier":"live.auteur@example.test","password":"Live-Passw0rd!"}' | python3 -c 'import json,sys; print(json.load(sys.stdin)["jwt"])')
curl -s -w '\n%{http_code}\n' http://127.0.0.1:1337/api/users/me?populate=role -H "Authorization: Bearer $JWT" | python3 -c 'import sys; lines=sys.stdin.read().splitlines(); import json; print(json.loads(lines[0])["role"]["type"], lines[1])'
docker compose --env-file "$TMP_ENV" logs backend | grep -c 'Live-Passw0rd!'
docker compose --env-file "$TMP_ENV" down -v
rm -f "$TMP_ENV"
```

Expected: four `Granted "…" to role "…"` JSON lines, one `Created dev auteur account "live.auteur@example.test"` line; the `/users/me` line prints `auteur 200`; the password grep count prints `0`. If the account is not created because `NODE_ENV` is not `development` inside the container, stop and report BLOCKED with the log output instead of changing the compose file. Put the output in the task report.

- [ ] **Step 10: Commit**

```bash
cd /project/devops2
git add backend/src/bootstrap/dev-account.ts backend/src/index.ts backend/tests/integration/dev_account.test.ts .env.example docker-compose.yml tests/structure/test_docker_compose.sh tests/structure/test_env_example.sh specs/001-questionnaire-platform/quickstart.md
git commit -m "T062 (D2-72): development-only auteur account from DEV_AUTEUR_* variables"
```

(with the two trailer lines from Global Constraints)

---

### Task 3: Record completion

**Files:**
- Modify: `CLAUDE.md`, `specs/001-questionnaire-platform/tasks.md`

**Interfaces:**
- Consumes: the commits of Tasks 1–2 and their test evidence.
- Produces: nothing for later tasks.

- [ ] **Step 1: `CLAUDE.md`**

In "Current state": change "**T001–T010** and **T061** of 76 tasks" to "**T001–T010**, **T061** and **T062** of 76 tasks"; append to the `backend/` bullet's T061 sentence: "Role permissions come from `ROLE_PERMISSIONS` in `src/bootstrap/permissions.ts` (granted at boot, additive; `auteur`/`administrateur`: `users/me`, `role.find`); in development, `DEV_AUTEUR_EMAIL`/`DEV_AUTEUR_PASSWORD` create a test `auteur` account at boot (T062)."

- [ ] **Step 2: `tasks.md`**

Mark `T062` `[X]` with an inline annotation in the style of T061: design and plan paths, files, RED/GREEN evidence of both tasks, regression results, live compose check output, reviewer verdicts, Jira `D2-72`, and the note that the "propriétaire" rule stays in each endpoint's controller. Append to each of T018, T019, T020, T021, T035, T045, T046, T047, T048 and T064 (the tasks implementing an authenticated `contracts/api.md` endpoint): `*(grant its action in ROLE_PERMISSIONS, backend/src/bootstrap/permissions.ts — T062.)*` Append to T034, T036 and T037 (endpoints reachable without an account): `*(public endpoint, not a business-role permission: choose route \`config.auth: false\` or a grant to the users-permissions \`public\` role in this task — T062.)*`

- [ ] **Step 3: Verify and commit**

```bash
export PATH=/tmp/claude-1000/-project-devops2/f0c0f41e-6d12-45e7-a390-b175e6f2473f/scratchpad/node-v22.12.0-linux-x64/bin:$PATH
cd /project/devops2 && for t in tests/structure/*.sh; do bash "$t" | grep -E '^Total'; done
git add CLAUDE.md specs/001-questionnaire-platform/tasks.md
git commit -m "T062 (D2-72): record completion"
```

- [ ] **Step 4: Jira**

After the final whole-branch review passes: comment on D2-72 (summary, test evidence, commit range, "each endpoint task adds its action to `ROLE_PERMISSIONS`") and move it to `Terminé` (transition id `41`).
