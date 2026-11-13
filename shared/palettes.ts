import type { Palette } from './types';

export const PALETTES: Palette[] = [
  {
    id: 'ember-forge',
    name: 'Ember Forge',
    vibe: 'Warm, confident, made-by-hand',
    primary: '#E2562B',
    secondary: '#1F1A17',
    accent: '#F2B705',
    surface: '#FFF8F2',
    ink: '#1B1512',
    gradient: ['#E2562B', '#F2B705'],
    onPrimary: '#FFFFFF',
  },
  {
    id: 'midnight-circuit',
    name: 'Midnight Circuit',
    vibe: 'Technical, calm, modern',
    primary: '#3B82F6',
    secondary: '#0B1220',
    accent: '#22D3EE',
    surface: '#F5F8FF',
    ink: '#0B1220',
    gradient: ['#3B82F6', '#22D3EE'],
    onPrimary: '#FFFFFF',
  },
  {
    id: 'sage-studio',
    name: 'Sage Studio',
    vibe: 'Grounded, natural, editorial',
    primary: '#4F7F5B',
    secondary: '#22301F',
    accent: '#C9A227',
    surface: '#F6F8F3',
    ink: '#1C241A',
    gradient: ['#4F7F5B', '#8FB996'],
    onPrimary: '#FFFFFF',
  },
  {
    id: 'rose-quartz',
    name: 'Rose Quartz',
    vibe: 'Soft, personable, lifestyle',
    primary: '#D6336C',
    secondary: '#3D0F22',
    accent: '#FFB3C7',
    surface: '#FFF5F8',
    ink: '#2B0A17',
    gradient: ['#D6336C', '#FF8FA3'],
    onPrimary: '#FFFFFF',
  },
  {
    id: 'solar-flare',
    name: 'Solar Flare',
    vibe: 'Energetic, loud, creator-first',
    primary: '#FF7A00',
    secondary: '#2A1600',
    accent: '#FFD166',
    surface: '#FFFBF3',
    ink: '#201100',
    gradient: ['#FF7A00', '#FFD166'],
    onPrimary: '#1A1000',
  },
  {
    id: 'deep-ocean',
    name: 'Deep Ocean',
    vibe: 'Trustworthy, clean, corporate',
    primary: '#0F766E',
    secondary: '#062E2B',
    accent: '#5EEAD4',
    surface: '#F0FDFA',
    ink: '#062B28',
    gradient: ['#0F766E', '#5EEAD4'],
    onPrimary: '#FFFFFF',
  },
  {
    id: 'royal-ink',
    name: 'Royal Ink',
    vibe: 'Premium, creative, bold',
    primary: '#4C1D95',
    secondary: '#1B0B3B',
    accent: '#A78BFA',
    surface: '#F7F5FF',
    ink: '#1A0B33',
    gradient: ['#4C1D95', '#A78BFA'],
    onPrimary: '#FFFFFF',
  },
  {
    id: 'sand-clay',
    name: 'Sand & Clay',
    vibe: 'Earthy, artisan, warm',
    primary: '#B45309',
    secondary: '#3A2210',
    accent: '#F59E0B',
    surface: '#FDF8F1',
    ink: '#2A1A0B',
    gradient: ['#B45309', '#F59E0B'],
    onPrimary: '#FFFFFF',
  },
  {
    id: 'monochrome',
    name: 'Monochrome',
    vibe: 'Minimal, timeless, high-contrast',
    primary: '#111111',
    secondary: '#333333',
    accent: '#9CA3AF',
    surface: '#FAFAFA',
    ink: '#0A0A0A',
    gradient: ['#111111', '#4B5563'],
    onPrimary: '#FFFFFF',
  },
  {
    id: 'neon-lime',
    name: 'Neon Lime',
    vibe: 'Playful, fast, Gen-Z',
    primary: '#65A30D',
    secondary: '#14200A',
    accent: '#BEF264',
    surface: '#F7FEE7',
    ink: '#101A06',
    gradient: ['#65A30D', '#BEF264'],
    onPrimary: '#0E1A05',
  },
  {
    id: 'coastal-blue',
    name: 'Coastal Blue',
    vibe: 'Fresh, airy, approachable',
    primary: '#0284C7',
    secondary: '#082F49',
    accent: '#7DD3FC',
    surface: '#F0F9FF',
    ink: '#062033',
    gradient: ['#0284C7', '#7DD3FC'],
    onPrimary: '#FFFFFF',
  },
  {
    id: 'berry-pop',
    name: 'Berry Pop',
    vibe: 'Vibrant, youthful, social',
    primary: '#7C3AED',
    secondary: '#2B0B4C',
    accent: '#F472B6',
    surface: '#FDF4FF',
    ink: '#240A3D',
    gradient: ['#7C3AED', '#F472B6'],
    onPrimary: '#FFFFFF',
  },
];

export function getPalette(id: string): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0];
}

export function paletteFromSeed(seed: string): Palette {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return PALETTES[hash % PALETTES.length];
}

/** Relative luminance helper used to keep text readable on generated artwork. */
export function contrastInk(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return luminance > 0.45 ? '#101010' : '#FFFFFF';
}
