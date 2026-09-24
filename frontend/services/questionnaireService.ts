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
