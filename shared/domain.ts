export type PlatformId =
  | 'youtube'
  | 'tiktok'
  | 'instagram'
  | 'facebook'
  | 'x'
  | 'pinterest'
  | 'threads'
  | 'linkedin'
  | 'twitch'
  | 'reddit';

export type AvailabilityStatus = 'available' | 'taken' | 'unconfirmed' | 'invalid';
export type Confidence = 'verified' | 'unconfirmed';

export interface AvailabilityResult {
  platform: PlatformId;
  handle: string;
  status: AvailabilityStatus;
  confidence: Confidence;
  evidence: string;
  profileUrl: string;
  httpStatus: number | null;
  checkedAt: string;
  manual?: 'available' | 'taken';
}

export type NameStyle =
  | 'compound'
  | 'invented'
  | 'descriptive'
  | 'metaphor'
  | 'action'
  | 'alliterative'
  | 'prefixed';

export type NameTarget = 'business' | 'youtube' | 'social';

export interface GeneratedName {
  name: string;
  slug: string;
  style: NameStyle;
  technique: string;
  score: number;
  source: 'engine' | 'ai';
}

export interface Palette {
  id: string;
  name: string;
  vibe: string;
  primary: string;
  secondary: string;
  accent: string;
  surface: string;
  ink: string;
  gradient: [string, string];
  onPrimary: string;
}

export interface NameRequest {
  keywords: string[];
  target: NameTarget;
  count: number;
  styles: NameStyle[];
  seed: string;
}

export interface NicheResearchLink {
  label: string;
  url: string;
}

export interface Niche {
  id: string;
  label: string;
  category: string;
  summary: string;
  audience: string[];
  demand: 'very high' | 'high' | 'growing' | 'steady';
  demandNote: string;
  monetization: string[];
  contentAngles: string[];
  competitorLandscape: string;
  keywords: string[];
  platforms: PlatformId[];
}

export interface BannerSpec {
  id: string;
  platform: PlatformId;
  label: string;
  width: number;
  height: number;
  safeWidth: number;
  safeHeight: number;
  note: string;
}


