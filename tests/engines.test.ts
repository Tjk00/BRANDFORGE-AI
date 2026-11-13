import { describe, expect, it } from 'vitest';
import { generateNames, normalizeNameInput, slugify } from '../shared/names';
import { generateCopy, TONE_OPTIONS, truncate } from '../shared/copy';
import { renderLogo, LOGO_STYLES, initialsOf, escapeXml } from '../shared/logo';
import { BANNERS, AVATAR_STYLES, renderAvatar, renderBanner, getBanner } from '../shared/graphics';
import { PALETTES } from '../shared/palettes';
import { NICHES, getNiche, researchLinks } from '../shared/niches';
import { PLATFORM_IDS, PLATFORMS, getPlatform } from '../shared/platforms';

const palette = PALETTES[0];

describe('name generation', () => {
  it('returns exactly the requested number of unique names (50 and 100)', () => {
    for (const count of [50, 100]) {
      const names = generateNames({ keywords: ['coffee'], target: 'business', count, styles: [], seed: 'seed-a' });
      expect(names).toHaveLength(count);
      const unique = new Set(names.map((n) => n.name.toLowerCase()));
      expect(unique.size).toBe(count);
      for (const entry of names) {
        expect(entry.name.trim().length).toBeGreaterThan(1);
        expect(entry.slug).toBe(slugify(entry.name));
        expect(entry.score).toBeGreaterThanOrEqual(20);
        expect(entry.score).toBeLessThanOrEqual(98);
      }
    }
  });

  it('is deterministic for the same seed and different across seeds', () => {
    const request = { keywords: ['fitness'], target: 'youtube' as const, count: 20, styles: [], seed: 'fixed' };
    const a = generateNames(request).map((n) => n.name);
    const b = generateNames(request).map((n) => n.name);
    const c = generateNames({ ...request, seed: 'other' }).map((n) => n.name);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('caps output at 100 even when asked for more', () => {
    expect(generateNames({ keywords: ['art'], target: 'social', count: 500, styles: [], seed: 'x' })).toHaveLength(100);
  });

  it('respects an explicit style selection', () => {
    const names = generateNames({ keywords: ['tea'], target: 'business', count: 12, styles: ['alliterative'], seed: 's' });
    expect(names.every((n) => n.style === 'alliterative')).toBe(true);
  });

  it('normalises keyword input and slugs safely', () => {
    expect(normalizeNameInput('coffee, beans;  Roastery')).toEqual(['coffee', 'beans', 'Roastery']);
    expect(slugify('Ember & Oak!')).toBe('ember-oak');
  });
});

describe('copy generation', () => {
  const input = {
    name: 'Ember & Oak',
    niche: NICHES[0],
    keywords: ['coffee', 'roasting'],
    audience: 'home baristas',
    tone: 'friendly',
  };

  it('produces every deliverable with usable content', () => {
    const copy = generateCopy(input);
    expect(copy.taglines.length).toBeGreaterThanOrEqual(5);
    expect(copy.slogans.length).toBeGreaterThanOrEqual(5);
    expect(copy.youtubeDescription.length).toBeGreaterThan(120);
    expect(copy.youtubeDescription.length).toBeLessThanOrEqual(5000);
    expect(copy.brandStory.length).toBeGreaterThan(80);
    expect(copy.mission.length).toBeGreaterThan(20);
    expect(copy.keywords.length).toBeGreaterThan(2);
    for (const platform of PLATFORM_IDS) {
      const bio = copy.socialBios[platform];
      expect(typeof bio).toBe('string');
      expect(bio.length).toBeGreaterThan(10);
      expect(bio.length).toBeLessThanOrEqual(getPlatform(platform).bioLimit);
    }
  });

  it('mentions the brand name and supports every tone', () => {
    for (const tone of TONE_OPTIONS) {
      const copy = generateCopy({ ...input, tone });
      expect(copy.taglines.some((t) => t.includes('Ember'))).toBe(true);
    }
  });

  it('truncates to platform limits without breaking mid-word', () => {
    const long = 'word '.repeat(200).trim();
    const out = truncate(long, 50);
    expect(out.length).toBeLessThanOrEqual(50);
    expect(out.endsWith(' ')).toBe(false);
  });
});

describe('logo generation', () => {
  it('renders a valid SVG for every style', () => {
    for (const style of LOGO_STYLES) {
      const svg = renderLogo({ text: 'Ember & Oak', subtext: 'Roastery', style: style.id, palette });
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
      expect(svg).toContain('viewBox');
      expect(svg.length).toBeGreaterThan(300);
    }
  });

  it('escapes user text so markup cannot be injected', () => {
    const svg = renderLogo({ text: '<script>alert(1)</script>', style: 'wordmark', palette });
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
    expect(escapeXml('a & b < c > d "e"')).toBe('a &amp; b &lt; c &gt; d &quot;e&quot;');
  });

  it('derives initials for monograms', () => {
    expect(initialsOf('Ember & Oak')).toBe('EO');
    expect(initialsOf('brandforge')).toBe('BR');
  });
});

describe('social graphics', () => {
  it('renders profile pictures in every style', () => {
    for (const style of AVATAR_STYLES) {
      const svg = renderAvatar({ name: 'Ember & Oak', palette, size: 512, style: style.id });
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg).toContain('width="512"');
      expect(svg).toContain('height="512"');
    }
  });

  it('renders every banner at its real platform dimensions', () => {
    expect(BANNERS.length).toBeGreaterThanOrEqual(5);
    const ids = BANNERS.map((b) => b.id);
    for (const required of ['youtube-banner', 'facebook-cover', 'x-header']) {
      expect(ids).toContain(required);
    }
    for (const spec of BANNERS) {
      const svg = renderBanner({ spec, name: 'Ember & Oak', tagline: 'Roast better coffee', handle: '@emberandoak', palette });
      expect(svg).toContain(`width="${spec.width}"`);
      expect(svg).toContain(`height="${spec.height}"`);
      expect(svg).toContain('viewBox');
    }
    expect(getBanner('youtube-banner')?.width).toBe(2560);
    expect(getBanner('nope')).toBeUndefined();
  });
});

describe('research library', () => {
  it('ships real niches with working research links', () => {
    expect(NICHES.length).toBeGreaterThanOrEqual(12);
    for (const niche of NICHES) {
      expect(niche.label.length).toBeGreaterThan(2);
      expect(niche.audience.length).toBeGreaterThanOrEqual(3);
      for (const segment of niche.audience) {
        expect(segment.trim().length).toBeGreaterThan(2);
      }
      expect(niche.keywords.length).toBeGreaterThan(2);
      const links = researchLinks(niche);
      expect(links.length).toBeGreaterThan(2);
      for (const link of links) {
        expect(link.url.startsWith('https://')).toBe(true);
      }
    }
  });

  it('looks niches up by id', () => {
    const first = NICHES[0];
    expect(getNiche(first.id)?.id).toBe(first.id);
    expect(getNiche('does-not-exist')).toBeNull();
  });
});

describe('platform registry', () => {
  it('covers all ten requested platforms with real URLs and limits', () => {
    expect(PLATFORM_IDS).toHaveLength(10);
    for (const id of ['youtube', 'tiktok', 'instagram', 'facebook', 'x', 'pinterest', 'threads', 'linkedin', 'twitch', 'reddit'] as const) {
      expect(PLATFORM_IDS).toContain(id);
    }
    for (const platform of PLATFORMS) {
      expect(platform.profileUrl('brandforge')).toMatch(/^https:\/\//);
      expect(platform.bioLimit).toBeGreaterThan(0);
      expect(platform.handlePattern.test('brandforge')).toBe(true);
      expect(platform.handlePattern.test('bad handle!')).toBe(false);
    }
  });
});
