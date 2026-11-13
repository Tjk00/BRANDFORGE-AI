import { hashSeed } from './names';
import type { LogoSvgStyle, Palette } from './types';

export interface LogoOptions {
  text: string;
  subtext?: string;
  style: LogoSvgStyle;
  palette: Palette;
  width?: number;
  height?: number;
  variant?: number;
}

export const LOGO_STYLES: { id: LogoSvgStyle; label: string; blurb: string }[] = [
  { id: 'wordmark', label: 'Wordmark', blurb: 'Typography-led, clean at small sizes' },
  { id: 'monogram', label: 'Monogram', blurb: 'Initials in a contained shape' },
  { id: 'badge', label: 'Badge', blurb: 'Circular emblem, great for avatars' },
  { id: 'geometric', label: 'Geometric', blurb: 'Icon plus name, very versatile' },
  { id: 'gradient', label: 'Gradient', blurb: 'Modern, high-impact, screen-first' },
  { id: 'line', label: 'Line mark', blurb: 'Minimal outline, premium feel' },
  { id: 'stacked', label: 'Stacked', blurb: 'Icon above name, editorial layout' },
  { id: 'orbit', label: 'Orbit', blurb: 'Circular system, tech-forward' },
];

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function initialsOf(text: string): string {
  const words = text
    .replace(/[^A-Za-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return 'B';
  if (words.length === 1) {
    const w = words[0];
    return (w.length > 1 ? `${w[0]}${w[1]}` : w[0]).toUpperCase();
  }
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

/** Approximate text width so generated SVG never overflows its box. */
export function fitFontSize(text: string, maxWidth: number, maxSize: number, minSize: number, factor = 0.6): number {
  if (text.length === 0) return maxSize;
  const size = maxWidth / (text.length * factor);
  return Math.max(minSize, Math.min(maxSize, Math.round(size * 100) / 100));
}

const FONT = "'Inter','Helvetica Neue',Helvetica,Arial,sans-serif";

function shapeFor(variant: number): 'hex' | 'circle' | 'diamond' | 'shield' | 'spark' | 'square' {
  const shapes = ['hex', 'circle', 'diamond', 'shield', 'spark', 'square'] as const;
  return shapes[Math.abs(variant) % shapes.length];
}

function iconMark(
  shape: 'hex' | 'circle' | 'diamond' | 'shield' | 'spark' | 'square',
  cx: number,
  cy: number,
  r: number,
  fill: string,
  stroke: string,
  strokeWidth: number,
): string {
  switch (shape) {
    case 'circle':
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
    case 'diamond':
      return `<rect x="${cx - r * 0.78}" y="${cy - r * 0.78}" width="${r * 1.56}" height="${r * 1.56}" rx="${r * 0.16}" transform="rotate(45 ${cx} ${cy})" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
    case 'square':
      return `<rect x="${cx - r * 0.85}" y="${cy - r * 0.85}" width="${r * 1.7}" height="${r * 1.7}" rx="${r * 0.34}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
    case 'shield':
      return `<path d="M ${cx} ${cy - r} L ${cx + r * 0.86} ${cy - r * 0.5} L ${cx + r * 0.72} ${cy + r * 0.55} L ${cx} ${cy + r} L ${cx - r * 0.72} ${cy + r * 0.55} L ${cx - r * 0.86} ${cy - r * 0.5} Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
    case 'spark':
      return `<path d="M ${cx} ${cy - r} L ${cx + r * 0.28} ${cy - r * 0.28} L ${cx + r} ${cy} L ${cx + r * 0.28} ${cy + r * 0.28} L ${cx} ${cy + r} L ${cx - r * 0.28} ${cy + r * 0.28} L ${cx - r} ${cy} L ${cx - r * 0.28} ${cy - r * 0.28} Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
    default: {
      const pts: string[] = [];
      for (let i = 0; i < 6; i += 1) {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
        pts.push(`${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`);
      }
      return `<polygon points="${pts.join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
    }
  }
}

export function renderLogo(options: LogoOptions): string {
  const width = options.width ?? 512;
  const height = options.height ?? 512;
  const p = options.palette;
  const text = options.text.trim() || 'Brand';
  const subtext = (options.subtext ?? '').trim();
  const variant = options.variant ?? hashSeed(text);
  const shape = shapeFor(variant);
  const uid = `lg${hashSeed(`${text}${options.style}${variant}`).toString(36)}`;
  const initials = initialsOf(text);

  const header = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${escapeXml(text)} logo">`;

  const defs = `<defs><linearGradient id="${uid}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${p.gradient[0]}"/><stop offset="100%" stop-color="${p.gradient[1]}"/></linearGradient></defs>`;

  const cx = width / 2;
  const cy = height / 2;

  switch (options.style) {
    case 'wordmark': {
      const size = fitFontSize(text, width * 0.82, height * 0.22, 22, 0.62);
      const barW = Math.min(width * 0.28, size * 2.4);
      return [
        header,
        defs,
        `<rect width="${width}" height="${height}" fill="none"/>`,
        `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-family="${FONT}" font-size="${size}" font-weight="800" letter-spacing="${(size * 0.01).toFixed(2)}" fill="${p.primary}">${escapeXml(text.toUpperCase())}</text>`,
        `<rect x="${cx - barW / 2}" y="${cy + size * 0.72}" width="${barW}" height="${Math.max(4, size * 0.1)}" rx="${size * 0.05}" fill="${p.accent}"/>`,
        subtext
          ? `<text x="${cx}" y="${cy + size * 1.35}" text-anchor="middle" font-family="${FONT}" font-size="${fitFontSize(subtext, width * 0.7, size * 0.36, 10, 0.55)}" font-weight="600" letter-spacing="${size * 0.06}" fill="${p.ink}" opacity="0.7">${escapeXml(subtext.toUpperCase())}</text>`
          : '',
        '</svg>',
      ].join('');
    }
    case 'monogram': {
      const box = Math.min(width, height) * 0.56;
      const size = fitFontSize(text, width * 0.78, height * 0.11, 14, 0.6);
      return [
        header,
        defs,
        `<rect x="${cx - box / 2}" y="${cy - box * 0.72}" width="${box}" height="${box}" rx="${box * 0.26}" fill="url(#${uid}g)"/>`,
        `<text x="${cx}" y="${cy - box * 0.72 + box / 2}" text-anchor="middle" dominant-baseline="middle" font-family="${FONT}" font-size="${box * 0.44}" font-weight="800" fill="${p.onPrimary}">${escapeXml(initials)}</text>`,
        `<text x="${cx}" y="${cy + box * 0.62}" text-anchor="middle" font-family="${FONT}" font-size="${size}" font-weight="700" letter-spacing="${size * 0.08}" fill="${p.ink}">${escapeXml(text.toUpperCase())}</text>`,
        '</svg>',
      ].join('');
    }
    case 'badge': {
      const r = Math.min(width, height) * 0.36;
      const ringId = `${uid}ring`;
      const ringPath = `M ${cx - r} ${cy} a ${r} ${r} 0 1 1 ${r * 2} 0 a ${r} ${r} 0 1 1 ${-r * 2} 0`;
      return [
        header,
        defs,
        `<defs><path id="${ringId}" d="${ringPath}"/></defs>`,
        `<circle cx="${cx}" cy="${cy}" r="${r * 1.16}" fill="none" stroke="${p.primary}" stroke-width="${Math.max(2, r * 0.035)}"/>`,
        `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${p.primary}"/>`,
        `<text font-family="${FONT}" font-size="${fitFontSize(text, r * 5.2, r * 0.28, 9, 0.62)}" font-weight="700" letter-spacing="${r * 0.045}" fill="${p.accent}"><textPath href="#${ringId}" startOffset="50%" text-anchor="middle">${escapeXml(text.toUpperCase())}</textPath></text>`,
        `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-family="${FONT}" font-size="${r * 0.5}" font-weight="800" fill="${p.onPrimary}">${escapeXml(initials)}</text>`,
        subtext
          ? `<text x="${cx}" y="${cy + r * 1.42}" text-anchor="middle" font-family="${FONT}" font-size="${r * 0.16}" font-weight="600" letter-spacing="${r * 0.04}" fill="${p.ink}" opacity="0.75">${escapeXml(subtext)}</text>`
          : '',
        '</svg>',
      ].join('');
    }
    case 'geometric': {
      const iconR = Math.min(width, height) * 0.17;
      const iconCx = width * 0.22;
      const size = fitFontSize(text, width * 0.52, height * 0.2, 16, 0.6);
      return [
        header,
        defs,
        iconMark(shape, iconCx, cy, iconR, `url(#${uid}g)`, p.secondary, Math.max(2, iconR * 0.08)),
        `<circle cx="${iconCx}" cy="${cy}" r="${iconR * 0.34}" fill="${p.surface}"/>`,
        `<text x="${iconCx + iconR * 1.35}" y="${cy}" text-anchor="start" dominant-baseline="middle" font-family="${FONT}" font-size="${size}" font-weight="800" letter-spacing="${size * 0.02}" fill="${p.ink}">${escapeXml(text)}</text>`,
        subtext
          ? `<text x="${iconCx + iconR * 1.35}" y="${cy + size * 0.92}" text-anchor="start" font-family="${FONT}" font-size="${size * 0.4}" font-weight="600" letter-spacing="${size * 0.08}" fill="${p.primary}">${escapeXml(subtext.toUpperCase())}</text>`
          : '',
        '</svg>',
      ].join('');
    }
    case 'gradient': {
      const pad = Math.min(width, height) * 0.08;
      const size = fitFontSize(text, width - pad * 4, height * 0.24, 18, 0.6);
      return [
        header,
        defs,
        `<rect x="${pad}" y="${pad}" width="${width - pad * 2}" height="${height - pad * 2}" rx="${Math.min(width, height) * 0.12}" fill="url(#${uid}g)"/>`,
        `<circle cx="${width - pad * 2.2}" cy="${pad * 2.4}" r="${width * 0.1}" fill="${p.onPrimary}" opacity="0.14"/>`,
        `<circle cx="${pad * 2.2}" cy="${height - pad * 2.6}" r="${width * 0.16}" fill="${p.onPrimary}" opacity="0.1"/>`,
        `<text x="${cx}" y="${cy - size * 0.1}" text-anchor="middle" dominant-baseline="middle" font-family="${FONT}" font-size="${size}" font-weight="800" fill="${p.onPrimary}">${escapeXml(text)}</text>`,
        subtext
          ? `<text x="${cx}" y="${cy + size * 0.86}" text-anchor="middle" font-family="${FONT}" font-size="${size * 0.36}" font-weight="600" letter-spacing="${size * 0.1}" fill="${p.onPrimary}" opacity="0.88">${escapeXml(subtext.toUpperCase())}</text>`
          : '',
        '</svg>',
      ].join('');
    }
    case 'line': {
      const r = Math.min(width, height) * 0.24;
      const size = fitFontSize(text, width * 0.8, height * 0.13, 14, 0.6);
      return [
        header,
        defs,
        `<circle cx="${cx}" cy="${cy - height * 0.1}" r="${r}" fill="none" stroke="${p.primary}" stroke-width="${Math.max(2, r * 0.06)}"/>`,
        `<path d="M ${cx - r * 0.5} ${cy - height * 0.1} L ${cx + r * 0.5} ${cy - height * 0.1}" stroke="${p.accent}" stroke-width="${Math.max(2, r * 0.09)}" stroke-linecap="round"/>`,
        `<text x="${cx}" y="${cy + height * 0.24}" text-anchor="middle" font-family="${FONT}" font-size="${size}" font-weight="700" letter-spacing="${size * 0.14}" fill="${p.ink}">${escapeXml(text.toUpperCase())}</text>`,
        '</svg>',
      ].join('');
    }
    case 'stacked': {
      const iconR = Math.min(width, height) * 0.15;
      const iconCy = height * 0.3;
      const size = fitFontSize(text, width * 0.84, height * 0.17, 14, 0.6);
      return [
        header,
        defs,
        iconMark(shape, cx, iconCy, iconR, `url(#${uid}g)`, p.secondary, Math.max(2, iconR * 0.08)),
        `<text x="${cx}" y="${height * 0.62}" text-anchor="middle" font-family="${FONT}" font-size="${size}" font-weight="800" letter-spacing="${size * 0.03}" fill="${p.ink}">${escapeXml(text)}</text>`,
        `<rect x="${cx - size * 1.1}" y="${height * 0.68}" width="${size * 2.2}" height="${Math.max(3, size * 0.08)}" rx="${size * 0.04}" fill="${p.accent}"/>`,
        subtext
          ? `<text x="${cx}" y="${height * 0.79}" text-anchor="middle" font-family="${FONT}" font-size="${size * 0.34}" font-weight="600" letter-spacing="${size * 0.1}" fill="${p.primary}">${escapeXml(subtext.toUpperCase())}</text>`
          : '',
        '</svg>',
      ].join('');
    }
    case 'orbit':
    default: {
      const r = Math.min(width, height) * 0.3;
      const size = fitFontSize(text, width * 0.8, height * 0.13, 14, 0.6);
      const dotAngle = (Math.abs(variant) % 360) * (Math.PI / 180);
      return [
        header,
        defs,
        `<circle cx="${cx}" cy="${cy - height * 0.08}" r="${r}" fill="none" stroke="${p.primary}" stroke-width="${Math.max(2, r * 0.05)}"/>`,
        `<circle cx="${cx}" cy="${cy - height * 0.08}" r="${r * 0.62}" fill="url(#${uid}g)"/>`,
        `<circle cx="${(cx + r * Math.cos(dotAngle)).toFixed(2)}" cy="${(cy - height * 0.08 + r * Math.sin(dotAngle)).toFixed(2)}" r="${r * 0.1}" fill="${p.accent}"/>`,
        `<text x="${cx}" y="${cy + height * 0.3}" text-anchor="middle" font-family="${FONT}" font-size="${size}" font-weight="800" letter-spacing="${size * 0.05}" fill="${p.ink}">${escapeXml(text)}</text>`,
        '</svg>',
      ].join('');
    }
  }
}

export function svgDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
