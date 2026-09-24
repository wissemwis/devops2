import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LoginFormView } from '@/components/LoginFormView';
import { Sommaire } from '@/components/Sommaire';
import { TamponStatut } from '@/components/TamponStatut';
import { INITIAL_LOGIN_STATE, LOGIN_MESSAGES } from '@/lib/login-state';

function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

describe('LOGIN_MESSAGES', () => {
  it('holds the exact French messages', () => {
    expect(LOGIN_MESSAGES).toEqual({
      missing: 'Renseignez votre email et votre mot de passe.',
      invalid: 'Email ou mot de passe incorrect.',
      'forbidden-role': "Ce compte n'a pas accès à l'espace auteur.",
      unavailable: 'Le service est momentanément indisponible. Réessayez dans un instant.',
    });
    expect(INITIAL_LOGIN_STATE).toEqual({ message: null, email: '' });
  });
});

describe('TamponStatut', () => {
  it('labels each statut', () => {
    expect(text(renderToStaticMarkup(<TamponStatut statut="brouillon" />))).toBe('brouillon');
    expect(text(renderToStaticMarkup(<TamponStatut statut="publie" />))).toBe('PUBLIÉ');
    expect(text(renderToStaticMarkup(<TamponStatut statut="ferme" />))).toBe('FERMÉ');
  });

  it('gives each statut its own colour law', () => {
    const brouillon = renderToStaticMarkup(<TamponStatut statut="brouillon" />);
    const publie = renderToStaticMarkup(<TamponStatut statut="publie" />);
    const ferme = renderToStaticMarkup(<TamponStatut statut="ferme" />);

    expect(brouillon).toContain('border-dashed');
    expect(brouillon).toContain('text-crayon');
    expect(publie).toContain('text-encre');
    expect(ferme).toContain('text-tampon');
  });
});

describe('Sommaire', () => {
  const items = [
    {
      documentId: 'b',
      titre: 'Retour séance 4',
      statut: 'brouillon' as const,
      updatedAt: '2026-09-24T08:00:00.000Z',
    },
    {
      documentId: 'a',
      titre: 'Retour séance 3',
      statut: 'publie' as const,
      updatedAt: '2026-09-20T08:00:00.000Z',
    },
  ];

  it('lists the questionnaires in the given order, numbered, with statut and date', () => {
    const html = renderToStaticMarkup(<Sommaire state={{ kind: 'list', items }} />);
    const content = text(html);

    expect(html).toContain('<ol');
    expect(content.indexOf('Retour séance 4')).toBeLessThan(content.indexOf('Retour séance 3'));
    expect(content).toContain('1.');
    expect(content).toContain('2.');
    expect(content).toContain('brouillon');
    expect(content).toContain('PUBLIÉ');
    expect(content).toContain('modifié le 24 septembre 2026');
  });

  it('shows the empty state as an invitation', () => {
    const content = text(renderToStaticMarkup(<Sommaire state={{ kind: 'list', items: [] }} />));

    expect(content).toBe('Vos questionnaires apparaîtront ici.');
  });

  it('shows the error with a retry link', () => {
    const html = renderToStaticMarkup(<Sommaire state={{ kind: 'error' }} />);

    expect(text(html)).toContain('Impossible de charger vos questionnaires.');
    expect(html).toMatch(/<a[^>]*href="\/questionnaires"[^>]*>Réessayer<\/a>/);
    expect(html).toContain('role="alert"');
  });
});

describe('LoginFormView', () => {
  const noop = () => undefined;

  it('renders labelled email and password fields and the submit button', () => {
    const html = renderToStaticMarkup(
      <LoginFormView state={INITIAL_LOGIN_STATE} action={noop} pending={false} />,
    );

    expect(html).toMatch(/<label[^>]*for="email"[^>]*>Email<\/label>/);
    expect(html).toMatch(/<input[^>]*id="email"[^>]*>/);
    expect(html).toMatch(/<label[^>]*for="password"[^>]*>Mot de passe<\/label>/);
    expect(html).toMatch(/<input[^>]*type="password"[^>]*>/);
    expect(html).toMatch(/autocomplete="current-password"/i);
    expect(text(html)).toContain('Se connecter');
    expect(html).not.toContain('role="alert"');
  });

  it('shows each error message as an alert tied to the fields and keeps the email', () => {
    for (const message of Object.values(LOGIN_MESSAGES)) {
      const html = renderToStaticMarkup(
        <LoginFormView
          state={{ message, email: 'prof@example.test' }}
          action={noop}
          pending={false}
        />,
      );

      expect(html).toContain('role="alert"');
      expect(text(html).replaceAll('&#x27;', "'")).toContain(message);
      expect(html).toContain('aria-invalid="true"');
      expect(html).toMatch(/aria-describedby="connexion-erreur"/);
      expect(html).toContain('value="prof@example.test"');
    }
  });

  it('disables the button while pending', () => {
    const html = renderToStaticMarkup(
      <LoginFormView state={INITIAL_LOGIN_STATE} action={noop} pending={true} />,
    );

    expect(html).toMatch(/<button[^>]*disabled=""/);
  });
});
