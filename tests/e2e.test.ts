import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import JSZip from 'jszip';
import { routeApi } from '../shared/api';
import { MemoryKv, Repository } from '../shared/store';
import { PALETTES } from '../shared/palettes';
import { PLATFORM_IDS } from '../shared/platforms';
import { BANNERS } from '../shared/graphics';
import { LOGO_STYLES } from '../shared/logo';
import { buildBrandKitArchive, brandSlug } from '../src/lib/export';
import type { BrandProject } from '../shared/brand';

const PASSWORD = 'ForgePass123!';
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

let store: Repository;

beforeEach(() => {
  store = new Repository(new MemoryKv());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function call(method: string, path: string, body?: unknown, cookie?: string) {
  return routeApi({
    method,
    path,
    body,
    headers: cookie ? { cookie } : {},
    env: {},
    store,
  });
}

function sessionCookie(response: { headers?: Record<string, string> }): string {
  return (response.headers?.['Set-Cookie'] ?? '').split(';')[0] ?? '';
}

async function register(email: string) {
  const response = await call('POST', '/api/auth/register', { email, password: PASSWORD, name: 'E2E Builder' });
  expect(response.status).toBe(200);
  return sessionCookie(response);
}

/**
 * The six-stage journey a real user takes: research, names, handles, design,
 * voice, then a saved project that exports a complete brand kit.
 */
describe('end-to-end brand journey', () => {
  it('runs all six stages and exports every expected asset', async () => {
    const cookie = await register('journey@example.com');

    /* ---------------------------------------------------- stage 1: research */
    const niches = (await call('GET', '/api/niches')).body as {
      niches: { id: string; label: string; audience: string[] }[];
    };
    expect(niches.niches.length).toBeGreaterThanOrEqual(12);
    const niche = niches.niches[0];

    /* ------------------------------------------------------- stage 2: names */
    const nameResponse = await call('POST', '/api/names', {
      keywords: ['coffee', 'roastery'],
      target: 'youtube',
      count: 60,
      styles: [],
      seed: 'journey-seed',
    });
    expect(nameResponse.status).toBe(200);
    const names = (nameResponse.body as { names: { name: string; slug: string }[] }).names;
    expect(names).toHaveLength(60);
    expect(new Set(names.map((n) => n.name)).size).toBe(60);
    const chosen = names[0];

    /* ----------------------------------------------------- stage 3: handles */
    const probe = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      // Deterministic mix: one platform "exists", everything else is absent.
      return new Response(url.includes('tiktok') ? 'profile' : '', {
        status: url.includes('tiktok') ? 200 : 404,
      });
    });
    vi.stubGlobal('fetch', probe);

    const handleResponse = await call('POST', '/api/availability', {
      handle: chosen.slug,
      platforms: PLATFORM_IDS,
    });
    expect(handleResponse.status).toBe(200);
    const handles = (handleResponse.body as {
      results: { platform: string; status: string; confidence: string; evidence: string }[];
    }).results;
    expect(handles).toHaveLength(10);
    expect(new Set(handles.map((h) => h.platform)).size).toBe(10);
    for (const result of handles) {
      // Unconfirmed results must never be presented as proof a handle is free.
      if (result.status === 'available') expect(result.confidence).toBe('verified');
      expect(result.evidence.length).toBeGreaterThan(3);
    }

    /* ------------------------------------------------------ stage 4: design */
    const palettes = (await call('GET', '/api/palettes')).body as { palettes: unknown[] };
    expect(palettes.palettes.length).toBeGreaterThanOrEqual(10);
    const palette = PALETTES[0];

    /* ------------------------------------------------------- stage 5: voice */
    const copyResponse = await call('POST', '/api/copy', {
      name: chosen.name,
      nicheId: niche.id,
      keywords: ['coffee', 'roastery'],
      audience: niche.audience[0] ?? 'home baristas',
      tone: 'bold',
    });
    expect(copyResponse.status).toBe(200);
    const copy = (copyResponse.body as { copy: BrandProject['copy'] }).copy;
    expect(copy).toBeTruthy();
    expect(copy?.youtubeDescription.length).toBeGreaterThan(100);
    expect(copy?.taglines.length).toBeGreaterThan(0);

    /* ------------------------------------------- save the generated project */
    const now = new Date().toISOString();
    const project: BrandProject = {
      id: 'bp_journey',
      createdAt: now,
      updatedAt: now,
      workingTitle: 'Coffee brand',
      chosenName: chosen.name,
      tagline: copy?.taglines[0] ?? 'Brewed with intent',
      nicheId: niche.id,
      keywords: ['coffee', 'roastery'],
      paletteId: palette.id,
      palette,
      logoStyle: 'wordmark',
      names: names as BrandProject['names'],
      copy: copy ?? null,
      handles: handles as BrandProject['handles'],
      notes: 'Generated by the end-to-end suite.',
    };

    const saved = await call('PUT', '/api/projects/bp_journey', { project }, cookie);
    expect(saved.status).toBe(200);

    const readBack = await call('GET', '/api/projects/bp_journey', undefined, cookie);
    expect(readBack.status).toBe(200);
    const stored = (readBack.body as { project: BrandProject }).project;
    expect(stored.chosenName).toBe(chosen.name);
    expect(stored.names).toHaveLength(60);
    expect(stored.handles).toHaveLength(10);
    expect(stored.copy?.mission.length).toBeGreaterThan(10);

    /* ------------------------------------------------------- edit and resave */
    const edited = await call(
      'PUT',
      '/api/projects/bp_journey',
      { project: { ...stored, tagline: 'Roast. Pour. Repeat.', notes: 'Edited after review.' } },
      cookie,
    );
    expect(edited.status).toBe(200);
    const afterEdit = (await call('GET', '/api/projects/bp_journey', undefined, cookie)).body as {
      project: BrandProject;
    };
    expect(afterEdit.project.tagline).toBe('Roast. Pour. Repeat.');
    expect(afterEdit.project.names).toHaveLength(60);

    /* ------------------------------------------------------ stage 6: export */
    const archive = await buildBrandKitArchive(afterEdit.project, {
      rasterize: async () => new Uint8Array(PNG_MAGIC),
    });
    const zip = await JSZip.loadAsync(archive);
    const files = Object.keys(zip.files).filter((path) => !zip.files[path].dir);
    const slug = brandSlug(afterEdit.project);

    expect(files).toContain(`${slug}/README.txt`);
    expect(files).toContain(`${slug}/brand-guidelines.html`);
    expect(files).toContain(`${slug}/brand-guidelines.md`);

    // Palette is machine-readable and matches the chosen colours.
    const paletteJson = JSON.parse(await zip.file(`${slug}/palette/palette.json`)!.async('string')) as {
      primary: string;
    };
    expect(paletteJson.primary).toBe(palette.primary);

    // Every logo style exists as an SVG master and a real PNG.
    for (const style of LOGO_STYLES) {
      expect(files).toContain(`${slug}/logos/logo-${style.id}.svg`);
      expect(files).toContain(`${slug}/logos/logo-${style.id}.png`);
    }
    const logoPng = await zip.file(`${slug}/logos/logo-wordmark.png`)!.async('uint8array');
    expect(Array.from(logoPng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);

    // Profile pictures: four style masters plus one per platform at its real size.
    expect(files).toContain(`${slug}/profile-pictures/avatar-monogram-512.svg`);
    for (const platform of PLATFORM_IDS) {
      const entry = files.find((path) => path.includes(`/profile-pictures/${platform}-`));
      expect(entry, `profile picture for ${platform}`).toBeTruthy();
    }

    // Banners: artwork, safe-area guide and PNG for each platform spec.
    for (const spec of BANNERS) {
      expect(files).toContain(`${slug}/banners/${spec.id}.svg`);
      expect(files).toContain(`${slug}/banners/${spec.id}-safe-area-guide.svg`);
      expect(files).toContain(`${slug}/banners/${spec.id}.png`);
    }

    // Voice assets and per-platform bios.
    expect(await zip.file(`${slug}/copy/youtube-description.txt`)!.async('string')).toContain(
      copy!.youtubeDescription.slice(0, 40),
    );
    for (const platform of PLATFORM_IDS) {
      expect(files).toContain(`${slug}/copy/bios/${platform}.txt`);
    }
    expect(files).toContain(`${slug}/copy/brand-story.txt`);
    expect(files).toContain(`${slug}/copy/mission.txt`);

    // Availability results carry their evidence into the kit.
    const csv = await zip.file(`${slug}/handles/availability.csv`)!.async('string');
    expect(csv.split('\n')).toHaveLength(11);
    expect(csv).toContain('platform');

    const guidelines = await zip.file(`${slug}/brand-guidelines.html`)!.async('string');
    expect(guidelines).toContain(chosen.name);
    expect(guidelines).toContain(palette.primary);
    expect(files.length).toBeGreaterThan(45);
  });

  it('keeps a saved project private to its owner', async () => {
    const owner = await register('owner@example.com');
    const stranger = await register('stranger@example.com');
    const now = new Date().toISOString();
    const project: BrandProject = {
      id: 'bp_private',
      createdAt: now,
      updatedAt: now,
      workingTitle: 'Private brand',
      chosenName: 'Private Brand',
      tagline: '',
      nicheId: null,
      keywords: [],
      paletteId: PALETTES[0].id,
      palette: PALETTES[0],
      logoStyle: 'monogram',
      names: [],
      copy: null,
      handles: [],
      notes: '',
    };

    expect((await call('PUT', '/api/projects/bp_private', { project }, owner)).status).toBe(200);
    expect((await call('GET', '/api/projects/bp_private', undefined, stranger)).status).toBe(404);
    expect((await call('DELETE', '/api/projects/bp_private', undefined, stranger)).status).toBe(404);
    expect((await call('GET', '/api/projects/bp_private', undefined, owner)).status).toBe(200);
  });
});
