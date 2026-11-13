import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { routeApi } from '../shared/api';
import { MemoryKv, Repository } from '../shared/store';
import { resetRateLimits } from '../shared/rate-limit';

const PASSWORD = 'ForgePass123!';
const CLIENT_IP = '203.0.113.9';

let store: Repository;

beforeEach(() => {
  resetRateLimits();
  store = new Repository(new MemoryKv());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function call(method: string, path: string, body?: unknown, cookie?: string) {
  return routeApi({ method, path, body, headers: cookie ? { cookie } : {}, env: {}, store });
}

async function register(email: string) {
  const response = await call('POST', '/api/auth/register', { email, password: PASSWORD, name: 'Hardening' });
  expect(response.status).toBe(200);
  return (response.headers?.['Set-Cookie'] ?? '').split(';')[0] ?? '';
}

describe('request correlation and error handling', () => {
  it('echoes a caller supplied request id and generates one when absent', async () => {
    const explicit = await routeApi({
      path: '/api/health',
      method: 'GET',
      requestId: 'req-test-123',
      store,
    });
    expect(explicit.headers?.['x-request-id']).toBe('req-test-123');

    const generated = await call('GET', '/api/health');
    expect(generated.headers?.['x-request-id']).toBeTruthy();
    expect(generated.headers?.['x-request-id']).not.toBe('req-test-123');
  });

  it('answers an unexpected storage failure with JSON instead of crashing', async () => {
    const broken = new Repository(new MemoryKv());
    (broken as unknown as { getProviders: () => Promise<never> }).getProviders = async () => {
      throw new Error('storage offline: /var/secret/path');
    };

    const response = await routeApi({
      path: '/api/ai',
      method: 'POST',
      body: { prompt: 'Write a tagline' },
      store: broken,
    });

    expect(response.status).toBe(500);
    const body = response.body as { error: string; requestId: string };
    expect(body.error).toBe('The server could not complete that request.');
    expect(body.requestId).toBeTruthy();
    // Internal paths and stack details never reach the client.
    expect(JSON.stringify(response.body)).not.toContain('storage offline');
    expect(JSON.stringify(response.body)).not.toContain('/var/secret/path');
  });

  it('returns JSON 404s for unknown routes', async () => {
    const response = await call('GET', '/api/nope');
    expect(response.status).toBe(404);
    expect(typeof (response.body as { error: string }).error).toBe('string');
    expect(response.headers?.['Content-Type']).toContain('application/json');
  });
});

describe('rate limiting', () => {
  it('throttles repeated credential attempts from one address', async () => {
    let limited: Awaited<ReturnType<typeof routeApi>> | null = null;

    for (let index = 0; index < 31; index += 1) {
      const response = await routeApi({
        path: '/api/auth/login',
        method: 'POST',
        body: { email: `probe${index}@example.com`, password: PASSWORD },
        headers: {},
        env: {},
        store,
        clientIp: CLIENT_IP,
      });
      if (response.status === 429) {
        limited = response;
        break;
      }
      expect(response.status).toBe(401);
    }

    expect(limited, 'the 31st credential attempt should be throttled').toBeTruthy();
    expect((limited!.body as { retryAfter: number }).retryAfter).toBeGreaterThan(0);
    expect(Number(limited!.headers?.['Retry-After'])).toBeGreaterThan(0);
  });

  it('keeps budgets separate per caller and skips internal calls', async () => {
    for (let index = 0; index < 31; index += 1) {
      await routeApi({
        path: '/api/auth/login',
        method: 'POST',
        body: { email: `a${index}@example.com`, password: PASSWORD },
        headers: {},
        env: {},
        store,
        clientIp: CLIENT_IP,
      });
    }

    const otherClient = await routeApi({
      path: '/api/auth/login',
      method: 'POST',
      body: { email: 'fresh@example.com', password: PASSWORD },
      headers: {},
      env: {},
      store,
      clientIp: '198.51.100.4',
    });
    expect(otherClient.status).toBe(401);

    // No client address means an in-process call, which is never throttled.
    for (let index = 0; index < 40; index += 1) {
      const internal = await call('POST', '/api/auth/login', {
        email: `internal${index}@example.com`,
        password: PASSWORD,
      });
      expect(internal.status).toBe(401);
    }
  });
});

describe('AI provider credentials stay server side', () => {
  it('calls the configured provider with the stored key and never returns it', async () => {
    const admin = await register('admin@example.com');
    const saved = await call(
      'PUT',
      '/api/admin/providers',
      { apiKey: 'server-only-key', baseUrl: 'https://ai.example.com/v1', model: 'forge-1', enabled: true },
      admin,
    );
    expect(saved.status).toBe(200);

    const upstream = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: 'Roast. Pour. Repeat.' } }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', upstream);

    const response = await call('POST', '/api/ai', { prompt: 'Write a tagline', system: 'Be brief.' });
    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body)).toContain('Roast. Pour. Repeat.');
    expect(JSON.stringify(response.body)).not.toContain('server-only-key');

    expect(upstream).toHaveBeenCalledTimes(1);
    const [url, init] = upstream.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(url)).toBe('https://ai.example.com/v1/chat/completions');
    const headers = new Headers(init.headers as HeadersInit);
    expect(headers.get('authorization')).toBe('Bearer server-only-key');
  });

  it('rejects non-public or insecure provider endpoints', async () => {
    const insecure = await call('POST', '/api/ai', {
      prompt: 'hi',
      ai: { apiKey: 'k', baseUrl: 'http://ai.example.com/v1', model: 'm', enabled: true },
    });
    expect(insecure.status).toBe(400);

    const local = await call('POST', '/api/ai', {
      prompt: 'hi',
      ai: { apiKey: 'k', baseUrl: 'https://localhost/v1', model: 'm', enabled: true },
    });
    expect(local.status).toBe(400);
    expect(JSON.stringify(local.body)).not.toContain('localhost');
  });

  it('reports honestly when no provider is configured', async () => {
    const response = await call('POST', '/api/ai', { prompt: 'hi' });
    expect(response.status).toBe(400);
    expect((response.body as { error: string }).error.toLowerCase()).toContain('no ai provider');
  });
});
