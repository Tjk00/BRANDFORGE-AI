import { routeApi } from '../../shared/api';
import { D1Kv, Repository, type D1Like } from '../../shared/store';

/**
 * Cloudflare Pages Function: /api/*
 *
 * Mirrors the Express server exactly by reusing the same shared router, so
 * behaviour on Pages, Workers and Node is identical. Accounts use the D1 binding
 * when one is configured; without it the studio still runs in local-only mode.
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

export const onRequest = async (context: PagesContext): Promise<Response> => {
  const url = new URL(context.request.url);
  const method = context.request.method;

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
  });

  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...(result.headers ?? {}),
    },
  });
};
