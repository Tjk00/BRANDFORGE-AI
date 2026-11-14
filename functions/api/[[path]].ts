import { routeApi } from '../../shared/api';
import { bootstrapD1, lazyBootstrap, type StoreBootstrap } from '../../shared/bootstrap';
import { logEvent } from '../../shared/logger';
import type { D1Like } from '../../shared/store';

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

let cachedStorage: (() => Promise<StoreBootstrap>) | null = null;

/**
 * Migrations run once per isolate on the first API call, so a fresh D1 database
 * is ready before any account route is served.
 */
function storageFor(env: Env): Promise<StoreBootstrap> {
  if (!cachedStorage) {
    const binding = env.BF_KV;
    cachedStorage = binding
      ? lazyBootstrap(() => bootstrapD1(binding))
      : async () => ({ storage: { mode: 'none' as const, durable: false } });
  }
  return cachedStorage();
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
    const { repository, storage } = await storageFor(context.env);
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
      store: repository,
      storage,
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
