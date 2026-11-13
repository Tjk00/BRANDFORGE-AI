import { escapeXml, fitFontSize, initialsOf, LOGO_STYLES } from './logo';
import { hashSeed } from './names';
import { getPlatform } from './platforms';
import type { BannerSpec, LogoSvgStyle, Palette, PlatformId } from './types';

const FONT = "'Inter','Helvetica Neue',Helvetica,Arial,sans-serif";

export const BANNERS: BannerSpec[] = [
  {
    id: 'youtube-banner',
    platform: 'youtube',
    label: 'YouTube banner',
    width: 2560,
    height: 1440,
    safeWidth: 1546,
    safeHeight: 423,
    note: 'The dashed area is the only region visible on TV, desktop and mobile. Keep every word inside it.',
  },
  {
    id: 'facebook-cover',
    platform: 'facebook',
    label: 'Facebook cover',
    width: 1640,
    height: 624,
    safeWidth: 1640,
    safeHeight: 624,
    note: 'Facebook crops the cover differently on mobile and desktop, so the centre strip carries the message.',
  },
  {
    id: 'x-header',
    platform: 'x',
    label: 'X header',
    width: 1500,
    height: 500,
    safeWidth: 1200,
    safeHeight: 400,
    note: 'The avatar overlaps the lower-left corner on profile view; keep the name centred.',
  },
  {
    id: 'linkedin-banner',
    platform: 'linkedin',
    label: 'LinkedIn banner',
    width: 1584,
    height: 396,
    safeWidth: 1200,
    safeHeight: 396,
    note: 'The profile photo covers the left edge, so the wordmark sits right of centre.',
  },
  {
    id: 'twitch-banner',
    platform: 'twitch',
    label: 'Twitch banner',
    width: 1200,
    height: 480,
    safeWidth: 1200,
    safeHeight: 400,
    note: 'Twitch overlays offline state text in the middle; keep it clear of the centre.',
  },
  {
    id: 'pinterest-cover',
    platform: 'pinterest',
    label: 'Pinterest board cover',
    width: 1000,
    height: 1500,
    safeWidth: 1000,
    safeHeight: 1200,
    note: 'Portrait format: Pinterest crops to 2:3 in feeds, so the top two thirds carry the brand.',
  },
];

export function getBanner(id: string): BannerSpec | undefined {
  return BANNERS.find((b) => b.id === id);
}

export type AvatarStyle = 'monogram' | 'icon' | 'ring' | 'solid';

export const AVATAR_STYLES: { id: AvatarStyle; label: string }[] = [
  { id: 'monogram', label: 'Monogram' },
  { id: 'icon', label: 'Icon' },
  { id: 'ring', label: 'Ring' },
  { id: 'solid', label: 'Solid' },
];

export interface AvatarOptions {
  name: string;
  palette: Palette;
  size?: number;
  style?: AvatarStyle;
  variant?: number;
}

export function renderAvatar(options: AvatarOptions): string {
  const size = options.size ?? 512;
  const p = options.palette;
  const style = options.style ?? 'monogram';
  const name = options.name.trim() || 'Brand';
  const variant = options.variant ?? hashSeed(name);
  const uid = `av${hashSeed(`${name}${style}${size}`).toString(36)}`;
  const initials = initialsOf(name);
  const c = size / 2;

  const head = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${escapeXml(name)} profile picture">`;
  const defs = `<defs><linearGradient id="${uid}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${p.gradient[0]}"/><stop offset="100%" stop-color="${p.gradient[1]}"/></linearGradient></defs>`;

  const bodies: Record<AvatarStyle, string> = {
    monogram: [
      `<rect width="${size}" height="${size}" fill="url(#${uid}g)"/>`,
      `<text x="${c}" y="${c}" text-anchor="middle" dominant-baseline="central" font-family="${FONT}" font-size="${size * 0.4}" font-weight="800" fill="${p.onPrimary}" letter-spacing="${size * 0.005}">${escapeXml(initials)}</text>`,
    ].join(''),
    icon: [
      `<rect width="${size}" height="${size}" fill="${p.primary}"/>`,
      `<circle cx="${c}" cy="${c}" r="${size * 0.34}" fill="none" stroke="${p.onPrimary}" stroke-width="${size * 0.055}"/>`,
      `<path d="M ${c - size * 0.16} ${c + size * 0.02} L ${c} ${c - size * 0.18} L ${c + size * 0.16} ${c + size * 0.02}" fill="none" stroke="${p.accent}" stroke-width="${size * 0.06}" stroke-linecap="round" stroke-linejoin="round"/>`,
      `<circle cx="${c}" cy="${c + size * 0.2}" r="${size * 0.035}" fill="${p.onPrimary}"/>`,
    ].join(''),
    ring: [
      `<rect width="${size}" height="${size}" fill="${p.surface}"/>`,
      `<circle cx="${c}" cy="${c}" r="${size * 0.42}" fill="none" stroke="${p.primary}" stroke-width="${size * 0.07}"/>`,
      `<circle cx="${c}" cy="${c}" r="${size * 0.34}" fill="url(#${uid}g)"/>`,
      `<text x="${c}" y="${c}" text-anchor="middle" dominant-baseline="central" font-family="${FONT}" font-size="${size * 0.3}" font-weight="800" fill="${p.onPrimary}">${escapeXml(initials)}</text>`,
    ].join(''),
    solid: [
      `<rect width="${size}" height="${size}" fill="${p.secondary}"/>`,
      `<circle cx="${size * 0.82}" cy="${size * 0.18}" r="${size * 0.16}" fill="${p.accent}" opacity="0.55"/>`,
      `<text x="${c}" y="${c}" text-anchor="middle" dominant-baseline="central" font-family="${FONT}" font-size="${size * 0.32}" font-weight="800" fill="${p.onPrimary}" letter-spacing="${size * 0.02}">${escapeXml(initials)}</text>`,
    ].join(''),
  };

  // variant keeps avatar shapes from being identical across projects
  const accentDot =
    Math.abs(variant) % 3 === 0
      ? `<circle cx="${size * 0.2}" cy="${size * 0.2}" r="${size * 0.05}" fill="${p.accent}"/>`
      : '';

  return [head, defs, bodies[style] ?? bodies.monogram, accentDot, '</svg>'].join('');
}

export interface BannerOptions {
  spec: BannerSpec;
  name: string;
  tagline: string;
  handle?: string;
  palette: Palette;
  logoStyle?: LogoSvgStyle;
  showSafeArea?: boolean;
  variant?: number;
}

export function renderBanner(options: BannerOptions): string {
  const { spec, palette: p } = options;
  const { width, height } = spec;
  const name = options.name.trim() || 'Brand';
  const tagline = options.tagline.trim();
  const handle = (options.handle ?? '').trim();
  const variant = options.variant ?? hashSeed(name);
  const uid = `bn${hashSeed(`${name}${spec.id}${variant}`).toString(36)}`;
  const style = options.logoStyle ?? LOGO_STYLES[Math.abs(variant) % LOGO_STYLES.length].id;

  const safeX = (width - spec.safeWidth) / 2;
  const safeY = (height - spec.safeHeight) / 2;
  const cx = width / 2;
  const cy = height / 2;
  const nameSize = fitFontSize(name, spec.safeWidth * 0.72, Math.min(height * 0.26, 150), 20, 0.58);
  const taglineSize = Math.max(12, nameSize * 0.34);

  const safeArea = options.showSafeArea
    ? `<rect x="${safeX}" y="${safeY}" width="${spec.safeWidth}" height="${spec.safeHeight}" fill="none" stroke="${p.onPrimary}" stroke-opacity="0.75" stroke-width="${Math.max(2, width * 0.002)}" stroke-dasharray="${Math.max(8, width * 0.01)} ${Math.max(6, width * 0.008)}"/>`
    : '';

  const decorations = [
    `<circle cx="${width * 0.08}" cy="${height * 0.18}" r="${height * 0.34}" fill="${p.accent}" opacity="0.16"/>`,
    `<circle cx="${width * 0.94}" cy="${height * 0.9}" r="${height * 0.42}" fill="${p.onPrimary}" opacity="0.1"/>`,
    `<rect x="${width * 0.72}" y="${-height * 0.2}" width="${width * 0.06}" height="${height * 1.4}" fill="${p.onPrimary}" opacity="0.06" transform="rotate(18 ${width * 0.75} ${height / 2})"/>`,
  ].join('');

  const badge = handle
    ? `<g><rect x="${cx - Math.max(90, handle.length * taglineSize * 0.34)}" y="${cy + nameSize * 0.92}" width="${Math.max(180, handle.length * taglineSize * 0.68)}" height="${taglineSize * 1.7}" rx="${taglineSize * 0.85}" fill="${p.onPrimary}" opacity="0.16"/><text x="${cx}" y="${cy + nameSize * 0.92 + taglineSize * 0.86}" text-anchor="middle" dominant-baseline="central" font-family="${FONT}" font-size="${taglineSize * 0.86}" font-weight="700" fill="${p.onPrimary}">${escapeXml(handle)}</text></g>`
    : '';

  const platformTag = `<text x="${width - safeX * 0.5}" y="${height - safeY * 0.4}" text-anchor="end" font-family="${FONT}" font-size="${Math.max(11, height * 0.032)}" font-weight="700" letter-spacing="${height * 0.004}" fill="${p.onPrimary}" opacity="0.5">${escapeXml(getPlatform(spec.platform).label.toUpperCase())} · ${spec.width}×${spec.height}</text>`;

  const core =
    style === 'monogram' || style === 'badge'
      ? [
          `<circle cx="${cx}" cy="${cy - nameSize * 0.55}" r="${nameSize * 0.5}" fill="${p.onPrimary}" opacity="0.18"/>`,
          `<text x="${cx}" y="${cy - nameSize * 0.55}" text-anchor="middle" dominant-baseline="central" font-family="${FONT}" font-size="${nameSize * 0.42}" font-weight="800" fill="${p.onPrimary}">${escapeXml(initialsOf(name))}</text>`,
          `<text x="${cx}" y="${cy + nameSize * 0.28}" text-anchor="middle" font-family="${FONT}" font-size="${nameSize * 0.78}" font-weight="800" fill="${p.onPrimary}">${escapeXml(name)}</text>`,
        ].join('')
      : `<text x="${cx}" y="${cy - nameSize * 0.1}" text-anchor="middle" dominant-baseline="central" font-family="${FONT}" font-size="${nameSize}" font-weight="800" letter-spacing="${style === 'wordmark' ? nameSize * 0.02 : 0}" fill="${p.onPrimary}">${escapeXml(style === 'wordmark' ? name.toUpperCase() : name)}</text>`;

  const taglineBlock = tagline
    ? `<text x="${cx}" y="${cy + nameSize * 0.62}" text-anchor="middle" font-family="${FONT}" font-size="${taglineSize}" font-weight="600" fill="${p.onPrimary}" opacity="0.92">${escapeXml(tagline)}</text>`
    : '';

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${escapeXml(name)} ${escapeXml(spec.label)}">`,
    `<defs><linearGradient id="${uid}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${p.gradient[0]}"/><stop offset="100%" stop-color="${p.gradient[1]}"/></linearGradient></defs>`,
    `<rect width="${width}" height="${height}" fill="${p.secondary}"/>`,
    `<rect width="${width}" height="${height}" fill="url(#${uid}g)" opacity="0.94"/>`,
    decorations,
    core,
    taglineBlock,
    badge,
    safeArea,
    platformTag,
    '</svg>',
  ].join('');
}

export function avatarSizesFor(platform: PlatformId): number {
  return getPlatform(platform).avatarSize;
}
