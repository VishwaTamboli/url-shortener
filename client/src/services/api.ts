import type { CreateUrlResponse, UrlStats } from '../types';

/** Backend origin. Override per environment with client/.env → VITE_API_BASE_URL. */
export const API_BASE_URL = (
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:3000'
).replace(/\/+$/, '');

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function throwFromResponse(res: Response): Promise<never> {
  let message = `Request failed (HTTP ${res.status})`;
  try {
    const body = (await res.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) message = body.message.join('. ');
    else if (typeof body.message === 'string') message = body.message;
  } catch {
    /* keep the default message */
  }
  throw new ApiError(res.status, message);
}

/** Mirrors the backend rule: only http(s) URLs are accepted. */
export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function createShortUrl(
  originalUrl: string,
  signal?: AbortSignal,
): Promise<CreateUrlResponse> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/urls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ originalUrl }),
      signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw err;
    throw new ApiError(0, `Could not reach the API at ${API_BASE_URL}. Is the backend running?`);
  }
  if (!res.ok) await throwFromResponse(res);
  return (await res.json()) as CreateUrlResponse;
}

export async function fetchStats(code: string, signal?: AbortSignal): Promise<UrlStats> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/urls/${encodeURIComponent(code)}/stats`, { signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw err;
    throw new ApiError(0, `Could not reach the API at ${API_BASE_URL}. Is the backend running?`);
  }
  if (!res.ok) await throwFromResponse(res);
  return (await res.json()) as UrlStats;
}
