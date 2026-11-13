# BRANDFORGE AI

**Research. Name. Design. Launch.**

An all-in-one brand discovery and identity studio. Mobile-first, free-tier friendly, and fully functional with **no paid APIs and no API keys** — every generator is a deterministic engine that runs locally, and the optional AI provider is additive, never required.

---

## What actually works

| # | Feature | How it works |
|---|---------|--------------|
| 1 | **Niche research** | 14 curated niches with audience segments, keyword sets, competitor angles, content-opportunity lists and one-click research links to live sources (Google Trends, YouTube search, Reddit, Amazon). |
| 2 | **Name generation** | 50–100 unique names per run across business, YouTube and social targets, using 10 naming styles (compound, alliterative, invented, prefix/suffix, metaphor, action, latin-root, portmanteau, descriptive, personal). Every name carries a slug, a style label, a rationale and a memorability score. Seeded and reproducible. |
| 3 | **Username availability** | Real server-side probes of all 10 platforms, classified as **verified** (a definitive HTTP answer) or **unconfirmed** (a login wall, rate limit or ambiguous page). Never fabricated. |
| 4 | **Logos** | Six SVG styles — wordmark, monogram badge, emblem, geometric mark, stacked lockup, outline — generated as real vector markup, recoloured from any palette. |
| 5 | **Profile pictures** | Circular avatars in five styles at platform-correct sizes (400–1000 px), previewed live. |
| 6 | **Social graphics** | YouTube banner (2560×1440), Facebook cover (1640×859), X header (1500×500), LinkedIn banner, Twitch banner and Pinterest pin — each at its real dimensions. |
| 7 | **Copy & SEO** | Taglines, slogans, brand story, mission, YouTube description with timestamps and hashtags, plus per-platform bios trimmed to each platform's exact character limit. |
| 8 | **Projects** | Unlimited brand projects saved in the browser, re-openable and editable, with duplicate and delete. Import/export as JSON for backup. |
| 9 | **Brand kit export** | One ZIP containing every logo, avatar and banner as SVG, the palette as CSS variables, all copy as Markdown, and a generated `brand-guidelines.md`. |

### Honest availability checking

Platforms differ in what they expose to an unauthenticated request, so BRANDFORGE reports exactly what it can prove:

- **YouTube** — definitive. A `404` is a free handle; a `200` carrying a `channelId` is taken; YouTube's "this page isn't available" shell means free. These are marked **verified**.
- **Reddit** — definitive via the public `about.json` endpoint, unless Reddit blocks the request (then it is reported unconfirmed).
- **TikTok, Instagram, Facebook, X, Pinterest, Threads, LinkedIn, Twitch** — these serve a login wall or an identical shell for both free and taken handles. A hard `404` is still treated as verified-free, but anything ambiguous is labelled **unconfirmed** with the evidence and a direct profile link so you can confirm in one tap.
- **Manual override** — every row can be marked taken or free by you. Manual entries are always labelled *recorded by you*, never as verified.

Nothing is ever marked "available" on the basis of a page that a taken account would also produce.

---

## Quick start

```bash
npm install
npm run build      # builds the client into dist/ and the server into server-dist/
npm start          # http://localhost:8787
```

For development with hot reload (two terminals):

```bash
npm run dev        # Vite client on :5173, proxies /api to :8787
npm run dev:api    # API on :8787
```

### Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Vite dev server with API proxy |
| `npm run dev:api` | Node API server with watch mode |
| `npm run build` | Client + server production build |
| `npm start` | Serve the built client and API from one Node process on `PORT` |
| `npm run typecheck` | `tsc --noEmit` across client, server, shared and functions |
| `npm test` | Vitest suite (engines, availability rules, API router) |
| `npm run check` | typecheck + tests + build |

---

## Deployment

The API is one shared router (`shared/api.ts`) mounted three ways, so behaviour is identical everywhere.

### Cloudflare Pages (free)

1. Push this repository to GitHub.
2. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**.
3. Build command `npm run build:client`, output directory `dist`.
4. `functions/api/[[path]].ts` is detected automatically and serves `/api/*`.
5. Optional: add `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL` under **Settings → Environment variables**.

Or from the CLI:

```bash
npm run build:client
npx wrangler pages deploy dist --project-name brandforge-ai
```

`wrangler.toml` already declares the Pages project, compatibility date and build output.

### Cloudflare Workers (free)

```bash
npm run build:client
npx wrangler deploy --config workers/wrangler.toml
```

`workers/index.ts` routes `/api/*` to the shared router and delegates everything else to the `ASSETS` binding, with SPA fallback configured.

### Any Node host

`npm run build && npm start` serves both client and API on `PORT` (default `8787`) bound to `0.0.0.0`.

### iPhone

Open the deployed URL in Safari and use **Share → Add to Home Screen**. The app ships a web manifest and icons, runs offline for everything that does not need the network (name generation, copy, logos, graphics, projects), and is designed for one-handed use with bottom navigation and 44 px touch targets.

---

## Optional AI provider

BRANDFORGE works completely without AI. If you want a model to rewrite taglines or expand a description, configure any OpenAI-compatible endpoint:

```bash
AI_API_KEY=...            # required to enable
AI_BASE_URL=https://api.openai.com/v1   # default
AI_MODEL=gpt-4o-mini      # default
```

You can also enter a key in **Settings**; it is stored only in your browser and sent per-request to your own server, never to a third party from the browser. The server validates the base URL (HTTPS only, private and loopback addresses refused) before forwarding.

---

## Architecture

```
shared/            Isomorphic engines — no browser or Node APIs
  niches.ts        Curated research library + live research links
  names.ts         Seeded name generator (10 styles, 3 targets)
  copy.ts          Taglines, bios, descriptions, brand story
  logo.ts          SVG logo renderer (6 styles)
  graphics.ts      Avatars + banners at platform dimensions
  palettes.ts      Colour systems with contrast pairs
  platforms.ts     10-platform registry (limits, URL templates, rules)
  availability.ts  Probe interpretation: verified vs unconfirmed
  api.ts           The single API router used by every host

src/               React 19 + TypeScript client
  sections/        Home, Research, Names, Handles, Design, Copy, Projects, Export, Settings
  lib/             API client, project storage, ZIP export, navigation

server/index.ts    Express host: /api router + static client
functions/         Cloudflare Pages Function
workers/           Standalone Cloudflare Worker
tests/             Vitest: engines, availability honesty rules, API contract
```

**Data stays local.** Projects live in `localStorage`; there is no account system and no server-side storage. Export a project's JSON to move it between devices.

---

## Testing

```bash
npm test        # 34 tests
```

The suite covers the name engine's uniqueness and determinism, copy length limits, SVG validity and escaping, banner dimensions, platform registry integrity, the availability classification rules (including that login walls never become "available"), and the API contract for every route.

---

## Known limits

- Availability probes depend on the platform's public responses. If a platform changes its login wall or rate-limits the server, those rows report **unconfirmed** rather than guessing.
- Serverless platforms (Pages/Workers) have short request budgets; large batches are checked with a small concurrency limit and cached for 45 seconds.
- Logos and graphics are generated as SVG (crisp at any size). Export produces SVG files; rasterise them with any converter if a PNG is required.
- The AI integration is a proxy for an OpenAI-compatible chat completions endpoint. It is optional and disabled by default.
