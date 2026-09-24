import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthorGate } from '@/lib/author-gate';

const gate = vi.fn<() => Promise<AuthorGate>>();

vi.mock('@/lib/current-author', () => ({ currentAuthorGate: () => gate() }));
vi.mock('@/app/questionnaires/create/CreationForm', () => ({
  CreationForm: () => <form data-testid="creation-form" />,
}));
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT ${path}`);
  },
}));

const { default: NouveauQuestionnairePage } = await import('@/app/questionnaires/create/page');

function author(role: 'auteur' | 'administrateur'): AuthorGate {
  return { kind: 'author', author: { id: 7, nom: 'Prof', email: 'prof@example.test', role } };
}

async function render(): Promise<string> {
  return renderToStaticMarkup(await NouveauQuestionnairePage());
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

  it('redirects to /login when the session is missing', async () => {
    gate.mockResolvedValue({ kind: 'login' });

    await expect(NouveauQuestionnairePage()).rejects.toThrow('REDIRECT /login');
  });

  it('annotates an unavailable service with the headline and a retry link', async () => {
    gate.mockResolvedValue({ kind: 'unavailable' });

    const html = await render();

    expect(html).toMatch(/<h1[^>]*>Nouveau questionnaire<\/h1>/);
    expect(html).toContain('role="alert"');
    expect(html).toContain('Le service est momentanément indisponible. Réessayez dans un instant.');
    expect(html).toMatch(/<a[^>]*href="\/questionnaires\/create"[^>]*>Réessayer<\/a>/);
  });
});
