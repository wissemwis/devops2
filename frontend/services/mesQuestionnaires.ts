import { logger } from '@/lib/logger';
import { StrapiUnavailableError, strapiFetch } from './strapi';

export type Statut = 'brouillon' | 'publie' | 'ferme';
export type SommaireItem = { documentId: string; titre: string; statut: Statut; updatedAt: string };
export type SommaireState = { kind: 'list'; items: SommaireItem[] } | { kind: 'error' };

type ListBody = { data?: SommaireItem[] };

export async function listMine(access: string): Promise<SommaireState> {
  try {
    const response = await strapiFetch('/api/mes-questionnaires', {
      headers: { Authorization: `Bearer ${access}` },
    });
    if (!response.ok) {
      logger.warn('questionnaires.list.failed', { status: response.status });
      return { kind: 'error' };
    }
    const body = (await response.json()) as ListBody;
    const items = (body.data ?? []).map(({ documentId, titre, statut, updatedAt }) => ({
      documentId,
      titre,
      statut,
      updatedAt,
    }));
    return { kind: 'list', items };
  } catch (error) {
    if (!(error instanceof StrapiUnavailableError)) throw error;
    logger.warn('questionnaires.list.failed', { status: error.status });
    return { kind: 'error' };
  }
}
