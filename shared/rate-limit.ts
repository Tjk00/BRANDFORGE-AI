/**
 * Fixed-window rate limiting that works on Node, Cloudflare Pages and Workers.
 *
 * The counters live in module memory, so each running instance enforces its own
 * budget. That is enough to stop a single client hammering an endpoint, and it
 * needs no Redis, Durable Object or paid add-on. Account sign-in also keeps its
 * per-email throttle in shared/accounts.ts.
 */

export interface RateLimitRule {
  /** Requests allowed inside one window. */
  max: number;
  windowMs: number;
}

export interface RateLimitOutcome {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}

const windows = new Map<string, { count: number; resetAt: number }>();
const MAX_TRACKED_KEYS = 5000;

function prune(now: number): void {
  for (const [key, entry] of windows) {
    if (now >= entry.resetAt) windows.delete(key);
  }
  if (windows.size >= MAX_TRACKED_KEYS) windows.clear();
}

export function rateLimit(
  bucket: string,
  identity: string,
  rule: RateLimitRule,
  now = Date.now(),
): RateLimitOutcome {
  const key = `${bucket}|${identity}`;
  const entry = windows.get(key);

  if (!entry || now >= entry.resetAt) {
    if (windows.size >= MAX_TRACKED_KEYS) prune(now);
    windows.set(key, { count: 1, resetAt: now + rule.windowMs });
    return { allowed: true, limit: rule.max, remaining: rule.max - 1, retryAfterSeconds: 0 };
  }

  entry.count += 1;
  return {
    allowed: entry.count <= rule.max,
    limit: rule.max,
    remaining: Math.max(0, rule.max - entry.count),
    retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
  };
}

/** Test helper: clear every counter. */
export function resetRateLimits(): void {
  windows.clear();
}

export const RATE_RULES = {
  /** Expensive: one outbound AI request per call. */
  ai: { max: 10, windowMs: 5 * 60_000 },
  /** Outbound platform probes; keeps the host from being used as a scraper. */
  availability: { max: 40, windowMs: 60_000 },
  /** Pure CPU name and copy generation. */
  generate: { max: 90, windowMs: 60_000 },
  /** Credential endpoints, on top of the per-email throttle. */
  auth: { max: 30, windowMs: 60_000 },
} satisfies Record<string, RateLimitRule>;
