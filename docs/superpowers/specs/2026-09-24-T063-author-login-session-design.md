# T063 — Author login page, authenticated session, and the author-space visual world

**Date:** 2026-09-24 · **Status:** approved in brainstorming, pending written-spec review
**Task:** `specs/001-questionnaire-platform/tasks.md` T063 (User Story 1). Jira: D2-73.
**Binding context:** `spec.md` User Story 1 (AC1), FR-016; `contracts/api.md` (US1 amendment,
T077 `mes-questionnaires` amendment); `.specify/memory/constitution.md` v1.2.0 (I Test-First,
II YAGNI, IV Sécurité par défaut, V Observabilité); `PRODUCT.md` (impeccable product context);
T062 (`ROLE_PERMISSIONS`, `DEV_AUTEUR_*` account), T060 (`frontend/lib/logger.ts`), T077
(`GET /api/mes-questionnaires`).

## 1. Problem

No frontend page exists yet: `frontend/app/page.tsx` is still the `create-next-app` page and
nothing lets an `auteur` authenticate. Every US1 screen (T022 creation, T023 editor, T024
publish/close) needs an authenticated author and a place to land. T063 is also the first real
UI of the product, so it sets the visual world every later author-space surface inherits;
`DESIGN.md` does not exist yet.

The backend runs users-permissions in **refresh mode** (`backend/config/plugins.ts`:
`jwtManagement: 'refresh'`, `sessions.httpOnly: true`). Verified in Strapi 5.54's source:
- `POST /api/auth/local` returns `{ jwt, user }`; `jwt` is an **access token of 10 minutes**
  (`DEFAULT_ACCESS_TOKEN_LIFESPAN`); the **refresh token** (idle 14 days, max 30 days) is only
  sent as the `Set-Cookie` `strapi_up_refresh` (httpOnly), never in the body.
- `POST /api/auth/refresh` reads that cookie (or `body.refreshToken`), **rotates** it (new
  `Set-Cookie`) and returns a new `jwt`; 401 when invalid.
- `POST /api/auth/logout` revokes the session server side, but its action
  `plugin::users-permissions.auth.logout` is granted by default only to the `authenticated`
  role — not to `auteur` or `administrateur`, so today an auteur's logout would answer 403.
- The login response's `user` does not carry the role; `GET /api/users/me?populate=role` does
  (`auteur` and `administrateur` hold `user.me` and `role.find`, T062).

## 2. Goals and success criteria

- An `auteur` or `administrateur` signs in at `/login` with email and password and lands on
  `/questionnaires`; a `repondant` (or any other role) is refused with a clear message and no
  session is left behind.
- The browser never holds a Strapi token: tokens live in httpOnly cookies owned by the Next.js
  server (BFF), and only the Next.js server calls Strapi.
- A session survives the 10-minute access token transparently (refresh before rendering) and
  ends on logout (revoked in Strapi) or when the refresh token is refused.
- `/questionnaires` shows the author's name, a logout control, and "Mes questionnaires" from
  `GET /api/mes-questionnaires`, with empty and error states.
- The author space has a committed, documented visual world ("Cahier Seyès"), recorded as a
  direction contract before code and as `DESIGN.md` at the end.

## 3. Decisions

| # | Decision | Rejected alternatives |
|---|----------|-----------------------|
| D1 | Scope: T063 (login + session + minimal author home) **and** the visual world for the whole author space; only T063's surfaces are built. | T063 alone with the world extended task by task; skipping to T022. |
| D2 | BFF: Next.js server actions and server components call Strapi; tokens in httpOnly cookies set by Next.js. | JWT in `localStorage` with direct browser calls (XSS-readable token, CORS); Auth.js credentials provider (extra dependency for one login). |
| D3 | Keep Strapi refresh mode; store access and refresh tokens in two cookies; `proxy.ts` refreshes before rendering; logout revokes in Strapi (grant `auth.logout` to `auteur`/`administrateur`). | Switch Strapi to `legacy-support` 30-day JWT (logout cannot revoke; a stolen token lives 30 days); access token only (re-login every 10 minutes). |
| D4 | After login: a protected `/questionnaires` author home with header (name, logout) and the "Mes questionnaires" list. No link or button to pages that do not exist yet ("Nouveau questionnaire" arrives with T022). | An empty protected shell; redirecting to the future `/questionnaires/create`. |
| D5 | Only `auteur` and `administrateur` may open a session; any other role is refused at login and its fresh Strapi session is revoked immediately. | Opening a session for any valid account and letting later calls fail with 403. |
| D6 | Visual world "Cahier Seyès" (impeccable direction round, seed `8d74740c`, assigned direction, chosen by the user), light theme only. | "Fiche de séance" (impeccable's pick), "Polycopié" (competitive challenger), the category-standard SaaS look; declined challengers: Orizuru, convention catalog, drum machine, Datamatics, rain garden. |

## 4. Session architecture

### 4.1 Units

| Unit | Responsibility |
|------|----------------|
| `frontend/services/strapi.ts` | Server-only `fetch` to `process.env.STRAPI_URL` (new, server-only variable; `http://backend:1337` in Docker Compose). Returns the raw `Response`; throws a typed "unavailable" error on network failure. |
| `frontend/services/authService.ts` | `login(email, password)`, `refresh(refreshToken)`, `logout(accessToken, refreshToken)`, `currentUser(accessToken)`. Returns typed results: `{ ok: true, tokens, user }` or `{ ok: false, reason: 'invalid' \| 'forbidden-role' \| 'unavailable' }`. Reads the refresh token from the response's `Set-Cookie` (`strapi_up_refresh`) with `headers.getSetCookie()`. |
| `frontend/lib/session-cookies.ts` | Cookie names and options: access cookie (`maxAge` from the JWT `exp`, 10 minutes by default), refresh cookie (`maxAge` 30 days); `httpOnly`, `sameSite: 'lax'`, `path: '/'`, `secure` only when `NODE_ENV === 'production'`. Helpers to write both and clear both. |
| `frontend/lib/session-decision.ts` | Pure `decide({ access, refresh, now })` → `'pass' \| 'refresh' \| 'login'`: no refresh cookie → `login`; access present and `exp` more than 30 s ahead → `pass`; otherwise → `refresh`. |
| `frontend/proxy.ts` | Next 16 proxy (Node runtime), matcher `/questionnaires/:path*`. Applies `decide`: `login` → redirect `/login`; `refresh` → `authService.refresh`; success writes both cookies on the response **and** on the forwarded request (so the render reads the new access token); failure clears both cookies and redirects to `/login`. |
| `frontend/app/login/page.tsx` + `actions.ts` + `LoginForm.tsx` | Server page (redirects to `/questionnaires` when a valid session already exists); client form with `useActionState`; server action `loginAction` wraps the pure `authenticate(formData, deps)` which validates input, calls `authService.login`, and returns the form state (message, submitted email kept) or writes cookies and `redirect('/questionnaires')`. |
| `frontend/app/questionnaires/layout.tsx` | Server layout: `currentUser(access)`; `null` → `redirect('/login')`; renders the author header (name, "Se déconnecter" form bound to `logoutAction`). |
| `frontend/app/questionnaires/page.tsx` | Server page: `GET /api/mes-questionnaires` with the access token; renders `Sommaire` (list, empty, or error state). |
| `frontend/app/questionnaires/actions.ts` | `logoutAction`: `authService.logout`, clear cookies, `redirect('/login')` (cookies cleared even if Strapi is unreachable). |
| `frontend/app/page.tsx` | Replaced: `redirect('/questionnaires')`. |
| `frontend/components/` | `TamponStatut`, `Sommaire`, `Feuille` (ruled sheet with margin), `ChampLigne` (ruled-line input), `AnnotationErreur`; presentational, no data fetching. |

Existing empty placeholders `app/questionnaires/create/.gitkeep` and
`app/questionnaires/[id]/results/.gitkeep` stay; the new layout will protect them when they
become pages.

### 4.2 Flows

- **Login:** form → `loginAction` → `POST /api/auth/local` → 400 → `invalid`; network error or
  5xx → `unavailable` (logged); 200 → `GET /api/users/me?populate=role` with the new access
  token → role type not in `{auteur, administrateur}` → `POST /api/auth/logout` with that
  session (best effort) → `forbidden-role`; allowed → write both cookies → redirect.
- **Navigation:** proxy `decide` → pass / refresh (rotate, rewrite cookies) / redirect login.
- **Logout:** `logoutAction` → `POST /api/auth/logout` with `Authorization: Bearer <access>`
  and `Cookie: strapi_up_refresh=<refresh>` → clear cookies → redirect `/login`.

### 4.3 Messages (French, exact)

- invalid: « Email ou mot de passe incorrect. »
- forbidden-role: « Ce compte n'a pas accès à l'espace auteur. »
- unavailable: « Le service est momentanément indisponible. Réessayez dans un instant. »
- empty email or password (client and server): « Renseignez votre email et votre mot de passe. »
- list error: « Impossible de charger vos questionnaires. » with a « Réessayer » link to
  `/questionnaires`.
- empty list: « Vos questionnaires apparaîtront ici. »

### 4.4 Security and observability

- Tokens never reach client JavaScript, the DOM, logs, or error messages; the password is never
  logged. `lib/logger` records `auth.login.unavailable`, `auth.refresh.failed` and
  `auth.logout.failed` events with status codes only.
- No open redirect: login always redirects to `/questionnaires` (no `next` parameter — YAGNI).
- Strapi's own auth rate limit (10 requests / minute) stays the brute-force guard.

### 4.5 Backend change

`ROLE_PERMISSIONS` gains `plugin::users-permissions.auth.logout` for `auteur` and
`administrateur`. `repondant` stays `[]`.

### 4.6 Configuration

- `STRAPI_URL` (server-only): `.env.example` documents it; `docker-compose.yml` sets
  `STRAPI_URL: http://backend:1337` on `frontend`. `NEXT_PUBLIC_API_BASE_URL` is unchanged.
- `<html lang="fr">`; metadata title « Espace auteur — Questionnaires ».

## 5. Visual world — "Cahier Seyès"

Mode: **Operate** (the author completes a task; clarity outranks expression, brand lives in
details). Scene: the instructor prepares at a desk, on a laptop, in daylight → light theme
only, no dark mode. Anti-goals set by the user: no "hacker" look (dark ground, neon, mono
everywhere), no Google Forms clone (violet, centred card).

- **Material and palette (total commitment, nothing outside the notebook):** paper `#FBFBF8`
  (near white, not cream); Seyès ruling — fine lines every 8 px `#DCE3F3`, strong lines every
  32 px `#B9C6E8`, faint verticals every 32 px — on sheets only, never under control text; red
  margin rule 2 px `#D8343A` full height as the structural rail; ink blue `#1F3FA8` for actions
  and focus; graphite `#2B2B2B` text, `#5B5F6B` secondary; red pen `#C62828` for errors only.
- **Type:** one workhorse family, Atkinson Hyperlegible Next via `next/font`; vertical rhythm
  on the ruling (32 px lines, 17 px body), tabular numerals for numbering; no school cursive.
- **State vocabulary (raises from the direction round):**
  - one colour law per statut, everywhere — stamps: *brouillon* pencil graphite, dashed border,
    lowercase; *PUBLIÉ* ink blue, solid border, slight tilt; *FERMÉ* grey stamp;
  - state is marked as with a pen: focus = the control circled in ink;
  - lifecycle steps stay visible (applies to later detail surfaces: the brouillon → publié →
    fermé trail is never erased);
  - an empty state is an invitation (a ruled page ready to write), never an apology;
  - total palette commitment.
- **Controls:** fields are written on a ruling line (2 px graphite baseline, ink on focus), label
  above; primary button solid ink with paper text; links in ink.
- **Errors:** red-pen annotation, with a "!" mark in the margin aligned to its line.
- **First viewports:**
  - `/login`: a full-viewport ruled sheet; the margin carries « Espace auteur »; a ~28 rem
    column: « Connexion » written on the line, Email, Mot de passe, « Se connecter » in solid
    ink.
  - `/questionnaires`: margin « Espace auteur »; header line with the author's name and « Se
    déconnecter »; title « Mes questionnaires »; the list as a table of contents — number in the
    margin, titre, dotted leader, statut stamp, « modifié le … » small.
- **Motion:** 120 ms colour transitions, 1 px button press, `prefers-reduced-motion` honoured.
- **Responsive:** below 640 px the margin narrows to 20 px and margin labels move above the
  column; the ruling stays.
- **Impeccable process:** the direction contract (THESIS, OWN-WORLD, STORY, FIRST VIEWPORT,
  FORM with seed key `8d74740c`, FINISH) is written to the surface brief with
  `impeccable surface-brief write` before any UI code; `reference/craft-floor.md` is read before
  UI edits; `impeccable detect` runs once on the finished UI; `DESIGN.md` is written at the end
  from the built world. The contract never enters source code or anything served to the
  browser.

## 6. Tests (written first — Constitution I)

Frontend (Vitest, existing harness, no new dependency):
- `authService`: login success (refresh token read from `Set-Cookie`), 400 → `invalid`,
  `repondant` → logout called then `forbidden-role`, network error and 5xx → `unavailable`;
  refresh success and 401; logout sends bearer and refresh cookie; `currentUser`.
- `session-cookies`: options per environment, `maxAge` from JWT `exp`, clear.
- `session-decision`: `pass` / `refresh` / `login` including the 30 s skew and a malformed
  token.
- `authenticate`: empty fields, each failure message, success writes cookies and redirects.
- Components with `react-dom/server` `renderToStaticMarkup`: `TamponStatut` (three statuts),
  `Sommaire` (order, empty, error), `LoginForm` (three messages, labels bound to inputs).

Backend (Jest): `role_permissions` covers the new grant; a contract test proves an `auteur`
logged in through `POST /api/auth/local` gets 200 on `POST /api/auth/logout` and that the
revoked refresh token then fails on `POST /api/auth/refresh`.

Gates: frontend and backend `build`, `lint`, `format:check`, `test`; `tests/structure/*.sh`
(extended for `STRAPI_URL`).

Live check (`docker compose -p devops2-check`, only if ports 1337/3000/5432 are free, ending
with `down -v` of that project only): `/login` → 200; `/questionnaires` without cookies →
redirect to `/login`; `authService` login / refresh / logout against the real Strapi with the
`DEV_AUTEUR_*` account.

No browser exists in this environment, so no screenshots: the user checks the rendering
(desktop and mobile) against a checklist delivered at the end.

## 7. Out of scope

- Questionnaire creation, editing, publish/close UI (T022–T024) and the respondent pages.
- Password reset, account creation, session list management, "remember me".
- A dark theme.
