import { describe, expect, it } from 'vitest';
import { routeApi } from '../shared/api';

const call = (path: string, method: string, body?: unknown) => routeApi({ path, method, body });

describe('api router', () => {
  it('reports health without any AI key configured', async () => {
    const res = await call('/api/health', 'GET');
    expect(res.status).toBe(200);
    const body = res.body as { ok: boolean; aiConfigured: boolean; platforms: number; niches: number };
    expect(body.ok).toBe(true);
    expect(body.aiConfigured).toBe(false);
    expect(body.platforms).toBe(10);
    expect(body.niches).toBeGreaterThanOrEqual(12);
  });

  it('serves the platform, niche and palette catalogues', async () => {
    const platforms = (await call('/api/platforms', 'GET')).body as { platforms: unknown[] };
    expect(platforms.platforms).toHaveLength(10);
    const niches = (await call('/api/niches', 'GET')).body as { niches: unknown[] };
    expect(niches.niches.length).toBeGreaterThanOrEqual(12);
    const palettes = (await call('/api/palettes', 'GET')).body as { palettes: unknown[] };
    expect(palettes.palettes.length).toBeGreaterThanOrEqual(10);
  });

  it('generates names over the API', async () => {
    const res = await call('/api/names', 'POST', {
      keywords: ['coffee', 'roastery'],
      target: 'youtube',
      count: 60,
      styles: [],
      seed: 'api-seed',
    });
    expect(res.status).toBe(200);
    const body = res.body as { names: { name: string; slug: string }[] };
    expect(body.names).toHaveLength(60);
    expect(new Set(body.names.map((n) => n.name)).size).toBe(60);
  });

  it('generates copy over the API', async () => {
    const res = await call('/api/copy', 'POST', {
      name: 'Ember & Oak',
      nicheId: 'specialty-coffee',
      keywords: ['coffee'],
      audience: 'home baristas',
      tone: 'bold',
    });
    expect(res.status).toBe(200);
    const body = res.body as { copy: { youtubeDescription: string; taglines: string[] } };
    expect(body.copy.youtubeDescription.length).toBeGreaterThan(100);
    expect(body.copy.taglines.length).toBeGreaterThan(0);
  });

  it('rejects invalid payloads with a helpful message', async () => {
    const res = await call('/api/names', 'POST', {});
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect((res.body as { error: string }).error.length).toBeGreaterThan(3);
  });

  it('flags invalid handles per platform without claiming availability', async () => {
    const res = await call('/api/availability', 'POST', { handle: 'bad handle!', platforms: ['youtube', 'linkedin'] });
    expect(res.status).toBe(200);
    const body = res.body as { results: { platform: string; status: string; evidence: string }[] };
    expect(body.results).toHaveLength(2);
    for (const result of body.results) {
      expect(result.status).toBe('invalid');
      expect(result.evidence.length).toBeGreaterThan(3);
    }
  });

  it('refuses AI calls with a clear message when no provider is configured', async () => {
    const res = await call('/api/ai', 'POST', { prompt: 'hi', system: 'x' });
    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error.toLowerCase()).toContain('no ai provider');
  });

  it('returns 404 for unknown routes', async () => {
    const res = await call('/api/does-not-exist', 'GET');
    expect(res.status).toBe(404);
  });
});
