import type { PlatformId } from './types';

export interface ProbeSpec {
  /** URL requested by the availability checker. */
  url: (handle: string) => string;
  accept: string;
  headers?: Record<string, string>;
}

export interface PlatformMeta {
  id: PlatformId;
  label: string;
  group: 'Video' | 'Social' | 'Image' | 'Professional' | 'Community';
  color: string;
  handlePattern: RegExp;
  minLength: number;
  maxLength: number;
  profileUrl: (handle: string) => string;
  probe: ProbeSpec | null;
  /** True only when the platform's public response can be read without a login. */
  autoCheckable: boolean;
  verificationNote: string;
  avatarSize: number;
  bioLimit: number;
}

const BASE_HEADERS: Record<string, string> = {
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
};

export const PLATFORMS: PlatformMeta[] = [
  {
    id: 'youtube',
    label: 'YouTube',
    group: 'Video',
    color: '#FF0033',
    handlePattern: /^[a-z0-9][a-z0-9._-]*$/,
    minLength: 3,
    maxLength: 30,
    profileUrl: (h) => `https://www.youtube.com/@${h}`,
    probe: {
      url: (h) => `https://www.youtube.com/@${h}`,
      accept: 'text/html',
      headers: BASE_HEADERS,
    },
    autoCheckable: true,
    verificationNote:
      'YouTube answers without a login: HTTP 404 means no channel owns the handle, and a served channel page exposes its channelId.',
    avatarSize: 800,
    bioLimit: 1000,
  },
  {
    id: 'reddit',
    label: 'Reddit',
    group: 'Community',
    color: '#FF4500',
    handlePattern: /^[a-z0-9_-]{3,20}$/,
    minLength: 3,
    maxLength: 20,
    profileUrl: (h) => `https://www.reddit.com/user/${h}`,
    probe: {
      url: (h) => `https://www.reddit.com/user/${h}/about.json`,
      accept: 'application/json',
      headers: { ...BASE_HEADERS, 'User-Agent': 'brandforge-ai/1.0 (handle availability check)' },
    },
    autoCheckable: true,
    verificationNote:
      'Reddit exposes a public about.json per user: HTTP 404 means the user does not exist, JSON with a name means it does. Datacenter IPs are often rate limited, in which case the result stays unconfirmed.',
    avatarSize: 256,
    bioLimit: 200,
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    group: 'Video',
    color: '#00F2EA',
    handlePattern: /^[a-z0-9._]{2,24}$/,
    minLength: 2,
    maxLength: 24,
    profileUrl: (h) => `https://www.tiktok.com/@${h}`,
    probe: {
      url: (h) => `https://www.tiktok.com/@${h}`,
      accept: 'text/html',
      headers: BASE_HEADERS,
    },
    autoCheckable: true,
    verificationNote:
      'TikTok serves the same shell page for real and missing handles, so only a hard HTTP 404 is treated as verified. Otherwise the result is unconfirmed.',
    avatarSize: 200,
    bioLimit: 80,
  },
  {
    id: 'instagram',
    label: 'Instagram',
    group: 'Image',
    color: '#E1306C',
    handlePattern: /^[a-z0-9._]{1,30}$/,
    minLength: 1,
    maxLength: 30,
    profileUrl: (h) => `https://www.instagram.com/${h}/`,
    probe: {
      url: (h) => `https://www.instagram.com/${h}/`,
      accept: 'text/html',
      headers: BASE_HEADERS,
    },
    autoCheckable: true,
    verificationNote:
      'Instagram redirects logged-out requests to a login wall, so most checks stay unconfirmed. A hard HTTP 404 is treated as verified availability.',
    avatarSize: 320,
    bioLimit: 150,
  },
  {
    id: 'facebook',
    label: 'Facebook',
    group: 'Social',
    color: '#1877F2',
    handlePattern: /^[a-z0-9.]{5,50}$/,
    minLength: 5,
    maxLength: 50,
    profileUrl: (h) => `https://www.facebook.com/${h}`,
    probe: {
      url: (h) => `https://www.facebook.com/${h}`,
      accept: 'text/html',
      headers: BASE_HEADERS,
    },
    autoCheckable: true,
    verificationNote:
      'Facebook answers logged-out requests with a login redirect, so results are usually unconfirmed. A hard HTTP 404 is treated as verified availability.',
    avatarSize: 320,
    bioLimit: 255,
  },
  {
    id: 'x',
    label: 'X',
    group: 'Social',
    color: '#0F1419',
    handlePattern: /^[a-z0-9_]{1,15}$/,
    minLength: 1,
    maxLength: 15,
    profileUrl: (h) => `https://x.com/${h}`,
    probe: {
      url: (h) => `https://x.com/${h}`,
      accept: 'text/html',
      headers: BASE_HEADERS,
    },
    autoCheckable: true,
    verificationNote:
      'X renders a JavaScript app for every handle and its public availability endpoint was retired, so checks stay unconfirmed unless X returns a hard HTTP 404.',
    avatarSize: 400,
    bioLimit: 160,
  },
  {
    id: 'pinterest',
    label: 'Pinterest',
    group: 'Image',
    color: '#E60023',
    handlePattern: /^[a-z0-9_]{3,30}$/,
    minLength: 3,
    maxLength: 30,
    profileUrl: (h) => `https://www.pinterest.com/${h}/`,
    probe: {
      url: (h) => `https://www.pinterest.com/${h}/`,
      accept: 'text/html',
      headers: BASE_HEADERS,
    },
    autoCheckable: true,
    verificationNote:
      'Pinterest returns a client-rendered page for both real and missing handles, so only a hard HTTP 404 is treated as verified.',
    avatarSize: 165,
    bioLimit: 500,
  },
  {
    id: 'threads',
    label: 'Threads',
    group: 'Social',
    color: '#101010',
    handlePattern: /^[a-z0-9._]{1,30}$/,
    minLength: 1,
    maxLength: 30,
    profileUrl: (h) => `https://www.threads.com/@${h}`,
    probe: {
      url: (h) => `https://www.threads.com/@${h}`,
      accept: 'text/html',
      headers: BASE_HEADERS,
    },
    autoCheckable: true,
    verificationNote:
      'Threads requires a logged-in session for reliable lookups, so results are usually unconfirmed. A hard HTTP 404 is treated as verified availability.',
    avatarSize: 320,
    bioLimit: 500,
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    group: 'Professional',
    color: '#0A66C2',
    handlePattern: /^[a-z0-9-]{3,100}$/,
    minLength: 3,
    maxLength: 100,
    profileUrl: (h) => `https://www.linkedin.com/in/${h}`,
    probe: {
      url: (h) => `https://www.linkedin.com/in/${h}`,
      accept: 'text/html',
      headers: BASE_HEADERS,
    },
    autoCheckable: true,
    verificationNote:
      'LinkedIn blocks automated lookups with an auth wall (HTTP 999/302), so personal-profile checks stay unconfirmed. A hard HTTP 404 is treated as verified availability.',
    avatarSize: 400,
    bioLimit: 2600,
  },
  {
    id: 'twitch',
    label: 'Twitch',
    group: 'Video',
    color: '#9146FF',
    handlePattern: /^[a-z0-9_]{4,25}$/,
    minLength: 4,
    maxLength: 25,
    profileUrl: (h) => `https://www.twitch.tv/${h}`,
    probe: {
      url: (h) => `https://www.twitch.tv/${h}`,
      accept: 'text/html',
      headers: BASE_HEADERS,
    },
    autoCheckable: true,
    verificationNote:
      'Twitch serves its app shell for every channel name; the public Helix API needs a registered client ID. Checks stay unconfirmed unless Twitch returns a hard HTTP 404.',
    avatarSize: 300,
    bioLimit: 300,
  },
];

export const PLATFORM_IDS: PlatformId[] = PLATFORMS.map((p) => p.id);

const BY_ID = new Map<PlatformId, PlatformMeta>(PLATFORMS.map((p) => [p.id, p]));

export function getPlatform(id: PlatformId): PlatformMeta {
  const meta = BY_ID.get(id);
  if (!meta) throw new Error(`Unknown platform: ${id}`);
  return meta;
}

export function isPlatformId(value: string): value is PlatformId {
  return BY_ID.has(value as PlatformId);
}

export function platformLabel(id: PlatformId): string {
  return BY_ID.get(id)?.label ?? id;
}
