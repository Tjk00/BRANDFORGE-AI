/**
 * Cloudflare D1 over HTTPS.
 *
 * Cloudflare Workers reach D1 through a binding. A plain Node server cannot, so
 * this driver talks to the same database through Cloudflare's documented D1
 * HTTP API instead. It implements the same `D1Like` interface as the binding,
 * which means the identical `Repository`, migrations and tests run on both
 * hosts without a second code path.
 *
 * Credentials are read from the environment at runtime and never reach the
 * browser: this module is only imported by server-side entry points.
 */

import type { D1Like, D1StatementLike } from '../shared/store';

export interface D1HttpConfig {
  accountId: string;
  databaseId: string;
  apiToken: string;
  /** Overridable for tests; defaults to the public Cloudflare API. */
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export class D1HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'D1HttpError';
  }
}

interface D1ApiResult {
  results?: unknown[];
  success?: boolean;
  meta?: Record<string, unknown>;
}

interface D1ApiResponse {
  success?: boolean;
  errors?: { code?: number; message?: string }[];
  result?: D1ApiResult[];
}

class D1HttpStatement implements D1StatementLike {
  constructor(
    private readonly db: D1Http,
    private readonly sql: string,
    private readonly params: unknown[] = [],
  ) {}

  bind(...values: unknown[]): D1StatementLike {
    return new D1HttpStatement(this.db, this.sql, values);
  }

  async first<T = unknown>(): Promise<T | null> {
    const rows = await this.db.query(this.sql, this.params);
    return (rows[0] as T | undefined) ?? null;
  }

  async all<T = unknown>(): Promise<{ results?: T[] }> {
    const rows = await this.db.query(this.sql, this.params);
    return { results: rows as T[] };
  }

  async run(): Promise<unknown> {
    await this.db.query(this.sql, this.params);
    return { success: true };
  }
}

export class D1Http implements D1Like {
  private readonly endpoint: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly config: D1HttpConfig) {
    this.endpoint = `${config.baseUrl ?? 'https://api.cloudflare.com/client/v4'}/accounts/${encodeURIComponent(
      config.accountId,
    )}/d1/database/${encodeURIComponent(config.databaseId)}/query`;
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.timeoutMs = config.timeoutMs ?? 10_000;
  }

  prepare(query: string): D1StatementLike {
    return new D1HttpStatement(this, query);
  }

  async exec(query: string): Promise<unknown> {
    await this.query(query, []);
    return { success: true };
  }

  /** Execute one statement and return its rows. */
  async query(sql: string, params: unknown[]): Promise<unknown[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sql, params }),
        signal: controller.signal,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new D1HttpError(503, `Could not reach Cloudflare D1: ${reason}`);
    } finally {
      clearTimeout(timer);
    }

    const raw = (await response.json().catch(() => ({}))) as D1ApiResponse;

    if (!response.ok || raw.success === false) {
      const detail = (raw.errors ?? [])
        .map((entry) => entry.message ?? `error ${entry.code ?? 'unknown'}`)
        .join('; ');
      throw new D1HttpError(
        response.ok ? 502 : response.status,
        `Cloudflare D1 rejected the query${detail ? `: ${detail}` : ` (HTTP ${response.status})`}`,
      );
    }

    const first = raw.result?.[0];
    if (first && first.success === false) {
      throw new D1HttpError(502, 'Cloudflare D1 reported a failed statement.');
    }
    return first?.results ?? [];
  }
}

export type D1EnvResult =
  | { kind: 'none' }
  | { kind: 'configured'; db: D1Http; accountId: string; databaseId: string }
  | { kind: 'incomplete'; missing: string[] };

const REQUIRED_KEYS = ['D1_ACCOUNT_ID', 'D1_DATABASE_ID', 'CLOUDFLARE_API_TOKEN'] as const;

/**
 * Resolve D1 credentials from the environment.
 *
 * A partially configured database reports `incomplete` instead of falling back
 * to ephemeral file storage, so a typo can never quietly discard data.
 */
export function d1FromEnv(env: Record<string, string | undefined>): D1EnvResult {
  const missing = REQUIRED_KEYS.filter((key) => !env[key]?.trim());
  const anyPresent = REQUIRED_KEYS.some((key) => Boolean(env[key]?.trim()));

  if (missing.length === REQUIRED_KEYS.length) return { kind: 'none' };
  if (missing.length > 0) return { kind: 'incomplete', missing: [...missing] };

  const accountId = env.D1_ACCOUNT_ID as string;
  const databaseId = env.D1_DATABASE_ID as string;

  return {
    kind: 'configured',
    accountId,
    databaseId,
    db: new D1Http({
      accountId: accountId.trim(),
      databaseId: databaseId.trim(),
      apiToken: (env.CLOUDFLARE_API_TOKEN as string).trim(),
      baseUrl: env.D1_API_BASE_URL?.trim() || undefined,
    }),
  };
}
