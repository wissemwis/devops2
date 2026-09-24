# T077 — Author-scoped reads: `GET /api/mes-questionnaires` and `GET /api/mes-questionnaires/:id`

**Date:** 2026-09-24 · **Status:** approved in brainstorming, pending written-spec review
**Task:** `specs/001-questionnaire-platform/tasks.md` T077 (Phase 3, User Story 1). Jira: D2-87.
**Binding context:** `spec.md` User Story 1 (acceptance scenarios 1–2), FR-016; `contracts/api.md`
Questionnaires section and its 2026-09-23 US1 amendment; `.specify/memory/constitution.md` v1.2.0
(I Test-First, II YAGNI, IV Sécurité par défaut); US1 backend design
(`2026-09-23-US1-backend-questionnaires-design.md`), `loadForAction` in
`backend/src/api/questionnaire/services/questionnaire-access.ts`, `ROLE_PERMISSIONS` in
`backend/src/bootstrap/permissions.ts` (T062).

## 1. Problem

US1 backend (T011–T021) lets an `auteur` create, fill, publish and close a questionnaire, but
nothing lets it read one back: no route returns a `brouillon` questionnaire with its questions,
and no route lists the caller's questionnaires. The frontend of T022–T024 (creation page,
question editor, publish/close actions) cannot redisplay a draft or show "my questionnaires"
without them.

`GET /api/questionnaires/:id` is already reserved by the contract for T034: the public or
invitation-token read of a `publie` questionnaire, with `config.auth: false`. Strapi cannot
register two handlers on the same method and path, so the author-scoped read needs its own path.

## 2. Goals and success criteria

- The owner of a questionnaire, or any `administrateur` (FR-016), reads it in any `statut`
  (`brouillon`, `publie`, `ferme`) with its questions ordered by `position`.
- Any caller holding the action lists the questionnaires it authored, and only those.
- Another `auteur` gets `403`, an unknown `documentId` gets `404`, a `repondant` or an
  unauthenticated caller gets `403` — the status codes of the US1 amendment.
- The author (`auteur` relation, email, password hash) is never exposed.
- The public route of T034 stays untouched and independent.

## 3. Decisions

| # | Decision | Rejected alternatives |
|---|----------|-----------------------|
| D1 | A dedicated prefix: `GET /api/mes-questionnaires` (list) and `GET /api/mes-questionnaires/:id` (detail). T034 keeps `GET /api/questionnaires/:id` for the public read. | One `auth: false` route decoding an optional JWT by hand (reimplements authentication, mixes two security rules in one handler); `GET /api/questionnaires` + `GET /api/questionnaires/:id/edition` (less regular). |
| D2 | Detail: owner or any `administrateur`, as for `close`. List: only questionnaires whose `auteur` is the caller, for every role that holds the action — an `administrateur`, who cannot create, gets an empty list. An "all questionnaires" view for the administrateur waits for its real need (US3/US4). | List returns everything to an administrateur (the `mes-` name would lie); no read at all for the administrateur. |
| D3 | List items carry `documentId`, `titre`, `description`, `statut`, `visibilite`, `createdAt`, `updatedAt` (plus Strapi's numeric `id`), no questions, no author; sorted by `updatedAt` descending; no pagination, `meta: {}`. | A computed `nbQuestions`; Strapi's native `page`/`pageSize` pagination. |
| D4 | Two custom actions, `findMine` and `findOneMine`, on the existing `questionnaire` controller, following the `publish`/`close` pattern. They read no query parameter: `populate`, `filters`, `sort`, `fields` sent by the client are ignored. | Strapi's native `find`/`findOne` behind a policy injecting an `auteur` filter (leaves `populate`/`filters` open to the client); a separate read service (one more layer for two queries). |

## 4. Design

### 4.1 Routes and permissions

`backend/src/api/questionnaire/routes/questionnaire.ts` gains:

| Method | Path | Handler |
|--------|------|---------|
| GET | `/mes-questionnaires` | `api::questionnaire.questionnaire.findMine` |
| GET | `/mes-questionnaires/:id` | `api::questionnaire.questionnaire.findOneMine` |

`ROLE_PERMISSIONS` grants `api::questionnaire.questionnaire.findMine` and
`api::questionnaire.questionnaire.findOneMine` to `auteur` and to `administrateur`; `repondant`
stays `[]`. Without a JWT the public role has no such action: `403` (`ForbiddenError`).

### 4.2 `findMine`

- Query: `strapi.documents(UID).findMany({ filters: { auteur: { id: ctx.state.user.id } },
  sort: 'updatedAt:desc', fields: [titre, description, statut, visibilite, createdAt, updatedAt] })`.
  No `populate`.
- Response `200`: `{ "data": [ { "id", "documentId", "titre", "description", "statut",
  "visibilite", "createdAt", "updatedAt" }, … ], "meta": {} }` after `sanitizeOutput` and
  `transformResponse`. An empty list is `{ "data": [], "meta": {} }`.

### 4.3 `findOneMine`

- Access: `loadForAction(strapi, ctx.params.id, ctx.state.user, { allowAdministrateur: true })`
  — `404` `questionnaire not found`, `403` `PolicyError` for a non-owner who is not
  `administrateur`. No `statut` check.
- Then reload the document with the same `fields` as the list and
  `populate: { questions: { sort: 'position:asc', populate: ['image'] } }`. `auteur` is not
  populated.
- Response `200`: `{ "data": { "id", "documentId", "titre", "description", "statut",
  "visibilite", "createdAt", "updatedAt", "questions": [ { "id", "documentId", "texte", "type",
  "position", "obligatoire", "options", "image", … }, … ] }, "meta": {} }`, questions in
  ascending `position`, after `sanitizeOutput` and `transformResponse`. `image` is `null` until
  T068 makes upload available.

### 4.4 Errors

Same shapes and rule as the US1 amendment: `{ "data": null, "error": { "status", "name",
"message", "details" } }`; clients branch on `error.status`, never on `error.name`.

## 5. Tests (written first — Constitution I)

`backend/tests/contract/mes_questionnaires_list.test.ts`:
- no JWT → `403`; `repondant` → `403`;
- an `auteur` with no questionnaire → `200`, `data: []`;
- two auteurs each with questionnaires → each sees only its own;
- order: most recently updated first;
- items carry the D3 fields and no `auteur`, no `questions`;
- `?populate=auteur` and `?filters[...]` are ignored (still only the caller's, still no `auteur`);
- an `administrateur` → `200`, `data: []`.

`backend/tests/contract/mes_questionnaires_get.test.ts`:
- no JWT → `403`; `repondant` → `403`;
- unknown `documentId` → `404`;
- another `auteur` → `403`;
- owner reads a `brouillon`, a `publie` and a `ferme` questionnaire → `200` each;
- `administrateur` reads another author's questionnaire → `200`;
- questions added out of order (e.g. positions 3, 1, 2) come back as 1, 2, 3 with their
  `options` for `choix_multiple`;
- no `auteur` in the body, even with `?populate=auteur`.

Existing helpers `createUserWithRole`, `createQuestionnaire`, `addQuestion` and the publish/close
routes build the fixtures; no new helper unless a test needs one twice.

## 6. Documentation

- `contracts/api.md`: a `GET /api/mes-questionnaires` and `GET /api/mes-questionnaires/:id`
  section under the US1 amendment, with one sentence separating it from T034's public
  `GET /api/questionnaires/:id`.
- `tasks.md`: T077 `[X]`.
- `CLAUDE.md` "Current state": T077 done, the two routes, the updated `ROLE_PERMISSIONS`
  sentence.

## 7. Out of scope

- The public/invitation-token read (T034).
- An administrateur view of all questionnaires (US3/US4, when needed).
- Question reorder/delete (T064), image upload (T068), pagination.
