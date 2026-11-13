import type { AvailabilityResult, GeneratedName, Palette, PlatformId } from '../shared/types';

export type { AvailabilityResult, GeneratedName, Palette, PlatformId };

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
}

export interface AiSettings {
  enabled: boolean;
  baseUrl: string;
  model: string;
  apiKey: string;
}
