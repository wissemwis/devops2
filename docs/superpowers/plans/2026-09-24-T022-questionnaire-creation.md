# T022 — Questionnaire creation page and draft page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An `auteur` creates a `brouillon` questionnaire from `/questionnaires/create`, lands on its draft page `/questionnaires/[id]`, and finds every questionnaire linked from « Mes questionnaires ».

**Architecture:** Same shape as T063's `/login`: a server action (`useActionState`) delegates to a pure `submitCreation(formData, deps)`, which calls a server-only Strapi client `services/questionnaireService.ts` (`createQuestionnaire`, `getMine`). Pages are Server Components under the existing `app/questionnaires/layout.tsx` (author gate, header line, `proxy.ts` refresh); the author read is memoised per request with React `cache()` so pages can check the role without a second `/users/me` call. Presentational components are pure and rendered in tests with `renderToStaticMarkup`.

**Tech Stack:** Next.js 16.3.5 App Router, React 19.2.8, TypeScript, Tailwind v4 (`@theme` tokens in `app/globals.css`), Vitest 4 (node environment).

**Spec:** `docs/superpowers/specs/2026-09-24-T022-questionnaire-creation-design.md`

## Global Constraints

- **No comments in code** (`//`, `/* */`, JSDoc) in any source, test or CSS file — `CLAUDE.md`.
- All UI copy is French and exact, as written in this plan (typographic apostrophe is the ASCII `'`, em dash `—`, arrow `←`, ellipsis `…`).
- Only the Cahier Seyès tokens exist: `papier`, `reglure`, `reglure-forte`, `marge`, `encre`, `encre-sombre`, `graphite`, `graphite-doux`, `crayon`, `tampon`, `stylo-rouge`; every line box is 32 px (`leading-[32px]`, `h-ligne`, `mt-ligne`); colour transitions are `duration-[120ms]`.
- Every actionable element is ink blue (`text-encre` / `bg-encre`) and carries the `entoure` class (focus circle).
- Strapi is only reached through `strapiFetch` (`services/strapi.ts`); `StrapiUnavailableError` means 429, 5xx, network failure or missing `STRAPI_URL`.
- Access token cookie name comes from `ACCESS_COOKIE` (`lib/session-cookies.ts`), never a string literal in app code.
- Logs go through `logger` (`lib/logger.ts`) with an event name and `{ status }`; never log a token.
- Node for every command: `export PATH=/tmp/claude-1000/-project-devops2/f0c0f41e-6d12-45e7-a390-b175e6f2473f/scratchpad/node-v22.12.0-linux-x64/bin:$PATH`, then run from `/project/devops2/frontend`.
- Never stage `.env*` (except `.env.example`) or `.superpowers/`. Commit messages end with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_018oex3Jpgz8jfd3XAQ58F4t
  ```

## Review Focus

- A title made only of spaces must be refused as missing (browser `required` lets it through) — tested in Task 2.
- A draft URL with a non-alphanumeric id (`..`, `a/b`, `%2e%2e`) must be treated as not found without any Strapi call, so the Bearer token never reaches another backend path — tested in Task 1.
- An `administrateur` posting the form directly (bypassing the hidden link) gets the « réservée aux auteurs » annotation from Strapi's `403`, not a crash — tested in Tasks 2 and 4.
- An expired session during the action (no access cookie, or Strapi `401`) redirects to `/login` instead of showing a form error — tested in Task 2.
- A long title or a multi-line description is shown whole on the draft page (wrapped, line breaks kept), never truncated — tested in Task 5.

---

### Task 1: Strapi client `services/questionnaireService.ts`

**Files:**
- Create: `frontend/services/questionnaireService.ts`
- Test: `frontend/tests/unit/questionnaireService.test.ts`

**Interfaces:**
- Consumes: `strapiFetch(path, init)`, `StrapiUnavailableError` (`services/strapi.ts`); `Statut` (`services/mesQuestionnaires.ts`); `logger` (`lib/logger.ts`).
- Produces:
  ```ts
  export type Visibilite = 'publique' | 'privee';
  export type QuestionType = 'likert' | 'choix_multiple' | 'texte_libre';
  export type NewQuestionnaire = { titre: string; description: string; visibilite: Visibilite };
  export type CreateFailure = 'invalid' | 'session' | 'forbidden' | 'unavailable';
  export type CreateResult = { ok: true; documentId: string } | { ok: false; reason: CreateFailure };
  export type QuestionLue = { documentId: string; texte: string; type: QuestionType; position: number; obligatoire: boolean };
  export type QuestionnaireLu = { documentId: string; titre: string; description: string | null; statut: Statut; visibilite: Visibilite; questions: QuestionLue[] };
  export type Lecture = { kind: 'found'; questionnaire: QuestionnaireLu } | { kind: 'not-found' } | { kind: 'session' } | { kind: 'unavailable' };
  export function createQuestionnaire(access: string, input: NewQuestionnaire): Promise<CreateResult>;
  export function getMine(access: string, documentId: string): Promise<Lecture>;
  ```

- [ ] **Step 1: Write the failing test**

`frontend/tests/unit/questionnaireService.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQuestionnaire, getMine } from '@/services/questionnaireService';

let write: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.stubEnv('STRAPI_URL', 'http://backend:1337');
  write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  write.mockRestore();
});

function logged(): string {
  return write.mock.calls.map((call: unknown[]) => String(call[0])).join('');
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function stubFetch(response: Response | Error) {
  const fetchMock =
    response instanceof Error
      ? vi.fn().mockRejectedValue(response)
      : vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const INPUT = { titre: 'Retour séance 5', description: 'Dix minutes.', visibilite: 'publique' as const };

describe('createQuestionnaire', () => {
  it('posts the questionnaire with the bearer token and returns its documentId on 201', async () => {
    const fetchMock = stubFetch(
      json({ data: { id: 3, documentId: 'abc123', titre: 'Retour séance 5' }, meta: {} }, 201),
    );

    expect(await createQuestionnaire('access-1', INPUT)).toEqual({ ok: true, documentId: 'abc123' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://backend:1337/api/questionnaires');
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer access-1');
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json');
    expect(JSON.parse(String(init.body))).toEqual({ data: INPUT });
  });

  it('omits an empty description', async () => {
    const fetchMock = stubFetch(json({ data: { documentId: 'abc123' } }, 201));

    await createQuestionnaire('access-1', { ...INPUT, description: '' });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      data: { titre: 'Retour séance 5', visibilite: 'publique' },
    });
  });

  it('maps 400, 401 and 403 to their reasons', async () => {
    stubFetch(json({ error: { status: 400 } }, 400));
    expect(await createQuestionnaire('access-1', INPUT)).toEqual({ ok: false, reason: 'invalid' });

    stubFetch(json({ error: { status: 401 } }, 401));
    expect(await createQuestionnaire('access-1', INPUT)).toEqual({ ok: false, reason: 'session' });

    stubFetch(json({ error: { status: 403 } }, 403));
    expect(await createQuestionnaire('access-1', INPUT)).toEqual({
      ok: false,
      reason: 'forbidden',
    });
  });

  it('returns unavailable on 5xx, network failure, an unexpected status or a 201 without documentId, and logs it', async () => {
    for (const response of [
      json({}, 503),
      new TypeError('fetch failed'),
      json({}, 404),
      json({ data: {} }, 201),
    ]) {
      stubFetch(response);
      expect(await createQuestionnaire('access-1', INPUT)).toEqual({
        ok: false,
        reason: 'unavailable',
      });
    }
    expect(logged()).toContain('questionnaire.create.failed');
    expect(logged()).not.toContain('access-1');
  });
});

describe('getMine', () => {
  const body = {
    data: {
      id: 3,
      documentId: 'abc123',
      titre: 'Retour séance 5',
      description: 'Ligne 1\nLigne 2',
      statut: 'brouillon',
      visibilite: 'privee',
      createdAt: '2026-09-24T08:00:00.000Z',
      updatedAt: '2026-09-24T08:00:00.000Z',
      questions: [
        {
          id: 1,
          documentId: 'q1',
          texte: 'Rythme ?',
          type: 'likert',
          position: 1,
          obligatoire: true,
          options: null,
          image: null,
        },
        {
          id: 2,
          documentId: 'q2',
          texte: 'Remarques',
          type: 'texte_libre',
          position: 2,
          obligatoire: false,
          options: null,
          image: null,
        },
      ],
    },
    meta: {},
  };

  it('reads the questionnaire with the bearer token and keeps the question order', async () => {
    const fetchMock = stubFetch(json(body, 200));

    expect(await getMine('access-1', 'abc123')).toEqual({
      kind: 'found',
      questionnaire: {
        documentId: 'abc123',
        titre: 'Retour séance 5',
        description: 'Ligne 1\nLigne 2',
        statut: 'brouillon',
        visibilite: 'privee',
        questions: [
          { documentId: 'q1', texte: 'Rythme ?', type: 'likert', position: 1, obligatoire: true },
          {
            documentId: 'q2',
            texte: 'Remarques',
            type: 'texte_libre',
            position: 2,
            obligatoire: false,
          },
        ],
      },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend:1337/api/mes-questionnaires/abc123',
      expect.objectContaining({ headers: { Authorization: 'Bearer access-1' } }),
    );
  });

  it('reads a missing description as null and missing questions as an empty list', async () => {
    stubFetch(
      json(
        {
          data: {
            documentId: 'abc123',
            titre: 'T',
            statut: 'publie',
            visibilite: 'publique',
          },
        },
        200,
      ),
    );

    expect(await getMine('access-1', 'abc123')).toEqual({
      kind: 'found',
      questionnaire: {
        documentId: 'abc123',
        titre: 'T',
        description: null,
        statut: 'publie',
        visibilite: 'publique',
        questions: [],
      },
    });
  });

  it('treats 404 and 403 as not found and 401 as an expired session', async () => {
    stubFetch(json({}, 404));
    expect(await getMine('access-1', 'abc123')).toEqual({ kind: 'not-found' });

    stubFetch(json({}, 403));
    expect(await getMine('access-1', 'abc123')).toEqual({ kind: 'not-found' });

    stubFetch(json({}, 401));
    expect(await getMine('access-1', 'abc123')).toEqual({ kind: 'session' });
  });

  it('returns unavailable on 5xx, network failure or an unexpected status, and logs it', async () => {
    for (const response of [json({}, 500), new TypeError('fetch failed'), json({}, 418)]) {
      stubFetch(response);
      expect(await getMine('access-1', 'abc123')).toEqual({ kind: 'unavailable' });
    }
    expect(logged()).toContain('questionnaire.read.failed');
    expect(logged()).not.toContain('access-1');
  });

  it('never calls Strapi for an id that is not alphanumeric', async () => {
    const fetchMock = stubFetch(json(body, 200));

    for (const id of ['..', 'a/b', '%2e%2e', 'abc 123', '']) {
      expect(await getMine('access-1', id)).toEqual({ kind: 'not-found' });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/questionnaireService.test.ts`
Expected: FAIL — cannot resolve `@/services/questionnaireService`.

- [ ] **Step 3: Write minimal implementation**

`frontend/services/questionnaireService.ts`:

```ts
import { logger } from '@/lib/logger';
import type { Statut } from './mesQuestionnaires';
import { StrapiUnavailableError, strapiFetch } from './strapi';

export type Visibilite = 'publique' | 'privee';
export type QuestionType = 'likert' | 'choix_multiple' | 'texte_libre';
export type NewQuestionnaire = { titre: string; description: string; visibilite: Visibilite };
export type CreateFailure = 'invalid' | 'session' | 'forbidden' | 'unavailable';
export type CreateResult = { ok: true; documentId: string } | { ok: false; reason: CreateFailure };
export type QuestionLue = {
  documentId: string;
  texte: string;
  type: QuestionType;
  position: number;
  obligatoire: boolean;
};
export type QuestionnaireLu = {
  documentId: string;
  titre: string;
  description: string | null;
  statut: Statut;
  visibilite: Visibilite;
  questions: QuestionLue[];
};
export type Lecture =
  | { kind: 'found'; questionnaire: QuestionnaireLu }
  | { kind: 'not-found' }
  | { kind: 'session' }
  | { kind: 'unavailable' };

type QuestionBody = Partial<QuestionLue>;
type QuestionnaireBody = Partial<Omit<QuestionnaireLu, 'questions'>> & {
  questions?: QuestionBody[];
};

const CREATE_FAILURES: Partial<Record<number, CreateFailure>> = {
  400: 'invalid',
  401: 'session',
  403: 'forbidden',
};

const DOCUMENT_ID = /^[a-z0-9]+$/i;

function bearer(access: string) {
  return { Authorization: `Bearer ${access}` };
}

function payload({ titre, description, visibilite }: NewQuestionnaire) {
  return description === '' ? { titre, visibilite } : { titre, description, visibilite };
}

export async function createQuestionnaire(
  access: string,
  input: NewQuestionnaire,
): Promise<CreateResult> {
  try {
    const response = await strapiFetch('/api/questionnaires', {
      method: 'POST',
      headers: { ...bearer(access), 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: payload(input) }),
    });
    if (response.status === 201) {
      const body = (await response.json()) as { data?: { documentId?: unknown } };
      const documentId = body.data?.documentId;
      if (typeof documentId === 'string') return { ok: true, documentId };
    }
    const reason = CREATE_FAILURES[response.status];
    if (reason) return { ok: false, reason };
    logger.warn('questionnaire.create.failed', { status: response.status });
    return { ok: false, reason: 'unavailable' };
  } catch (error) {
    if (!(error instanceof StrapiUnavailableError)) throw error;
    logger.warn('questionnaire.create.failed', { status: error.status });
    return { ok: false, reason: 'unavailable' };
  }
}

function toQuestion({ documentId, texte, type, position, obligatoire }: QuestionBody): QuestionLue {
  return {
    documentId: documentId ?? '',
    texte: texte ?? '',
    type: type ?? 'texte_libre',
    position: position ?? 0,
    obligatoire: obligatoire === true,
  };
}

function toQuestionnaire(data: QuestionnaireBody): QuestionnaireLu {
  return {
    documentId: data.documentId ?? '',
    titre: data.titre ?? '',
    description: data.description ?? null,
    statut: data.statut ?? 'brouillon',
    visibilite: data.visibilite ?? 'publique',
    questions: (data.questions ?? []).map(toQuestion),
  };
}

export async function getMine(access: string, documentId: string): Promise<Lecture> {
  if (!DOCUMENT_ID.test(documentId)) return { kind: 'not-found' };
  try {
    const response = await strapiFetch(`/api/mes-questionnaires/${documentId}`, {
      headers: bearer(access),
    });
    if (response.status === 404 || response.status === 403) return { kind: 'not-found' };
    if (response.status === 401) return { kind: 'session' };
    if (response.ok) {
      const body = (await response.json()) as { data?: QuestionnaireBody | null };
      if (body.data) return { kind: 'found', questionnaire: toQuestionnaire(body.data) };
    }
    logger.warn('questionnaire.read.failed', { status: response.status });
    return { kind: 'unavailable' };
  } catch (error) {
    if (!(error instanceof StrapiUnavailableError)) throw error;
    logger.warn('questionnaire.read.failed', { status: error.status });
    return { kind: 'unavailable' };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/questionnaireService.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/services/questionnaireService.ts frontend/tests/unit/questionnaireService.test.ts
git commit -m "T022: questionnaire service — create a draft and read one of mine"
```
(with the two trailer lines from Global Constraints)

---

### Task 2: Creation form state, `submitCreation` and the server action

**Files:**
- Create: `frontend/lib/creation-state.ts`
- Create: `frontend/lib/create-questionnaire.ts`
- Create: `frontend/app/questionnaires/create/actions.ts`
- Test: `frontend/tests/unit/create-questionnaire.test.ts`
- Test: `frontend/tests/unit/create-action.test.ts`

**Interfaces:**
- Consumes: `createQuestionnaire`, `CreateResult`, `NewQuestionnaire`, `Visibilite` (Task 1); `LOGIN_MESSAGES` (`lib/login-state.ts`); `ACCESS_COOKIE` (`lib/session-cookies.ts`).
- Produces:
  ```ts
  // lib/creation-state.ts
  export type CreationMessage = 'missing-titre' | 'invalid' | 'forbidden' | 'unavailable';
  export type CreationFormState = { message: CreationMessage | null; titre: string; description: string; visibilite: Visibilite };
  export const INITIAL_CREATION_STATE: CreationFormState;
  export const CREATION_MESSAGES: Record<CreationMessage, string>;
  export function titreInvalide(message: CreationMessage | null): boolean;
  // lib/create-questionnaire.ts
  export type SubmitCreationDeps = { access: string | undefined; create: (access: string, input: NewQuestionnaire) => Promise<CreateResult> };
  export type CreationOutcome = { kind: 'form'; state: CreationFormState } | { kind: 'redirect'; to: string };
  export function submitCreation(formData: FormData, deps: SubmitCreationDeps): Promise<CreationOutcome>;
  // app/questionnaires/create/actions.ts
  export async function createAction(previous: CreationFormState, formData: FormData): Promise<CreationFormState>;
  ```

- [ ] **Step 1: Write the failing tests**

`frontend/tests/unit/create-questionnaire.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { submitCreation } from '@/lib/create-questionnaire';
import {
  CREATION_MESSAGES,
  INITIAL_CREATION_STATE,
  titreInvalide,
} from '@/lib/creation-state';
import type { CreateResult } from '@/services/questionnaireService';

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

function creating(result: CreateResult) {
  return vi.fn().mockResolvedValue(result);
}

const FIELDS = { titre: '  Retour séance 5  ', description: '  Dix minutes.  ', visibilite: 'privee' };

describe('creation state', () => {
  it('holds the exact French messages and a public default', () => {
    expect(CREATION_MESSAGES).toEqual({
      'missing-titre': 'Donnez un titre à votre questionnaire.',
      invalid: 'Vérifiez le titre et la visibilité.',
      forbidden: 'Seuls les auteurs peuvent créer un questionnaire.',
      unavailable: 'Le service est momentanément indisponible. Réessayez dans un instant.',
    });
    expect(INITIAL_CREATION_STATE).toEqual({
      message: null,
      titre: '',
      description: '',
      visibilite: 'publique',
    });
  });

  it('marks the title invalid only for a title problem', () => {
    expect(titreInvalide('missing-titre')).toBe(true);
    expect(titreInvalide('invalid')).toBe(true);
    expect(titreInvalide('forbidden')).toBe(false);
    expect(titreInvalide('unavailable')).toBe(false);
    expect(titreInvalide(null)).toBe(false);
  });
});

describe('submitCreation', () => {
  it('creates the trimmed questionnaire and redirects to its draft page', async () => {
    const create = creating({ ok: true, documentId: 'abc123' });

    expect(await submitCreation(form(FIELDS), { access: 'access-1', create })).toEqual({
      kind: 'redirect',
      to: '/questionnaires/abc123',
    });
    expect(create).toHaveBeenCalledWith('access-1', {
      titre: 'Retour séance 5',
      description: 'Dix minutes.',
      visibilite: 'privee',
    });
  });

  it('refuses a title made only of spaces without calling Strapi, keeping what was typed', async () => {
    const create = creating({ ok: true, documentId: 'abc123' });

    expect(
      await submitCreation(form({ ...FIELDS, titre: '   ' }), { access: 'access-1', create }),
    ).toEqual({
      kind: 'form',
      state: {
        message: 'missing-titre',
        titre: '',
        description: 'Dix minutes.',
        visibilite: 'privee',
      },
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('refuses an unknown visibility without calling Strapi', async () => {
    const create = creating({ ok: true, documentId: 'abc123' });

    expect(
      await submitCreation(form({ ...FIELDS, visibilite: 'secrete' }), { access: 'access-1', create }),
    ).toEqual({
      kind: 'form',
      state: {
        message: 'invalid',
        titre: 'Retour séance 5',
        description: 'Dix minutes.',
        visibilite: 'publique',
      },
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('redirects to /login without a session or on an expired one', async () => {
    const create = creating({ ok: true, documentId: 'abc123' });
    expect(await submitCreation(form(FIELDS), { access: undefined, create })).toEqual({
      kind: 'redirect',
      to: '/login',
    });
    expect(create).not.toHaveBeenCalled();

    expect(
      await submitCreation(form(FIELDS), {
        access: 'access-1',
        create: creating({ ok: false, reason: 'session' }),
      }),
    ).toEqual({ kind: 'redirect', to: '/login' });
  });

  it('turns every other refusal into its message, keeping what was typed', async () => {
    for (const reason of ['invalid', 'forbidden', 'unavailable'] as const) {
      expect(
        await submitCreation(form(FIELDS), {
          access: 'access-1',
          create: creating({ ok: false, reason }),
        }),
      ).toEqual({
        kind: 'form',
        state: {
          message: reason,
          titre: 'Retour séance 5',
          description: 'Dix minutes.',
          visibilite: 'privee',
        },
      });
    }
  });
});
```

`frontend/tests/unit/create-action.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { INITIAL_CREATION_STATE } from '@/lib/creation-state';

const jar = new Map<string, string>();
const redirect = vi.fn();
const createQuestionnaire = vi.fn();

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { value: jar.get(name) } : undefined),
  }),
}));
vi.mock('next/navigation', () => ({ redirect: (path: string) => redirect(path) }));
vi.mock('@/services/questionnaireService', () => ({
  createQuestionnaire: (access: string, input: unknown) => createQuestionnaire(access, input),
}));

const { createAction } = await import('@/app/questionnaires/create/actions');

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

beforeEach(() => {
  jar.clear();
  redirect.mockReset();
  createQuestionnaire.mockReset();
});

describe('createAction', () => {
  it('creates with the access cookie and redirects to the draft page', async () => {
    jar.set('qp_access', 'access-1');
    createQuestionnaire.mockResolvedValue({ ok: true, documentId: 'abc123' });

    await createAction(
      INITIAL_CREATION_STATE,
      form({ titre: 'Retour', description: '', visibilite: 'publique' }),
    );

    expect(createQuestionnaire).toHaveBeenCalledWith('access-1', {
      titre: 'Retour',
      description: '',
      visibilite: 'publique',
    });
    expect(redirect).toHaveBeenCalledWith('/questionnaires/abc123');
  });

  it('returns the form state on a refusal', async () => {
    jar.set('qp_access', 'access-1');
    createQuestionnaire.mockResolvedValue({ ok: false, reason: 'forbidden' });

    const state = await createAction(
      INITIAL_CREATION_STATE,
      form({ titre: 'Retour', description: '', visibilite: 'publique' }),
    );

    expect(state).toEqual({
      message: 'forbidden',
      titre: 'Retour',
      description: '',
      visibilite: 'publique',
    });
    expect(redirect).not.toHaveBeenCalled();
  });

  it('redirects to /login without an access cookie', async () => {
    await createAction(INITIAL_CREATION_STATE, form({ titre: 'Retour', visibilite: 'publique' }));

    expect(createQuestionnaire).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith('/login');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/create-questionnaire.test.ts tests/unit/create-action.test.ts`
Expected: FAIL — cannot resolve `@/lib/create-questionnaire`, `@/lib/creation-state`, `@/app/questionnaires/create/actions`.

- [ ] **Step 3: Write minimal implementation**

`frontend/lib/creation-state.ts`:

```ts
import type { Visibilite } from '@/services/questionnaireService';
import { LOGIN_MESSAGES } from './login-state';

export type CreationMessage = 'missing-titre' | 'invalid' | 'forbidden' | 'unavailable';

export type CreationFormState = {
  message: CreationMessage | null;
  titre: string;
  description: string;
  visibilite: Visibilite;
};

export const INITIAL_CREATION_STATE: CreationFormState = {
  message: null,
  titre: '',
  description: '',
  visibilite: 'publique',
};

export const CREATION_MESSAGES: Record<CreationMessage, string> = {
  'missing-titre': 'Donnez un titre à votre questionnaire.',
  invalid: 'Vérifiez le titre et la visibilité.',
  forbidden: 'Seuls les auteurs peuvent créer un questionnaire.',
  unavailable: LOGIN_MESSAGES.unavailable,
};

export function titreInvalide(message: CreationMessage | null): boolean {
  return message === 'missing-titre' || message === 'invalid';
}
```

`frontend/lib/create-questionnaire.ts`:

```ts
import type {
  CreateResult,
  NewQuestionnaire,
  Visibilite,
} from '@/services/questionnaireService';
import type { CreationFormState, CreationMessage } from './creation-state';

export type SubmitCreationDeps = {
  access: string | undefined;
  create: (access: string, input: NewQuestionnaire) => Promise<CreateResult>;
};

export type CreationOutcome =
  | { kind: 'form'; state: CreationFormState }
  | { kind: 'redirect'; to: string };

function isVisibilite(value: string): value is Visibilite {
  return value === 'publique' || value === 'privee';
}

export async function submitCreation(
  formData: FormData,
  deps: SubmitCreationDeps,
): Promise<CreationOutcome> {
  const titre = String(formData.get('titre') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const choix = String(formData.get('visibilite') ?? '');
  const visibilite: Visibilite = isVisibilite(choix) ? choix : 'publique';
  const refuse = (message: CreationMessage): CreationOutcome => ({
    kind: 'form',
    state: { message, titre, description, visibilite },
  });
  if (!deps.access) return { kind: 'redirect', to: '/login' };
  if (titre === '') return refuse('missing-titre');
  if (!isVisibilite(choix)) return refuse('invalid');
  const result = await deps.create(deps.access, { titre, description, visibilite });
  if (result.ok) return { kind: 'redirect', to: `/questionnaires/${result.documentId}` };
  if (result.reason === 'session') return { kind: 'redirect', to: '/login' };
  return refuse(result.reason);
}
```

`frontend/app/questionnaires/create/actions.ts`:

```ts
'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { submitCreation } from '@/lib/create-questionnaire';
import type { CreationFormState } from '@/lib/creation-state';
import { ACCESS_COOKIE } from '@/lib/session-cookies';
import { createQuestionnaire } from '@/services/questionnaireService';

export async function createAction(
  _previous: CreationFormState,
  formData: FormData,
): Promise<CreationFormState> {
  const access = (await cookies()).get(ACCESS_COOKIE)?.value;
  const outcome = await submitCreation(formData, { access, create: createQuestionnaire });
  if (outcome.kind === 'redirect') redirect(outcome.to);
  return outcome.state;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/create-questionnaire.test.ts tests/unit/create-action.test.ts`
Expected: PASS (7 + 3 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/creation-state.ts frontend/lib/create-questionnaire.ts frontend/app/questionnaires/create/actions.ts frontend/tests/unit/create-questionnaire.test.ts frontend/tests/unit/create-action.test.ts
git commit -m "T022: creation action — validate, create the draft, redirect to it"
```

---

### Task 3: Form components — `ChampLigne` text, `ChampLignes`, `ChoixCases`, `CreationFormView`

**Files:**
- Modify: `frontend/components/ChampLigne.tsx`
- Create: `frontend/components/ChampLignes.tsx`
- Create: `frontend/components/ChoixCases.tsx`
- Create: `frontend/components/CreationFormView.tsx`
- Modify: `frontend/app/globals.css` (add `.lignes`)
- Test: `frontend/tests/unit/creation-form.test.tsx`

**Interfaces:**
- Consumes: `CreationFormState`, `CREATION_MESSAGES`, `titreInvalide` (Task 2); `AnnotationErreur`.
- Produces:
  ```ts
  // ChampLigne props gain: type 'email' | 'password' | 'text'; maxLength?: number
  export function ChampLignes(props: { id: string; name: string; label: string; defaultValue?: string; rows?: number }): JSX.Element;
  export type Choix = { value: string; label: string };
  export function ChoixCases(props: { name: string; legend: string; choix: readonly Choix[]; defaultValue: string }): JSX.Element;
  export const VISIBILITES: readonly Choix[];
  export function CreationFormView(props: { state: CreationFormState; action: (formData: FormData) => void; pending: boolean }): JSX.Element;
  ```

- [ ] **Step 1: Write the failing test**

`frontend/tests/unit/creation-form.test.tsx`:

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ChampLignes } from '@/components/ChampLignes';
import { ChoixCases } from '@/components/ChoixCases';
import { CreationFormView } from '@/components/CreationFormView';
import { CREATION_MESSAGES, INITIAL_CREATION_STATE } from '@/lib/creation-state';

function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replaceAll('&#x27;', "'");
}

const noop = () => undefined;

describe('ChampLignes', () => {
  it('renders a labelled ruled textarea with its value', () => {
    const html = renderToStaticMarkup(
      <ChampLignes id="description" name="description" label="Description" defaultValue="Bonjour" />,
    );

    expect(html).toMatch(/<label[^>]*for="description"[^>]*>Description<\/label>/);
    expect(html).toMatch(/<textarea[^>]*id="description"[^>]*name="description"[^>]*rows="3"/);
    expect(html).toContain('lignes');
    expect(html).toContain('>Bonjour</textarea>');
  });
});

describe('ChoixCases', () => {
  it('renders a legend and one labelled radio per choice, the default checked', () => {
    const html = renderToStaticMarkup(
      <ChoixCases
        name="couleur"
        legend="Couleur"
        choix={[
          { value: 'bleu', label: 'Bleu' },
          { value: 'rouge', label: 'Rouge' },
        ]}
        defaultValue="rouge"
      />,
    );

    expect(html).toMatch(/<fieldset[^>]*>\s*<legend[^>]*>Couleur<\/legend>/);
    expect(html).toMatch(/<input[^>]*id="couleur-bleu"[^>]*type="radio"[^>]*name="couleur"[^>]*value="bleu"/);
    expect(html).toMatch(/<label[^>]*for="couleur-bleu"[^>]*>Bleu<\/label>/);
    expect(html).toMatch(/<input[^>]*id="couleur-rouge"[^>]*checked=""/);
    expect(html).not.toMatch(/<input[^>]*id="couleur-bleu"[^>]*checked=""/);
  });
});

describe('CreationFormView', () => {
  it('renders the title, description and visibility fields with Publique checked', () => {
    const html = renderToStaticMarkup(
      <CreationFormView state={INITIAL_CREATION_STATE} action={noop} pending={false} />,
    );
    const content = text(html);

    expect(html).toMatch(/<label[^>]*for="titre"[^>]*>Titre<\/label>/);
    expect(html).toMatch(/<input[^>]*id="titre"[^>]*type="text"[^>]*maxLength="255"/i);
    expect(html).toMatch(/<input[^>]*id="titre"[^>]*required=""/);
    expect(html).toMatch(/<label[^>]*for="description"[^>]*>Description \(facultatif\)<\/label>/);
    expect(content).toContain('Visibilité');
    expect(content).toContain('Publique — toute personne ayant le lien');
    expect(content).toContain('Privée — uniquement les personnes invitées');
    expect(html).toMatch(/<input[^>]*id="visibilite-publique"[^>]*checked=""/);
    expect(content).toContain('Créer le brouillon');
    expect(html).toMatch(/<a[^>]*href="\/questionnaires"[^>]*>Annuler<\/a>/);
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('aria-invalid');
  });

  it('shows each message as an alert and keeps the typed values', () => {
    for (const message of Object.keys(CREATION_MESSAGES) as (keyof typeof CREATION_MESSAGES)[]) {
      const html = renderToStaticMarkup(
        <CreationFormView
          state={{ message, titre: 'Retour', description: 'Dix minutes.', visibilite: 'privee' }}
          action={noop}
          pending={false}
        />,
      );

      expect(html).toContain('role="alert"');
      expect(text(html)).toContain(CREATION_MESSAGES[message]);
      expect(html).toContain('value="Retour"');
      expect(html).toContain('>Dix minutes.</textarea>');
      expect(html).toMatch(/<input[^>]*id="visibilite-privee"[^>]*checked=""/);
    }
  });

  it('marks the title invalid and tied to the alert only for a title problem', () => {
    const titre = renderToStaticMarkup(
      <CreationFormView
        state={{ ...INITIAL_CREATION_STATE, message: 'missing-titre' }}
        action={noop}
        pending={false}
      />,
    );
    const service = renderToStaticMarkup(
      <CreationFormView
        state={{ ...INITIAL_CREATION_STATE, message: 'unavailable' }}
        action={noop}
        pending={false}
      />,
    );

    expect(titre).toMatch(/<input[^>]*id="titre"[^>]*aria-invalid="true"[^>]*aria-describedby="creation-erreur"/);
    expect(service).not.toContain('aria-invalid');
  });

  it('disables the button and changes its label while pending', () => {
    const html = renderToStaticMarkup(
      <CreationFormView state={INITIAL_CREATION_STATE} action={noop} pending={true} />,
    );

    expect(html).toMatch(/<button[^>]*disabled=""/);
    expect(text(html)).toContain('Création…');
    expect(text(html)).not.toContain('Créer le brouillon');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/creation-form.test.tsx`
Expected: FAIL — cannot resolve `@/components/ChampLignes`.

- [ ] **Step 3: Write minimal implementation**

`frontend/components/ChampLigne.tsx` — replace the props type and add `maxLength` (the rest is unchanged):

```tsx
type ChampLigneProps = {
  id: string;
  name: string;
  label: string;
  type: 'email' | 'password' | 'text';
  autoComplete: string;
  defaultValue?: string;
  maxLength?: number;
  invalid?: boolean;
  describedBy?: string;
};

export function ChampLigne({
  id,
  name,
  label,
  type,
  autoComplete,
  defaultValue,
  maxLength,
  invalid,
  describedBy,
}: ChampLigneProps) {
  return (
    <div className="mt-ligne">
      <label htmlFor={id} className="block h-ligne leading-[32px] text-graphite-doux">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        maxLength={maxLength}
        required
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        className="entoure block h-ligne w-full border-b-2 border-graphite bg-papier px-1 leading-[30px] text-graphite transition-colors duration-[120ms] focus:border-encre aria-invalid:border-stylo-rouge"
      />
    </div>
  );
}
```

`frontend/app/globals.css` — add after the `input:-webkit-autofill` block:

```css
.lignes {
  --trait: var(--color-graphite);
  background-color: var(--color-papier);
  background-image: repeating-linear-gradient(
    to bottom,
    transparent 0 30px,
    var(--trait) 30px 32px
  );
  background-attachment: local;
}

.lignes:focus {
  --trait: var(--color-encre);
}
```

`frontend/components/ChampLignes.tsx`:

```tsx
type ChampLignesProps = {
  id: string;
  name: string;
  label: string;
  defaultValue?: string;
  rows?: number;
};

export function ChampLignes({ id, name, label, defaultValue, rows = 3 }: ChampLignesProps) {
  return (
    <div className="mt-ligne">
      <label htmlFor={id} className="block h-ligne leading-[32px] text-graphite-doux">
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        rows={rows}
        defaultValue={defaultValue}
        className="lignes entoure block min-h-[calc(var(--spacing-ligne)*3)] w-full resize-y px-1 leading-[32px] text-graphite"
      />
    </div>
  );
}
```

`frontend/components/ChoixCases.tsx`:

```tsx
export type Choix = { value: string; label: string };

type ChoixCasesProps = {
  name: string;
  legend: string;
  choix: readonly Choix[];
  defaultValue: string;
};

export function ChoixCases({ name, legend, choix, defaultValue }: ChoixCasesProps) {
  return (
    <fieldset className="mt-ligne">
      <legend className="block h-ligne leading-[32px] text-graphite-doux">{legend}</legend>
      {choix.map(({ value, label }) => {
        const id = `${name}-${value}`;
        return (
          <div key={value} className="flex h-ligne items-center gap-3">
            <input
              id={id}
              type="radio"
              name={name}
              value={value}
              defaultChecked={value === defaultValue}
              className="entoure size-4 shrink-0 accent-encre"
            />
            <label htmlFor={id} className="leading-[32px]">
              {label}
            </label>
          </div>
        );
      })}
    </fieldset>
  );
}
```

`frontend/components/CreationFormView.tsx`:

```tsx
import { CREATION_MESSAGES, type CreationFormState, titreInvalide } from '@/lib/creation-state';
import { AnnotationErreur } from './AnnotationErreur';
import { ChampLigne } from './ChampLigne';
import { ChampLignes } from './ChampLignes';
import { type Choix, ChoixCases } from './ChoixCases';

type CreationFormViewProps = {
  state: CreationFormState;
  action: (formData: FormData) => void;
  pending: boolean;
};

const ERREUR_ID = 'creation-erreur';

export const VISIBILITES: readonly Choix[] = [
  { value: 'publique', label: 'Publique — toute personne ayant le lien' },
  { value: 'privee', label: 'Privée — uniquement les personnes invitées' },
];

export function CreationFormView({ state, action, pending }: CreationFormViewProps) {
  const message = state.message === null ? null : CREATION_MESSAGES[state.message];
  const invalid = titreInvalide(state.message);
  return (
    <form action={action}>
      {message && <AnnotationErreur id={ERREUR_ID}>{message}</AnnotationErreur>}
      <ChampLigne
        id="titre"
        name="titre"
        label="Titre"
        type="text"
        autoComplete="off"
        maxLength={255}
        defaultValue={state.titre}
        invalid={invalid}
        describedBy={invalid ? ERREUR_ID : undefined}
      />
      <ChampLignes
        id="description"
        name="description"
        label="Description (facultatif)"
        defaultValue={state.description}
      />
      <ChoixCases
        name="visibilite"
        legend="Visibilité"
        choix={VISIBILITES}
        defaultValue={state.visibilite}
      />
      <div className="mt-[calc(var(--spacing-ligne)*2)] flex items-center gap-6">
        <button
          type="submit"
          disabled={pending}
          className="entoure h-ligne rounded-sm bg-encre px-6 font-bold text-papier transition-[background-color,transform] duration-[120ms] hover:bg-encre-sombre active:translate-y-px disabled:cursor-wait disabled:bg-encre-sombre"
        >
          {pending ? 'Création…' : 'Créer le brouillon'}
        </button>
        <a
          href="/questionnaires"
          className="entoure text-encre underline underline-offset-4 transition-colors duration-[120ms] hover:text-encre-sombre"
        >
          Annuler
        </a>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/creation-form.test.tsx tests/unit/components.test.tsx`
Expected: PASS (the existing `LoginFormView` tests still pass with the widened `ChampLigne`).

If the `titre` attribute-order regexes fail only because React renders the attributes in another order, loosen the regex to two separate assertions on the same `<input[^>]*id="titre"[^>]*>` tag; do not change the component to satisfy attribute order.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/ChampLigne.tsx frontend/components/ChampLignes.tsx frontend/components/ChoixCases.tsx frontend/components/CreationFormView.tsx frontend/app/globals.css frontend/tests/unit/creation-form.test.tsx
git commit -m "T022: creation form view — ruled description, visibility choice, red-pen errors"
```

---

### Task 4: Per-request author read and the creation page

**Files:**
- Create: `frontend/lib/current-author.ts`
- Modify: `frontend/app/questionnaires/layout.tsx`
- Create: `frontend/app/questionnaires/create/CreationForm.tsx`
- Create: `frontend/app/questionnaires/create/page.tsx`
- Test: `frontend/tests/unit/create-page.test.tsx`

**Interfaces:**
- Consumes: `gateAuthor`, `AuthorGate` (`lib/author-gate.ts`); `currentUser` (`services/authService.ts`); `ACCESS_COOKIE`, `REFRESH_COOKIE`; `createAction` (Task 2); `INITIAL_CREATION_STATE` (Task 2); `CreationFormView` (Task 3).
- Produces:
  ```ts
  export const currentAuthorGate: () => Promise<AuthorGate>; // lib/current-author.ts, React cache()
  export default async function NouveauQuestionnairePage(): Promise<JSX.Element | null>;
  ```

- [ ] **Step 1: Write the failing test**

`frontend/tests/unit/create-page.test.tsx`:

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthorGate } from '@/lib/author-gate';

const gate = vi.fn<() => Promise<AuthorGate>>();

vi.mock('@/lib/current-author', () => ({ currentAuthorGate: () => gate() }));
vi.mock('@/app/questionnaires/create/CreationForm', () => ({
  CreationForm: () => <form data-testid="creation-form" />,
}));

const { default: NouveauQuestionnairePage } = await import('@/app/questionnaires/create/page');

function author(role: 'auteur' | 'administrateur'): AuthorGate {
  return { kind: 'author', author: { id: 7, nom: 'Prof', email: 'prof@example.test', role } };
}

async function render(): Promise<string> {
  const page = await NouveauQuestionnairePage();
  return page === null ? '' : renderToStaticMarkup(page);
}

beforeEach(() => {
  gate.mockReset();
});

describe('NouveauQuestionnairePage', () => {
  it('shows the headline and the form to an auteur', async () => {
    gate.mockResolvedValue(author('auteur'));

    const html = await render();

    expect(html).toMatch(/<h1[^>]*>Nouveau questionnaire<\/h1>/);
    expect(html).toContain('data-testid="creation-form"');
  });

  it('tells an administrateur that creation is reserved to authors, without the form', async () => {
    gate.mockResolvedValue(author('administrateur'));

    const html = await render();

    expect(html).toContain('La création de questionnaires est réservée aux auteurs.');
    expect(html).toMatch(/<a[^>]*href="\/questionnaires"[^>]*>Retour à mes questionnaires<\/a>/);
    expect(html).not.toContain('data-testid="creation-form"');
  });

  it('renders nothing when the layout handles the session', async () => {
    gate.mockResolvedValue({ kind: 'login' });
    expect(await render()).toBe('');

    gate.mockResolvedValue({ kind: 'unavailable' });
    expect(await render()).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/create-page.test.tsx`
Expected: FAIL — cannot resolve `@/lib/current-author`.

- [ ] **Step 3: Write minimal implementation**

`frontend/lib/current-author.ts`:

```ts
import { cookies } from 'next/headers';
import { cache } from 'react';
import { currentUser } from '@/services/authService';
import { type AuthorGate, gateAuthor } from './author-gate';
import { ACCESS_COOKIE, REFRESH_COOKIE } from './session-cookies';

export const currentAuthorGate = cache(async (): Promise<AuthorGate> => {
  const store = await cookies();
  return gateAuthor(
    { access: store.get(ACCESS_COOKIE)?.value, refresh: store.get(REFRESH_COOKIE)?.value },
    { currentUser },
  );
});
```

`frontend/app/questionnaires/layout.tsx` — replace the imports and the first lines of the component so it uses the memoised gate (the JSX below stays exactly as it is):

```tsx
import { redirect } from 'next/navigation';
import { AnnotationErreur } from '@/components/AnnotationErreur';
import { Feuille } from '@/components/Feuille';
import { currentAuthorGate } from '@/lib/current-author';
import { LOGIN_MESSAGES } from '@/lib/login-state';
import { logoutAction } from './actions';

export default async function QuestionnairesLayout({ children }: LayoutProps<'/questionnaires'>) {
  const gate = await currentAuthorGate();
  if (gate.kind === 'login') redirect('/login');
```

`frontend/app/questionnaires/create/CreationForm.tsx`:

```tsx
'use client';

import { useActionState } from 'react';
import { CreationFormView } from '@/components/CreationFormView';
import { INITIAL_CREATION_STATE } from '@/lib/creation-state';
import { createAction } from './actions';

export function CreationForm() {
  const [state, action, pending] = useActionState(createAction, INITIAL_CREATION_STATE);
  return <CreationFormView state={state} action={action} pending={pending} />;
}
```

`frontend/app/questionnaires/create/page.tsx`:

```tsx
import { currentAuthorGate } from '@/lib/current-author';
import { CreationForm } from './CreationForm';

export default async function NouveauQuestionnairePage() {
  const gate = await currentAuthorGate();
  if (gate.kind !== 'author') return null;
  return (
    <div className="max-w-md">
      <h1 className="mt-ligne text-[28px] font-bold leading-[64px] tracking-[-0.02em]">
        Nouveau questionnaire
      </h1>
      {gate.author.role === 'auteur' ? (
        <CreationForm />
      ) : (
        <>
          <p className="mt-ligne leading-[32px] text-crayon">
            La création de questionnaires est réservée aux auteurs.
          </p>
          <p className="leading-[32px]">
            <a
              href="/questionnaires"
              className="entoure text-encre underline underline-offset-4 transition-colors duration-[120ms] hover:text-encre-sombre"
            >
              Retour à mes questionnaires
            </a>
          </p>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/create-page.test.tsx && npx vitest run`
Expected: PASS, whole suite green (the layout change keeps `author-gate` tests unaffected).

Then: `npx tsc --noEmit` — Expected: no error. If `LayoutProps` is reported missing, run `npx next typegen` first (it generates the global route types) and retry.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/current-author.ts frontend/app/questionnaires/layout.tsx frontend/app/questionnaires/create/CreationForm.tsx frontend/app/questionnaires/create/page.tsx frontend/tests/unit/create-page.test.tsx
git commit -m "T022: creation page, reserved to authors, with the author read once per request"
```

---

### Task 5: Draft page `/questionnaires/[id]`

**Files:**
- Create: `frontend/components/BrouillonView.tsx`
- Create: `frontend/app/questionnaires/[id]/page.tsx`
- Create: `frontend/app/questionnaires/[id]/not-found.tsx`
- Test: `frontend/tests/unit/brouillon.test.tsx`

**Interfaces:**
- Consumes: `getMine`, `QuestionnaireLu`, `QuestionType`, `Visibilite` (Task 1); `TamponStatut`, `AnnotationErreur`; `LOGIN_MESSAGES`; `ACCESS_COOKIE`.
- Produces:
  ```ts
  export const LIBELLES_VISIBILITE: Record<Visibilite, string>;
  export const LIBELLES_TYPE: Record<QuestionType, string>;
  export function BrouillonView(props: { questionnaire: QuestionnaireLu }): JSX.Element;
  export default async function BrouillonPage(props: PageProps<'/questionnaires/[id]'>): Promise<JSX.Element>;
  export default function QuestionnaireIntrouvable(): JSX.Element;
  ```
  T023 replaces the read-only question list inside `BrouillonView` with its editor.

- [ ] **Step 1: Write the failing test**

`frontend/tests/unit/brouillon.test.tsx`:

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrouillonView } from '@/components/BrouillonView';
import type { Lecture, QuestionnaireLu } from '@/services/questionnaireService';

const jar = new Map<string, string>();
const getMine = vi.fn<(access: string, id: string) => Promise<Lecture>>();

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { value: jar.get(name) } : undefined),
  }),
}));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
  redirect: (path: string) => {
    throw new Error(`REDIRECT ${path}`);
  },
}));
vi.mock('@/services/questionnaireService', () => ({
  getMine: (access: string, id: string) => getMine(access, id),
}));

const { default: BrouillonPage } = await import('@/app/questionnaires/[id]/page');
const { default: QuestionnaireIntrouvable } = await import('@/app/questionnaires/[id]/not-found');

function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replaceAll('&#x27;', "'");
}

const QUESTIONNAIRE: QuestionnaireLu = {
  documentId: 'abc123',
  titre: 'Retour sur la séance 5 — pipelines, conteneurs et déploiement continu sur Kubernetes',
  description: 'Première ligne\nDeuxième ligne',
  statut: 'brouillon',
  visibilite: 'privee',
  questions: [
    { documentId: 'q1', texte: 'Rythme ?', type: 'likert', position: 1, obligatoire: true },
    { documentId: 'q2', texte: 'Outil préféré', type: 'choix_multiple', position: 2, obligatoire: false },
    { documentId: 'q3', texte: 'Remarques', type: 'texte_libre', position: 3, obligatoire: false },
  ],
};

function page(id: string) {
  return BrouillonPage({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) });
}

beforeEach(() => {
  jar.clear();
  getMine.mockReset();
});

describe('BrouillonView', () => {
  it('shows the whole title, the stamp, the visibility and the description with its line breaks', () => {
    const html = renderToStaticMarkup(<BrouillonView questionnaire={QUESTIONNAIRE} />);

    expect(html).toMatch(/<a[^>]*href="\/questionnaires"[^>]*>← Mes questionnaires<\/a>/);
    expect(html).toContain(`>${QUESTIONNAIRE.titre}</h1>`);
    expect(html).not.toMatch(/<h1[^>]*truncate/);
    expect(text(html)).toContain('brouillon');
    expect(text(html)).toContain('Privée — sur invitation');
    expect(html).toContain('whitespace-pre-line');
    expect(html).toContain('Première ligne\nDeuxième ligne');
  });

  it('lists the questions in order, numbered, with their type and obligatoire', () => {
    const content = text(renderToStaticMarkup(<BrouillonView questionnaire={QUESTIONNAIRE} />));

    expect(content).toContain('Questions');
    expect(content.indexOf('Rythme ?')).toBeLessThan(content.indexOf('Outil préféré'));
    expect(content.indexOf('Outil préféré')).toBeLessThan(content.indexOf('Remarques'));
    expect(content).toContain('1.');
    expect(content).toContain('3.');
    expect(content).toContain('Échelle de Likert · obligatoire');
    expect(content).toContain('Choix multiple');
    expect(content).not.toContain('Choix multiple · obligatoire');
    expect(content).toContain('Texte libre');
  });

  it('writes an invitation when there is no question and no description', () => {
    const html = renderToStaticMarkup(
      <BrouillonView
        questionnaire={{ ...QUESTIONNAIRE, description: null, visibilite: 'publique', questions: [] }}
      />,
    );

    expect(text(html)).toContain("Aucune question pour l'instant.");
    expect(text(html)).toContain('Publique — lien ouvert');
    expect(html).not.toContain('whitespace-pre-line');
    expect(html).not.toContain('<ol');
  });
});

describe('BrouillonPage', () => {
  it('reads the questionnaire with the access cookie and shows it', async () => {
    jar.set('qp_access', 'access-1');
    getMine.mockResolvedValue({ kind: 'found', questionnaire: QUESTIONNAIRE });

    const html = renderToStaticMarkup(await page('abc123'));

    expect(getMine).toHaveBeenCalledWith('access-1', 'abc123');
    expect(html).toContain(`>${QUESTIONNAIRE.titre}</h1>`);
  });

  it('calls notFound for an unknown or foreign questionnaire', async () => {
    getMine.mockResolvedValue({ kind: 'not-found' });

    await expect(page('abc123')).rejects.toThrow('NOT_FOUND');
  });

  it('redirects to /login on an expired session', async () => {
    getMine.mockResolvedValue({ kind: 'session' });

    await expect(page('abc123')).rejects.toThrow('REDIRECT /login');
  });

  it('annotates an unavailable service with a retry link to the same page', async () => {
    getMine.mockResolvedValue({ kind: 'unavailable' });

    const html = renderToStaticMarkup(await page('abc123'));

    expect(html).toContain('role="alert"');
    expect(text(html)).toContain(
      'Le service est momentanément indisponible. Réessayez dans un instant.',
    );
    expect(html).toMatch(/<a[^>]*href="\/questionnaires\/abc123"[^>]*>Réessayer<\/a>/);
  });
});

describe('QuestionnaireIntrouvable', () => {
  it('explains and links back to the list', () => {
    const html = renderToStaticMarkup(<QuestionnaireIntrouvable />);

    expect(html).toMatch(/<h1[^>]*>Questionnaire introuvable<\/h1>/);
    expect(text(html)).toContain("Ce questionnaire n'existe pas ou ne vous appartient pas.");
    expect(html).toMatch(/<a[^>]*href="\/questionnaires"[^>]*>Retour à mes questionnaires<\/a>/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/brouillon.test.tsx`
Expected: FAIL — cannot resolve `@/components/BrouillonView`.

- [ ] **Step 3: Write minimal implementation**

`frontend/components/BrouillonView.tsx`:

```tsx
import type {
  QuestionnaireLu,
  QuestionType,
  Visibilite,
} from '@/services/questionnaireService';
import { TamponStatut } from './TamponStatut';

export const LIBELLES_VISIBILITE: Record<Visibilite, string> = {
  publique: 'Publique — lien ouvert',
  privee: 'Privée — sur invitation',
};

export const LIBELLES_TYPE: Record<QuestionType, string> = {
  likert: 'Échelle de Likert',
  choix_multiple: 'Choix multiple',
  texte_libre: 'Texte libre',
};

const DANS_LA_MARGE = 'sm:absolute sm:right-[calc(100%+3.25rem)] sm:text-right';

export function BrouillonView({ questionnaire }: { questionnaire: QuestionnaireLu }) {
  const { titre, description, statut, visibilite, questions } = questionnaire;
  return (
    <>
      <p className="mt-ligne leading-[32px]">
        <a
          href="/questionnaires"
          className="entoure text-encre underline underline-offset-4 transition-colors duration-[120ms] hover:text-encre-sombre"
        >
          ← Mes questionnaires
        </a>
      </p>
      <h1 className="text-[28px] font-bold leading-[64px] tracking-[-0.02em] break-words">
        {titre}
      </h1>
      <p className="flex flex-wrap items-center gap-3 leading-[32px]">
        <TamponStatut statut={statut} />
        <span className="text-graphite-doux">{LIBELLES_VISIBILITE[visibilite]}</span>
      </p>
      {description && (
        <p className="mt-ligne whitespace-pre-line break-words leading-[32px]">{description}</p>
      )}
      <section aria-labelledby="questions-titre" className="mt-ligne">
        <h2
          id="questions-titre"
          className="h-ligne text-sm font-bold uppercase leading-[32px] tracking-wide text-graphite-doux sm:relative"
        >
          <span className={`${DANS_LA_MARGE} sm:whitespace-nowrap`}>Questions</span>
        </h2>
        {questions.length === 0 ? (
          <p className="leading-[32px] text-crayon">Aucune question pour l&apos;instant.</p>
        ) : (
          <ol>
            {questions.map((question, index) => (
              <li key={question.documentId} className="relative leading-[32px]">
                <span className={`tabular-nums text-graphite-doux ${DANS_LA_MARGE}`}>
                  {index + 1}.
                </span>{' '}
                <span className="break-words">{question.texte}</span>
                <span className="block text-sm text-graphite-doux">
                  {LIBELLES_TYPE[question.type]}
                  {question.obligatoire ? ' · obligatoire' : ''}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
```

`frontend/app/questionnaires/[id]/page.tsx`:

```tsx
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { AnnotationErreur } from '@/components/AnnotationErreur';
import { BrouillonView } from '@/components/BrouillonView';
import { LOGIN_MESSAGES } from '@/lib/login-state';
import { ACCESS_COOKIE } from '@/lib/session-cookies';
import { getMine } from '@/services/questionnaireService';

export default async function BrouillonPage({ params }: PageProps<'/questionnaires/[id]'>) {
  const { id } = await params;
  const access = (await cookies()).get(ACCESS_COOKIE)?.value ?? '';
  const lecture = await getMine(access, id);
  if (lecture.kind === 'not-found') notFound();
  if (lecture.kind === 'session') redirect('/login');
  if (lecture.kind === 'unavailable') {
    return (
      <AnnotationErreur id="brouillon-erreur">
        {LOGIN_MESSAGES.unavailable}{' '}
        <a
          href={`/questionnaires/${id}`}
          className="entoure font-bold text-encre underline transition-colors duration-[120ms] hover:text-encre-sombre"
        >
          Réessayer
        </a>
      </AnnotationErreur>
    );
  }
  return <BrouillonView questionnaire={lecture.questionnaire} />;
}
```

(`id` only reaches this `href` after `getMine` accepted it as alphanumeric — any other id returns `not-found` first.)

`frontend/app/questionnaires/[id]/not-found.tsx`:

```tsx
export default function QuestionnaireIntrouvable() {
  return (
    <>
      <h1 className="mt-ligne text-[28px] font-bold leading-[64px] tracking-[-0.02em]">
        Questionnaire introuvable
      </h1>
      <p className="mt-ligne leading-[32px]">
        Ce questionnaire n&apos;existe pas ou ne vous appartient pas.
      </p>
      <p className="leading-[32px]">
        <a
          href="/questionnaires"
          className="entoure text-encre underline underline-offset-4 transition-colors duration-[120ms] hover:text-encre-sombre"
        >
          Retour à mes questionnaires
        </a>
      </p>
    </>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/brouillon.test.tsx`
Expected: PASS (8 tests).

Then: `npx tsc --noEmit` (run `npx next typegen` first if `PageProps` is reported missing). Expected: no error.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/BrouillonView.tsx "frontend/app/questionnaires/[id]/page.tsx" "frontend/app/questionnaires/[id]/not-found.tsx" frontend/tests/unit/brouillon.test.tsx
git commit -m "T022: draft page — the questionnaire read back with its questions, not-found and outage states"
```

---

### Task 6: Linked table of contents and « Nouveau questionnaire »

**Files:**
- Modify: `frontend/components/Sommaire.tsx`
- Modify: `frontend/app/questionnaires/page.tsx`
- Modify: `frontend/tests/unit/components.test.tsx` (the `Sommaire` describe)
- Test: `frontend/tests/unit/mes-questionnaires-page.test.tsx`

**Interfaces:**
- Consumes: `currentAuthorGate` (Task 4); `listMine` (`services/mesQuestionnaires.ts`); `ACCESS_COOKIE`.
- Produces: no new export; `Sommaire` titles become `<a href="/questionnaires/<documentId>" title="<titre>">`.

- [ ] **Step 1: Write the failing tests**

In `frontend/tests/unit/components.test.tsx`, add inside `describe('Sommaire', …)` after the first `it`:

```tsx
  it('links each title to its draft page and carries the full title on hover', () => {
    const html = renderToStaticMarkup(<Sommaire state={{ kind: 'list', items }} />);

    expect(html).toMatch(
      /<a[^>]*href="\/questionnaires\/b"[^>]*title="Retour séance 4"[^>]*>Retour séance 4<\/a>/,
    );
    expect(html).toMatch(
      /<a[^>]*href="\/questionnaires\/a"[^>]*title="Retour séance 3"[^>]*>Retour séance 3<\/a>/,
    );
  });
```

`frontend/tests/unit/mes-questionnaires-page.test.tsx`:

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthorGate } from '@/lib/author-gate';

const jar = new Map<string, string>();
const gate = vi.fn<() => Promise<AuthorGate>>();
const listMine = vi.fn();

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { value: jar.get(name) } : undefined),
  }),
}));
vi.mock('@/lib/current-author', () => ({ currentAuthorGate: () => gate() }));
vi.mock('@/services/mesQuestionnaires', () => ({
  listMine: (access: string) => listMine(access),
}));

const { default: MesQuestionnairesPage } = await import('@/app/questionnaires/page');

function author(role: 'auteur' | 'administrateur'): AuthorGate {
  return { kind: 'author', author: { id: 7, nom: 'Prof', email: 'prof@example.test', role } };
}

beforeEach(() => {
  jar.clear();
  jar.set('qp_access', 'access-1');
  gate.mockReset();
  listMine.mockReset();
  listMine.mockResolvedValue({ kind: 'list', items: [] });
});

describe('MesQuestionnairesPage', () => {
  it('offers « Nouveau questionnaire » to an auteur', async () => {
    gate.mockResolvedValue(author('auteur'));

    const html = renderToStaticMarkup(await MesQuestionnairesPage());

    expect(html).toMatch(/<a[^>]*href="\/questionnaires\/create"[^>]*>\+ Nouveau questionnaire<\/a>/);
    expect(listMine).toHaveBeenCalledWith('access-1');
  });

  it('does not offer it to an administrateur', async () => {
    gate.mockResolvedValue(author('administrateur'));

    const html = renderToStaticMarkup(await MesQuestionnairesPage());

    expect(html).not.toContain('/questionnaires/create');
    expect(html).toContain('Mes questionnaires');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/components.test.tsx tests/unit/mes-questionnaires-page.test.tsx`
Expected: FAIL — no `<a href="/questionnaires/b"…>` in the `Sommaire`, no creation link on the page.

- [ ] **Step 3: Write minimal implementation**

`frontend/components/Sommaire.tsx` — replace the title span

```tsx
          <span className="min-w-0 truncate">{item.titre}</span>
```

with

```tsx
          <a
            href={`/questionnaires/${item.documentId}`}
            title={item.titre}
            className="entoure min-w-0 truncate text-encre underline-offset-4 transition-colors duration-[120ms] hover:text-encre-sombre hover:underline"
          >
            {item.titre}
          </a>
```

`frontend/app/questionnaires/page.tsx`:

```tsx
import { cookies } from 'next/headers';
import { Sommaire } from '@/components/Sommaire';
import { currentAuthorGate } from '@/lib/current-author';
import { ACCESS_COOKIE } from '@/lib/session-cookies';
import { listMine } from '@/services/mesQuestionnaires';

export default async function MesQuestionnairesPage() {
  const gate = await currentAuthorGate();
  const access = (await cookies()).get(ACCESS_COOKIE)?.value ?? '';
  const state = await listMine(access);
  const peutCreer = gate.kind === 'author' && gate.author.role === 'auteur';
  return (
    <>
      <h1 className="mt-ligne text-[28px] font-bold leading-[64px] tracking-[-0.02em]">
        Mes questionnaires
      </h1>
      {peutCreer && (
        <p className="leading-[32px]">
          <a
            href="/questionnaires/create"
            className="entoure font-bold text-encre underline underline-offset-4 transition-colors duration-[120ms] hover:text-encre-sombre"
          >
            + Nouveau questionnaire
          </a>
        </p>
      )}
      <Sommaire state={state} />
    </>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run`
Expected: PASS, whole suite green.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/Sommaire.tsx frontend/app/questionnaires/page.tsx frontend/tests/unit/components.test.tsx frontend/tests/unit/mes-questionnaires-page.test.tsx
git commit -m "T022: link the table of contents to each draft and offer « Nouveau questionnaire »"
```

---

### Task 7: Design check, documentation and full verification

**Files:**
- Modify: `DESIGN.md`
- Modify: `specs/001-questionnaire-platform/tasks.md` (T022 line)
- Modify: `CLAUDE.md` ("Current state")
- Possibly modify: files flagged by `impeccable detect` (only to fix real findings)

**Interfaces:**
- Consumes: everything above. Produces: documentation only.

- [ ] **Step 1: Full frontend verification**

Run from `/project/devops2/frontend`:
```bash
npx vitest run && npx tsc --noEmit && npm run lint && npm run format:check && npm run build
```
Expected: all green. If `format:check` fails, run `npx prettier --write <the listed files> --ignore-path ../.prettierignore`, re-run, and include those files in this task's commit.

- [ ] **Step 2: impeccable detect (once)**

Run from `/project/devops2`:
`/project/devops2/.claude/skills/impeccable/scripts/impeccable detect --json frontend/app/globals.css frontend/app/questionnaires frontend/components`
Expected: `[]`. For any finding, fix it in the flagged file if it is a real problem against `DESIGN.md`; if it is a false positive, record it in the task report. Re-run once.

- [ ] **Step 3: Update `DESIGN.md`**

In `## Components`, after `### Inputs / Fields (ChampLigne)`, add:

```markdown
### Ruled text area (ChampLignes)
- **Style:** a block of notebook lines — label above in soft graphite, then a textarea on paper with a 2 px baseline under every 32 px text line (the baselines scroll with the text), three lines tall by default, vertical resize only.
- **Focus:** every baseline turns ink blue and the control is circled in ink.
- **Use:** the questionnaire description; any long optional text later.

### Choice lines (ChoixCases)
- **Style:** a `fieldset` whose `legend` reads like a field label, then one ruling line per choice: a native radio tinted ink (`accent-color`), then its label in body type.
- **Focus:** the radio is circled in ink.
- **Use:** the questionnaire visibility (« Publique » checked by default).
```

After `### Table of contents (Sommaire)`, replace its paragraph's « title (truncated on one line) » with « title as an ink link to the draft page (truncated on one line, full title in its `title` attribute) », and add:

```markdown
### Draft page (BrouillonView)
One questionnaire read back on its sheet: an ink back link « ← Mes questionnaires », the full title as the headline (wrapped on the ruling, never truncated), one line with the statut stamp and the visibility in soft graphite, the description in body type with its line breaks kept, then the « QUESTIONS » label in the margin and the questions numbered in the margin, each with its type and « obligatoire » in small soft graphite. **Empty state:** the pencil line « Aucune question pour l'instant. » **Unknown or foreign questionnaire:** the headline « Questionnaire introuvable », one sentence, a link back to the list.

### Creation form
Headline « Nouveau questionnaire » in the narrow form column: Titre (ChampLigne), Description (ChampLignes), Visibilité (ChoixCases), then two ruling lines lower the ink button « Créer le brouillon » (pending: « Création… ») with the ink link « Annuler » to its right. Errors follow the login rule: one red-pen annotation above the fields; only a title problem draws the title's baseline in red. An `administrateur` sees the pencil line « La création de questionnaires est réservée aux auteurs. » instead of the form.
```

In `### Known limitations`, change the line about the `title` attribute to:
`- Truncated author names have no `title` attribute, so the full name is not reachable on hover (questionnaire titles have one since T022).`

- [ ] **Step 4: Update `tasks.md` and `CLAUDE.md`**

`specs/001-questionnaire-platform/tasks.md` — T022 line becomes:

```markdown
- [X] T022 [P] [US1] [UI] Frontend: questionnaire creation page in `frontend/app/questionnaires/create/page.tsx` *(Done 2026-09-24: form Titre / Description / Visibilité (Publique by default) through a server action and `submitCreation` (`lib/create-questionnaire.ts`); redirect to a new draft page `/questionnaires/[id]` read from `GET /api/mes-questionnaires/:id` (T077), where T023 plugs its editor; « Mes questionnaires » links each title to it and offers « + Nouveau questionnaire » to an `auteur` only; `services/questionnaireService.ts` started (`createQuestionnaire`, `getMine`) for T024 to extend; author read memoised per request in `lib/current-author.ts`. See `docs/superpowers/specs/2026-09-24-T022-questionnaire-creation-design.md`.)*
```

`CLAUDE.md` "Current state":
- In the task list sentence, add **T022** after **T021** : `**T001–T010**, **T011–T021**, **T022**, **T060**, …`.
- In the `frontend/` bullet, after the T063 sentence ending `(T063).`, add: `` `/questionnaires/create` (creation form, `auteur` only) and the draft page `/questionnaires/[id]` (read via `GET /api/mes-questionnaires/:id`); the table of contents links each title to its draft; Strapi calls for questionnaires live in `services/questionnaireService.ts` (T022). ``

- [ ] **Step 5: Commit**

```bash
git add DESIGN.md specs/001-questionnaire-platform/tasks.md CLAUDE.md <files fixed after detect or prettier>
git commit -m "T022: DESIGN.md for the creation form and the draft page, T022 done, current state"
```

---

## After the tasks (controller, not a subagent task)

Live check under `docker compose -p devops2-check` (only when ports 1337, 3000 and 5432 are free; end with `docker compose -p devops2-check down -v`, never touching the `devops2` project): log in as the dev auteur → « + Nouveau questionnaire » → submit a title of spaces (red-pen « Donnez un titre… ») → create « Retour séance 5 », Privée → lands on `/questionnaires/<id>` with the brouillon stamp, « Privée — sur invitation », « Aucune question pour l'instant. » → back to the list, the new title is an ink link → `/questionnaires/zzz` shows « Questionnaire introuvable ».
