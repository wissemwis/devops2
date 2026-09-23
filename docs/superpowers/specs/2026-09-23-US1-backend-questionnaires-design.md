# User Story 1 backend (T011–T021) — Questionnaires and questions: create, add, publish, close

**Date:** 2026-09-23 · **Status:** approved in brainstorming, pending written-spec review
**Tasks:** `specs/001-questionnaire-platform/tasks.md` T011–T021 (Phase 3, User Story 1, backend
part). Jira: T011 D2-19, T012 D2-20, T013 D2-21, T014 D2-22, T015 D2-23, T016 D2-24, T017 D2-25,
T018 D2-26, T019 D2-68, T020 D2-69, T021 D2-29.
**Binding context:** `spec.md` User Story 1 (acceptance scenarios 1–3), FR-001, FR-002, FR-003,
FR-004, FR-005, FR-016 and the Edge Case "publier sans question"; `data-model.md` Questionnaire
and Question; `contracts/api.md` Questionnaires section; `quickstart.md` Scénario 1;
`.specify/memory/constitution.md` v1.2.0 (I Test-First, II YAGNI, IV Sécurité par défaut);
T061/T062 designs (native roles, `ROLE_PERMISSIONS` in `backend/src/bootstrap/permissions.ts`,
Jest harness `backend/tests/helpers/strapi.ts`).

## 1. Problem

No business content-type or endpoint exists yet: `backend/src/api/questionnaire|question` hold
only `.gitkeep`. User Story 1 (P1, the MVP) needs an `auteur` to create a questionnaire, add
questions of the three types, publish it and close it. T011–T015 are the contract/integration
tests written first; T016–T021 the content-types and endpoints that make them pass. A contract
test merged alone would leave `npm test` red on `main`, so the tests and their implementation
ship together, one endpoint at a time.

Two gaps in the existing documents are closed here:
- `contracts/api.md` and `data-model.md` use accented enum values (`publié`, `fermé`, `privée`)
  and flat request/response bodies, while the roles already use ASCII codes (`repondant`, T061)
  and Strapi 5 wraps every content-API body in `data`.
- A `choix_multiple` question needs its list of choices (`data-model.md` Réponse-question says
  the answer holds "id(s) d'option"), but Question has no field for them and the contract does
  not transmit them.

## 2. Goals and success criteria

- An authenticated `auteur` can `POST /api/questionnaires`, add questions of each type,
  publish (only with at least one question) and close its questionnaire, exactly through the
  4 routes of the contract, with the status machine `brouillon → publie → ferme` linear and
  irreversible (FR-005).
- An `administrateur` can close any questionnaire (FR-016); a `repondant`, an unauthenticated
  caller, or an `auteur` who does not own the questionnaire cannot act on it.
- Every response goes through Strapi's sanitisation: no author email or password hash leaks.
- `data-model.md` and `contracts/api.md` describe exactly what the code does.

**Out of scope:** `GET /api/questionnaires/:id` and the public access link (T034, US2 — the
quickstart's "lien d'accès" is checked there; here the end-to-end test checks `statut = publie`
and the `documentId` the link will use); reordering and deleting questions (T064); image format
and size validation (T068); FR-016 authorization tests on US3 endpoints (T069); the frontend
(T022–T024) and the login page (T063); whether a `choix_multiple` answer takes one or several
choices (US2 answer validation).

## 3. Decisions taken in brainstorming

| # | Question | Decision |
|---|---|---|
| D1 | Scope of this cycle | All of the US1 backend, T011–T021, in one spec and one plan; one plan task per endpoint with its contract test written first. |
| D2 | Enum values | ASCII codes: `statut` ∈ `brouillon`, `publie`, `ferme`; `visibilite` ∈ `publique`, `privee`. Accented labels are the UI's business. `data-model.md` and `contracts/api.md` amended. |
| D3 | Body format | Strapi's native envelope everywhere: requests `{ "data": { … } }`, responses `{ "data": { documentId, … }, "meta": {} }`, errors `{ "data": null, "error": { status, name, message, details } }`. Controllers built with `createCoreController` to keep `sanitizeInput`/`sanitizeOutput`. Contract amended. |
| D4 | Choices of a `choix_multiple` question | JSON field `options`: an array of at least 2 distinct non-empty labels, required for `choix_multiple`, forbidden for `likert` and `texte_libre`. US2 answers will hold the chosen labels. |

## 4. Design

### 4.1 Content-types

`backend/src/api/questionnaire/content-types/questionnaire/schema.json`
(`collectionName: questionnaires`, `options.draftAndPublish: false` so Strapi's own draft/publish
does not overlap `statut`):

| Attribute | Definition |
|---|---|
| `titre` | `string`, `required: true` |
| `description` | `text` |
| `statut` | `enumeration`, `enum: ["brouillon", "publie", "ferme"]`, `default: "brouillon"`, `required: true` |
| `visibilite` | `enumeration`, `enum: ["publique", "privee"]`, `required: true` |
| `auteur` | `relation`, `manyToOne`, `target: plugin::users-permissions.user` |
| `questions` | `relation`, `oneToMany`, `target: api::question.question`, `mappedBy: questionnaire` |

`auteur` is always set by the create controller from the authenticated caller (the only write
path in this cycle); `data-model.md`'s "requis" is guaranteed by that controller and its test. `createdAt` /
`updatedAt` are `dateCreation` / `dateModification`.

`backend/src/api/question/content-types/question/schema.json` (`collectionName: questions`,
`draftAndPublish: false`):

| Attribute | Definition |
|---|---|
| `texte` | `string`, `required: true` |
| `type` | `enumeration`, `enum: ["likert", "choix_multiple", "texte_libre"]`, `required: true` |
| `position` | `integer`, `required: true`, `min: 1` |
| `obligatoire` | `boolean`, `default: false`, `required: true` |
| `options` | `json` |
| `image` | `media`, `multiple: false`, `allowedTypes: ["images"]` |
| `questionnaire` | `relation`, `manyToOne`, `target: api::questionnaire.questionnaire`, `inversedBy: questions` |

Each API also gets the scaffold files Strapi needs (`services/<name>.ts` with
`factories.createCoreService`, `controllers/<name>.ts`), and **no** `createCoreRouter`: the only
routes are the custom ones of §4.3.

### 4.2 Question rules — `backend/src/api/question/services/question-rules.ts`

Pure functions, unit-tested without Strapi:

```ts
export type QuestionType = 'likert' | 'choix_multiple' | 'texte_libre';

export function optionsError(type: QuestionType, options: unknown): string | null;
export function positionTaken(position: number, existingPositions: readonly number[]): boolean;
```

- `optionsError`: for `choix_multiple`, `options` must be an array of at least 2 strings, each
  non-empty after trimming, pairwise distinct after trimming → otherwise a message
  (`options must list at least 2 distinct non-empty labels for a choix_multiple question`);
  for the other types `options` must be `undefined` or `null` → otherwise
  (`options are only allowed for a choix_multiple question`).
- `positionTaken`: `true` when another question of the same questionnaire already uses that
  position.

### 4.3 Routes, actions and permissions

Custom route files (`backend/src/api/questionnaire/routes/questionnaire.ts`,
`backend/src/api/question/routes/question.ts`), default content-API auth (users-permissions):

| Method + path | Handler (action) | `ROLE_PERMISSIONS` |
|---|---|---|
| `POST /questionnaires` | `api::questionnaire.questionnaire.create` | `auteur` |
| `PATCH /questionnaires/:id/questions` | `api::question.question.add` | `auteur` |
| `POST /questionnaires/:id/publish` | `api::questionnaire.questionnaire.publish` | `auteur` |
| `POST /questionnaires/:id/close` | `api::questionnaire.questionnaire.close` | `auteur`, `administrateur` |

`repondant` gets none of them. `:id` is the questionnaire's `documentId`.

### 4.4 Ownership — `backend/src/api/questionnaire/services/questionnaire-access.ts`

```ts
export async function loadForAction(
  strapi: Core.Strapi,
  documentId: string,
  user: { id: number; role?: { type?: string } },
  options?: { allowAdministrateur?: boolean },
): Promise<QuestionnaireRecord>;
```

- Loads the questionnaire by `documentId` with its `auteur` id and its questions' positions.
- Throws `NotFoundError` (404) when it does not exist; `ForbiddenError` (403) when the caller is
  not its `auteur`, unless `allowAdministrateur` is set and the caller's role type is
  `administrateur` (used by `close` only).
- Roles and permissions decide who may call a route; this service decides whether the caller
  may act on this questionnaire.

### 4.5 Endpoint behaviour

All bodies use the `data` envelope; every response goes through `sanitizeOutput`.

- **`POST /api/questionnaires`** — body `{ data: { titre, description?, visibilite } }`,
  validated by the content-type (missing `titre` or unknown `visibilite` → 400
  `ValidationError`). `statut` is forced to `brouillon` and `auteur` to the caller, whatever the
  body says. Response `201 { data }`.
- **`PATCH /api/questionnaires/:id/questions`** — body `{ data: { texte, type, position,
  obligatoire?, options?, image? } }`. Ownership (§4.4); questionnaire must be `brouillon`,
  otherwise 409 `ConflictError`-shaped response (`status: 409`); `optionsError` → 400;
  `positionTaken` → 400 (`position <n> is already used in this questionnaire`); content-type
  validation → 400. Creates the question linked to the questionnaire. Response `200 { data:
  question }`.
- **`POST /api/questionnaires/:id/publish`** — ownership; not `brouillon` → 409; no question →
  422 (`a questionnaire needs at least one question to be published`); otherwise
  `statut = publie`. Response `200 { data }`.
- **`POST /api/questionnaires/:id/close`** — ownership with `allowAdministrateur`; not `publie`
  → 409; otherwise `statut = ferme`. Response `200 { data }`.
- Status codes 409 and 422 are produced through Koa's `ctx.throw`-compatible Strapi error
  handling so that the body keeps Strapi's error shape; the exact mechanism (an `HttpError`
  subclass from `@strapi/utils` `errors` or `ctx.conflict`/`ctx.unprocessableEntity` if the
  installed version provides them) is chosen in the plan against the installed Strapi, and
  pinned by the contract tests' assertions on `status` and `error.status`.
- An unauthenticated call is refused by Strapi's content-API auth; the exact status (401 or 403)
  is observed by a contract test and written into the contract amendment.

### 4.6 Documentation amendments (dated 2026-09-23, US1 backend)

- `data-model.md`: ASCII enum codes; Question `options` field and its rule; `position ≥ 1`
  unique per questionnaire enforced by the add endpoint; `draftAndPublish` disabled.
- `contracts/api.md`: a dated amendment at the top of the Questionnaires section — `data`
  envelope for requests and responses, Strapi error shape, `:id` = `documentId`, ASCII enum
  values, `options` in the add-question body, 400/403/404/409/422 cases per endpoint, the
  observed unauthenticated status.
- `tasks.md`: T011–T021 annotated on completion; `CLAUDE.md` "Current state" updated.

## 5. Testing (test-first, Jest harness of T061)

Shared helpers (`backend/tests/helpers/`): `createUserWithRole(strapi, type)` → `{ user, jwt }`
(users-permissions user service + JWT service, confirmed, local provider, `nom` set);
`createQuestionnaire(strapi, owner, overrides?)` and `addQuestion(strapi, questionnaire,
overrides?)` seeding through the Document Service.

- `tests/unit/question_rules.test.ts` — every branch of `optionsError` and `positionTaken`.
- `tests/integration/questionnaire_schema.test.ts` — both content-types are loaded with the
  attributes, enums, defaults and relations of §4.1, and `draftAndPublish` is off.
- `tests/contract/questionnaires_create.test.ts` (T011) — 201 with `statut: brouillon` and the
  caller as `auteur` even when the body sends `statut: publie` and another `auteur`; 400 without
  `titre`; 400 with `visibilite: privée`; refused for `repondant` (403), `administrateur` (403)
  and unauthenticated; response has no `auteur` email/password.
- `tests/contract/questions_add.test.ts` (T012) — one question of each type; `choix_multiple`
  without or with 1 option → 400; `likert` with options → 400; duplicate position → 400;
  another auteur → 403; unknown id → 404; questionnaire `publie` → 409.
- `tests/contract/questionnaire_publish.test.ts` (T013) — 200 `publie` with one question;
  422 without question; 409 when already `publie` or `ferme`; 403; 404.
- `tests/contract/questionnaire_close.test.ts` (T014) — owner 200 `ferme`; `administrateur`
  non-owner 200; another auteur 403; 409 from `brouillon` and from `ferme`.
- `tests/integration/create_publish.test.ts` (T015, quickstart Scénario 1) — an `auteur` logs in
  through `POST /api/auth/local`, creates a questionnaire, adds a `likert`, a `choix_multiple`
  and a `texte_libre` question, publishes (`statut = publie`, `documentId` returned), then
  closes it.
- `tests/integration/role_permissions.test.ts` keeps passing (every new action exists, no
  forbidden write action granted).

Live check: `docker compose -p devops2-check` on PostgreSQL with the dev `auteur` account (T062),
the Scénario 1 flow through `curl`, then `down -v` of that project only; skipped and recorded if
ports 1337/3000/5432 are taken.

Regression gate per task: all `tests/structure/*.sh`; in `backend/`: `npm test`, `npm run
build`, `npm run lint`, `npm run format:check`.

## 6. Risks

- **409/422 in Strapi's error shape.** Strapi's `@strapi/utils` errors map to 400/401/403/404/
  413/429 out of the box; 409 and 422 need either Koa context helpers or a small `HttpError`
  subclass. The plan verifies against the installed version before choosing; the tests pin the
  wire format.
- **Relation writes by id vs documentId.** Strapi 5 accepts both for relations in the Document
  Service; the plan uses `documentId` consistently and the schema test covers the relation
  targets.
- **Concurrent adds with the same position.** Two simultaneous `PATCH` calls could both pass
  the `positionTaken` check. Acceptable for a single author editing a draft; T064 (reorder)
  revisits positions.
- **`options` as free JSON.** The database does not constrain it; `optionsError` is the only
  guard, so every write path to a question (today only `add`; T064 later) must call it.
