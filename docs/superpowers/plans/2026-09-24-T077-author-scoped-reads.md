# T077 Author-Scoped Reads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the owner of a questionnaire (or any `administrateur`) read it in any `statut` with its questions ordered by `position`, and let a caller list the questionnaires it authored, through `GET /api/mes-questionnaires/:id` and `GET /api/mes-questionnaires`.

**Architecture:** Two custom actions, `findOneMine` and `findMine`, on the existing `questionnaire` core controller, each on its own custom route, granted to `auteur` and `administrateur` in `ROLE_PERMISSIONS`. `findOneMine` reuses `loadForAction` for 404/403, then reloads the document with fixed `fields` and `populate`; `findMine` filters on `auteur.id = caller`. Neither action reads `ctx.query`.

**Tech Stack:** Strapi 5.54.0 (TypeScript), `@strapi/plugin-users-permissions` 5.54.0, Jest 29 + ts-jest + Supertest (harness `backend/tests/helpers/strapi.ts`).

**Spec:** `docs/superpowers/specs/2026-09-24-T077-author-scoped-reads-design.md`

## Global Constraints

- **No comments in code**: no `//`, `/* */`, JSDoc or `#` in any source, test, configuration or script file you write (CLAUDE.md "Code conventions"). Existing comments may stay.
- Test-first: every test is run and seen failing for the expected reason before the implementation is written (constitution Principe I).
- Node is not on PATH: `export PATH=/tmp/claude-1000/-project-devops2/f0c0f41e-6d12-45e7-a390-b175e6f2473f/scratchpad/node-v22.12.0-linux-x64/bin:$PATH`
- Routes (exact): `GET /api/mes-questionnaires` → `api::questionnaire.questionnaire.findMine`; `GET /api/mes-questionnaires/:id` → `api::questionnaire.questionnaire.findOneMine`. `:id` is the questionnaire `documentId`.
- Grants (exact) in `ROLE_PERMISSIONS`: both actions → `auteur` and `administrateur`; `repondant` stays `[]`.
- Returned questionnaire fields (exact): `titre`, `description`, `statut`, `visibilite`, `createdAt`, `updatedAt`, plus Strapi's own `id` and `documentId`. Never `auteur`. List items never carry `questions`.
- List: only questionnaires whose `auteur` is the caller, sorted `updatedAt:desc`, no pagination, `meta: {}`.
- Detail: owner or `administrateur`, any `statut`; `questions` sorted `position:asc`, each with `image` populated.
- Status codes: no JWT or `repondant` → 403 (`ForbiddenError`); unknown `documentId` → 404 (`questionnaire not found`); non-owner `auteur` → 403 (`PolicyError`, `only the author of this questionnaire can do this`).
- Neither action reads `ctx.query`: client `populate`, `filters`, `sort`, `fields` are ignored.
- Stage files by path only (never `git add -A` / `git add .`); never stage `.env*` or `.superpowers/`. Commit messages end with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_018oex3Jpgz8jfd3XAQ58F4t
  ```
- Regression gate (every task): `cd /project/devops2 && for t in tests/structure/*.sh; do echo "== $t"; bash "$t" | grep -E '^Total'; done`; in `backend/`: `npm test && npm run build && npm run lint && npm run format:check`. Known pre-existing noise only: lint warning in `config/plugins.ts`, Prettier warning on `.strapi-updater.json`.
- If an installed Strapi type or API differs from the code below, adjust only typing or the call shape, never an assertion, and record it in the report.

## Review Focus

- A questionnaire with no question yet (a fresh `brouillon`, the first thing T022 will display) → detail returns `questions: []`, not a missing key or `null` (Task 1 test "returns an empty questions list").
- The detail's `questions` disappear because `sanitizeOutput(data, ctx)` passes `auth` and Strapi's `removeRestrictedRelations` strips relations the role cannot `find` → sanitise with `strapi.contentAPI.sanitize.output(found, strapi.getModel(UID))` without `auth` (Task 1 test "orders questions by position").
- An administrateur asks for an unknown `documentId` → 404, not 403 or 500 (Task 1 test "answers 404 to an administrateur too").
- A client passes `?filters[auteur][id]=<other>` or `?populate=*` to the list → still only its own questionnaires, no `auteur`, no `questions` (Task 2 test "ignores client query parameters").
- An auteur owning one questionnaire per `statut` → the list returns all three, not only drafts (Task 2 test "lists every statut").

---

### Task 1: `GET /api/mes-questionnaires/:id` (detail)

**Files:**
- Create: `backend/tests/contract/mes_questionnaires_get.test.ts`
- Modify: `backend/src/api/questionnaire/controllers/questionnaire.ts` (add `READ_FIELDS` and `findOneMine`)
- Modify: `backend/src/api/questionnaire/routes/questionnaire.ts` (add the route)
- Modify: `backend/src/bootstrap/permissions.ts` (grant `findOneMine` to `auteur` and `administrateur`)

**Interfaces:**
- Consumes: `loadForAction(strapi, documentId, user, { allowAdministrateur: true })` from `backend/src/api/questionnaire/services/questionnaire-access.ts` (404 `NotFoundError`, 403 `PolicyError`); test helpers `createUserWithRole(strapi, type)` → `{ user, jwt }` (`tests/helpers/users.ts`), `createQuestionnaire(strapi, owner, overrides)` and `addQuestion(strapi, questionnaire, overrides)` (`tests/helpers/questionnaires.ts`).
- Produces: module constant `READ_FIELDS` in the questionnaire controller (`['titre', 'description', 'statut', 'visibilite', 'createdAt', 'updatedAt']`), reused by Task 2's `findMine`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/contract/mes_questionnaires_get.test.ts`:

```ts
import request from 'supertest';
import type { Core } from '@strapi/strapi';
import { setupStrapi, teardownStrapi } from '../helpers/strapi';
import { createUserWithRole } from '../helpers/users';
import { addQuestion, createQuestionnaire } from '../helpers/questionnaires';

let strapi: Core.Strapi;

beforeAll(async () => {
  strapi = await setupStrapi();
});

afterAll(async () => {
  await teardownStrapi();
});

function get(jwt: string | null, documentId: string, query = '') {
  const pending = request(strapi.server.httpServer).get(
    `/api/mes-questionnaires/${documentId}${query}`,
  );
  return jwt ? pending.set('Authorization', `Bearer ${jwt}`) : pending;
}

describe('GET /api/mes-questionnaires/:id (T077, US1, FR-016)', () => {
  it('answers 403 without a JWT and to a repondant', async () => {
    const { user: owner } = await createUserWithRole(strapi, 'auteur');
    const { jwt: repondant } = await createUserWithRole(strapi, 'repondant');
    const questionnaire = await createQuestionnaire(strapi, owner);

    expect((await get(null, questionnaire.documentId)).status).toBe(403);
    expect((await get(repondant, questionnaire.documentId)).status).toBe(403);
  });

  it('answers 404 for an unknown documentId', async () => {
    const { jwt } = await createUserWithRole(strapi, 'auteur');

    const res = await get(jwt, 'unknown-document-id');

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('questionnaire not found');
  });

  it('answers 404 to an administrateur too', async () => {
    const { jwt } = await createUserWithRole(strapi, 'administrateur');

    expect((await get(jwt, 'unknown-document-id')).status).toBe(404);
  });

  it('answers 403 to another auteur', async () => {
    const { user: owner } = await createUserWithRole(strapi, 'auteur');
    const { jwt: intruder } = await createUserWithRole(strapi, 'auteur');
    const questionnaire = await createQuestionnaire(strapi, owner);

    const res = await get(intruder, questionnaire.documentId);

    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe('only the author of this questionnaire can do this');
  });

  it('lets the owner read its questionnaire in every statut', async () => {
    const { user, jwt } = await createUserWithRole(strapi, 'auteur');

    for (const statut of ['brouillon', 'publie', 'ferme']) {
      const questionnaire = await createQuestionnaire(strapi, user, {
        statut,
        description: 'Séance 3',
        visibilite: 'privee',
      });

      const res = await get(jwt, questionnaire.documentId);

      expect(res.status).toBe(200);
      expect(res.body.meta).toEqual({});
      expect(res.body.data).toMatchObject({
        documentId: questionnaire.documentId,
        titre: 'Retour de séance',
        description: 'Séance 3',
        statut,
        visibilite: 'privee',
      });
      expect(res.body.data.createdAt).toEqual(expect.any(String));
      expect(res.body.data.updatedAt).toEqual(expect.any(String));
    }
  });

  it('lets an administrateur read a questionnaire it does not own', async () => {
    const { user: owner } = await createUserWithRole(strapi, 'auteur');
    const { jwt: administrateur } = await createUserWithRole(strapi, 'administrateur');
    const questionnaire = await createQuestionnaire(strapi, owner, { statut: 'publie' });

    const res = await get(administrateur, questionnaire.documentId);

    expect(res.status).toBe(200);
    expect(res.body.data.documentId).toBe(questionnaire.documentId);
  });

  it('returns an empty questions list for a questionnaire without question', async () => {
    const { user, jwt } = await createUserWithRole(strapi, 'auteur');
    const questionnaire = await createQuestionnaire(strapi, user);

    const res = await get(jwt, questionnaire.documentId);

    expect(res.status).toBe(200);
    expect(res.body.data.questions).toEqual([]);
  });

  it('orders questions by position with their options', async () => {
    const { user, jwt } = await createUserWithRole(strapi, 'auteur');
    const questionnaire = await createQuestionnaire(strapi, user);
    await addQuestion(strapi, questionnaire, { position: 3, texte: 'Troisième' });
    await addQuestion(strapi, questionnaire, {
      position: 1,
      texte: 'Première',
      type: 'choix_multiple',
      options: ['Oui', 'Non'],
    });
    await addQuestion(strapi, questionnaire, {
      position: 2,
      texte: 'Deuxième',
      type: 'texte_libre',
      obligatoire: false,
    });

    const res = await get(jwt, questionnaire.documentId);

    expect(res.status).toBe(200);
    expect(res.body.data.questions).toHaveLength(3);
    expect(res.body.data.questions).toEqual([
      expect.objectContaining({
        texte: 'Première',
        type: 'choix_multiple',
        position: 1,
        options: ['Oui', 'Non'],
      }),
      expect.objectContaining({
        texte: 'Deuxième',
        type: 'texte_libre',
        position: 2,
        obligatoire: false,
      }),
      expect.objectContaining({ texte: 'Troisième', type: 'likert', position: 3 }),
    ]);
    for (const question of res.body.data.questions) {
      expect(question.documentId).toEqual(expect.any(String));
      expect(question.image).toBeNull();
      expect(question).not.toHaveProperty('questionnaire');
    }
  });

  it('never exposes the author, even when the client asks for it', async () => {
    const { user, jwt } = await createUserWithRole(strapi, 'auteur');
    const questionnaire = await createQuestionnaire(strapi, user);

    for (const query of ['', '?populate=auteur', '?populate=*', '?fields[0]=titre']) {
      const res = await get(jwt, questionnaire.documentId, query);

      expect(res.status).toBe(200);
      expect(res.body.data).not.toHaveProperty('auteur');
      expect(res.body.data.statut).toBe('brouillon');
      expect(res.body.data.questions).toEqual([]);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /project/devops2/backend && npx jest tests/contract/mes_questionnaires_get.test.ts`
Expected: FAIL — the 404 test and every 200 test fail because the route does not exist yet (an unmatched GET answers 404 with Strapi's `NotFoundError` body but no `questionnaire not found` message; the 200 tests get 404). The 403 tests may already pass; that is expected, not a reason to stop.

- [ ] **Step 3: Add the route**

In `backend/src/api/questionnaire/routes/questionnaire.ts`, append to `routes` (after the `close` route):

```ts
    {
      method: 'GET',
      path: '/mes-questionnaires/:id',
      handler: 'api::questionnaire.questionnaire.findOneMine',
      config: { policies: [] },
    },
```

- [ ] **Step 4: Add `READ_FIELDS` and `findOneMine` to the controller**

In `backend/src/api/questionnaire/controllers/questionnaire.ts`, below `const CREATE_FIELDS = …`, add:

```ts
const READ_FIELDS = ['titre', 'description', 'statut', 'visibilite', 'createdAt', 'updatedAt'];
```

and inside the returned object, after `close`, add:

```ts
    async findOneMine(ctx) {
      const questionnaire = await loadForAction(strapi, ctx.params.id, ctx.state.user, {
        allowAdministrateur: true,
      });
      const found = await strapi.documents(UID).findOne({
        documentId: questionnaire.documentId,
        fields: READ_FIELDS,
        populate: { questions: { sort: 'position:asc', populate: ['image'] } },
      } as never);
      const output = await strapi.contentAPI.sanitize.output(found, strapi.getModel(UID));
      return transformResponse(output);
    },
```

`strapi.contentAPI.sanitize.output` is called **without** `auth` on purpose: the controller's `sanitizeOutput(data, ctx)` passes `auth`, and Strapi's `removeRestrictedRelations` visitor then removes `questions` because no role holds `api::question.question.find` (spec §4.3). Do not "fix" this by granting `api::question.question.find`.

- [ ] **Step 5: Grant the action**

In `backend/src/bootstrap/permissions.ts`, add `'api::questionnaire.questionnaire.findOneMine'` to both the `auteur` list (after `'api::questionnaire.questionnaire.close'`) and the `administrateur` list (after `'api::questionnaire.questionnaire.close'`).

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd /project/devops2/backend && npx jest tests/contract/mes_questionnaires_get.test.ts tests/integration/role_permissions.test.ts`
Expected: PASS (the role-permissions suite checks the table matches the database and names only actions the app exposes).

- [ ] **Step 7: Run the regression gate**

Run the full gate from Global Constraints. Expected: all suites green, only the known lint/Prettier noise.

- [ ] **Step 8: Commit**

```bash
cd /project/devops2
git add backend/tests/contract/mes_questionnaires_get.test.ts backend/src/api/questionnaire/controllers/questionnaire.ts backend/src/api/questionnaire/routes/questionnaire.ts backend/src/bootstrap/permissions.ts
git commit -F - <<'EOF'
T077: GET /api/mes-questionnaires/:id for the owner or an administrateur

Any statut, questions ordered by position. Sanitised without auth so the
content-API relation check does not strip questions (no role holds
question.find, and none should).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018oex3Jpgz8jfd3XAQ58F4t
EOF
```

---

### Task 2: `GET /api/mes-questionnaires` (list) and documentation

**Files:**
- Create: `backend/tests/contract/mes_questionnaires_list.test.ts`
- Modify: `backend/src/api/questionnaire/controllers/questionnaire.ts` (add `findMine`)
- Modify: `backend/src/api/questionnaire/routes/questionnaire.ts` (add the route)
- Modify: `backend/src/bootstrap/permissions.ts` (grant `findMine` to `auteur` and `administrateur`)
- Modify: `specs/001-questionnaire-platform/contracts/api.md` (new section)
- Modify: `specs/001-questionnaire-platform/tasks.md` (T077 `[X]`)
- Modify: `CLAUDE.md` ("Current state")

**Interfaces:**
- Consumes: `READ_FIELDS` from Task 1 (same controller file); `findOneMine` and its route from Task 1; the same test helpers as Task 1.
- Produces: nothing consumed later in this plan.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/contract/mes_questionnaires_list.test.ts`:

```ts
import request from 'supertest';
import type { Core } from '@strapi/strapi';
import { setupStrapi, teardownStrapi } from '../helpers/strapi';
import { createUserWithRole } from '../helpers/users';
import { addQuestion, createQuestionnaire } from '../helpers/questionnaires';

let strapi: Core.Strapi;

beforeAll(async () => {
  strapi = await setupStrapi();
});

afterAll(async () => {
  await teardownStrapi();
});

function list(jwt: string | null, query = '') {
  const pending = request(strapi.server.httpServer).get(`/api/mes-questionnaires${query}`);
  return jwt ? pending.set('Authorization', `Bearer ${jwt}`) : pending;
}

function pause() {
  return new Promise((resolve) => setTimeout(resolve, 20));
}

function documentIds(res: { body: { data: { documentId: string }[] } }) {
  return res.body.data.map((item) => item.documentId);
}

describe('GET /api/mes-questionnaires (T077, US1, FR-016)', () => {
  it('answers 403 without a JWT and to a repondant', async () => {
    const { jwt: repondant } = await createUserWithRole(strapi, 'repondant');

    expect((await list(null)).status).toBe(403);
    expect((await list(repondant)).status).toBe(403);
  });

  it('returns an empty list to an auteur without questionnaire', async () => {
    const { jwt } = await createUserWithRole(strapi, 'auteur');

    const res = await list(jwt);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [], meta: {} });
  });

  it('returns an empty list to an administrateur', async () => {
    const { user: owner } = await createUserWithRole(strapi, 'auteur');
    const { jwt } = await createUserWithRole(strapi, 'administrateur');
    await createQuestionnaire(strapi, owner);

    const res = await list(jwt);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('shows each auteur only its own questionnaires', async () => {
    const alice = await createUserWithRole(strapi, 'auteur');
    const bob = await createUserWithRole(strapi, 'auteur');
    const aliceOne = await createQuestionnaire(strapi, alice.user);
    const aliceTwo = await createQuestionnaire(strapi, alice.user);
    const bobOne = await createQuestionnaire(strapi, bob.user);

    const aliceRes = await list(alice.jwt);
    const bobRes = await list(bob.jwt);

    expect(aliceRes.status).toBe(200);
    expect(documentIds(aliceRes).sort()).toEqual(
      [aliceOne.documentId, aliceTwo.documentId].sort(),
    );
    expect(documentIds(bobRes)).toEqual([bobOne.documentId]);
  });

  it('lists every statut', async () => {
    const { user, jwt } = await createUserWithRole(strapi, 'auteur');
    for (const statut of ['brouillon', 'publie', 'ferme']) {
      await createQuestionnaire(strapi, user, { statut });
    }

    const res = await list(jwt);

    expect(res.body.data.map((item: { statut: string }) => item.statut).sort()).toEqual([
      'brouillon',
      'ferme',
      'publie',
    ]);
  });

  it('puts the most recently updated questionnaire first', async () => {
    const { user, jwt } = await createUserWithRole(strapi, 'auteur');
    const older = await createQuestionnaire(strapi, user, { titre: 'Ancien' });
    await pause();
    const newer = await createQuestionnaire(strapi, user, { titre: 'Récent' });
    await pause();

    expect(documentIds(await list(jwt))).toEqual([newer.documentId, older.documentId]);

    await strapi.documents('api::questionnaire.questionnaire').update({
      documentId: older.documentId,
      data: { titre: 'Ancien modifié' } as never,
    });

    expect(documentIds(await list(jwt))).toEqual([older.documentId, newer.documentId]);
  });

  it('returns the summary fields, never the author nor the questions', async () => {
    const { user, jwt } = await createUserWithRole(strapi, 'auteur');
    const questionnaire = await createQuestionnaire(strapi, user, {
      description: 'Séance 4',
      visibilite: 'privee',
    });
    await addQuestion(strapi, questionnaire);

    const res = await list(jwt);

    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({});
    expect(res.body.data).toHaveLength(1);
    const [item] = res.body.data;
    expect(item).toMatchObject({
      documentId: questionnaire.documentId,
      titre: 'Retour de séance',
      description: 'Séance 4',
      statut: 'brouillon',
      visibilite: 'privee',
    });
    expect(item.createdAt).toEqual(expect.any(String));
    expect(item.updatedAt).toEqual(expect.any(String));
    expect(item).not.toHaveProperty('auteur');
    expect(item).not.toHaveProperty('questions');
  });

  it('ignores client query parameters', async () => {
    const alice = await createUserWithRole(strapi, 'auteur');
    const bob = await createUserWithRole(strapi, 'auteur');
    const aliceOne = await createQuestionnaire(strapi, alice.user);
    await addQuestion(strapi, aliceOne);
    await createQuestionnaire(strapi, bob.user);

    for (const query of [
      `?filters[auteur][id]=${bob.user.id}`,
      '?populate=*',
      '?populate=auteur',
      '?sort=titre:asc',
      '?pagination[pageSize]=0',
    ]) {
      const res = await list(alice.jwt, query);

      expect(res.status).toBe(200);
      expect(documentIds(res)).toEqual([aliceOne.documentId]);
      expect(res.body.data[0]).not.toHaveProperty('auteur');
      expect(res.body.data[0]).not.toHaveProperty('questions');
      expect(res.body.meta).toEqual({});
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /project/devops2/backend && npx jest tests/contract/mes_questionnaires_list.test.ts`
Expected: FAIL — every 200 test gets 404 (no route matches `GET /api/mes-questionnaires`). The 403 test may already pass.

- [ ] **Step 3: Add the route**

In `backend/src/api/questionnaire/routes/questionnaire.ts`, insert **before** the `/mes-questionnaires/:id` route added in Task 1:

```ts
    {
      method: 'GET',
      path: '/mes-questionnaires',
      handler: 'api::questionnaire.questionnaire.findMine',
      config: { policies: [] },
    },
```

- [ ] **Step 4: Add `findMine` to the controller**

In `backend/src/api/questionnaire/controllers/questionnaire.ts`, inside the returned object, before `findOneMine`, add:

```ts
    async findMine(ctx) {
      const found = await strapi.documents(UID).findMany({
        filters: { auteur: { id: ctx.state.user.id } },
        sort: 'updatedAt:desc',
        fields: READ_FIELDS,
      } as never);
      const output = await sanitizeOutput(found, ctx);
      return transformResponse(output);
    },
```

`sanitizeOutput(found, ctx)` is fine here: the list populates no relation, so the `auth` relation check has nothing to remove.

- [ ] **Step 5: Grant the action**

In `backend/src/bootstrap/permissions.ts`, add `'api::questionnaire.questionnaire.findMine'` to both the `auteur` and the `administrateur` lists, just before `'api::questionnaire.questionnaire.findOneMine'`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd /project/devops2/backend && npx jest tests/contract/mes_questionnaires_list.test.ts tests/contract/mes_questionnaires_get.test.ts tests/integration/role_permissions.test.ts`
Expected: PASS.

- [ ] **Step 7: Amend `contracts/api.md`**

In `specs/001-questionnaire-platform/contracts/api.md`, insert this section after the `### POST /api/questionnaires/:id/close` section and before `### GET /api/questionnaires/:id`:

```markdown
### GET /api/mes-questionnaires

> **Amendement 2026-09-24 (T077)** — lectures réservées à l'auteur, distinctes de la lecture
> publique `GET /api/questionnaires/:id` (T034, `publie` uniquement, sans authentification ou
> avec jeton d'invitation). Mêmes enveloppe, codes d'état et règles d'erreur que l'amendement US1.

- Auth : auteur ou administrateur.
- Réponse `200`: `{ "data": [ { "id", "documentId", "titre", "description", "statut", "visibilite", "createdAt", "updatedAt" }, … ], "meta": {} }`
  — uniquement les questionnaires dont l'appelant est l'auteur (liste vide pour un administrateur,
  qui ne crée pas de questionnaire), tous statuts, triés par `updatedAt` décroissant, sans
  pagination, sans `questions` ni `auteur`.
- Les paramètres de requête (`filters`, `populate`, `sort`, `fields`, `pagination`) sont ignorés.

### GET /api/mes-questionnaires/:id

- Auth : auteur (propriétaire) ou administrateur. (FR-016)
- Réponse `200`: `{ "data": { "id", "documentId", "titre", "description", "statut", "visibilite", "createdAt", "updatedAt", "questions": [ { "id", "documentId", "texte", "type", "position", "obligatoire", "options", "image", … }, … ] }, "meta": {} }`
  — quel que soit le `statut`, questions triées par `position` croissante, sans `auteur`.
- `404` si inconnu, `403` si l'appelant n'est ni le propriétaire ni administrateur.
- Les paramètres de requête sont ignorés.
```

- [ ] **Step 8: Record T077 in `tasks.md`**

In `specs/001-questionnaire-platform/tasks.md`, change the T077 line's `- [ ] T077` to `- [X] T077` and append to the end of that same line:

```
 *(Done 2026-09-24: `GET /api/mes-questionnaires` and `GET /api/mes-questionnaires/:id`, actions `findMine`/`findOneMine` granted to `auteur` and `administrateur`; the detail is sanitised without `auth` because Strapi's content-API relation check would strip `questions` — no role holds `question.find`, see `docs/superpowers/specs/2026-09-24-T077-author-scoped-reads-design.md`.)*
```

- [ ] **Step 9: Update `CLAUDE.md` "Current state"**

In `CLAUDE.md`:
- In the "Current state" opening line, replace `**T001–T010**, **T011–T021**, **T060**, **T061** and **T062**` with `**T001–T010**, **T011–T021**, **T060**, **T061**, **T062** and **T077**`, and replace `of 76 tasks` with the count of task lines in `tasks.md` (`grep -cE '^- \[[ X]\] T[0-9]{3}' specs/001-questionnaire-platform/tasks.md`).
- In the `ROLE_PERMISSIONS` sentence, replace `questionnaire
  `create`/`publish`/`close`, question `add`; `administrateur`: `users/me`, `role.find`,
  questionnaire `close`` so that it reads: `auteur`: `users/me`, `role.find`, questionnaire `create`/`publish`/`close`/`findMine`/`findOneMine`, question `add`; `administrateur`: `users/me`, `role.find`, questionnaire `close`/`findMine`/`findOneMine`.
- In the sentence listing the routes (`routes `POST /api/questionnaires`, …`), add `GET /api/mes-questionnaires` and `GET /api/mes-questionnaires/:id` (author-scoped reads, any statut, T077)` after `POST /api/questionnaires/:id/close`.

- [ ] **Step 10: Run the regression gate**

Run the full gate from Global Constraints. Expected: all suites green, only the known lint/Prettier noise.

- [ ] **Step 11: Commit**

```bash
cd /project/devops2
git add backend/tests/contract/mes_questionnaires_list.test.ts backend/src/api/questionnaire/controllers/questionnaire.ts backend/src/api/questionnaire/routes/questionnaire.ts backend/src/bootstrap/permissions.ts specs/001-questionnaire-platform/contracts/api.md specs/001-questionnaire-platform/tasks.md CLAUDE.md
git commit -F - <<'EOF'
T077: GET /api/mes-questionnaires lists the caller's questionnaires

Only the caller's own, every statut, most recently updated first, no
pagination; client query parameters are ignored. Contract, tasks.md and
CLAUDE.md record the two author-scoped reads.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018oex3Jpgz8jfd3XAQ58F4t
EOF
```
