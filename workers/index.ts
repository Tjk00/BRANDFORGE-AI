import { routeApi } from '../shared/api';
import { D1Kv, Repository, type D1Like } from '../shared/store';

/**
 * Standalone Cloudflare Worker entry point.
 * Serves /api/* through the shared router and delegates everything else
 * to the static asset binding configured in workers/wrangler.toml.
 */
interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  AI_API_KEY?: string;
  AI_BASE_URL?: string;
  AI_MODEL?: string;
  ADMIN_EMAIL?: string;
  BF_KV?: D1Like;
}

let cachedRepository: Repository | null = null;

function repositoryFor(env: Env): Repository | undefined {
  if (!env.BF_KV) return undefined;
  if (!cachedRepository) cachedRepository = new Repository(new D1Kv(env.BF_KV));
  return cachedRepository;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      let body: unknown;
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        try {
          body = await request.json();
        } catch {
          body = undefined;
        }
      }

      const result = await routeApi({
        path: url.pathname,
        method: request.method,
        body,
        headers: Object.fromEntries(request.headers.entries()),
        env: {
          AI_API_KEY: env.AI_API_KEY,
          AI_BASE_URL: env.AI_BASE_URL,
          AI_MODEL: env.AI_MODEL,
          ADMIN_EMAIL: env.ADMIN_EMAIL,
        },
        store: repositoryFor(env),
      });

      return new Response(JSON.stringify(result.body), {
        status: result.status,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          ...(result.headers ?? {}),
        },
      });
    }

    return env.ASSETS.fetch(request);
  },
};
