# T022 — Questionnaire creation page and draft page

**Date:** 2026-09-24 · **Status:** approved in brainstorming, pending written-spec review
**Task:** `specs/001-questionnaire-platform/tasks.md` T022 (Phase 3, User Story 1). Jira: D2-27.
**Binding context:** `spec.md` User Story 1 (acceptance scenario 1), FR-001, FR-004, FR-016;
`contracts/api.md` `POST /api/questionnaires` and `GET /api/mes-questionnaires/:id` (T077);
`.specify/memory/constitution.md` v1.2.0 (I Test-First, II YAGNI, IV Sécurité par défaut);
T063 design (`2026-09-24-T063-author-login-session-design.md`) for the BFF session, `proxy.ts`
and the author layout; `DESIGN.md` (Cahier Seyès) for every visual decision.

## 1. Problem

T063 gives an author a session and a table of contents of their questionnaires, but no way to
create one. The backend route `POST /api/questionnaires` exists (T011–T021) and the owner-scoped
read `GET /api/mes-questionnaires/:id` exists (T077); nothing in the frontend calls them. T023
(question editor) and T024 (publish/close actions) also need a page that shows one draft; no
task names that page.

## 2. Goals and success criteria

- An `auteur` opens `/questionnaires/create`, enters a title, an optional description and a
  visibility, and gets a `brouillon` questionnaire in under a minute.
- After creation the author lands on the draft page `/questionnaires/<documentId>`, which shows
  the questionnaire and its (possibly empty) question list; T023 plugs its editor there.
- Every error (empty title, Strapi `400`, `401`, `403`, unavailable) is annotated in red pen
  without losing what was typed.
- The table of contents links each title to its draft page and offers « Nouveau questionnaire »
  to authors.
- An `administrateur`, who holds no `create` action (T062), is told the page is reserved to
  authors and is never offered the link.
- Everything is drawn in the Cahier Seyès world of `DESIGN.md`, with no new direction.

## 3. Decisions

| # | Decision | Rejected alternatives |
|---|----------|-----------------------|
| D1 | After « Créer le brouillon », redirect to a new draft page `/questionnaires/[id]` that reads `GET /api/mes-questionnaires/:id`. | Redirect back to the list (the author can do nothing with the draft until T023). |
| D2 | Visibility is two radios, « Publique » pre-checked. No update route exists, so the choice is final; the default fits the end-of-session feedback use. | No pre-checked radio (one more click; forced choice). |
| D3 | Server action + `useActionState`, as `/login`: `actions.ts` delegates to a pure `submitCreation(formData, deps)` that is tested without Next. Works without JavaScript; `proxy.ts` already refreshes the token for `/questionnaires/:path*`. | A client component posting to a BFF route handler (more code, no progressive enhancement); a client fetch to Strapi (impossible: httpOnly token, server-only `STRAPI_URL`). |
| D4 | `services/questionnaireService.ts` is created with `createQuestionnaire` and `getMine`; T024 adds publish/close to the same file. | `getMine` in `mesQuestionnaires.ts` (splits one resource's client over two files). |
| D5 | The author read by the layout is memoised per request with React `cache()` (`lib/current-author.ts`), so pages that need the role (create page, « Nouveau questionnaire » link) do not call `/users/me` a second time. | Calling `currentUser` again in each page; passing the role through a context (Server Components have none). |

## 4. Design

### 4.1 Routes

| Path | File | Content |
|------|------|---------|
| `/questionnaires` | `app/questionnaires/page.tsx` (changed) | Headline, « + Nouveau questionnaire » link (auteur only), `Sommaire` with linked titles. |
| `/questionnaires/create` | `app/questionnaires/create/{page,actions,CreationForm}.tsx` | Creation form (auteur) or the reserved-to-authors line (administrateur). |
| `/questionnaires/[id]` | `app/questionnaires/[id]/{page,not-found}.tsx` | Draft page. |

All three sit under the existing `app/questionnaires/layout.tsx`, so the author gate, the header
line and the proxy refresh apply unchanged. The static `create` segment wins over `[id]` in the
App Router; Strapi `documentId`s are never `create`.

### 4.2 `lib/current-author.ts`

`currentAuthorGate = cache(async () => gateAuthor({access, refresh} from cookies(), { currentUser }))`.
The layout and the pages call it; within one request Strapi's `/users/me` is called once.

### 4.3 `services/questionnaireService.ts`

- `createQuestionnaire(access, { titre, description, visibilite })` →
  `POST /api/questionnaires` with `{ data: { titre, description?, visibilite } }` (description
  omitted when empty) and `Authorization: Bearer`. Returns
  `{ ok: true, documentId }` on `201`, `{ ok: false, reason }` with reason `invalid` (`400`),
  `session` (`401`), `forbidden` (`403`), `unavailable` (`StrapiUnavailableError`, or any other
  status, logged `questionnaire.create.failed` with the status).
- `getMine(access, documentId)` → `GET /api/mes-questionnaires/:id`. Returns
  `{ kind: 'found', questionnaire }` (`documentId`, `titre`, `description`, `statut`,
  `visibilite`, `questions: { documentId, texte, type, position, obligatoire }[]`),
  `{ kind: 'not-found' }` for `404` and `403`, `{ kind: 'session' }` for `401`,
  `{ kind: 'unavailable' }` otherwise (logged `questionnaire.read.failed`).
- `documentId` is URL-encoded in the path.

### 4.4 `lib/create-questionnaire.ts`

`submitCreation(formData, { create, access })` → `{ kind: 'form', state }` or
`{ kind: 'redirect', to }`:

- `titre` trimmed; empty → state with message `missing-titre`, field `titre` invalid.
- `visibilite` not `publique`/`privee` → message `invalid`.
- `description` trimmed, sent only when not empty.
- `create` result: `ok` → redirect `/questionnaires/<documentId>`; `session` → redirect
  `/login`; `invalid` → message `invalid` (titre marked invalid); `forbidden` → message
  `forbidden`; `unavailable` → message `unavailable`.
- The state always carries back `titre`, `description` and `visibilite` as typed.

Messages (`lib/creation-state.ts`, `CREATION_MESSAGES`):
- `missing-titre`: « Donnez un titre à votre questionnaire. »
- `invalid`: « Vérifiez le titre et la visibilité. »
- `forbidden`: « Seuls les auteurs peuvent créer un questionnaire. »
- `unavailable`: `LOGIN_MESSAGES.unavailable` (same sentence).

`actions.ts` (`'use server'`) reads `qp_access` from `cookies()`, calls `submitCreation`, and
calls `redirect()` on a redirect outcome.

### 4.5 Creation page (`/questionnaires/create`)

- Administrateur (from `currentAuthorGate`): a pencil line « La création de questionnaires est
  réservée aux auteurs. » and an ink link « Retour à mes questionnaires ».
- Auteur: headline « Nouveau questionnaire », then `CreationFormView` in a `max-w-md` column:
  - `AnnotationErreur` above the fields when there is a message (login rule).
  - Titre: `ChampLigne` extended with `type: 'text'`, `required`, `maxLength` 255;
    `aria-invalid` only for `missing-titre` and `invalid`.
  - Description: new `ChampLignes` — a 3-row textarea, paper background with a 32 px ruled
    line under each text line (`repeating-linear-gradient`), vertical resize, label
    « Description (facultatif) ».
  - Visibilité: new `ChoixCases` — `fieldset` + `legend` styled as a field label, two lines on
    the ruling, native radios with `accent-color` ink: « Publique — toute personne ayant le
    lien » (checked by default) and « Privée — uniquement les personnes invitées ».
  - Two ruling lines lower: primary ink button « Créer le brouillon » (pending: « Création… »,
    disabled, `cursor: wait`) and, to its right, the ink link « Annuler » to `/questionnaires`.

### 4.6 Draft page (`/questionnaires/[id]`)

- `getMine(access, params.id)`: `not-found` → `notFound()`; `session` → `redirect('/login')`;
  `unavailable` → `AnnotationErreur` with « Réessayer » linking to the same page.
- Found:
  - Ink link « ← Mes questionnaires ».
  - Headline: the full title, wrapped on the ruling, never truncated.
  - One line: `TamponStatut`, then the visibility in soft graphite (« Publique — lien ouvert »,
    « Privée — sur invitation »).
  - Description in body type with `whitespace-pre-line`; nothing when absent.
  - Section « Questions » with the margin label « QUESTIONS » on its line.
    - Empty: pencil line « Aucune question pour l'instant. »
    - Otherwise a list numbered in the margin: text, type in soft graphite (« Échelle de
      Likert », « Choix multiple », « Texte libre »), « obligatoire » when set. Read-only.
- `not-found.tsx`: on the sheet, « Ce questionnaire n'existe pas ou ne vous appartient pas. »
  and an ink link back to `/questionnaires`.

### 4.7 Table of contents changes

- `Sommaire` titles become `<a href="/questionnaires/<documentId>">` (ink-dark on hover) with a
  `title` attribute carrying the full title.
- `page.tsx` shows « + Nouveau questionnaire » under the headline for an `auteur` only.
- The empty state line stays and is followed by the creation link for an `auteur`.

### 4.8 Accessibility

One `h1` per page; `aria-describedby` from each invalid field to the annotation; the visibility
group is a `fieldset`/`legend`; focus circle and 120 ms colour transitions as in `DESIGN.md`,
0 ms under `prefers-reduced-motion`.

## 5. Tests (written first — Constitution I)

Vitest, node environment, `renderToStaticMarkup` for components, as in T063:

- `tests/unit/questionnaireService.test.ts`: create → 201/400/401/403/500/network, body shape
  (description omitted when empty), Bearer header; getMine → 200 mapping and question order
  preserved, 404, 403, 401, 5xx, encoded id.
- `tests/unit/create-questionnaire.test.ts`: empty title, invalid visibility, each `create`
  reason, redirect targets, typed values carried back.
- `lib/current-author.ts` has no unit test: React `cache()` only memoises inside a server
  render, so a Vitest call cannot observe it; `gateAuthor` stays covered by its own tests, and
  the live check confirms the pages render with the author's role.
- `tests/unit/components.test.tsx` (extended): `CreationFormView` (default radio, pending label,
  annotation + `aria-invalid` + `aria-describedby`, typed values restored), `ChampLignes`,
  `ChoixCases`, draft view (stamp, visibility label, empty questions line, numbered questions,
  type labels), `Sommaire` links and `title`.

The live check under `docker compose -p devops2-check` walks: login → « Nouveau questionnaire »
→ empty title error → create → draft page → back to the list with the new brouillon linked.

## 6. Documentation

- `DESIGN.md`: `ChampLignes`, `ChoixCases`, the draft page and the linked table of contents;
  remove the « no `title` attribute » limitation for questionnaire titles.
- `tasks.md`: T022 `[X]` with a Done note (draft page added, `questionnaireService.ts` started
  for T024).
- `CLAUDE.md` "Current state": T022 done, the three routes.

## 7. Out of scope

- Adding, reordering or deleting questions (T023, T064); publish/close buttons (T024).
- Editing title, description or visibility after creation (no route exists).
- Image upload (T068).
