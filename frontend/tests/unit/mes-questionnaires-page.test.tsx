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

    expect(html).toMatch(
      /<a[^>]*href="\/questionnaires\/create"[^>]*>\+ Nouveau questionnaire<\/a>/,
    );
    expect(listMine).toHaveBeenCalledWith('access-1');
  });

  it('does not offer it to an administrateur', async () => {
    gate.mockResolvedValue(author('administrateur'));

    const html = renderToStaticMarkup(await MesQuestionnairesPage());

    expect(html).not.toContain('/questionnaires/create');
    expect(html).toContain('Mes questionnaires');
  });
});
