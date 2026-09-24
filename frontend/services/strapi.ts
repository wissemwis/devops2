export class StrapiUnavailableError extends Error {
  readonly status?: number;

  constructor(status?: number, cause?: unknown) {
    super('Strapi is unavailable', { cause });
    this.name = 'StrapiUnavailableError';
    this.status = status;
  }
}

export async function strapiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const base = process.env.STRAPI_URL;
  if (!base) throw new StrapiUnavailableError(undefined, new Error('STRAPI_URL is not set'));
  let response: Response;
  try {
    response = await fetch(new URL(path, base).toString(), { ...init, cache: 'no-store' });
  } catch (error) {
    throw new StrapiUnavailableError(undefined, error);
  }
  if (response.status === 429 || response.status >= 500) {
    throw new StrapiUnavailableError(response.status);
  }
  return response;
}
