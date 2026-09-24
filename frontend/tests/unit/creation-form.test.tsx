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
      <ChampLignes
        id="description"
        name="description"
        label="Description"
        defaultValue="Bonjour"
      />,
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
    expect(html).toMatch(
      /<input[^>]*id="couleur-bleu"[^>]*type="radio"[^>]*name="couleur"[^>]*value="bleu"/,
    );
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
    expect(html).not.toContain('aria-invalid="true"');
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

    expect(titre).toMatch(
      /<input[^>]*id="titre"[^>]*aria-invalid="true"[^>]*aria-describedby="creation-erreur"/,
    );
    expect(service).not.toContain('aria-invalid="true"');
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
