import { optionsError, positionTaken } from '../../src/api/question/services/question-rules';

const CHOICES_MESSAGE =
  'options must list at least 2 distinct non-empty labels for a choix_multiple question';
const FORBIDDEN_MESSAGE = 'options are only allowed for a choix_multiple question';

describe('optionsError (US1, D4)', () => {
  it('accepts two or more distinct labels for choix_multiple', () => {
    expect(optionsError('choix_multiple', ['Oui', 'Non'])).toBeNull();
    expect(optionsError('choix_multiple', ['Oui', 'Non', 'Sans avis'])).toBeNull();
  });

  it('rejects missing, non-array or too short options for choix_multiple', () => {
    expect(optionsError('choix_multiple', undefined)).toBe(CHOICES_MESSAGE);
    expect(optionsError('choix_multiple', null)).toBe(CHOICES_MESSAGE);
    expect(optionsError('choix_multiple', 'Oui,Non')).toBe(CHOICES_MESSAGE);
    expect(optionsError('choix_multiple', ['Oui'])).toBe(CHOICES_MESSAGE);
  });

  it('rejects blank labels and non-string labels', () => {
    expect(optionsError('choix_multiple', ['Oui', '   '])).toBe(CHOICES_MESSAGE);
    expect(optionsError('choix_multiple', ['Oui', 2])).toBe(CHOICES_MESSAGE);
  });

  it('rejects labels that are duplicates after trimming', () => {
    expect(optionsError('choix_multiple', ['Oui', ' Oui '])).toBe(CHOICES_MESSAGE);
  });

  it('forbids options on likert and texte_libre, and accepts their absence', () => {
    expect(optionsError('likert', ['1', '2'])).toBe(FORBIDDEN_MESSAGE);
    expect(optionsError('texte_libre', [])).toBe(FORBIDDEN_MESSAGE);
    expect(optionsError('likert', undefined)).toBeNull();
    expect(optionsError('texte_libre', null)).toBeNull();
  });
});

describe('positionTaken (US1)', () => {
  it('is true only when the position is already used', () => {
    expect(positionTaken(2, [1, 2, 3])).toBe(true);
    expect(positionTaken(4, [1, 2, 3])).toBe(false);
    expect(positionTaken(1, [])).toBe(false);
  });
});
