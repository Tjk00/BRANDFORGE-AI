import type { AvailabilityResult, GeneratedName, Palette, PlatformId } from './domain';
import type { BrandVoice } from './voice';

export type LogoSvgStyle =
  | 'wordmark'
  | 'monogram'
  | 'badge'
  | 'geometric'
  | 'gradient'
  | 'line'
  | 'stacked'
  | 'orbit';

export interface BrandCopy {
  taglines: string[];
  slogans: string[];
  youtubeDescription: string;
  socialBios: Record<PlatformId, string>;
  brandStory: string;
  mission: string;
  keywords: string[];
}

export interface BrandProject {
  id: string;
  createdAt: string;
  updatedAt: string;
  workingTitle: string;
  chosenName: string;
  tagline: string;
  nicheId: string | null;
  keywords: string[];
  paletteId: string;
  palette: Palette;
  logoStyle: LogoSvgStyle;
  names: GeneratedName[];
  copy: BrandCopy | null;
  handles: AvailabilityResult[];
  notes: string;
  /** Optional so projects saved by earlier versions keep loading. */
  voice?: BrandVoice | null;
  audience?: string;
  tone?: string;
  favorites?: string[];
  /** Set when a brand kit ZIP was actually downloaded. */
  lastExportedAt?: string;
}

export interface AiSettings {
  enabled: boolean;
  baseUrl: string;
  model: string;
  apiKey: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
  nicheId: string | null;
  paletteId: string;
}
