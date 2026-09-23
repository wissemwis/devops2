export type QuestionType = 'likert' | 'choix_multiple' | 'texte_libre';

const CHOICES_MESSAGE =
  'options must list at least 2 distinct non-empty labels for a choix_multiple question';
const FORBIDDEN_MESSAGE = 'options are only allowed for a choix_multiple question';

function areDistinctLabels(options: unknown): boolean {
  if (!Array.isArray(options) || options.length < 2) return false;
  if (!options.every((option) => typeof option === 'string' && option.trim() !== '')) {
    return false;
  }
  const trimmed = options.map((option: string) => option.trim());
  return new Set(trimmed).size === trimmed.length;
}

export function optionsError(type: string, options: unknown): string | null {
  if (type === 'choix_multiple') {
    return areDistinctLabels(options) ? null : CHOICES_MESSAGE;
  }
  return options === undefined || options === null ? null : FORBIDDEN_MESSAGE;
}

export function positionTaken(position: number, existingPositions: readonly number[]): boolean {
  return existingPositions.includes(position);
}
