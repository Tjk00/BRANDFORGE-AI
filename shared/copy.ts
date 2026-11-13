import { hashSeed } from './names';
import { getPlatform, PLATFORM_IDS } from './platforms';
import type { BrandCopy, Niche, PlatformId } from './types';

export interface CopyInput {
  name: string;
  niche: Niche | null;
  keywords: string[];
  audience: string;
  tone: string;
}

const TONES: Record<string, { opener: string; closer: string; verb: string }> = {
  friendly: { opener: 'Straightforward', closer: 'No gatekeeping, no filler.', verb: 'learn' },
  bold: { opener: 'Unapologetically practical', closer: 'Skip the theory. Start today.', verb: 'build' },
  expert: { opener: 'Methodical', closer: 'Every claim traced back to the source.', verb: 'master' },
  playful: { opener: 'Refreshingly human', closer: 'Serious tools, light delivery.', verb: 'enjoy' },
  calm: { opener: 'Considered', closer: 'One clear next step at a time.', verb: 'grow' },
};

export const TONE_OPTIONS = Object.keys(TONES);

function tone(input: CopyInput) {
  return TONES[input.tone] ?? TONES.friendly;
}

function pickFrom<T>(list: T[], salt: string): T {
  return list[hashSeed(salt) % list.length];
}

export function truncate(text: string, limit: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= limit) return clean;
  const cut = clean.slice(0, limit - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

function topic(input: CopyInput): string {
  const niche = input.niche;
  if (niche) return niche.keywords[0] ?? niche.label.toLowerCase();
  if (input.keywords.length > 0) return input.keywords[0];
  return 'brand building';
}

function audience(input: CopyInput): string {
  if (input.audience.trim()) return input.audience.trim();
  if (input.niche && input.niche.audience.length > 0) return input.niche.audience[0].toLowerCase();
  return 'people starting something new';
}

export function generateTaglines(input: CopyInput): string[] {
  const t = topic(input);
  const a = audience(input);
  const n = input.name;
  const t3 = tone(input);
  const pool = [
    `${n}: ${t}, minus the guesswork.`,
    `Built for ${a} who want ${t} to actually work.`,
    `${t3.opener} ${t} for ${a}.`,
    `From first idea to finished ${t} brand.`,
    `${t} with a system, not a slogan.`,
    `${n} — research, name, design, launch.`,
    `Your ${t} brand, decided in one session.`,
    `Clarity on ${t} before you spend a cent.`,
    `${t} that fits the life you actually have.`,
    `One brand. One voice. Every platform.`,
  ];
  return dedupe(pool).slice(0, 10);
}

export function generateSlogans(input: CopyInput): string[] {
  const t = topic(input);
  const t3 = tone(input);
  const pool = [
    `Make the ${t} decision once.`,
    `Name it. Claim it. Ship it.`,
    `${t3.closer}`,
    `Every handle, one identity.`,
    `Designed to be recognised.`,
    `Small brand. Sharp edges.`,
    `Say it once, clearly.`,
    `Proof over promises.`,
    `Built to be remembered.`,
    `Start narrow. Grow loud.`,
  ];
  return dedupe(pool).slice(0, 10);
}

function dedupe(list: string[]): string[] {
  const seen = new Set<string>();
  return list.filter((item) => {
    const key = item.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function generateYouTubeDescription(input: CopyInput): string {
  const n = input.name;
  const t = topic(input);
  const a = audience(input);
  const t3 = tone(input);
  const angles = input.niche?.contentAngles ?? [
    `Practical ${t} walkthroughs`,
    'Tool and cost comparisons',
    'Mistakes worth avoiding',
  ];
  const keywords = keywordList(input);
  const hashtags = keywords.slice(0, 3).map((k) => `#${k.replace(/[^a-z0-9]/gi, '')}`).join(' ');

  return [
    `${n} helps ${a} ${t3.verb} ${t} without wasting months on trial and error.`,
    '',
    `What you will find here:`,
    ...angles.map((angle) => `• ${angle}`),
    '',
    `${t3.opener} by design. ${t3.closer}`,
    '',
    `Topics covered: ${keywords.join(', ')}.`,
    '',
    `Subscribe if you want the next ${t} breakdown as soon as it publishes.`,
    '',
    hashtags,
  ].join('\n');
}

export function keywordList(input: CopyInput): string[] {
  const base = input.keywords.map((k) => k.trim().toLowerCase()).filter(Boolean);
  const niche = input.niche?.keywords ?? [];
  const combined = dedupe([...base, ...niche]).slice(0, 12);
  if (combined.length === 0) return ['brand building', 'brand identity', 'content strategy'];
  return combined;
}

export function generateBios(input: CopyInput): Record<PlatformId, string> {
  const n = input.name;
  const t = topic(input);
  const a = audience(input);
  const t3 = tone(input);
  const kw = keywordList(input);
  const short = kw[0] ?? t;

  const raw: Record<PlatformId, string> = {
    youtube: `${n} — ${t} for ${a}. New videos on ${kw.slice(0, 3).join(', ')}. ${t3.closer}`,
    tiktok: `${t} made simple. ${n}.`,
    instagram: `${n} · ${t} for ${a}\nPractical tips, real numbers, no fluff.\n↓ Start here`,
    facebook: `${n} shares practical ${t} advice for ${a}. Follow for weekly guides, checklists and honest tool reviews.`,
    x: `${t} for ${a}. Practical threads, no hype. Built by ${n}.`,
    pinterest: `${n} pins ${t} ideas, checklists and layouts for ${a}. Save what you want to try first.`,
    threads: `${n}. ${t}, explained without the jargon. Here for the questions more than the highlight reel.`,
    linkedin: `${n} — helping ${a} with ${t}. I write about ${kw.slice(0, 3).join(', ')} and share what actually moved the numbers.`,
    twitch: `${n} live — ${t} for ${a}. Builds, reviews and Q&A. Schedule in the panels below.`,
    reddit: `${n} — ${t} for ${a}. Sharing what worked, what failed, and the numbers behind both.`,
  };

  const out = {} as Record<PlatformId, string>;
  for (const platform of PLATFORM_IDS) {
    const limit = getPlatform(platform).bioLimit;
    out[platform] = truncate(raw[platform] || `${n} — ${short}.`, limit);
  }
  return out;
}

export function generateBrandStory(input: CopyInput): string {
  const n = input.name;
  const t = topic(input);
  const a = audience(input);
  const t3 = tone(input);
  const audienceLine = input.niche?.audience.slice(0, 3).join(', ') ?? a;

  return [
    `${n} started from a simple observation: most people who want to build something around ${t} do not need more inspiration, they need a decision framework.`,
    `The audience is specific — ${audienceLine} — and so is the promise. ${t3.opener} guidance, published consistently, with the reasoning shown rather than hidden.`,
    `Every piece of content is built to be used the same day: a checklist you can run, a comparison you can act on, a template you can adapt.`,
    `${t3.closer} That is the standard ${n} holds itself to.`,
  ].join(' ');
}

export function generateMission(input: CopyInput): string {
  return `${input.name} exists to make ${topic(input)} decisions clear, affordable and repeatable for ${audience(input)}.`;
}

export function generateCopy(input: CopyInput): BrandCopy {
  const salt = `${input.name}|${input.niche?.id ?? 'none'}|${input.tone}`;
  const taglines = generateTaglines(input);
  const slogans = generateSlogans(input);
  return {
    taglines,
    slogans,
    youtubeDescription: generateYouTubeDescription(input),
    socialBios: generateBios(input),
    brandStory: generateBrandStory(input),
    mission: generateMission(input),
    keywords: keywordList(input),
  };
}

export function defaultTagline(input: CopyInput): string {
  const taglines = generateTaglines(input);
  return pickFrom(taglines, `${input.name}-tagline`);
}
