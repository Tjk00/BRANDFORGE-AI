import { routeApi } from '../../shared/api';

/**
 * Cloudflare Pages Function: /api/*
 * Mirrors the Express server exactly by reusing the same shared router,
 * so behaviour on Pages, Workers and Node is identical.
 */
interface Env {
  AI_API_KEY?: string;
  AI_BASE_URL?: string;
  AI_MODEL?: string;
}

interface PagesContext {
  request: Request;
  env: Env;
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
    env: {
      AI_API_KEY: context.env.AI_API_KEY,
      AI_BASE_URL: context.env.AI_BASE_URL,
      AI_MODEL: context.env.AI_MODEL,
    },
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
