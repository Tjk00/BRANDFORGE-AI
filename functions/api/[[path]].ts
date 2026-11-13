import { routeApi } from '../../shared/api';
import { logEvent } from '../../shared/logger';
import { D1Kv, Repository, type D1Like } from '../../shared/store';

/**
 * Cloudflare Pages Function: /api/*
 *
 * Reuses the same shared router as the Express server and the Worker, so
 * behaviour, rate limiting and logging are identical on every host. Accounts use
 * the D1 binding when configured; without it the studio still runs in local-only
 * mode and every API route answers honestly.
 */
interface Env {
  AI_API_KEY?: string;
  AI_BASE_URL?: string;
  AI_MODEL?: string;
  ADMIN_EMAIL?: string;
  BF_KV?: D1Like;
}

interface PagesContext {
  request: Request;
  env: Env;
}

let cachedRepository: Repository | null = null;

function repositoryFor(env: Env): Repository | undefined {
  if (!env.BF_KV) return undefined;
  if (!cachedRepository) cachedRepository = new Repository(new D1Kv(env.BF_KV));
  return cachedRepository;
}

function requestIdFor(request: Request): string {
  const incoming = request.headers.get('x-request-id');
  if (incoming && incoming.length <= 64) return incoming;
  const cryptoApi = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return cryptoApi?.randomUUID?.() ?? `req_${Date.now().toString(36)}`;
}

function clientIpFor(request: Request): string | undefined {
  return (
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    undefined
  );
}

export const onRequest = async (context: PagesContext): Promise<Response> => {
  const requestId = requestIdFor(context.request);
  const url = new URL(context.request.url);
  const method = context.request.method;

  try {
    let body: unknown;
    if (method !== 'GET' && method !== 'HEAD') {
      try {
        body = await context.request.json();
      } catch {
        body = undefined;
      }
    }

    const result = await routeApi({
      path: url.pathname,
      method,
      body,
      headers: Object.fromEntries(context.request.headers.entries()),
      env: {
        AI_API_KEY: context.env.AI_API_KEY,
        AI_BASE_URL: context.env.AI_BASE_URL,
        AI_MODEL: context.env.AI_MODEL,
        ADMIN_EMAIL: context.env.ADMIN_EMAIL,
      },
      store: repositoryFor(context.env),
      clientIp: clientIpFor(context.request),
      requestId,
    });

    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'x-request-id': requestId,
        ...(result.headers ?? {}),
      },
    });
  } catch (error) {
    logEvent('error', 'pages.unhandled', {
      requestId,
      path: url.pathname,
      error: error instanceof Error ? error.message : String(error),
    });
    return new Response(
      JSON.stringify({ error: 'The server could not complete that request.', requestId }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'x-request-id': requestId },
      },
    );
  }
};
