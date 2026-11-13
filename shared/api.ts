import { checkHandle, createHttpProbe, normalizeHandle, validateHandle } from './availability';
import { generateCopy, TONE_OPTIONS } from './copy';
import { generateNames, normalizeNameInput } from './names';
import { getNiche, NICHES } from './niches';
import { PALETTES } from './palettes';
import { getPlatform, isPlatformId, PLATFORMS, PLATFORM_IDS } from './platforms';
import { routeAccounts } from './accounts';
import type { Repository } from './store';
import type { AiSettings, NameStyle, NameTarget, PlatformId } from './types';

export interface ApiRequest {
  method: string;
  path: string;
  body?: unknown;
  env?: Record<string, string | undefined>;
  /** Request headers, used for session cookies and client IP. */
  headers?: Record<string, string | undefined>;
  /** Present when the host has a storage driver (file on Node, D1 on Cloudflare). */
  store?: Repository;
}

export interface ApiResponse {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };

function ok(body: unknown): ApiResponse {
  return { status: 200, body, headers: JSON_HEADERS };
}

function fail(status: number, error: string, detail?: string): ApiResponse {
  return { status, body: { error, detail }, headers: JSON_HEADERS };
}

function asRecord(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

function stringList(value: unknown, max = 6): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((v): v is string => typeof v === 'string')
      .map((v) => v.trim())
      .filter(Boolean)
      .slice(0, max);
  }
  if (typeof value === 'string') return normalizeNameInput(value);
  return [];
}

function publicPlatforms() {
  return PLATFORMS.map((p) => ({
    id: p.id,
    label: p.label,
    group: p.group,
    color: p.color,
    minLength: p.minLength,
    maxLength: p.maxLength,
    autoCheckable: p.autoCheckable,
    verificationNote: p.verificationNote,
    avatarSize: p.avatarSize,
    bioLimit: p.bioLimit,
    profileUrlTemplate: p.profileUrl('{handle}'),
    handlePattern: p.handlePattern.source,
  }));
}

/* ---------------------------------------------------------------- availability */

const CACHE_TTL_MS = 45_000;
const cache = new Map<string, { at: number; body: unknown }>();

export function clearAvailabilityCache(): void {
  cache.clear();
}

async function availability(payload: Record<string, unknown>): Promise<ApiResponse> {
  const handle = normalizeHandle(String(payload.handle ?? ''));
  if (!handle) return fail(400, 'Enter a brand handle to check.');

  const requested = Array.isArray(payload.platforms)
    ? payload.platforms.filter((p): p is PlatformId => typeof p === 'string' && isPlatformId(p))
    : [];
  const platforms = requested.length > 0 ? requested : PLATFORM_IDS;

  const invalid = platforms
    .map((platform) => ({ platform, problem: validateHandle(platform, handle) }))
    .filter((entry) => entry.problem !== null);
  const checkable = platforms.filter((platform) => validateHandle(platform, handle) === null);

  if (checkable.length === 0) {
    return ok({
      handle,
      results: platforms.map((platform) => ({
        platform,
        handle,
        status: 'invalid',
        confidence: 'unconfirmed',
        evidence: validateHandle(platform, handle) ?? 'Invalid handle.',
        profileUrl: getPlatform(platform).profileUrl(handle),
        httpStatus: null,
        checkedAt: new Date().toISOString(),
      })),
      summary: { available: 0, taken: 0, unconfirmed: 0, invalid: platforms.length, verified: 0 },
      invalid,
    });
  }

  const key = `${handle}|${checkable.slice().sort().join(',')}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return ok(hit.body);
  }

  const results = await checkHandle(handle, checkable, createHttpProbe());
  const invalidResults = invalid.map(({ platform, problem }) => ({
    platform,
    handle,
    status: 'invalid' as const,
    confidence: 'unconfirmed' as const,
    evidence: problem ?? 'Invalid handle.',
    profileUrl: getPlatform(platform).profileUrl(handle),
    httpStatus: null,
    checkedAt: new Date().toISOString(),
  }));

  const all = [...results, ...invalidResults].sort(
    (a, b) => PLATFORM_IDS.indexOf(a.platform) - PLATFORM_IDS.indexOf(b.platform),
  );

  const body = {
    handle,
    results: all,
    summary: {
      available: all.filter((r) => r.status === 'available').length,
      taken: all.filter((r) => r.status === 'taken').length,
      unconfirmed: all.filter((r) => r.status === 'unconfirmed').length,
      invalid: all.filter((r) => r.status === 'invalid').length,
      verified: all.filter((r) => r.confidence === 'verified').length,
    },
  };

  cache.set(key, { at: Date.now(), body });
  return ok(body);
}

/* ------------------------------------------------------------------------ names */

function names(payload: Record<string, unknown>): ApiResponse {
  const keywords = stringList(payload.keywords, 6);
  if (keywords.length === 0) return fail(400, 'Add at least one keyword, niche or idea to generate names.');

  const target = (['business', 'youtube', 'social'] as NameTarget[]).includes(payload.target as NameTarget)
    ? (payload.target as NameTarget)
    : 'business';
  const styles = Array.isArray(payload.styles)
    ? (payload.styles.filter((s): s is NameStyle => typeof s === 'string') as NameStyle[])
    : [];
  const rawCount = Number(payload.count ?? 60);
  const count = Number.isFinite(rawCount) ? Math.min(100, Math.max(10, Math.round(rawCount))) : 60;

  const generated = generateNames({
    keywords,
    target,
    count,
    styles,
    seed: typeof payload.seed === 'string' ? payload.seed : keywords.join('-'),
  });

  return ok({ names: generated, count: generated.length, keywords, target });
}

/* ------------------------------------------------------------------------- copy */

function copy(payload: Record<string, unknown>): ApiResponse {
  const name = String(payload.name ?? '').trim();
  if (!name) return fail(400, 'Choose a brand name before generating copy.');

  const nicheId = typeof payload.nicheId === 'string' ? payload.nicheId : null;
  const niche = getNiche(nicheId);
  const tone = typeof payload.tone === 'string' && TONE_OPTIONS.includes(payload.tone) ? payload.tone : 'friendly';

  const result = generateCopy({
    name,
    niche,
    keywords: stringList(payload.keywords, 8),
    audience: String(payload.audience ?? ''),
    tone,
  });

  return ok({ copy: result, tone, nicheId: niche?.id ?? null });
}

/* ----------------------------------------------------------------- optional AI */

function isSafeRemoteUrl(raw: string): { ok: true; url: URL } | { ok: false; reason: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: 'The AI base URL is not a valid URL.' };
  }
  if (url.protocol !== 'https:') return { ok: false, reason: 'The AI base URL must use https.' };
  const host = url.hostname.toLowerCase();
  const blocked =
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === '[::1]' ||
    host === '0.0.0.0';
  if (blocked) return { ok: false, reason: 'The AI base URL must point at a public host.' };
  return { ok: true, url };
}

function resolveAi(payload: Record<string, unknown>, env: Record<string, string | undefined>) {
  const incoming = asRecord(payload.ai);
  const settings: AiSettings = {
    enabled: true,
    baseUrl:
      (typeof incoming.baseUrl === 'string' && incoming.baseUrl.trim()) ||
      env.AI_BASE_URL ||
      'https://api.openai.com/v1',
    model:
      (typeof incoming.model === 'string' && incoming.model.trim()) || env.AI_MODEL || 'gpt-4o-mini',
    apiKey: (typeof incoming.apiKey === 'string' && incoming.apiKey.trim()) || env.AI_API_KEY || '',
  };
  return settings;
}

async function ai(
  payload: Record<string, unknown>,
  env: Record<string, string | undefined>,
  store?: Repository,
): Promise<ApiResponse> {
  const settings = resolveAi(payload, env);

  // An administrator-managed key can fill in when no environment key exists.
  if (!settings.apiKey && store) {
    const config = await store.getProviders();
    if (config.enabled && config.apiKey) {
      settings.apiKey = config.apiKey;
      const incoming = asRecord(payload.ai);
      const hasBaseUrl = typeof incoming.baseUrl === 'string' && Boolean(incoming.baseUrl.trim());
      const hasModel = typeof incoming.model === 'string' && Boolean(incoming.model.trim());
      if (!hasBaseUrl && !env.AI_BASE_URL) settings.baseUrl = config.baseUrl;
      if (!hasModel && !env.AI_MODEL) settings.model = config.model;
    }
  }

  if (!settings.apiKey) {
    return fail(
      400,
      'No AI provider key configured.',
      'Add a key in Settings, or set AI_API_KEY on the server. Everything else in BRANDFORGE works without AI.',
    );
  }

  const safe = isSafeRemoteUrl(settings.baseUrl);
  if (!safe.ok) return fail(400, safe.reason);

  const prompt = String(payload.prompt ?? '').slice(0, 6000);
  if (!prompt.trim()) return fail(400, 'Nothing to send to the AI provider.');
  const system =
    String(payload.system ?? '').slice(0, 2000) ||
    'You are a brand strategist. Answer concisely and never invent statistics.';

  const endpoint = `${safe.url.origin}${safe.url.pathname.replace(/\/$/, '')}/chat/completions`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        temperature: 0.8,
        max_tokens: 1200,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
      }),
    });

    const text = await response.text();
    if (!response.ok) {
      const snippet = text.slice(0, 300);
      return fail(
        response.status === 401 || response.status === 403 ? 401 : 502,
        'The AI provider rejected the request.',
        snippet,
      );
    }

    const parsed = JSON.parse(text) as { choices?: { message?: { content?: string } }[] };
    const content = parsed.choices?.[0]?.message?.content ?? '';
    if (!content) return fail(502, 'The AI provider returned an empty response.');
    return ok({ text: content, model: settings.model });
  } catch (err) {
    const reason = err instanceof Error && err.name === 'AbortError' ? 'The AI request timed out.' : 'The AI request failed.';
    return fail(502, reason);
  } finally {
    clearTimeout(timer);
  }
}

/* ----------------------------------------------------------------------- router */

export async function routeApi(request: ApiRequest): Promise<ApiResponse> {
  const path = request.path.replace(/\/+$/, '') || '/';
  const method = request.method.toUpperCase();
  const payload = asRecord(request.body);
  const env = request.env ?? {};

  if (path === '/api/health' || path === '/api') {
    return ok({
      ok: true,
      app: 'BRANDFORGE AI',
      version: '1.0.0',
      aiConfigured: Boolean(env.AI_API_KEY),
      accountsEnabled: Boolean(request.store),
      platforms: PLATFORM_IDS.length,
      niches: NICHES.length,
      palettes: PALETTES.length,
      time: new Date().toISOString(),
    });
  }

  if (path === '/api/platforms' && method === 'GET') {
    return ok({ platforms: publicPlatforms() });
  }

  if (path === '/api/niches' && method === 'GET') {
    return ok({ niches: NICHES });
  }

  if (path === '/api/palettes' && method === 'GET') {
    return ok({ palettes: PALETTES });
  }

  if (path === '/api/names' && method === 'POST') {
    return names(payload);
  }

  if (path === '/api/copy' && method === 'POST') {
    return copy(payload);
  }

  if (path === '/api/availability' && method === 'POST') {
    return availability(payload);
  }

  if (path === '/api/ai' && method === 'POST') {
    return ai(payload, env, request.store);
  }

  if (
    path.startsWith('/api/auth') ||
    path.startsWith('/api/projects') ||
    path.startsWith('/api/admin') ||
    path.startsWith('/api/billing')
  ) {
    if (!request.store) {
      return fail(
        503,
        'Accounts are not enabled on this deployment.',
        'This host has no storage binding. The studio still works locally without an account.',
      );
    }
    const accountResponse = await routeAccounts({
      method,
      path,
      payload,
      env,
      headers: request.headers ?? {},
      store: request.store,
    });
    if (accountResponse) return accountResponse;
  }

  return fail(404, 'Unknown API route.', `${method} ${path}`);
}
