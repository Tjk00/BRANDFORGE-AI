import { getPlatform, isPlatformId } from './platforms';
import type { AvailabilityResult, AvailabilityStatus, PlatformId } from './types';

export interface ProbeResponse {
  status: number;
  body: string;
}

export type ProbeFn = (
  platform: PlatformId,
  url: string,
  headers: Record<string, string>,
  accept: string,
) => Promise<ProbeResponse>;

const MAX_BODY = 400_000;

export function normalizeHandle(raw: string): string {
  return raw
    .trim()
    .replace(/^@+/, '')
    .replace(/https?:\/\/[^/]+\//i, '')
    .replace(/[/?#].*$/, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

export function validateHandle(platform: PlatformId, handle: string): string | null {
  const meta = getPlatform(platform);
  if (!handle) return 'Enter a handle to check.';
  if (handle.length < meta.minLength) return `${meta.label} handles need at least ${meta.minLength} characters.`;
  if (handle.length > meta.maxLength) return `${meta.label} handles allow at most ${meta.maxLength} characters.`;
  if (!meta.handlePattern.test(handle)) return `${meta.label} allows only letters, numbers, dots, underscores or hyphens.`;
  return null;
}

function result(
  platform: PlatformId,
  handle: string,
  status: AvailabilityStatus,
  confidence: 'verified' | 'unconfirmed',
  evidence: string,
  httpStatus: number | null,
): AvailabilityResult {
  return {
    platform,
    handle,
    status,
    confidence,
    evidence,
    profileUrl: getPlatform(platform).profileUrl(handle),
    httpStatus,
    checkedAt: new Date().toISOString(),
  };
}

const YT_UNAVAILABLE = /This page isn['’]t available|isn['’]t available|Page not found/i;

/**
 * Turns a raw platform response into a result.
 * "verified" is only used when the platform itself gave a definitive answer:
 * a hard 404 (no such profile) or a payload that proves the profile exists.
 */
export function interpretProbe(
  platform: PlatformId,
  handle: string,
  res: ProbeResponse,
): AvailabilityResult {
  const { status, body } = res;

  if (status === 404) {
    return result(
      platform,
      handle,
      'available',
      'verified',
      `The platform answered HTTP 404 for this handle, so no public profile currently exists there.`,
      404,
    );
  }

  if (status === 429) {
    return result(
      platform,
      handle,
      'unconfirmed',
      'unconfirmed',
      'The platform rate limited the automated check (HTTP 429). Open the profile link to confirm by hand.',
      429,
    );
  }

  if (platform === 'youtube') {
    if (status === 200 && /"channelId"\s*:/.test(body)) {
      return result(platform, handle, 'taken', 'verified', 'YouTube served the channel page with a channelId, so this handle is in use.', 200);
    }
    if (status === 200 && YT_UNAVAILABLE.test(body)) {
      return result(platform, handle, 'available', 'verified', 'YouTube returned its "page not available" response for this handle.', 200);
    }
  }

  if (platform === 'reddit') {
    if (status === 200) {
      const parsed = safeJson(body);
      const name = parsed && typeof parsed === 'object' ? (parsed as { data?: { name?: unknown } }).data?.name : undefined;
      if (typeof name === 'string' && name.length > 0) {
        return result(platform, handle, 'taken', 'verified', `Reddit returned a public user record for u/${name}.`, 200);
      }
      return result(
        platform,
        handle,
        'unconfirmed',
        'unconfirmed',
        'Reddit replied with a body that did not contain a user record. Confirm by hand.',
        200,
      );
    }
    if (status === 403) {
      return result(
        platform,
        handle,
        'unconfirmed',
        'unconfirmed',
        'Reddit blocked the automated request from this network (HTTP 403). Open the profile link to confirm by hand.',
        403,
      );
    }
  }

  if (status >= 300 && status < 400) {
    return result(
      platform,
      handle,
      'unconfirmed',
      'unconfirmed',
      `The platform redirected the request (HTTP ${status}), typically to a login wall, so the answer cannot be verified automatically.`,
      status,
    );
  }

  if (status === 200) {
    return result(
      platform,
      handle,
      'unconfirmed',
      'unconfirmed',
      'The platform served a page that does not state whether the handle is free (client-rendered or login-gated). Open the profile link to confirm by hand.',
      200,
    );
  }

  return result(
    platform,
    handle,
    'unconfirmed',
    'unconfirmed',
    `The platform answered HTTP ${status}, which is not a definitive availability signal.`,
    status,
  );
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function createHttpProbe(timeoutMs = 9000): ProbeFn {
  return async (platform, url, headers, accept) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: accept,
          ...headers,
        },
      });
      const text = await res.text();
      return { status: res.status, body: text.slice(0, MAX_BODY) };
    } catch (err) {
      const message = err instanceof Error && err.name === 'AbortError' ? 'timed out' : 'failed';
      throw new Error(`Request to ${platform} ${message}`);
    } finally {
      clearTimeout(timer);
    }
  };
}

export interface CheckRequest {
  handle: string;
  platforms: PlatformId[];
}

export async function checkHandle(
  handle: string,
  platforms: PlatformId[],
  probe: ProbeFn,
): Promise<AvailabilityResult[]> {
  const clean = normalizeHandle(handle);
  const valid = platforms.filter((p): p is PlatformId => isPlatformId(p));

  const results = await Promise.all(
    valid.map(async (platform): Promise<AvailabilityResult> => {
      const meta = getPlatform(platform);
      const problem = validateHandle(platform, clean);
      if (problem) {
        return result(platform, clean, 'invalid', 'unconfirmed', problem, null);
      }
      if (!meta.probe) {
        return result(
          platform,
          clean,
          'unconfirmed',
          'unconfirmed',
          `${meta.label} has no public endpoint for this check. Open the profile link to confirm by hand.`,
          null,
        );
      }
      try {
        const res = await probe(platform, meta.probe.url(clean), meta.probe.headers ?? {}, meta.probe.accept);
        return interpretProbe(platform, clean, res);
      } catch (err) {
        return result(
          platform,
          clean,
          'unconfirmed',
          'unconfirmed',
          `${err instanceof Error ? err.message : 'The request failed'}. Open the profile link to confirm by hand.`,
          null,
        );
      }
    }),
  );

  return results;
}

export function applyManualResult(
  entry: AvailabilityResult,
  manual: 'available' | 'taken',
): AvailabilityResult {
  return {
    ...entry,
    status: manual,
    confidence: 'unconfirmed',
    manual,
    evidence: `Recorded by you after a manual check on ${new Date(entry.checkedAt).toLocaleDateString()}. Not verified by BRANDFORGE.`,
  };
}

export function summarize(results: AvailabilityResult[]) {
  return {
    available: results.filter((r) => r.status === 'available').length,
    taken: results.filter((r) => r.status === 'taken').length,
    unconfirmed: results.filter((r) => r.status === 'unconfirmed').length,
    invalid: results.filter((r) => r.status === 'invalid').length,
    verified: results.filter((r) => r.confidence === 'verified').length,
  };
}
