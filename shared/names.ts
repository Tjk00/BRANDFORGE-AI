import type { GeneratedName, NameRequest, NameStyle, NameTarget } from './types';

const STYLE_ORDER: NameStyle[] = [
  'compound',
  'prefixed',
  'invented',
  'descriptive',
  'metaphor',
  'action',
  'alliterative',
];

const PREFIXES = [
  'Nova', 'Lumen', 'Astra', 'Vero', 'Orbit', 'Pulse', 'Vanta', 'Zenith', 'Halo', 'Ember',
  'Quill', 'Vertex', 'Cinder', 'Solace', 'Rift', 'Arc', 'Onyx', 'Fable', 'North', 'Echo',
  'Terra', 'Alta', 'Rove', 'Sage', 'Tide', 'Flux', 'Grove', 'Apex', 'Lunar', 'Nimbus',
  'Cove', 'Harbor', 'Kite', 'Summit', 'Drift', 'Vela', 'Mesa', 'Juno', 'Atlas', 'Pico',
];

const NOUNS = [
  'Labs', 'Studio', 'Works', 'Collective', 'Foundry', 'Atelier', 'Guild', 'Bureau', 'House',
  'Forge', 'Craft', 'Loop', 'Path', 'Field', 'Grid', 'Signal', 'Current', 'Shift', 'Sprint',
  'Peak', 'Anchor', 'Bridge', 'Beacon', 'Compass', 'Canvas', 'Frame', 'Prism', 'Spark', 'Trail',
  'Garden', 'Harbor', 'Circuit', 'Ledge', 'Vault', 'Nest', 'Yard', 'Press', 'Loom', 'Relay', 'Depot',
];

const DESCRIPTORS = [
  'Bold', 'Bright', 'Quiet', 'Sharp', 'Warm', 'Wild', 'Clean', 'Deep', 'True', 'Swift',
  'Clear', 'Prime', 'Smart', 'Fresh', 'Solid', 'Keen', 'Lucid', 'Vivid', 'Calm', 'Brave',
];

const ACTIONS = [
  'Build', 'Make', 'Grow', 'Create', 'Learn', 'Move', 'Shape', 'Spark', 'Craft', 'Scale',
  'Launch', 'Forge', 'Design', 'Explore', 'Tune', 'Rally', 'Raise', 'Sketch', 'Trace', 'Draft',
];

const METAPHOR_WORDS = [
  'Compass', 'Lantern', 'Beacon', 'Comet', 'Harbor', 'Summit', 'River', 'Seed', 'Bridge',
  'Anchor', 'Prism', 'Atlas', 'Orbit', 'Ember', 'Tide', 'North', 'Bloom', 'Forge', 'Loom', 'Signal',
];

const TARGET_SUFFIX: Record<NameTarget, string[]> = {
  business: ['Labs', 'Studio', 'Works', 'Collective', 'Group', 'Partners', 'Foundry', 'Bureau', 'Co', 'Atelier'],
  youtube: ['TV', 'Media', 'Channel', 'Show', 'HQ', 'Network', 'Cast', 'Daily', 'Vlogs', 'Studio'],
  social: ['HQ', 'Club', 'Daily', 'Social', 'Life', 'World', 'Society', 'Diary', 'Squad', 'Collective'],
};

const SYLLABLES = [
  'ka', 'lo', 'mi', 'ra', 'vi', 'zo', 'ne', 'ta', 'su', 'po', 'dra', 'bel', 'cor', 'fin', 'gal',
  'hel', 'jor', 'kel', 'lun', 'mar', 'nor', 'pal', 'quo', 'rin', 'sol', 'tor', 'vel', 'wyn', 'zan', 'bri',
];

const SYLLABLE_TAIL = ['va', 'ra', 'do', 'na', 'li', 'so', 'mo', 'ti', 'ka', 'no', 'vy', 'ro'];

export function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 24);
}

function titleCase(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function cleanKeyword(raw: string): string {
  const trimmed = raw.trim().replace(/[^A-Za-z0-9\s-]/g, '');
  if (!trimmed) return '';
  return trimmed
    .split(/\s+/)
    .map((part) => titleCase(part))
    .join('');
}

function pick<T>(list: T[], rng: () => number): T {
  return list[Math.floor(rng() * list.length) % list.length];
}

interface Candidate {
  name: string;
  style: NameStyle;
  technique: string;
}

function buildCandidate(
  style: NameStyle,
  keyword: string,
  target: NameTarget,
  rng: () => number,
): Candidate | null {
  const suffix = pick(TARGET_SUFFIX[target], rng);
  const prefix = pick(PREFIXES, rng);
  const noun = pick(NOUNS, rng);
  const descriptor = pick(DESCRIPTORS, rng);
  const action = pick(ACTIONS, rng);
  const metaphor = pick(METAPHOR_WORDS, rng);

  switch (style) {
    case 'compound': {
      const parts = [
        [`${keyword}${noun}`, 'keyword + object noun'],
        [`${keyword}${suffix}`, 'keyword + category word'],
        [`${noun}${keyword}`, 'object noun + keyword'],
        [`${keyword}${metaphor}`, 'keyword + metaphor'],
      ] as const;
      const [name, technique] = parts[Math.floor(rng() * parts.length) % parts.length];
      return { name, style, technique };
    }
    case 'prefixed': {
      const [name, technique] =
        rng() > 0.5
          ? ([`${prefix}${keyword}`, 'abstract prefix + keyword'] as const)
          : ([`${prefix}${noun}`, 'abstract prefix + object noun'] as const);
      return { name, style, technique };
    }
    case 'invented': {
      const a = pick(SYLLABLES, rng);
      const b = pick(SYLLABLES, rng);
      const tail = pick(SYLLABLE_TAIL, rng);
      const form = rng();
      if (form < 0.4) return { name: `${titleCase(a)}${b}${tail}`, style, technique: 'coined three-syllable' };
      if (form < 0.75) return { name: `${titleCase(a)}${b}`, style, technique: 'coined two-syllable' };
      return { name: `${titleCase(a)}${b}${keyword.slice(0, 4)}`, style, technique: 'coined stem + keyword' };
    }
    case 'descriptive': {
      const [name, technique] =
        rng() > 0.5
          ? ([`${descriptor}${keyword}`, 'descriptor + keyword'] as const)
          : ([`${descriptor}${keyword}${suffix}`, 'descriptor + keyword + category'] as const);
      return { name, style, technique };
    }
    case 'metaphor': {
      const [name, technique] =
        rng() > 0.5
          ? ([`${metaphor}${suffix}`, 'metaphor + category word'] as const)
          : ([`${metaphor}${keyword}`, 'metaphor + keyword'] as const);
      return { name, style, technique };
    }
    case 'action': {
      const [name, technique] =
        rng() > 0.5
          ? ([`${action}${keyword}`, 'action verb + keyword'] as const)
          : ([`${action}${suffix}`, 'action verb + category word'] as const);
      return { name, style, technique };
    }
    case 'alliterative': {
      const letter = (keyword.charAt(0) || 'a').toLowerCase();
      const matches = DESCRIPTORS.filter((d) => d.toLowerCase().startsWith(letter));
      const partner = matches.length > 0 ? pick(matches, rng) : descriptor;
      return { name: `${partner}${keyword}`, style, technique: 'shared-initial alliteration' };
    }
    default:
      return null;
  }
}

function scoreName(name: string, keyword: string): number {
  const lower = name.toLowerCase();
  let score = 55;
  if (lower.length >= 6 && lower.length <= 12) score += 18;
  else if (lower.length <= 16) score += 8;
  else score -= 6;
  const vowels = (lower.match(/[aeiou]/g) ?? []).length;
  if (vowels / lower.length >= 0.3) score += 8;
  if (lower.includes(keyword.toLowerCase())) score += 10;
  if (/(.)\1\1/.test(lower)) score -= 12;
  if (lower.length > 18) score -= 10;
  if (/(ch|st|tr|br|kl|dr|gr)/.test(lower)) score += 4;
  return Math.max(20, Math.min(98, score));
}

export const NAME_STYLE_LABELS: Record<NameStyle, string> = {
  compound: 'Compound',
  prefixed: 'Abstract prefix',
  invented: 'Coined',
  descriptive: 'Descriptive',
  metaphor: 'Metaphor',
  action: 'Action',
  alliterative: 'Alliterative',
};

export function generateNames(request: NameRequest): GeneratedName[] {
  const count = Math.max(1, Math.min(100, Math.floor(request.count)));
  const keywords = (request.keywords.length > 0 ? request.keywords : ['Brand'])
    .map(cleanKeyword)
    .filter((k) => k.length > 0);
  const stylePool = (request.styles.length > 0 ? request.styles : STYLE_ORDER).filter((s) =>
    STYLE_ORDER.includes(s),
  );
  const seed = hashSeed(
    `${request.seed}|${request.target}|${count}|${keywords.join(',')}|${stylePool.join(',')}`,
  );
  const rng = mulberry32(seed);

  const used = new Set<string>();
  const out: GeneratedName[] = [];
  const maxAttempts = count * 300;
  let attempts = 0;

  while (out.length < count && attempts < maxAttempts) {
    attempts += 1;
    const style = stylePool[Math.floor(rng() * stylePool.length) % stylePool.length];
    const keyword = keywords[Math.floor(rng() * keywords.length) % keywords.length];
    const candidate = buildCandidate(style, keyword, request.target, rng);
    if (!candidate) continue;
    const name = candidate.name.replace(/\s+/g, '');
    if (name.length < 3 || name.length > 24) continue;
    const key = name.toLowerCase();
    if (used.has(key)) continue;
    const slug = slugify(name);
    if (slug.length < 3) continue;
    used.add(key);
    out.push({
      name,
      slug,
      style: candidate.style,
      technique: candidate.technique,
      score: scoreName(name, keyword),
      source: 'engine',
    });
  }

  return out.sort((a, b) => b.score - a.score);
}

export function normalizeNameInput(raw: string): string[] {
  return raw
    .split(/[,\n;|]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .slice(0, 6);
}
