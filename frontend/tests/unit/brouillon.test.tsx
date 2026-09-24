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
    {
      documentId: 'q2',
      texte: 'Outil préféré',
      type: 'choix_multiple',
      position: 2,
      obligatoire: false,
    },
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
        questionnaire={{
          ...QUESTIONNAIRE,
          description: null,
          visibilite: 'publique',
          questions: [],
        }}
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
