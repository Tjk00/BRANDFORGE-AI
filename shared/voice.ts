/**
 * Brand voice engine.
 *
 * Deterministic, offline and free: every string is composed from the brand's own
 * name, keywords, audience and tone. Nothing is presented as researched fact and
 * no statistics are invented.
 */

import type { PlatformId } from './domain';
import { PLATFORM_IDS } from './platforms';

export interface BrandVoice {
  businessDescription: string;
  brandStory: string;
  mission: string;
  vision: string;
  values: string[];
  positioning: string;
  taglines: string[];
  slogans: string[];
  socialBios: Record<PlatformId, string>;
  youtubeDescription: string;
  seoKeywords: string[];
  marketingMessages: string[];
  tone: string;
  generatedAt: string;
}

export interface VoiceInput {
  name: string;
  keywords?: string[];
  audience?: string;
  tone?: string;
}

const BIO_LIMITS: Partial<Record<PlatformId, number>> = {
  youtube: 1000,
  instagram: 150,
  tiktok: 80,
  x: 160,
  threads: 160,
  facebook: 255,
  pinterest: 160,
  linkedin: 220,
  twitch: 200,
  reddit: 200,
};

function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function titleCase(value: string): string {
  return value
    .split(/[\s-_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function dedupe(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    const value = clean(item);
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function truncate(value: string, limit: number): string {
  const text = clean(value);
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export function generateVoice(input: VoiceInput): BrandVoice {
  const name = clean(input.name) || 'Your brand';
  const keywords = dedupe(input.keywords ?? []).slice(0, 8);
  const focus = keywords.length ? keywords.slice(0, 3).join(', ') : 'practical ideas that actually work';
  const audience = clean(input.audience ?? '') || 'people who want a clearer path forward';
  const tone = clean(input.tone ?? '') || 'confident and friendly';

  const businessDescription = clean(
    `${name} helps ${audience} with ${focus}. We publish clear, tested guidance instead of hype, ` +
      `and we keep the tools and templates behind every recommendation in reach. The result is a brand ` +
      `that sounds ${tone} because the work behind it is genuinely useful.`,
  );

  const brandStory = clean(
    `${name} started from a simple frustration: too much advice about ${focus} is written for an algorithm ` +
      `instead of a person. So we built the opposite. Every project starts with the audience, then the name, ` +
      `then the design — in that order — because a brand that sounds like itself is easier to trust and easier ` +
      `to remember. Today ${name} exists for ${audience}, and the standard stays the same: say something true, ` +
      `make it useful, and keep it ${tone}.`,
  );

  const mission = clean(
    `Give ${audience} a ${tone} brand they can launch this week — with the research, names, visuals and words ` +
      `already worked out, and no dependency on a paid agency.`,
  );

  const vision = clean(
    `A world where a good idea does not stall because branding feels expensive: ${name} becomes the reference ` +
      `toolkit for ${focus}, used by independent creators and small teams to launch confidently.`,
  );

  const values = [
    `Clarity first — if it needs a paragraph to explain, it is not finished.`,
    `Evidence over adjectives — show the reasoning, never invent a statistic.`,
    `Own your assets — every logo, palette and line of copy is downloadable and yours.`,
    `Respect the audience — ${audience} can tell the difference between useful and loud.`,
    `Ship, then refine — a launched brand teaches more than a perfect draft.`,
  ];

  const positioning = clean(
    `${name} is a ${tone} brand for ${audience} that focuses on ${focus}. Unlike generic advice channels, ` +
      `everything here comes with a usable asset: a name, a palette, a template or a script you can run today.`,
  );

  const taglines = dedupe([
    `${titleCase(focus.split(',')[0] ?? 'Build')}, properly.`,
    `Made for ${audience}.`,
    `Clear brand. Real launch.`,
    `Name it. Design it. Ship it.`,
    `Your idea, finished.`,
    `Less noise. More signal.`,
  ]).slice(0, 6);

  const slogans = dedupe([
    `${name}: build it once, build it right.`,
    `From blank page to brand kit.`,
    `Research first. Always.`,
    `The brand studio that stays free.`,
    `Made to be remembered.`,
    `Launch day, not someday.`,
  ]).slice(0, 6);

  const baseBios: Record<string, string> = {
    youtube: `${name} — ${focus} for ${audience}. New videos on naming, design and launch. Full brand kits and free tools in the description of every video.`,
    instagram: `${name} · ${focus} for ${audience}. Free brand kits ↓`,
    tiktok: `${name} · ${focus}, fast. Free brand kit ↓`,
    x: `${name} — ${focus} for ${audience}. Building in public, sharing the templates.`,
    threads: `${name} — ${focus} for ${audience}. Say something true, make it useful.`,
    facebook: `${name} helps ${audience} with ${focus}. Free guides, templates and brand kits — no paid tools required.`,
    pinterest: `${name} · ${focus} ideas for ${audience}. Brand kits, palettes and templates.`,
    linkedin: `${name} — ${focus} for ${audience}. Practical branding: research, naming, identity, launch.`,
    twitch: `${name} · ${focus} for ${audience}. Live brand builds and design teardowns.`,
    reddit: `${name} — ${focus} for ${audience}. Sharing what works, without the sales pitch.`,
  };

  const socialBios = {} as Record<PlatformId, string>;
  for (const platform of PLATFORM_IDS) {
    socialBios[platform] = truncate(baseBios[platform] ?? baseBios.x, BIO_LIMITS[platform] ?? 160);
  }

  const youtubeDescription = clean(
    `${name} helps ${audience} with ${focus}.\n\n` +
      `On this channel: how to research a niche without guessing, how to generate and test brand names, ` +
      `how to check handles honestly, and how to build a logo, palette and brand kit you can actually use.\n\n` +
      `Everything is built to work without paid subscriptions. Start with the brand kit video, then ` +
      `follow the playlist in order.\n\n` +
      `Topics: ${dedupe([...keywords, 'branding', 'naming', 'logo design', 'launch']).slice(0, 10).join(' · ')}`,
  );

  const seoKeywords = dedupe([
    ...keywords,
    `${name} brand`,
    ...keywords.slice(0, 3).map((keyword) => `${keyword} for beginners`),
    ...keywords.slice(0, 3).map((keyword) => `best ${keyword} tools`),
    `${focus.split(',')[0]} tips`,
    'brand name generator',
    'free brand kit',
    'social media handle checker',
    'logo maker without subscription',
  ]).slice(0, 24);

  const marketingMessages = [
    `Your brand, finished this week — research, name, design and kit in one place.`,
    `No subscription, no watermark, no "upgrade to export". Download the real files.`,
    `We show the reasoning. You keep the assets.`,
    `Built for ${audience} who would rather launch than guess.`,
  ];

  return {
    businessDescription,
    brandStory,
    mission,
    vision,
    values,
    positioning,
    taglines,
    slogans,
    socialBios,
    youtubeDescription,
    seoKeywords,
    marketingMessages,
    tone,
    generatedAt: new Date().toISOString(),
  };
}
