import type { AiSettings, AvailabilityResult, PlatformId } from '../../shared/types';

export interface AvailabilityResponse {
  handle: string;
  results: AvailabilityResult[];
  summary: {
    available: number;
    taken: number;
    unconfirmed: number;
    invalid: number;
    verified: number;
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!response.ok) {
    const record = (body ?? {}) as { error?: string; detail?: string };
    throw new Error(record.error || `Request failed with status ${response.status}`);
  }
  return body as T;
}

export async function checkAvailability(
  handle: string,
  platforms: PlatformId[],
): Promise<AvailabilityResponse> {
  return request<AvailabilityResponse>('/api/availability', {
    method: 'POST',
    body: JSON.stringify({ handle, platforms }),
  });
}

export async function health(): Promise<{ ok: boolean; aiConfigured: boolean }> {
  return request<{ ok: boolean; aiConfigured: boolean }>('/api/health');
}

export async function askAi(
  prompt: string,
  system: string,
  settings: AiSettings,
): Promise<string> {
  const body = await request<{ text: string }>('/api/ai', {
    method: 'POST',
    body: JSON.stringify({
      prompt,
      system,
      ai: settings.enabled
        ? { baseUrl: settings.baseUrl, model: settings.model, apiKey: settings.apiKey }
        : undefined,
    }),
  });
  return body.text;
}
