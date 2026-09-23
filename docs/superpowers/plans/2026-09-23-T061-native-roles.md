# T061 — Native users-permissions roles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the T007 `role` enum with the three FR-016 roles as native Strapi users-permissions roles, add the required `nom` to the User, close public registration, and prove that an authenticated `auteur` gets its permissions resolved.

**Architecture:** The User extension keeps the 8 native attributes, restores the plugin's native `role` relation verbatim and adds `nom`. A small module `backend/src/bootstrap/roles.ts`, called from the app `bootstrap()`, idempotently creates the roles and forces `allow_register: false`. Behaviour is tested with a minimal Jest + Supertest harness that boots the compiled Strapi app in-process on a throwaway SQLite file (the harness T011 will reuse).

**Tech Stack:** Strapi 5.54.0 (TypeScript), `@strapi/plugin-users-permissions` 5.54.0, Jest 29 + ts-jest, Supertest, SQLite (tests), bash structure tests.

**Spec:** `docs/superpowers/specs/2026-09-23-T061-native-roles-design.md` (T061, Jira D2-71). Read it with `specs/001-questionnaire-platform/spec.md` (FR-016, Key Entities), `specs/001-questionnaire-platform/data-model.md` (Utilisateur) and `.specify/memory/constitution.md` v1.2.0.

## Global Constraints

- Strapi and `@strapi/plugin-users-permissions` stay at **5.54.0**; no new runtime dependency.
- Business role `type` values are exactly `auteur`, `repondant`, `administrateur`; names `Auteur`, `Répondant`, `Administrateur`.
- The User `role` attribute is exactly the plugin's native one: `{ "type": "relation", "relation": "manyToOne", "target": "plugin::users-permissions.role", "inversedBy": "users", "configurable": false }`.
- `nom` is `{ "type": "string", "required": true }`. `dateInscription` is the native `createdAt` (not added).
- Accounts are created by an administrator only; public registration closed: plugin store `advanced.allow_register === false`, and `POST /api/auth/local/register` answers `400` with `error.message === "Register action is currently disabled"`.
- The roles bootstrap never updates an existing role and grants no permission (permissions are T062).
- Logs go through `strapi.log` (JSON on stdout, T009).
- **No comments in code** (CLAUDE.md "Code conventions"): no new comment in any source, test, config or script file — names and tests carry the intent; explanations go in commit messages, `tasks.md` annotations, `data-model.md` or this plan. Existing comments may stay; a comment made wrong by a change is deleted, not rewritten.
- No secret committed (Principe IV): the dummy secrets live only in the test helper.
- Test files are named `*.test.ts` (plan.md Testing; T071). Jest runs with `maxWorkers: 1`.
- Node is not on this machine's PATH: prepend `/tmp/claude-1000/-project-devops2/f0c0f41e-6d12-45e7-a390-b175e6f2473f/scratchpad/node-v22.12.0-linux-x64/bin` (portable Node 22) to `PATH` in every shell that runs `npm`, `node` or the structure tests.
- Regression gate before the last commit: every `tests/structure/*.sh` passes, and in `backend/`: `npm test`, `npm run build`, `npm run lint` (only the pre-existing `config/plugins.ts` warning allowed), `npm run format:check`.

## Review Focus

- An administrator already created or edited a business role (same `type`, different name/description) → it is kept as is, no duplicate. *(Task 2, test "is idempotent and never overwrites an existing role")*
- Someone re-enables registration in the admin panel → it is closed again at the next start and the other advanced settings (e.g. `unique_email`, `email_confirmation`) are preserved. *(Task 2, test "re-closes registration…")*
- A User is created (admin panel or API) without `nom` → rejected by validation with a message naming `nom`. *(Task 1, test "rejects a user without nom")*
- The app runs on PostgreSQL (docker compose / Strapi Cloud), not only SQLite → the bootstrap uses only `strapi.db.query` and the plugin store, both portable. *(Task 2, Step 7 live check on the compose stack)*
- A Strapi upgrade changes the native User schema → the copied attributes drift silently. *(Task 1, drift test `tests/structure/test_user_schema.sh`)*

**Before Task 1:** move Jira D2-71 to `En cours` (transition id `21`) with a comment naming the
branch `claude/task-d2-71-native-roles` and this plan.

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `backend/package.json` (+ `package-lock.json`) | devDependencies, `test` script, `jest` config block | 1 |
| `backend/tsconfig.json` | exclude `tests/` from the Strapi compilation | 1 |
| `backend/tests/helpers/global-setup.ts` | compile the TS app once before the test run | 1 |
| `backend/tests/helpers/strapi.ts` | boot / destroy the compiled Strapi in-process with test env | 1 |
| `backend/tests/integration/users_schema.test.ts` | permission resolution for an `auteur` JWT; `nom` required | 1 |
| `backend/src/extensions/users-permissions/content-types/user/schema.json` | User extension: native attributes + native `role` + `nom` | 1 |
| `tests/structure/test_user_schema.sh` | drift test vs the installed plugin schema (replaces `test_user_role.sh`) | 1 |
| `specs/001-questionnaire-platform/data-model.md` | Utilisateur amendment | 1, 2 |
| `backend/src/bootstrap/roles.ts` | `ensureBusinessRoles`, `closePublicRegistration` | 2 |
| `backend/src/index.ts` | call them from `bootstrap()` | 2 |
| `backend/tests/integration/roles_bootstrap.test.ts` | roles, idempotence, registration closed | 2 |
| `CLAUDE.md`, `specs/001-questionnaire-platform/tasks.md` | record completion | 3 |

---

### Task 1: Test harness + corrected User schema (native `role` relation, required `nom`)

**Files:**
- Modify: `backend/package.json`, `backend/package-lock.json`, `backend/tsconfig.json`
- Create: `backend/tests/helpers/global-setup.ts`, `backend/tests/helpers/strapi.ts`, `backend/tests/integration/users_schema.test.ts`, `tests/structure/test_user_schema.sh`
- Modify: `backend/src/extensions/users-permissions/content-types/user/schema.json`, `specs/001-questionnaire-platform/data-model.md`
- Delete: `tests/structure/test_user_role.sh`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `setupStrapi(): Promise<Core.Strapi>` and `teardownStrapi(): Promise<void>` from `backend/tests/helpers/strapi.ts` (used by Task 2 and later by T011); `npm test` in `backend/`.

- [ ] **Step 1: Install the test tooling**

```bash
export PATH=/tmp/claude-1000/-project-devops2/f0c0f41e-6d12-45e7-a390-b175e6f2473f/scratchpad/node-v22.12.0-linux-x64/bin:$PATH
cd /project/devops2/backend
npm install --save-dev jest@^29.7.0 ts-jest@^29.2.5 @types/jest@^29.5.14 supertest@^7.1.0 @types/supertest@^6.0.3
```

Then add to `backend/package.json` — in `"scripts"`: `"test": "jest"`, and a top-level block:

```json
  "jest": {
    "preset": "ts-jest",
    "testEnvironment": "node",
    "testMatch": ["<rootDir>/tests/**/*.test.ts"],
    "globalSetup": "<rootDir>/tests/helpers/global-setup.ts",
    "maxWorkers": 1,
    "testTimeout": 120000
  }
```

In `backend/tsconfig.json`, add `"tests/"` to `"exclude"` (next to `"dist/"`) so `strapi build` does not compile the test files into `dist/`.

- [ ] **Step 2: Create the harness helpers**

`backend/tests/helpers/global-setup.ts`:

```ts
import path from 'node:path';
import { compileStrapi } from '@strapi/strapi';

export default async function globalSetup(): Promise<void> {
  await compileStrapi({ appDir: path.resolve(__dirname, '..', '..') });
}
```

`backend/tests/helpers/strapi.ts`:

```ts
import fs from 'node:fs';
import path from 'node:path';
import { createStrapi } from '@strapi/strapi';
import type { Core } from '@strapi/strapi';

const appDir = path.resolve(__dirname, '..', '..');
const TEST_DATABASE_FILE = path.join(appDir, '.tmp', 'test.db');

const TEST_ENV = {
  NODE_ENV: 'test',
  DATABASE_CLIENT: 'sqlite',
  DATABASE_FILENAME: '.tmp/test.db',
  APP_KEYS: 'testKeyA,testKeyB',
  ADMIN_JWT_SECRET: 'test-admin-jwt-secret',
  API_TOKEN_SALT: 'test-api-token-salt',
  TRANSFER_TOKEN_SALT: 'test-transfer-token-salt',
  ENCRYPTION_KEY: 'test-encryption-key',
  JWT_SECRET: 'test-jwt-secret',
  LOG_LEVEL: 'error',
};

let instance: Core.Strapi | undefined;

export async function setupStrapi(): Promise<Core.Strapi> {
  if (instance) return instance;
  Object.assign(process.env, TEST_ENV);
  fs.rmSync(TEST_DATABASE_FILE, { force: true });
  instance = await createStrapi({
    appDir,
    distDir: path.join(appDir, 'dist'),
    serveAdminPanel: false,
  }).load();
  await instance.server.mount();
  return instance;
}

export async function teardownStrapi(): Promise<void> {
  if (!instance) return;
  await instance.destroy();
  instance = undefined;
  fs.rmSync(TEST_DATABASE_FILE, { force: true });
}
```

If `createStrapi`'s options type rejects `serveAdminPanel`, drop that key; if `instance.destroy()` leaves the process hanging, close `instance.server.httpServer` and `instance.db.connection.destroy()` explicitly instead. Record either adjustment in the task report. The shell test in Step 4 has no header comment either: its purpose is recorded in the `tasks.md` T061 annotation (Task 3).

- [ ] **Step 3: Write the failing integration test**

`backend/tests/integration/users_schema.test.ts`:

```ts
import request from 'supertest';
import type { Core } from '@strapi/strapi';
import { setupStrapi, teardownStrapi } from '../helpers/strapi';

const ROLE_UID = 'plugin::users-permissions.role';

let strapi: Core.Strapi;

beforeAll(async () => {
  strapi = await setupStrapi();
});

afterAll(async () => {
  await teardownStrapi();
});

async function findOrCreateRole(type: string): Promise<{ id: number; type: string }> {
  const roles = strapi.db.query(ROLE_UID);
  const existing = await roles.findOne({ where: { type } });
  if (existing) return existing;
  return roles.create({ data: { type, name: type, description: 'created by test' } });
}

describe('User content-type (T061, FR-016)', () => {
  it('resolves the permissions of a user authenticated with a business role', async () => {
    const auteur = await findOrCreateRole('auteur');
    await strapi.db.query('plugin::users-permissions.permission').create({
      data: { action: 'plugin::users-permissions.user.me', role: auteur.id },
    });
    const user = await strapi.plugin('users-permissions').service('user').add({
      username: 'auteur-t061',
      email: 'auteur-t061@example.test',
      password: 'Passw0rd!',
      provider: 'local',
      confirmed: true,
      blocked: false,
      nom: 'Auteur T061',
      role: auteur.id,
    });
    const jwt = await strapi.plugin('users-permissions').service('jwt').issue({ id: user.id });

    const res = await request(strapi.server.httpServer)
      .get('/api/users/me?populate=role')
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body.role.type).toBe('auteur');
  });

  it('rejects a user without nom', async () => {
    const auteur = await findOrCreateRole('auteur');
    await expect(
      strapi.documents('plugin::users-permissions.user').create({
        data: {
          username: 'sans-nom',
          email: 'sans-nom@example.test',
          password: 'Passw0rd!',
          provider: 'local',
          role: auteur.id,
        },
      }),
    ).rejects.toThrow(/nom/);
  });
});
```

- [ ] **Step 4: Write the failing drift test**

`tests/structure/test_user_schema.sh` (make it executable, `chmod +x`):

```bash
#!/bin/bash

cd "$(git rev-parse --show-toplevel)"

node - <<'EOF'
const fs = require('fs');
const EXT = 'backend/src/extensions/users-permissions/content-types/user/schema.json';
const NATIVE = './backend/node_modules/@strapi/plugin-users-permissions/dist/server/content-types/user/index.js';

let total = 0;
let passed = 0;
function check(ok, msg, detail) {
  total += 1;
  if (ok) {
    passed += 1;
    console.log(`✓ PASS: ${msg}`);
  } else {
    console.log(`✗ FAIL: ${msg}`);
    if (detail) console.log(`  ${detail}`);
  }
}

let ext = null;
try {
  ext = JSON.parse(fs.readFileSync(EXT, 'utf8'));
} catch (e) {
  check(false, `${EXT} is valid JSON`, e.message);
}
let native = null;
try {
  native = require(require('path').resolve(NATIVE)).__require();
} catch (e) {
  check(false, 'installed plugin native User schema can be loaded', e.message);
}

if (ext && native) {
  const extAttrs = ext.attributes || {};
  for (const [name, def] of Object.entries(native.attributes)) {
    check(
      JSON.stringify(extAttrs[name]) === JSON.stringify(def),
      `native attribute "${name}" copied identically`,
      `expected ${JSON.stringify(def)}, got ${JSON.stringify(extAttrs[name])}`,
    );
  }
  check(extAttrs.role && extAttrs.role.type === 'relation', 'role is the native relation, not an enum (T007 removed)');
  check(
    JSON.stringify(extAttrs.nom) === JSON.stringify({ type: 'string', required: true }),
    'nom is a required string',
    `got ${JSON.stringify(extAttrs.nom)}`,
  );
  const allowed = new Set([...Object.keys(native.attributes), 'nom']);
  const extra = Object.keys(extAttrs).filter((k) => !allowed.has(k));
  check(extra.length === 0, 'no attribute beyond the native ones and nom', `extra: ${extra.join(', ')}`);
}

console.log('');
console.log('=== Test Results ===');
console.log(`Total: ${total} | Passed: ${passed} | Failed: ${total - passed}`);
if (passed === total) {
  console.log('');
  console.log('✓ All tests passed!');
  process.exit(0);
}
console.log('');
console.log('✗ Some tests failed');
process.exit(1);
EOF
```

- [ ] **Step 5: Run both tests to verify they fail**

```bash
export PATH=/tmp/claude-1000/-project-devops2/f0c0f41e-6d12-45e7-a390-b175e6f2473f/scratchpad/node-v22.12.0-linux-x64/bin:$PATH
cd /project/devops2 && bash tests/structure/test_user_schema.sh
cd backend && npx jest tests/integration/users_schema.test.ts
```

Expected: the drift test FAILS on `native attribute "role" copied identically`, `role is the native relation…` and `nom is a required string`. The Jest test FAILS: `GET /api/users/me` does not return `200` with `role.type === 'auteur'` (the enum hides the role relation), and the user without `nom` is accepted. If Jest fails for a harness reason instead (boot error, missing module), fix the harness first — the RED must be the schema's fault.

- [ ] **Step 6: Correct the User extension**

Replace `backend/src/extensions/users-permissions/content-types/user/schema.json` with:

```json
{
  "attributes": {
    "username": {
      "type": "string",
      "minLength": 3,
      "unique": true,
      "configurable": false,
      "required": true
    },
    "email": {
      "type": "email",
      "minLength": 6,
      "configurable": false,
      "required": true
    },
    "provider": {
      "type": "string",
      "configurable": false
    },
    "password": {
      "type": "password",
      "minLength": 6,
      "configurable": false,
      "private": true,
      "searchable": false
    },
    "resetPasswordToken": {
      "type": "string",
      "configurable": false,
      "private": true,
      "searchable": false
    },
    "confirmationToken": {
      "type": "string",
      "configurable": false,
      "private": true,
      "searchable": false
    },
    "confirmed": {
      "type": "boolean",
      "default": false,
      "configurable": false
    },
    "blocked": {
      "type": "boolean",
      "default": false,
      "configurable": false
    },
    "role": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "plugin::users-permissions.role",
      "inversedBy": "users",
      "configurable": false
    },
    "nom": {
      "type": "string",
      "required": true
    }
  }
}
```

Delete the T007 test that asserts the enum: `git rm tests/structure/test_user_role.sh`.

- [ ] **Step 7: Run both tests to verify they pass**

Same commands as Step 5. Expected: drift test `Failed: 0`; Jest `2 passed`.

- [ ] **Step 8: Amend `data-model.md`**

In `specs/001-questionnaire-platform/data-model.md`, section "Utilisateur (User)", replace the `role` and `dateInscription` rows with:

```markdown
| role | relation → rôle `users-permissions` (types `auteur`, `repondant`, `administrateur`) | requis (FR-016) — pas de rôle "analyste" séparé |
| dateInscription | datetime | `createdAt` natif de Strapi |
```

and add right below the table:

```markdown
**Amendement 2026-09-23 (T061)** : `role` n'est plus un enum ajouté au User (T007, qui écrasait
la relation native et cassait la résolution des permissions) mais la relation native du plugin
`users-permissions` vers ses rôles ; les trois rôles FR-016 sont des rôles `users-permissions`
de types `auteur`, `repondant`, `administrateur`. `nom` est ajouté par l'extension
`backend/src/extensions/users-permissions/content-types/user/schema.json` ; `dateInscription`
est le `createdAt` natif.
```

- [ ] **Step 9: Commit**

```bash
cd /project/devops2
git add backend/package.json backend/package-lock.json backend/tsconfig.json backend/tests/helpers/global-setup.ts backend/tests/helpers/strapi.ts backend/tests/integration/users_schema.test.ts backend/src/extensions/users-permissions/content-types/user/schema.json tests/structure/test_user_schema.sh specs/001-questionnaire-platform/data-model.md
git commit -m "T061 (D2-71): restore native users-permissions role relation, add required nom, Jest harness"
```

(`tests/structure/test_user_role.sh` is already staged as deleted by `git rm`.)

---

### Task 2: Idempotent business-roles bootstrap and closed public registration

**Files:**
- Create: `backend/src/bootstrap/roles.ts`, `backend/tests/integration/roles_bootstrap.test.ts`
- Modify: `backend/src/index.ts` (the `bootstrap` function and its comment), `specs/001-questionnaire-platform/data-model.md`

**Interfaces:**
- Consumes: `setupStrapi()` / `teardownStrapi()` from Task 1.
- Produces: `BUSINESS_ROLES` (readonly array of `{ type, name, description }`), `ensureBusinessRoles(strapi: Core.Strapi): Promise<void>`, `closePublicRegistration(strapi: Core.Strapi): Promise<void>` — T062 will add permissions and the dev seed next to them.

- [ ] **Step 1: Write the failing test**

`backend/tests/integration/roles_bootstrap.test.ts`:

```ts
import request from 'supertest';
import type { Core } from '@strapi/strapi';
import { setupStrapi, teardownStrapi } from '../helpers/strapi';
import { closePublicRegistration, ensureBusinessRoles } from '../../src/bootstrap/roles';

const ROLE_UID = 'plugin::users-permissions.role';
const BUSINESS_TYPES = ['administrateur', 'auteur', 'repondant'];

let strapi: Core.Strapi;

beforeAll(async () => {
  strapi = await setupStrapi();
});

afterAll(async () => {
  await teardownStrapi();
});

function pluginStore() {
  return strapi.store({ type: 'plugin', name: 'users-permissions' });
}

describe('business roles bootstrap (T061, FR-016)', () => {
  it('creates the three FR-016 roles at boot', async () => {
    const roles = await strapi.db.query(ROLE_UID).findMany({ where: { type: { $in: BUSINESS_TYPES } } });
    expect(roles.map((r: { type: string }) => r.type).sort()).toEqual(BUSINESS_TYPES);
  });

  it('is idempotent and never overwrites an existing role', async () => {
    const roles = strapi.db.query(ROLE_UID);
    await roles.update({ where: { type: 'auteur' }, data: { description: 'edited in the admin panel' } });

    await ensureBusinessRoles(strapi);

    expect(await roles.count({ where: { type: { $in: BUSINESS_TYPES } } })).toBe(3);
    const auteur = await roles.findOne({ where: { type: 'auteur' } });
    expect(auteur.description).toBe('edited in the admin panel');
  });

  it('closes public registration at boot', async () => {
    const advanced = (await pluginStore().get({ key: 'advanced' })) as Record<string, unknown>;
    expect(advanced.allow_register).toBe(false);

    const res = await request(strapi.server.httpServer)
      .post('/api/auth/local/register')
      .send({ username: 'self-signup', email: 'self-signup@example.test', password: 'Passw0rd!' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Register action is currently disabled');
  });

  it('re-closes registration re-enabled in the admin panel, keeping the other settings', async () => {
    const before = (await pluginStore().get({ key: 'advanced' })) as Record<string, unknown>;
    await pluginStore().set({ key: 'advanced', value: { ...before, allow_register: true } });

    await closePublicRegistration(strapi);

    const after = await pluginStore().get({ key: 'advanced' });
    expect(after).toEqual({ ...before, allow_register: false });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
export PATH=/tmp/claude-1000/-project-devops2/f0c0f41e-6d12-45e7-a390-b175e6f2473f/scratchpad/node-v22.12.0-linux-x64/bin:$PATH
cd /project/devops2/backend && npx jest tests/integration/roles_bootstrap.test.ts
```

Expected: FAIL — `Cannot find module '../../src/bootstrap/roles'`.

- [ ] **Step 3: Implement the module**

`backend/src/bootstrap/roles.ts`:

```ts
import type { Core } from '@strapi/strapi';

export const BUSINESS_ROLES = [
  {
    type: 'auteur',
    name: 'Auteur',
    description: 'Crée, publie et suit ses propres questionnaires (FR-016).',
  },
  {
    type: 'repondant',
    name: 'Répondant',
    description: 'Répond aux questionnaires ; aucun droit par défaut (FR-016).',
  },
  {
    type: 'administrateur',
    name: 'Administrateur',
    description: "Gère l'ensemble des questionnaires (FR-016).",
  },
] as const;

const ROLE_UID = 'plugin::users-permissions.role';

export async function ensureBusinessRoles(strapi: Core.Strapi): Promise<void> {
  const roles = strapi.db.query(ROLE_UID);
  for (const role of BUSINESS_ROLES) {
    const existing = await roles.findOne({ where: { type: role.type } });
    if (existing) continue;
    await roles.create({ data: { ...role } });
    strapi.log.info(`Created users-permissions role "${role.type}"`);
  }
}

export async function closePublicRegistration(strapi: Core.Strapi): Promise<void> {
  const store = strapi.store({ type: 'plugin', name: 'users-permissions' });
  const advanced = ((await store.get({ key: 'advanced' })) ?? {}) as Record<string, unknown>;
  if (advanced.allow_register === false) return;
  await store.set({ key: 'advanced', value: { ...advanced, allow_register: false } });
  strapi.log.info('Closed public registration (users-permissions allow_register=false)');
}
```

In `backend/src/index.ts`, add the import next to the health controller import:

```ts
import { closePublicRegistration, ensureBusinessRoles } from './bootstrap/roles';
```

and replace the empty `bootstrap` and its generic scaffold comment with (no new comment):

```ts
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await ensureBusinessRoles(strapi);
    await closePublicRegistration(strapi);
  },
```

- [ ] **Step 4: Run it to verify it passes**

Same command as Step 2. Expected: `4 passed`. Then the whole Jest suite: `npx jest` → both files pass.

- [ ] **Step 5: Amend `data-model.md`**

Append to the T061 amendment paragraph written in Task 1:

```markdown
Les comptes sont créés par un administrateur (panneau d'admin Strapi ; compte de test de
développement : T062) ; l'inscription publique est fermée (`allow_register: false`, réappliqué
à chaque démarrage par `backend/src/bootstrap/roles.ts`).
```

- [ ] **Step 6: Regression gate**

```bash
export PATH=/tmp/claude-1000/-project-devops2/f0c0f41e-6d12-45e7-a390-b175e6f2473f/scratchpad/node-v22.12.0-linux-x64/bin:$PATH
cd /project/devops2 && for t in tests/structure/*.sh; do echo "== $t"; bash "$t" | grep -E '^Total'; done
cd backend && npm test && npm run build && npm run lint && npm run format:check
```

Expected: every structure script `Failed: 0`; Jest all green; build OK; lint shows only the pre-existing `config/plugins.ts` warning; Prettier clean (run `npm run format` on the new files first if needed).

- [ ] **Step 7: Live check on PostgreSQL (compose)**

```bash
cd /project/devops2
CREATED_ENV=0; [ -f .env ] || { cp .env.example .env; CREATED_ENV=1; }
docker compose up -d
until [ "$(docker compose ps --format '{{.Health}}' backend)" = healthy ]; do sleep 5; done
docker compose logs backend | grep -E 'Created users-permissions role|Closed public registration'
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:1337/api/auth/local/register \
  -H 'Content-Type: application/json' -d '{"username":"x-signup","email":"x@example.test","password":"Passw0rd!"}'
docker compose down -v
[ "$CREATED_ENV" = 1 ] && rm .env
```

Expected: three `Created users-permissions role` JSON log lines and one `Closed public registration` line; the curl prints `400`. Put the output in the task report.

- [ ] **Step 8: Commit**

```bash
cd /project/devops2
git add backend/src/bootstrap/roles.ts backend/src/index.ts backend/tests/integration/roles_bootstrap.test.ts specs/001-questionnaire-platform/data-model.md
git commit -m "T061 (D2-71): bootstrap FR-016 roles idempotently, close public registration"
```

---

### Task 3: Record completion

**Files:**
- Modify: `CLAUDE.md`, `specs/001-questionnaire-platform/tasks.md`

**Interfaces:**
- Consumes: the commits of Tasks 1–2 and their test evidence.
- Produces: nothing for later tasks.

- [ ] **Step 1: Update `CLAUDE.md`**

In "Current state": replace the T007 bullet text "User content-type extended with a business `role` enum (T007)." with "User has the native users-permissions `role` relation plus a required `nom`; FR-016 roles `auteur`/`repondant`/`administrateur` are created at boot and public registration is closed (T061)."; replace the Tests bullet with "Tests — `tests/structure/*.sh` shell scripts, plus a Jest + Supertest harness in `backend/` (`npm test`; in-process Strapi on a throwaway SQLite file, `tests/helpers/strapi.ts`, introduced by T061)."; replace the "Open risk carried forward from T007" paragraph with "The T007 `role` enum risk is resolved by T061."

- [ ] **Step 2: Update `tasks.md`**

Mark `T061` `[X]` with an inline annotation in the style of T001–T010: files changed, RED evidence (the failing drift and Jest output of Task 1 Step 5 and Task 2 Step 2), GREEN evidence, regression results, live compose check, and Jira `D2-71`. Append to the T007 line: `*(superseded by T061: enum replaced by native users-permissions roles.)*`. Append to the T011 line: `*(Jest harness already introduced by T061 — reuse backend/tests/helpers/strapi.ts.)*`.

- [ ] **Step 3: Verify and commit**

```bash
export PATH=/tmp/claude-1000/-project-devops2/f0c0f41e-6d12-45e7-a390-b175e6f2473f/scratchpad/node-v22.12.0-linux-x64/bin:$PATH
cd /project/devops2 && for t in tests/structure/*.sh; do bash "$t" | grep -E '^Total'; done
git add CLAUDE.md specs/001-questionnaire-platform/tasks.md
git commit -m "T061 (D2-71): record completion"
```

- [ ] **Step 4: Jira**

Move D2-71 to `Terminé` (transition id `41`) and comment: summary of the change, the test evidence, the commit range, and "T011 reuses the Jest harness".
