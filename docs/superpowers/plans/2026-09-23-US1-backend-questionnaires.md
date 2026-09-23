# User Story 1 Backend (T011–T021) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an authenticated `auteur` create a questionnaire, add questions of the three types, publish it (only with at least one question) and close it, and let an `administrateur` close any questionnaire, through the four routes of `contracts/api.md`.

**Architecture:** Two Strapi content-types (`api::questionnaire.questionnaire`, `api::question.question`, `draftAndPublish: false`) with custom routes only (no core router). Controllers extend `createCoreController` to keep Strapi's `sanitizeInput`/`sanitizeOutput` and the `data` envelope; a pure rules module validates question options and positions; an access service enforces ownership (404/403). 409 and 422 are thrown as `http-errors` errors, which Strapi's error middleware formats into its standard error body.

**Tech Stack:** Strapi 5.54.0 (TypeScript), `@strapi/plugin-users-permissions` 5.54.0, `@strapi/utils` 5.54.0 (`errors`), `http-errors` 2.0.0, Jest 29 + ts-jest + Supertest (harness `backend/tests/helpers/strapi.ts`), Docker Compose.

**Spec:** `docs/superpowers/specs/2026-09-23-US1-backend-questionnaires-design.md`

## Global Constraints

- **No comments in code**: no `//`, `/* */`, JSDoc or `#` in any source, test, configuration or script file you write (CLAUDE.md "Code conventions"). Existing comments may stay.
- Test-first: every test is run and seen failing for the expected reason before the implementation is written (constitution Principe I).
- Node is not on PATH: `export PATH=/tmp/claude-1000/-project-devops2/f0c0f41e-6d12-45e7-a390-b175e6f2473f/scratchpad/node-v22.12.0-linux-x64/bin:$PATH`
- Enum codes (exact): `statut` ∈ `brouillon`, `publie`, `ferme` (default `brouillon`); `visibilite` ∈ `publique`, `privee`; question `type` ∈ `likert`, `choix_multiple`, `texte_libre`.
- Actions (exact) and their grants in `ROLE_PERMISSIONS` (`backend/src/bootstrap/permissions.ts`): `api::questionnaire.questionnaire.create` → `auteur`; `api::question.question.add` → `auteur`; `api::questionnaire.questionnaire.publish` → `auteur`; `api::questionnaire.questionnaire.close` → `auteur`, `administrateur`. `repondant` gets none.
- Body format: requests `{ "data": { … } }`; success responses `{ "data": { documentId, … }, "meta": {} }`; errors `{ "data": null, "error": { status, name, message, details } }`. `:id` is the questionnaire `documentId`.
- Status codes: create → 201; add/publish/close → 200; content-type validation, `optionsError`, taken position → 400 (`ValidationError`); unauthenticated and role without the action → 403 (`ForbiddenError`, Strapi's public role has permissions so the content-API auth answers 403, not 401); non-owner → 403; unknown `documentId` → 404; wrong status for the transition → 409 (`ConflictError`); publish without question → 422 (`UnprocessableEntityError`).
- Messages (exact): `options must list at least 2 distinct non-empty labels for a choix_multiple question`; `options are only allowed for a choix_multiple question`; `position <n> is already used in this questionnaire`; `questionnaire not found`; `only the author of this questionnaire can do this`; `questions can only be added to a brouillon questionnaire`; `only a brouillon questionnaire can be published`; `a questionnaire needs at least one question to be published`; `only a publie questionnaire can be closed`.
- No core router: no `find`, `findOne`, `update`, `delete` route is exposed for either API.
- Stage files by path only (never `git add -A` / `git add .`); never stage `.env*` or `.superpowers/`. Commit messages end with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_018oex3Jpgz8jfd3XAQ58F4t
  ```
- Regression gate (every task): `cd /project/devops2 && for t in tests/structure/*.sh; do echo "== $t"; bash "$t" | grep -E '^Total'; done`; in `backend/`: `npm test && npm run build && npm run lint && npm run format:check`. Known pre-existing noise only: lint warning in `config/plugins.ts`, Prettier warning on `.strapi-updater.json`.
- If an installed Strapi type or API differs from the code below (e.g. generated types for `strapi.documents` results), adjust only typing or the call shape, never an assertion, and record it in the report.

## Review Focus

- An author sends `statut: "publie"` or someone else's `auteur` in the create body → ignored; the questionnaire is `brouillon` and belongs to the caller (Task 2 test "forces statut and auteur").
- A `choix_multiple` question with duplicate or blank labels (`["Oui", " oui ", ""]`) → 400, not a question with unusable options (Task 1 unit tests "blank" and "duplicate after trim").
- A second author tries to add a question to, publish or close someone else's questionnaire → 403, not 200 (Tasks 3, 4, 5 "another auteur" tests).
- Publishing twice, or closing a `brouillon` → 409, never a silent no-op or a backwards transition (Tasks 4 and 5).
- The create/add/publish/close responses never contain the author's `email` or `password` (Task 2 test "never exposes the author").

---

### Task 1: Content-types, question rules and document amendments (T016, T017)

**Files:**
- Modify: `backend/package.json`, `backend/package-lock.json` (direct dependencies `@strapi/utils` `5.54.0`, `http-errors` `2.0.0`; devDependency `@types/http-errors` `2.0.4`)
- Create: `backend/src/api/questionnaire/content-types/questionnaire/schema.json`
- Create: `backend/src/api/questionnaire/services/questionnaire.ts`
- Create: `backend/src/api/questionnaire/controllers/questionnaire.ts` (core controller only in this task)
- Create: `backend/src/api/question/content-types/question/schema.json`
- Create: `backend/src/api/question/services/question.ts`
- Create: `backend/src/api/question/controllers/question.ts` (core controller only in this task)
- Create: `backend/src/api/question/services/question-rules.ts`
- Create: `backend/tests/unit/question_rules.test.ts`
- Create: `backend/tests/integration/questionnaire_schema.test.ts`
- Modify: `backend/types/generated/contentTypes.d.ts` (regenerated with `npx strapi ts:generate-types`, committed as the repo already tracks it)
- Delete: `backend/src/api/questionnaire/.gitkeep`, `backend/src/api/question/.gitkeep`
- Modify: `specs/001-questionnaire-platform/data-model.md`, `specs/001-questionnaire-platform/contracts/api.md` (dated amendments)

**Interfaces:**
- Consumes: Jest harness `setupStrapi()` / `teardownStrapi()` from `backend/tests/helpers/strapi.ts`.
- Produces: UIDs `api::questionnaire.questionnaire` and `api::question.question`; `QuestionType`, `optionsError(type: string, options: unknown): string | null`, `positionTaken(position: number, existingPositions: readonly number[]): boolean` from `backend/src/api/question/services/question-rules.ts`.

- [ ] **Step 1: Add the dependencies**

```bash
export PATH=/tmp/claude-1000/-project-devops2/f0c0f41e-6d12-45e7-a390-b175e6f2473f/scratchpad/node-v22.12.0-linux-x64/bin:$PATH
cd /project/devops2/backend
npm install --save-exact @strapi/utils@5.54.0 http-errors@2.0.0
npm install --save-dev --save-exact @types/http-errors@2.0.4
```

Both runtime packages are already installed transitively at these exact versions; declaring them makes the imports explicit.

- [ ] **Step 2: Write the failing unit test**

`backend/tests/unit/question_rules.test.ts`:

```ts
import { optionsError, positionTaken } from '../../src/api/question/services/question-rules';

const CHOICES_MESSAGE =
  'options must list at least 2 distinct non-empty labels for a choix_multiple question';
const FORBIDDEN_MESSAGE = 'options are only allowed for a choix_multiple question';

describe('optionsError (US1, D4)', () => {
  it('accepts two or more distinct labels for choix_multiple', () => {
    expect(optionsError('choix_multiple', ['Oui', 'Non'])).toBeNull();
    expect(optionsError('choix_multiple', ['Oui', 'Non', 'Sans avis'])).toBeNull();
  });

  it('rejects missing, non-array or too short options for choix_multiple', () => {
    expect(optionsError('choix_multiple', undefined)).toBe(CHOICES_MESSAGE);
    expect(optionsError('choix_multiple', null)).toBe(CHOICES_MESSAGE);
    expect(optionsError('choix_multiple', 'Oui,Non')).toBe(CHOICES_MESSAGE);
    expect(optionsError('choix_multiple', ['Oui'])).toBe(CHOICES_MESSAGE);
  });

  it('rejects blank labels and non-string labels', () => {
    expect(optionsError('choix_multiple', ['Oui', '   '])).toBe(CHOICES_MESSAGE);
    expect(optionsError('choix_multiple', ['Oui', 2])).toBe(CHOICES_MESSAGE);
  });

  it('rejects labels that are duplicates after trimming', () => {
    expect(optionsError('choix_multiple', ['Oui', ' Oui '])).toBe(CHOICES_MESSAGE);
  });

  it('forbids options on likert and texte_libre, and accepts their absence', () => {
    expect(optionsError('likert', ['1', '2'])).toBe(FORBIDDEN_MESSAGE);
    expect(optionsError('texte_libre', [])).toBe(FORBIDDEN_MESSAGE);
    expect(optionsError('likert', undefined)).toBeNull();
    expect(optionsError('texte_libre', null)).toBeNull();
  });
});

describe('positionTaken (US1)', () => {
  it('is true only when the position is already used', () => {
    expect(positionTaken(2, [1, 2, 3])).toBe(true);
    expect(positionTaken(4, [1, 2, 3])).toBe(false);
    expect(positionTaken(1, [])).toBe(false);
  });
});
```

- [ ] **Step 3: Write the failing schema test**

`backend/tests/integration/questionnaire_schema.test.ts`:

```ts
import type { Core } from '@strapi/strapi';
import { setupStrapi, teardownStrapi } from '../helpers/strapi';

let strapi: Core.Strapi;

beforeAll(async () => {
  strapi = await setupStrapi();
});

afterAll(async () => {
  await teardownStrapi();
});

function attributes(uid: string): Record<string, Record<string, unknown>> {
  const contentType = strapi.contentType(uid as never) as unknown as {
    attributes: Record<string, Record<string, unknown>>;
    options?: { draftAndPublish?: boolean };
  };
  return contentType.attributes;
}

function draftAndPublish(uid: string): boolean | undefined {
  const contentType = strapi.contentType(uid as never) as unknown as {
    options?: { draftAndPublish?: boolean };
  };
  return contentType.options?.draftAndPublish;
}

describe('Questionnaire and Question content-types (T016, T017)', () => {
  it('defines the Questionnaire attributes of the data model', () => {
    const attrs = attributes('api::questionnaire.questionnaire');
    expect(attrs.titre).toMatchObject({ type: 'string', required: true });
    expect(attrs.description).toMatchObject({ type: 'text' });
    expect(attrs.statut).toMatchObject({
      type: 'enumeration',
      enum: ['brouillon', 'publie', 'ferme'],
      default: 'brouillon',
      required: true,
    });
    expect(attrs.visibilite).toMatchObject({
      type: 'enumeration',
      enum: ['publique', 'privee'],
      required: true,
    });
    expect(attrs.auteur).toMatchObject({
      type: 'relation',
      relation: 'manyToOne',
      target: 'plugin::users-permissions.user',
    });
    expect(attrs.questions).toMatchObject({
      type: 'relation',
      relation: 'oneToMany',
      target: 'api::question.question',
      mappedBy: 'questionnaire',
    });
    expect(draftAndPublish('api::questionnaire.questionnaire')).toBe(false);
  });

  it('defines the Question attributes of the data model', () => {
    const attrs = attributes('api::question.question');
    expect(attrs.texte).toMatchObject({ type: 'string', required: true });
    expect(attrs.type).toMatchObject({
      type: 'enumeration',
      enum: ['likert', 'choix_multiple', 'texte_libre'],
      required: true,
    });
    expect(attrs.position).toMatchObject({ type: 'integer', required: true, min: 1 });
    expect(attrs.obligatoire).toMatchObject({ type: 'boolean', default: false, required: true });
    expect(attrs.options).toMatchObject({ type: 'json' });
    expect(attrs.image).toMatchObject({ type: 'media', multiple: false, allowedTypes: ['images'] });
    expect(attrs.questionnaire).toMatchObject({
      type: 'relation',
      relation: 'manyToOne',
      target: 'api::questionnaire.questionnaire',
      inversedBy: 'questions',
    });
    expect(draftAndPublish('api::question.question')).toBe(false);
  });

  it('exposes no core route for either API', () => {
    const paths = strapi.server.listRoutes().map((route) => route.path);
    expect(paths).not.toContain('/api/questionnaires/:id');
    expect(paths).not.toContain('/api/questions');
    expect(paths).not.toContain('/api/questions/:id');
  });
});
```

- [ ] **Step 4: Run both to verify they fail**

```bash
cd /project/devops2/backend && npx jest tests/unit/question_rules.test.ts tests/integration/questionnaire_schema.test.ts
```

Expected: `question_rules` FAIL — cannot find module `question-rules`; `questionnaire_schema` FAIL — the content-types are undefined (`Cannot read properties of undefined`).

- [ ] **Step 5: Implement the rules module**

`backend/src/api/question/services/question-rules.ts`:

```ts
export type QuestionType = 'likert' | 'choix_multiple' | 'texte_libre';

const CHOICES_MESSAGE =
  'options must list at least 2 distinct non-empty labels for a choix_multiple question';
const FORBIDDEN_MESSAGE = 'options are only allowed for a choix_multiple question';

function areDistinctLabels(options: unknown): boolean {
  if (!Array.isArray(options) || options.length < 2) return false;
  if (!options.every((option) => typeof option === 'string' && option.trim() !== '')) {
    return false;
  }
  const trimmed = options.map((option: string) => option.trim());
  return new Set(trimmed).size === trimmed.length;
}

export function optionsError(type: string, options: unknown): string | null {
  if (type === 'choix_multiple') {
    return areDistinctLabels(options) ? null : CHOICES_MESSAGE;
  }
  return options === undefined || options === null ? null : FORBIDDEN_MESSAGE;
}

export function positionTaken(position: number, existingPositions: readonly number[]): boolean {
  return existingPositions.includes(position);
}
```

- [ ] **Step 6: Create the content-types, services and core controllers**

`backend/src/api/questionnaire/content-types/questionnaire/schema.json`:

```json
{
  "kind": "collectionType",
  "collectionName": "questionnaires",
  "info": {
    "singularName": "questionnaire",
    "pluralName": "questionnaires",
    "displayName": "Questionnaire"
  },
  "options": {
    "draftAndPublish": false
  },
  "attributes": {
    "titre": { "type": "string", "required": true },
    "description": { "type": "text" },
    "statut": {
      "type": "enumeration",
      "enum": ["brouillon", "publie", "ferme"],
      "default": "brouillon",
      "required": true
    },
    "visibilite": { "type": "enumeration", "enum": ["publique", "privee"], "required": true },
    "auteur": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "plugin::users-permissions.user"
    },
    "questions": {
      "type": "relation",
      "relation": "oneToMany",
      "target": "api::question.question",
      "mappedBy": "questionnaire"
    }
  }
}
```

`backend/src/api/question/content-types/question/schema.json`:

```json
{
  "kind": "collectionType",
  "collectionName": "questions",
  "info": {
    "singularName": "question",
    "pluralName": "questions",
    "displayName": "Question"
  },
  "options": {
    "draftAndPublish": false
  },
  "attributes": {
    "texte": { "type": "string", "required": true },
    "type": {
      "type": "enumeration",
      "enum": ["likert", "choix_multiple", "texte_libre"],
      "required": true
    },
    "position": { "type": "integer", "required": true, "min": 1 },
    "obligatoire": { "type": "boolean", "default": false, "required": true },
    "options": { "type": "json" },
    "image": { "type": "media", "multiple": false, "allowedTypes": ["images"] },
    "questionnaire": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::questionnaire.questionnaire",
      "inversedBy": "questions"
    }
  }
}
```

`backend/src/api/questionnaire/services/questionnaire.ts`:

```ts
import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::questionnaire.questionnaire');
```

`backend/src/api/question/services/question.ts`:

```ts
import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::question.question');
```

`backend/src/api/questionnaire/controllers/questionnaire.ts`:

```ts
import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::questionnaire.questionnaire');
```

`backend/src/api/question/controllers/question.ts`:

```ts
import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::question.question');
```

Delete the two `.gitkeep` files. Create no `routes/` file in this task.

- [ ] **Step 7: Run both to verify they pass, regenerate types**

Same command as Step 4. Expected: `question_rules` 6 passed; `questionnaire_schema` 3 passed. Then `npx strapi ts:generate-types` and check `backend/types/generated/contentTypes.d.ts` now declares `ApiQuestionnaireQuestionnaire` and `ApiQuestionQuestion`.

- [ ] **Step 8: Amend `data-model.md` and `contracts/api.md`**

In `specs/001-questionnaire-platform/data-model.md`, change the Questionnaire rows `statut` to `enum: brouillon, publie, ferme` and `visibilite` to `enum: publique, privee`, add to the Question table the row

```markdown
| options | JSON (liste de libellés) | requis pour `choix_multiple` : au moins 2 libellés distincts et non vides (après suppression des espaces) ; interdit pour `likert` et `texte_libre` |
```

change `position`'s rule to `requis, entier ≥ 1, unique au sein d'un même questionnaire (vérifié à l'ajout), détermine l'ordre`, and add under the Questionnaire section:

```markdown
**Amendement 2026-09-23 (US1 backend, T011–T021)** : les valeurs d'énumération sont des codes
ASCII (`brouillon`/`publie`/`ferme`, `publique`/`privee`), cohérents avec les rôles (`repondant`) ;
les libellés accentués relèvent de l'interface. Le brouillon/publication natif de Strapi est
désactivé (`draftAndPublish: false`) : seul `statut` porte le cycle de vie. Une question
`choix_multiple` porte ses choix dans `options` ; une réponse (US2) contiendra les libellés choisis.
```

In `specs/001-questionnaire-platform/contracts/api.md`, insert right after the `## Questionnaires` heading:

```markdown
> **Amendement 2026-09-23 (US1 backend, T011–T021)** — s'applique à toute l'API :
> - Corps au format natif Strapi 5 : requête `{ "data": { … } }`, réponse `{ "data": { "documentId": …, … }, "meta": {} }`,
>   erreur `{ "data": null, "error": { "status", "name", "message", "details" } }`.
> - `:id` est le `documentId` Strapi (chaîne).
> - Valeurs d'énumération en codes ASCII : `statut` ∈ `brouillon`/`publie`/`ferme`, `visibilite` ∈ `publique`/`privee`.
> - Sans authentification, ou avec un rôle qui n'a pas l'action : `403`. Auteur non propriétaire : `403`.
>   Questionnaire inconnu : `404`. Transition impossible depuis le statut courant : `409`.
```

and update the four endpoint blocks: `POST /api/questionnaires` body `{ "data": { "titre", "description"?, "visibilite": "publique"|"privee" } }`, response `201` (`statut` toujours `brouillon`, `auteur` = appelant), `400` si `titre` manque ou `visibilite` invalide; `PATCH /api/questionnaires/:id/questions` body `{ "data": { "texte", "type", "position", "obligatoire"?, "options"?: string[], "image"?: mediaId } }`, `options` requis (≥ 2 libellés distincts) pour `choix_multiple` et interdit sinon, `400` si position déjà prise, `409` si le questionnaire n'est pas `brouillon`; `POST …/publish` `409` si pas `brouillon`, `422` sans question; `POST …/close` `409` si pas `publie`. Replace every accented enum value in those four blocks by its ASCII code.

- [ ] **Step 9: Regression gate**

Run the regression gate from Global Constraints. `tests/integration/role_permissions.test.ts` must still pass (no new permission yet).

- [ ] **Step 10: Commit**

```bash
cd /project/devops2
git add backend/package.json backend/package-lock.json backend/src/api/questionnaire backend/src/api/question backend/tests/unit/question_rules.test.ts backend/tests/integration/questionnaire_schema.test.ts backend/types/generated specs/001-questionnaire-platform/data-model.md specs/001-questionnaire-platform/contracts/api.md
git commit -m "US1 (T016, T017): Questionnaire and Question content-types, question rules, ASCII enums"
```

(with the two trailer lines from Global Constraints; `git add` of the two API directories also stages the `.gitkeep` deletions)

---

### Task 2: `POST /api/questionnaires` (T011, T018)

**Files:**
- Create: `backend/tests/helpers/users.ts`, `backend/tests/helpers/questionnaires.ts`
- Create: `backend/tests/contract/questionnaires_create.test.ts`
- Create: `backend/src/api/questionnaire/routes/questionnaire.ts`
- Modify: `backend/src/api/questionnaire/controllers/questionnaire.ts`
- Modify: `backend/src/bootstrap/permissions.ts` (`ROLE_PERMISSIONS`)

**Interfaces:**
- Consumes: content-types from Task 1; `ROLE_PERMISSIONS` from T062.
- Produces:
  - `createUserWithRole(strapi: Core.Strapi, type: 'auteur' | 'repondant' | 'administrateur'): Promise<{ user: { id: number; documentId: string }; jwt: string; email: string; password: string }>` in `backend/tests/helpers/users.ts`
  - `createQuestionnaire(strapi: Core.Strapi, owner: { id: number }, overrides?: Record<string, unknown>): Promise<{ id: number; documentId: string; statut: string }>` and `addQuestion(strapi: Core.Strapi, questionnaire: { documentId: string }, overrides?: Record<string, unknown>): Promise<{ id: number; documentId: string; position: number }>` in `backend/tests/helpers/questionnaires.ts`
  - route file `backend/src/api/questionnaire/routes/questionnaire.ts` exporting `{ routes: [...] }`; Tasks 4 and 5 append to it
  - controller actions added on top of the core controller: `create` (this task), `publish` (Task 4), `close` (Task 5)

- [ ] **Step 1: Write the test helpers**

`backend/tests/helpers/users.ts`:

```ts
import type { Core } from '@strapi/strapi';

let sequence = 0;

export async function createUserWithRole(
  strapi: Core.Strapi,
  type: 'auteur' | 'repondant' | 'administrateur',
): Promise<{ user: { id: number; documentId: string }; jwt: string; email: string; password: string }> {
  sequence += 1;
  const email = `${type}-${sequence}@example.test`;
  const password = 'Passw0rd!';
  const role = await strapi.db
    .query('plugin::users-permissions.role')
    .findOne({ where: { type } });
  const user = await strapi
    .plugin('users-permissions')
    .service('user')
    .add({
      username: `${type}-${sequence}`,
      email,
      password,
      provider: 'local',
      confirmed: true,
      blocked: false,
      nom: `${type} ${sequence}`,
      role: role.id,
    });
  const jwt = await strapi.plugin('users-permissions').service('jwt').issue({ id: user.id });
  return { user, jwt, email, password };
}
```

`backend/tests/helpers/questionnaires.ts`:

```ts
import type { Core } from '@strapi/strapi';

let position = 0;

export async function createQuestionnaire(
  strapi: Core.Strapi,
  owner: { id: number },
  overrides: Record<string, unknown> = {},
): Promise<{ id: number; documentId: string; statut: string }> {
  return strapi.documents('api::questionnaire.questionnaire').create({
    data: {
      titre: 'Retour de séance',
      visibilite: 'publique',
      statut: 'brouillon',
      auteur: owner.id,
      ...overrides,
    } as never,
  }) as unknown as Promise<{ id: number; documentId: string; statut: string }>;
}

export async function addQuestion(
  strapi: Core.Strapi,
  questionnaire: { documentId: string },
  overrides: Record<string, unknown> = {},
): Promise<{ id: number; documentId: string; position: number }> {
  position += 1;
  return strapi.documents('api::question.question').create({
    data: {
      texte: 'La séance était-elle claire ?',
      type: 'likert',
      position,
      obligatoire: true,
      questionnaire: questionnaire.documentId,
      ...overrides,
    } as never,
  }) as unknown as Promise<{ id: number; documentId: string; position: number }>;
}
```

- [ ] **Step 2: Write the failing contract test**

`backend/tests/contract/questionnaires_create.test.ts`:

```ts
import request from 'supertest';
import type { Core } from '@strapi/strapi';
import { setupStrapi, teardownStrapi } from '../helpers/strapi';
import { createUserWithRole } from '../helpers/users';

let strapi: Core.Strapi;

beforeAll(async () => {
  strapi = await setupStrapi();
});

afterAll(async () => {
  await teardownStrapi();
});

function post(jwt: string | null, data: Record<string, unknown>) {
  const call = request(strapi.server.httpServer).post('/api/questionnaires').send({ data });
  return jwt ? call.set('Authorization', `Bearer ${jwt}`) : call;
}

describe('POST /api/questionnaires (T011, FR-001, FR-004)', () => {
  it('creates a brouillon questionnaire owned by the calling auteur', async () => {
    const { user, jwt } = await createUserWithRole(strapi, 'auteur');

    const res = await post(jwt, {
      titre: 'Retour S1',
      description: 'Séance 1',
      visibilite: 'privee',
    });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      titre: 'Retour S1',
      description: 'Séance 1',
      visibilite: 'privee',
      statut: 'brouillon',
    });
    expect(typeof res.body.data.documentId).toBe('string');
    const stored = await strapi.documents('api::questionnaire.questionnaire').findOne({
      documentId: res.body.data.documentId,
      populate: ['auteur'],
    });
    expect((stored as unknown as { auteur: { id: number } }).auteur.id).toBe(user.id);
  });

  it('forces statut and auteur whatever the body says', async () => {
    const { user, jwt } = await createUserWithRole(strapi, 'auteur');
    const { user: other } = await createUserWithRole(strapi, 'auteur');

    const res = await post(jwt, {
      titre: 'Forcé',
      visibilite: 'publique',
      statut: 'publie',
      auteur: other.id,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.statut).toBe('brouillon');
    const stored = await strapi.documents('api::questionnaire.questionnaire').findOne({
      documentId: res.body.data.documentId,
      populate: ['auteur'],
    });
    expect((stored as unknown as { auteur: { id: number } }).auteur.id).toBe(user.id);
  });

  it('never exposes the author in the response', async () => {
    const { jwt } = await createUserWithRole(strapi, 'auteur');

    const res = await post(jwt, { titre: 'Discret', visibilite: 'publique' });

    expect(res.status).toBe(201);
    expect(JSON.stringify(res.body)).not.toContain('@example.test');
    expect(JSON.stringify(res.body)).not.toContain('password');
  });

  it('rejects a missing titre and an unknown visibilite with 400', async () => {
    const { jwt } = await createUserWithRole(strapi, 'auteur');

    const missing = await post(jwt, { visibilite: 'publique' });
    const accented = await post(jwt, { titre: 'Accent', visibilite: 'privée' });

    expect(missing.status).toBe(400);
    expect(missing.body.error.name).toBe('ValidationError');
    expect(accented.status).toBe(400);
    expect(accented.body.error.name).toBe('ValidationError');
  });

  it('refuses a repondant, an administrateur and an unauthenticated caller with 403', async () => {
    const { jwt: repondant } = await createUserWithRole(strapi, 'repondant');
    const { jwt: administrateur } = await createUserWithRole(strapi, 'administrateur');
    const body = { titre: 'Refusé', visibilite: 'publique' };

    expect((await post(repondant, body)).status).toBe(403);
    expect((await post(administrateur, body)).status).toBe(403);
    expect((await post(null, body)).status).toBe(403);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

```bash
cd /project/devops2/backend && npx jest tests/contract/questionnaires_create.test.ts
```

Expected: FAIL — `POST /api/questionnaires` answers `404` (no route yet) where `201`/`400`/`403` are expected.

- [ ] **Step 4: Implement the route, the action and the grant**

`backend/src/api/questionnaire/routes/questionnaire.ts`:

```ts
export default {
  routes: [
    {
      method: 'POST',
      path: '/questionnaires',
      handler: 'api::questionnaire.questionnaire.create',
      config: { policies: [] },
    },
  ],
};
```

`backend/src/api/questionnaire/controllers/questionnaire.ts`:

```ts
import { factories } from '@strapi/strapi';

const UID = 'api::questionnaire.questionnaire';

type Body = { data?: Record<string, unknown> };

export default factories.createCoreController(UID, ({ strapi }) => ({
  async create(ctx) {
    const input = (await this.sanitizeInput((ctx.request.body as Body)?.data ?? {}, ctx)) as Record<
      string,
      unknown
    >;
    const { statut: _statut, auteur: _auteur, ...fields } = input;
    const created = await strapi.documents(UID).create({
      data: { ...fields, statut: 'brouillon', auteur: ctx.state.user.id } as never,
    });
    const output = await this.sanitizeOutput(created, ctx);
    ctx.status = 201;
    return this.transformResponse(output);
  },
}));
```

In `backend/src/bootstrap/permissions.ts`, add `'api::questionnaire.questionnaire.create'` to the `auteur` list of `ROLE_PERMISSIONS`.

- [ ] **Step 5: Run it to verify it passes**

Same command as Step 3. Expected: `5 passed`. Then `npx jest tests/integration/role_permissions.test.ts` → still green (the new action exists and is granted).

- [ ] **Step 6: Regression gate**

Run the regression gate from Global Constraints.

- [ ] **Step 7: Commit**

```bash
cd /project/devops2
git add backend/tests/helpers/users.ts backend/tests/helpers/questionnaires.ts backend/tests/contract/questionnaires_create.test.ts backend/src/api/questionnaire/routes/questionnaire.ts backend/src/api/questionnaire/controllers/questionnaire.ts backend/src/bootstrap/permissions.ts
git commit -m "US1 (T011, T018): POST /api/questionnaires creates a brouillon owned by the auteur"
```

(with the two trailer lines from Global Constraints)

---

### Task 3: `PATCH /api/questionnaires/:id/questions` (T012, T019)

**Files:**
- Create: `backend/src/api/questionnaire/services/questionnaire-access.ts`
- Create: `backend/tests/contract/questions_add.test.ts`
- Create: `backend/src/api/question/routes/question.ts`
- Modify: `backend/src/api/question/controllers/question.ts`
- Modify: `backend/src/bootstrap/permissions.ts`

**Interfaces:**
- Consumes: `optionsError`, `positionTaken` (Task 1); `createUserWithRole`, `createQuestionnaire`, `addQuestion` (Task 2).
- Produces: `loadForAction(strapi: Core.Strapi, documentId: string, user: { id: number; role?: { type?: string } }, options?: { allowAdministrateur?: boolean }): Promise<QuestionnaireRecord>` with `type QuestionnaireRecord = { id: number; documentId: string; statut: 'brouillon' | 'publie' | 'ferme'; positions: number[] }` in `backend/src/api/questionnaire/services/questionnaire-access.ts` — used by Tasks 4 and 5.

- [ ] **Step 1: Write the failing contract test**

`backend/tests/contract/questions_add.test.ts`:

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

function patch(jwt: string, documentId: string, data: Record<string, unknown>) {
  return request(strapi.server.httpServer)
    .patch(`/api/questionnaires/${documentId}/questions`)
    .set('Authorization', `Bearer ${jwt}`)
    .send({ data });
}

describe('PATCH /api/questionnaires/:id/questions (T012, FR-002)', () => {
  it('adds a question of each type to a brouillon questionnaire of its auteur', async () => {
    const { user, jwt } = await createUserWithRole(strapi, 'auteur');
    const questionnaire = await createQuestionnaire(strapi, user);

    const likert = await patch(jwt, questionnaire.documentId, {
      texte: 'Clarté',
      type: 'likert',
      position: 1,
      obligatoire: true,
    });
    const choix = await patch(jwt, questionnaire.documentId, {
      texte: 'Format préféré',
      type: 'choix_multiple',
      position: 2,
      options: ['Cours', 'TP', 'Projet'],
    });
    const libre = await patch(jwt, questionnaire.documentId, {
      texte: 'Remarques',
      type: 'texte_libre',
      position: 3,
    });

    expect(likert.status).toBe(200);
    expect(likert.body.data).toMatchObject({
      texte: 'Clarté',
      type: 'likert',
      position: 1,
      obligatoire: true,
    });
    expect(choix.status).toBe(200);
    expect(choix.body.data.options).toEqual(['Cours', 'TP', 'Projet']);
    expect(libre.status).toBe(200);
    expect(libre.body.data.obligatoire).toBe(false);
    const stored = await strapi.documents('api::questionnaire.questionnaire').findOne({
      documentId: questionnaire.documentId,
      populate: ['questions'],
    });
    expect((stored as unknown as { questions: unknown[] }).questions).toHaveLength(3);
  });

  it('rejects wrong options with 400', async () => {
    const { user, jwt } = await createUserWithRole(strapi, 'auteur');
    const questionnaire = await createQuestionnaire(strapi, user);

    const none = await patch(jwt, questionnaire.documentId, {
      texte: 'Choix',
      type: 'choix_multiple',
      position: 1,
    });
    const single = await patch(jwt, questionnaire.documentId, {
      texte: 'Choix',
      type: 'choix_multiple',
      position: 1,
      options: ['Seul'],
    });
    const onLikert = await patch(jwt, questionnaire.documentId, {
      texte: 'Échelle',
      type: 'likert',
      position: 1,
      options: ['1', '2'],
    });

    for (const res of [none, single, onLikert]) {
      expect(res.status).toBe(400);
      expect(res.body.error.name).toBe('ValidationError');
    }
    expect(single.body.error.message).toBe(
      'options must list at least 2 distinct non-empty labels for a choix_multiple question',
    );
    expect(onLikert.body.error.message).toBe('options are only allowed for a choix_multiple question');
  });

  it('rejects a position already used in the questionnaire with 400', async () => {
    const { user, jwt } = await createUserWithRole(strapi, 'auteur');
    const questionnaire = await createQuestionnaire(strapi, user);
    const existing = await addQuestion(strapi, questionnaire);

    const res = await patch(jwt, questionnaire.documentId, {
      texte: 'Doublon',
      type: 'texte_libre',
      position: existing.position,
    });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe(
      `position ${existing.position} is already used in this questionnaire`,
    );
  });

  it('answers 403 to another auteur and 404 to an unknown questionnaire', async () => {
    const { user: owner } = await createUserWithRole(strapi, 'auteur');
    const { jwt: intruder } = await createUserWithRole(strapi, 'auteur');
    const questionnaire = await createQuestionnaire(strapi, owner);
    const body = { texte: 'Intrus', type: 'texte_libre', position: 1 };

    const forbidden = await patch(intruder, questionnaire.documentId, body);
    const missing = await patch(intruder, 'unknown-document-id', body);

    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.message).toBe('only the author of this questionnaire can do this');
    expect(missing.status).toBe(404);
    expect(missing.body.error.message).toBe('questionnaire not found');
  });

  it('answers 409 when the questionnaire is no longer brouillon', async () => {
    const { user, jwt } = await createUserWithRole(strapi, 'auteur');
    const questionnaire = await createQuestionnaire(strapi, user, { statut: 'publie' });

    const res = await patch(jwt, questionnaire.documentId, {
      texte: 'Trop tard',
      type: 'texte_libre',
      position: 1,
    });

    expect(res.status).toBe(409);
    expect(res.body.error.status).toBe(409);
    expect(res.body.error.message).toBe('questions can only be added to a brouillon questionnaire');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd /project/devops2/backend && npx jest tests/contract/questions_add.test.ts
```

Expected: FAIL — the route does not exist (`404` where `200`/`400`/`403`/`409` are expected).

- [ ] **Step 3: Implement the access service**

`backend/src/api/questionnaire/services/questionnaire-access.ts`:

```ts
import type { Core } from '@strapi/strapi';
import { errors } from '@strapi/utils';

export type QuestionnaireStatut = 'brouillon' | 'publie' | 'ferme';

export type QuestionnaireRecord = {
  id: number;
  documentId: string;
  statut: QuestionnaireStatut;
  positions: number[];
};

type Caller = { id: number; role?: { type?: string } };

type Loaded = {
  id: number;
  documentId: string;
  statut: QuestionnaireStatut;
  auteur?: { id: number } | null;
  questions?: { position: number }[];
};

export async function loadForAction(
  strapi: Core.Strapi,
  documentId: string,
  user: Caller,
  options: { allowAdministrateur?: boolean } = {},
): Promise<QuestionnaireRecord> {
  const found = (await strapi.documents('api::questionnaire.questionnaire').findOne({
    documentId,
    populate: ['auteur', 'questions'],
  })) as unknown as Loaded | null;
  if (!found) throw new errors.NotFoundError('questionnaire not found');
  const isOwner = found.auteur?.id === user.id;
  const isAdministrateur =
    options.allowAdministrateur === true && user.role?.type === 'administrateur';
  if (!isOwner && !isAdministrateur) {
    throw new errors.ForbiddenError('only the author of this questionnaire can do this');
  }
  return {
    id: found.id,
    documentId: found.documentId,
    statut: found.statut,
    positions: (found.questions ?? []).map((question) => question.position),
  };
}
```

- [ ] **Step 4: Implement the route, the action and the grant**

`backend/src/api/question/routes/question.ts`:

```ts
export default {
  routes: [
    {
      method: 'PATCH',
      path: '/questionnaires/:id/questions',
      handler: 'api::question.question.add',
      config: { policies: [] },
    },
  ],
};
```

`backend/src/api/question/controllers/question.ts`:

```ts
import { factories } from '@strapi/strapi';
import { errors } from '@strapi/utils';
import createError from 'http-errors';
import { loadForAction } from '../../questionnaire/services/questionnaire-access';
import { optionsError, positionTaken } from '../services/question-rules';

const UID = 'api::question.question';

type Body = { data?: Record<string, unknown> };

export default factories.createCoreController(UID, ({ strapi }) => ({
  async add(ctx) {
    const questionnaire = await loadForAction(strapi, ctx.params.id, ctx.state.user);
    if (questionnaire.statut !== 'brouillon') {
      throw createError(409, 'questions can only be added to a brouillon questionnaire');
    }
    const input = (await this.sanitizeInput((ctx.request.body as Body)?.data ?? {}, ctx)) as Record<
      string,
      unknown
    >;
    const { questionnaire: _questionnaire, ...fields } = input;
    const invalidOptions = optionsError(String(fields.type), fields.options);
    if (invalidOptions) throw new errors.ValidationError(invalidOptions);
    if (positionTaken(Number(fields.position), questionnaire.positions)) {
      throw new errors.ValidationError(
        `position ${fields.position} is already used in this questionnaire`,
      );
    }
    const created = await strapi.documents(UID).create({
      data: { ...fields, questionnaire: questionnaire.documentId } as never,
    });
    return this.transformResponse(await this.sanitizeOutput(created, ctx));
  },
}));
```

In `backend/src/bootstrap/permissions.ts`, add `'api::question.question.add'` to the `auteur` list.

- [ ] **Step 5: Run it to verify it passes**

Same command as Step 2. Expected: `5 passed`. Then `npx jest tests/integration/role_permissions.test.ts` → green.

- [ ] **Step 6: Regression gate**

Run the regression gate from Global Constraints.

- [ ] **Step 7: Commit**

```bash
cd /project/devops2
git add backend/src/api/questionnaire/services/questionnaire-access.ts backend/tests/contract/questions_add.test.ts backend/src/api/question/routes/question.ts backend/src/api/question/controllers/question.ts backend/src/bootstrap/permissions.ts
git commit -m "US1 (T012, T019): PATCH /api/questionnaires/:id/questions with options and position rules"
```

(with the two trailer lines from Global Constraints)

---

### Task 4: `POST /api/questionnaires/:id/publish` (T013, T020)

**Files:**
- Create: `backend/tests/contract/questionnaire_publish.test.ts`
- Modify: `backend/src/api/questionnaire/routes/questionnaire.ts`, `backend/src/api/questionnaire/controllers/questionnaire.ts`, `backend/src/bootstrap/permissions.ts`

**Interfaces:**
- Consumes: `loadForAction` (Task 3); helpers (Task 2); the create action and route file (Task 2).
- Produces: the `publish` action; Task 5 adds `close` next to it.

- [ ] **Step 1: Write the failing contract test**

`backend/tests/contract/questionnaire_publish.test.ts`:

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

function publish(jwt: string, documentId: string) {
  return request(strapi.server.httpServer)
    .post(`/api/questionnaires/${documentId}/publish`)
    .set('Authorization', `Bearer ${jwt}`)
    .send();
}

describe('POST /api/questionnaires/:id/publish (T013, FR-005)', () => {
  it('publishes a brouillon that has at least one question', async () => {
    const { user, jwt } = await createUserWithRole(strapi, 'auteur');
    const questionnaire = await createQuestionnaire(strapi, user);
    await addQuestion(strapi, questionnaire);

    const res = await publish(jwt, questionnaire.documentId);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ documentId: questionnaire.documentId, statut: 'publie' });
  });

  it('answers 422 without any question and leaves it brouillon', async () => {
    const { user, jwt } = await createUserWithRole(strapi, 'auteur');
    const questionnaire = await createQuestionnaire(strapi, user);

    const res = await publish(jwt, questionnaire.documentId);

    expect(res.status).toBe(422);
    expect(res.body.error.status).toBe(422);
    expect(res.body.error.message).toBe('a questionnaire needs at least one question to be published');
    const stored = await strapi
      .documents('api::questionnaire.questionnaire')
      .findOne({ documentId: questionnaire.documentId });
    expect((stored as unknown as { statut: string }).statut).toBe('brouillon');
  });

  it('answers 409 when already publie or ferme', async () => {
    const { user, jwt } = await createUserWithRole(strapi, 'auteur');
    const published = await createQuestionnaire(strapi, user, { statut: 'publie' });
    const closed = await createQuestionnaire(strapi, user, { statut: 'ferme' });
    await addQuestion(strapi, published);
    await addQuestion(strapi, closed);

    for (const questionnaire of [published, closed]) {
      const res = await publish(jwt, questionnaire.documentId);
      expect(res.status).toBe(409);
      expect(res.body.error.message).toBe('only a brouillon questionnaire can be published');
    }
  });

  it('answers 403 to another auteur and 404 to an unknown questionnaire', async () => {
    const { user: owner } = await createUserWithRole(strapi, 'auteur');
    const { jwt: intruder } = await createUserWithRole(strapi, 'auteur');
    const questionnaire = await createQuestionnaire(strapi, owner);
    await addQuestion(strapi, questionnaire);

    expect((await publish(intruder, questionnaire.documentId)).status).toBe(403);
    expect((await publish(intruder, 'unknown-document-id')).status).toBe(404);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd /project/devops2/backend && npx jest tests/contract/questionnaire_publish.test.ts
```

Expected: FAIL — the route does not exist (`404` where `200`/`422`/`409`/`403` are expected).

- [ ] **Step 3: Implement the route, the action and the grant**

Append to the `routes` array of `backend/src/api/questionnaire/routes/questionnaire.ts`:

```ts
    {
      method: 'POST',
      path: '/questionnaires/:id/publish',
      handler: 'api::questionnaire.questionnaire.publish',
      config: { policies: [] },
    },
```

In `backend/src/api/questionnaire/controllers/questionnaire.ts`, add the imports

```ts
import createError from 'http-errors';
import { loadForAction } from '../services/questionnaire-access';
```

and the action next to `create`:

```ts
  async publish(ctx) {
    const questionnaire = await loadForAction(strapi, ctx.params.id, ctx.state.user);
    if (questionnaire.statut !== 'brouillon') {
      throw createError(409, 'only a brouillon questionnaire can be published');
    }
    if (questionnaire.positions.length === 0) {
      throw createError(422, 'a questionnaire needs at least one question to be published');
    }
    const updated = await strapi.documents(UID).update({
      documentId: questionnaire.documentId,
      data: { statut: 'publie' } as never,
    });
    return this.transformResponse(await this.sanitizeOutput(updated, ctx));
  },
```

In `backend/src/bootstrap/permissions.ts`, add `'api::questionnaire.questionnaire.publish'` to the `auteur` list.

- [ ] **Step 4: Run it to verify it passes**

Same command as Step 2. Expected: `4 passed`. Then `npx jest tests/contract` → all contract files green.

- [ ] **Step 5: Regression gate**

Run the regression gate from Global Constraints.

- [ ] **Step 6: Commit**

```bash
cd /project/devops2
git add backend/tests/contract/questionnaire_publish.test.ts backend/src/api/questionnaire/routes/questionnaire.ts backend/src/api/questionnaire/controllers/questionnaire.ts backend/src/bootstrap/permissions.ts
git commit -m "US1 (T013, T020): POST /api/questionnaires/:id/publish, 422 without question"
```

(with the two trailer lines from Global Constraints)

---

### Task 5: `POST /api/questionnaires/:id/close` (T014, T021)

**Files:**
- Create: `backend/tests/contract/questionnaire_close.test.ts`
- Modify: `backend/src/api/questionnaire/routes/questionnaire.ts`, `backend/src/api/questionnaire/controllers/questionnaire.ts`, `backend/src/bootstrap/permissions.ts`

**Interfaces:**
- Consumes: `loadForAction(..., { allowAdministrateur: true })` (Task 3); helpers (Task 2); controller and route file (Tasks 2, 4).
- Produces: the `close` action.

- [ ] **Step 1: Write the failing contract test**

`backend/tests/contract/questionnaire_close.test.ts`:

```ts
import request from 'supertest';
import type { Core } from '@strapi/strapi';
import { setupStrapi, teardownStrapi } from '../helpers/strapi';
import { createUserWithRole } from '../helpers/users';
import { createQuestionnaire } from '../helpers/questionnaires';

let strapi: Core.Strapi;

beforeAll(async () => {
  strapi = await setupStrapi();
});

afterAll(async () => {
  await teardownStrapi();
});

function close(jwt: string, documentId: string) {
  return request(strapi.server.httpServer)
    .post(`/api/questionnaires/${documentId}/close`)
    .set('Authorization', `Bearer ${jwt}`)
    .send();
}

describe('POST /api/questionnaires/:id/close (T014, FR-005, FR-016)', () => {
  it('lets the auteur close its publie questionnaire', async () => {
    const { user, jwt } = await createUserWithRole(strapi, 'auteur');
    const questionnaire = await createQuestionnaire(strapi, user, { statut: 'publie' });

    const res = await close(jwt, questionnaire.documentId);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ documentId: questionnaire.documentId, statut: 'ferme' });
  });

  it('lets an administrateur close a questionnaire it does not own', async () => {
    const { user: owner } = await createUserWithRole(strapi, 'auteur');
    const { jwt: administrateur } = await createUserWithRole(strapi, 'administrateur');
    const questionnaire = await createQuestionnaire(strapi, owner, { statut: 'publie' });

    const res = await close(administrateur, questionnaire.documentId);

    expect(res.status).toBe(200);
    expect(res.body.data.statut).toBe('ferme');
  });

  it('answers 403 to another auteur', async () => {
    const { user: owner } = await createUserWithRole(strapi, 'auteur');
    const { jwt: intruder } = await createUserWithRole(strapi, 'auteur');
    const questionnaire = await createQuestionnaire(strapi, owner, { statut: 'publie' });

    expect((await close(intruder, questionnaire.documentId)).status).toBe(403);
  });

  it('answers 409 from brouillon and from ferme', async () => {
    const { user, jwt } = await createUserWithRole(strapi, 'auteur');
    const draft = await createQuestionnaire(strapi, user);
    const closed = await createQuestionnaire(strapi, user, { statut: 'ferme' });

    for (const questionnaire of [draft, closed]) {
      const res = await close(jwt, questionnaire.documentId);
      expect(res.status).toBe(409);
      expect(res.body.error.message).toBe('only a publie questionnaire can be closed');
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd /project/devops2/backend && npx jest tests/contract/questionnaire_close.test.ts
```

Expected: FAIL — the route does not exist.

- [ ] **Step 3: Implement the route, the action and the grants**

Append to the `routes` array of `backend/src/api/questionnaire/routes/questionnaire.ts`:

```ts
    {
      method: 'POST',
      path: '/questionnaires/:id/close',
      handler: 'api::questionnaire.questionnaire.close',
      config: { policies: [] },
    },
```

Add to `backend/src/api/questionnaire/controllers/questionnaire.ts`:

```ts
  async close(ctx) {
    const questionnaire = await loadForAction(strapi, ctx.params.id, ctx.state.user, {
      allowAdministrateur: true,
    });
    if (questionnaire.statut !== 'publie') {
      throw createError(409, 'only a publie questionnaire can be closed');
    }
    const updated = await strapi.documents(UID).update({
      documentId: questionnaire.documentId,
      data: { statut: 'ferme' } as never,
    });
    return this.transformResponse(await this.sanitizeOutput(updated, ctx));
  },
```

In `backend/src/bootstrap/permissions.ts`, add `'api::questionnaire.questionnaire.close'` to both the `auteur` and the `administrateur` lists.

- [ ] **Step 4: Run it to verify it passes**

Same command as Step 2. Expected: `4 passed`.

- [ ] **Step 5: Regression gate**

Run the regression gate from Global Constraints.

- [ ] **Step 6: Commit**

```bash
cd /project/devops2
git add backend/tests/contract/questionnaire_close.test.ts backend/src/api/questionnaire/routes/questionnaire.ts backend/src/api/questionnaire/controllers/questionnaire.ts backend/src/bootstrap/permissions.ts
git commit -m "US1 (T014, T021): POST /api/questionnaires/:id/close for the auteur or an administrateur"
```

(with the two trailer lines from Global Constraints)

---

### Task 6: Scénario 1 end to end, live check and completion records (T015)

**Files:**
- Create: `backend/tests/integration/create_publish.test.ts`
- Modify: `CLAUDE.md`, `specs/001-questionnaire-platform/tasks.md`

**Interfaces:**
- Consumes: the four routes (Tasks 2–5); `createUserWithRole` (Task 2), whose `email`/`password` are used to log in through `POST /api/auth/local`.
- Produces: nothing for later tasks.

- [ ] **Step 1: Write the end-to-end test**

`backend/tests/integration/create_publish.test.ts`:

```ts
import request from 'supertest';
import type { Core } from '@strapi/strapi';
import { setupStrapi, teardownStrapi } from '../helpers/strapi';
import { createUserWithRole } from '../helpers/users';

let strapi: Core.Strapi;

beforeAll(async () => {
  strapi = await setupStrapi();
});

afterAll(async () => {
  await teardownStrapi();
});

describe('quickstart Scénario 1 — créer et publier (T015, US1)', () => {
  it('lets a logged-in auteur create, fill, publish and close a questionnaire', async () => {
    const { email, password } = await createUserWithRole(strapi, 'auteur');
    const server = strapi.server.httpServer;

    const login = await request(server).post('/api/auth/local').send({ identifier: email, password });
    const jwt = login.body.jwt ?? '';
    const auth = { Authorization: `Bearer ${jwt}` };

    const created = await request(server)
      .post('/api/questionnaires')
      .set(auth)
      .send({ data: { titre: 'Retour S1', visibilite: 'publique' } });
    const id = created.body.data?.documentId;

    const questions = [
      { texte: 'Clarté', type: 'likert', position: 1, obligatoire: true },
      { texte: 'Format', type: 'choix_multiple', position: 2, options: ['Cours', 'TP'] },
      { texte: 'Remarques', type: 'texte_libre', position: 3 },
    ];
    const added = [];
    for (const data of questions) {
      added.push(
        await request(server).patch(`/api/questionnaires/${id}/questions`).set(auth).send({ data }),
      );
    }
    const published = await request(server).post(`/api/questionnaires/${id}/publish`).set(auth).send();
    const closed = await request(server).post(`/api/questionnaires/${id}/close`).set(auth).send();

    expect(login.status).toBe(200);
    expect(created.status).toBe(201);
    expect(created.body.data.statut).toBe('brouillon');
    expect(added.map((res) => res.status)).toEqual([200, 200, 200]);
    expect(published.status).toBe(200);
    expect(published.body.data).toMatchObject({ documentId: id, statut: 'publie' });
    expect(closed.status).toBe(200);
    expect(closed.body.data.statut).toBe('ferme');
  });
});
```

- [ ] **Step 2: Run it**

```bash
export PATH=/tmp/claude-1000/-project-devops2/f0c0f41e-6d12-45e7-a390-b175e6f2473f/scratchpad/node-v22.12.0-linux-x64/bin:$PATH
cd /project/devops2/backend && npx jest tests/integration/create_publish.test.ts
```

Expected: `1 passed` (all endpoints exist since Task 5). To prove the test is not vacuous, temporarily remove `'api::questionnaire.questionnaire.publish'` from `ROLE_PERMISSIONS`, rebuild through the harness, see it fail with `published.status` `403`, then restore it and see it pass; record both runs in the report.

- [ ] **Step 3: Live check on PostgreSQL (dedicated project, only if ports are free)**

```bash
cd /project/devops2
if ss -ltn | grep -qE ':(1337|3000|5432)\s'; then
  echo "SKIPPED: a host port among 1337/3000/5432 is in use"
else
  TMP_ENV=$(mktemp)
  cp .env.example "$TMP_ENV"
  sed -i -e 's/^DATABASE_NAME=.*/DATABASE_NAME=questionnaire/' \
         -e 's/^DATABASE_USERNAME=.*/DATABASE_USERNAME=questionnaire/' \
         -e 's/^DATABASE_PASSWORD=.*/DATABASE_PASSWORD=live-check-db/' \
         -e 's/^DEV_AUTEUR_EMAIL=.*/DEV_AUTEUR_EMAIL=live.auteur@example.test/' \
         -e 's/^DEV_AUTEUR_PASSWORD=.*/DEV_AUTEUR_PASSWORD=Live-Passw0rd!/' "$TMP_ENV"
  docker compose -p devops2-check --env-file "$TMP_ENV" up -d
  for i in $(seq 1 60); do
    [ "$(docker compose -p devops2-check --env-file "$TMP_ENV" ps --format '{{.Health}}' backend)" = healthy ] && break
    sleep 10
  done
  API=http://127.0.0.1:1337/api
  JWT=$(curl -s -X POST $API/auth/local -H 'Content-Type: application/json' \
    -d '{"identifier":"live.auteur@example.test","password":"Live-Passw0rd!"}' | python3 -c 'import json,sys; print(json.load(sys.stdin)["jwt"])')
  H="Authorization: Bearer $JWT"
  ID=$(curl -s -X POST $API/questionnaires -H "$H" -H 'Content-Type: application/json' \
    -d '{"data":{"titre":"Live","visibilite":"publique"}}' | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["documentId"])')
  curl -s -o /dev/null -w 'add %{http_code}\n' -X PATCH $API/questionnaires/$ID/questions -H "$H" -H 'Content-Type: application/json' \
    -d '{"data":{"texte":"Clarté","type":"likert","position":1,"obligatoire":true}}'
  curl -s -w '\npublish %{http_code}\n' -X POST $API/questionnaires/$ID/publish -H "$H"
  curl -s -w '\nclose %{http_code}\n' -X POST $API/questionnaires/$ID/close -H "$H"
  docker compose -p devops2-check --env-file "$TMP_ENV" down -v
  rm -f "$TMP_ENV"
fi
```

Expected: `add 200`, a publish body with `"statut":"publie"` and `publish 200`, a close body with `"statut":"ferme"` and `close 200`; then everything of project `devops2-check` removed. If skipped, record "SKIPPED" and the `ss` line. Never start, stop or remove anything of another compose project. Always run the `down -v` of `devops2-check` if `up` was attempted.

- [ ] **Step 4: Regression gate**

Run the regression gate from Global Constraints.

- [ ] **Step 5: `CLAUDE.md` and `tasks.md`**

`CLAUDE.md` "Current state": change the done-tasks line to include **T011–T021**; in the `backend/` bullet add: "Content-types `questionnaire` and `question` (ASCII enum codes, `draftAndPublish: false`, `options` JSON for `choix_multiple`); routes `POST /api/questionnaires`, `PATCH /api/questionnaires/:id/questions`, `POST /api/questionnaires/:id/publish`, `POST /api/questionnaires/:id/close` in Strapi's `data` envelope, ownership in `api/questionnaire/services/questionnaire-access.ts` (404/403), 409 on a wrong transition, 422 when publishing without question (US1 backend, T011–T021)."; in the Tests bullet mention `tests/contract/` and `tests/unit/`.

`specs/001-questionnaire-platform/tasks.md`: mark T011–T021 `[X]`, each with a short annotation (files, RED/GREEN evidence, Jira key) in the style of T060–T062; T015's annotation names the live check result; T011's annotation points to the spec and plan paths and the decisions D1–D4.

- [ ] **Step 6: Commit**

```bash
cd /project/devops2
git add backend/tests/integration/create_publish.test.ts CLAUDE.md specs/001-questionnaire-platform/tasks.md
git commit -m "US1 (T015): quickstart Scénario 1 end to end; record T011–T021 completion"
```

(with the two trailer lines from Global Constraints)

- [ ] **Step 7: Jira**

After the final whole-branch review passes: comment on D2-19, D2-20, D2-21, D2-22, D2-23, D2-24, D2-25, D2-26, D2-68, D2-69 and D2-29 (one short comment each: what was delivered, the test file, the commit range) and move each to `Terminé` (transition id `41`).
