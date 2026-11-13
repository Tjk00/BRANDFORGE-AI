import { describe, expect, it } from 'vitest';
import {
  applyManualResult,
  interpretProbe,
  normalizeHandle,
  summarize,
  validateHandle,
} from '../shared/availability';

describe('handle normalisation and validation', () => {
  it('strips @, spaces and profile URLs', () => {
    expect(normalizeHandle('  @BrandForge ')).toBe('brandforge');
    expect(normalizeHandle('https://www.youtube.com/@brandforge')).toBe('brandforge');
    expect(normalizeHandle('tiktok.com/@brand.forge')).toBe('brand.forge');
  });

  it('enforces per-platform rules', () => {
    expect(validateHandle('youtube', 'brandforge')).toBeNull();
    expect(validateHandle('youtube', 'ab')).not.toBeNull();
    expect(validateHandle('youtube', 'bad handle')).not.toBeNull();
    expect(validateHandle('linkedin', 'brandforge')).toBeNull();
    expect(validateHandle('linkedin', 'brand_forge')).not.toBeNull();
  });
});

describe('probe interpretation — verified only on definitive answers', () => {
  it('treats a hard 404 as verified available', () => {
    const result = interpretProbe('youtube', 'freehandle', { status: 404, body: 'Not Found' });
    expect(result.status).toBe('available');
    expect(result.confidence).toBe('verified');
    expect(result.httpStatus).toBe(404);
  });

  it('treats a YouTube channel page with channelId as verified taken', () => {
    const result = interpretProbe('youtube', 'mrbeast', { status: 200, body: '{"channelId":"UCX6OQ3DkcsbYNE6H8uQQuVA"}' });
    expect(result.status).toBe('taken');
    expect(result.confidence).toBe('verified');
  });

  it('treats the YouTube "page not available" shell as verified available', () => {
    const result = interpretProbe('youtube', 'freehandle', { status: 200, body: '<title>This page isn\'t available</title>' });
    expect(result.status).toBe('available');
    expect(result.confidence).toBe('verified');
  });

  it('never claims verified availability from a login wall or identical shell', () => {
    for (const platform of ['tiktok', 'instagram', 'x', 'facebook', 'pinterest', 'threads', 'twitch', 'linkedin'] as const) {
      const result = interpretProbe(platform, 'somehandle', {
        status: 200,
        body: '<html><body>Please log in. Couldn\'t find this account</body></html>',
      });
      expect(result.confidence).toBe('unconfirmed');
      expect(result.status).toBe('unconfirmed');
      expect(result.evidence.length).toBeGreaterThan(20);
    }
  });

  it('reports rate limiting and server errors as unconfirmed, not available', () => {
    expect(interpretProbe('instagram', 'x', { status: 429, body: '' }).status).toBe('unconfirmed');
    expect(interpretProbe('reddit', 'x', { status: 503, body: '' }).status).toBe('unconfirmed');
    expect(interpretProbe('reddit', 'x', { status: 403, body: 'blocked' }).status).toBe('unconfirmed');
  });

  it('always exposes a profile URL so the user can confirm by hand', () => {
    const result = interpretProbe('twitch', 'ninja', { status: 200, body: '<html></html>' });
    expect(result.profileUrl).toBe('https://www.twitch.tv/ninja');
    expect(result.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('manual overrides and summaries', () => {
  it('marks manual entries as unconfirmed and says who recorded them', () => {
    const base = interpretProbe('tiktok', 'name', { status: 200, body: '' });
    const manual = applyManualResult(base, 'taken');
    expect(manual.status).toBe('taken');
    expect(manual.confidence).toBe('unconfirmed');
    expect(manual.manual).toBe('taken');
    expect(manual.evidence.toLowerCase()).toContain('recorded by you');
  });

  it('counts every status including verified totals', () => {
    const results = [
      interpretProbe('youtube', 'a', { status: 404, body: '' }),
      interpretProbe('youtube', 'b', { status: 200, body: '"channelId": "x"' }),
      interpretProbe('tiktok', 'c', { status: 200, body: '' }),
      interpretProbe('x', 'bad handle!', { status: 200, body: '' }),
    ];
    const summary = summarize(results);
    expect(summary.available).toBe(1);
    expect(summary.taken).toBe(1);
    expect(summary.unconfirmed).toBe(2);
    expect(summary.verified).toBe(2);
  });
});
