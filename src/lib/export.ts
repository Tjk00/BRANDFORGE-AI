import JSZip from 'jszip';
import { generateCopy } from '../../shared/copy';
import { BANNERS, renderAvatar, renderBanner, type AvatarStyle } from '../../shared/graphics';
import { LOGO_STYLES, renderLogo, svgDataUri } from '../../shared/logo';
import { getNiche } from '../../shared/niches';
import { PALETTES } from '../../shared/palettes';
import { PLATFORMS } from '../../shared/platforms';
import type { BrandCopy, BrandProject, Palette } from '../../shared/types';

export function brandSlug(project: BrandProject): string {
  const base = (project.chosenName || project.workingTitle || 'brand').toLowerCase();
  return base.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'brand';
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function downloadText(text: string, filename: string, mime = 'text/plain;charset=utf-8'): void {
  downloadBlob(new Blob([text], { type: mime }), filename);
}

export function resolvePalette(project: BrandProject): Palette {
  return PALETTES.find((p) => p.id === project.paletteId) ?? project.palette ?? PALETTES[0];
}

export function resolveCopy(project: BrandProject): BrandCopy {
  if (project.copy) return project.copy;
  const niche = getNiche(project.nicheId);
  return generateCopy({
    name: project.chosenName || project.workingTitle || 'Your brand',
    niche,
    keywords: project.keywords,
    audience: '',
    tone: 'friendly',
  });
}

/** Rasterises an SVG string through canvas so the export contains real PNG files. */
export async function svgToPng(svg: string, width: number, height: number): Promise<Blob> {
  const image = new Image();
  image.decoding = 'sync';
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Could not rasterise the SVG.'));
    image.src = svgDataUri(svg);
  });

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable in this browser.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not encode the PNG.'));
    }, 'image/png');
  });
}

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export interface KitProgress {
  step: string;
  percent: number;
}

export async function buildBrandKitZip(
  project: BrandProject,
  onProgress?: (progress: KitProgress) => void,
): Promise<Blob> {
  const zip = new JSZip();
  const palette = resolvePalette(project);
  const copy = resolveCopy(project);
  const niche = getNiche(project.nicheId);
  const slug = brandSlug(project);
  const name = project.chosenName || project.workingTitle || 'Your brand';
  const root = zip.folder(slug) as JSZip;
  const total = 12;
  let done = 0;
  const tick = (step: string) => {
    done += 1;
    onProgress?.({ step, percent: Math.round((done / total) * 100) });
  };

  /* ---------------------------------------------------------- documentation */
  root.file(
    'README.txt',
    [
      `BRANDFORGE AI — brand kit for ${name}`,
      `Generated ${new Date().toLocaleString()}`,
      '',
      `Tagline: ${project.tagline || copy.taglines[0] || '—'}`,
      `Niche: ${niche?.label ?? 'Not selected'}`,
      `Palette: ${palette.name}`,
      '',
      'Contents',
      '  logos/            SVG masters plus 1024px PNG exports',
      '  profile-pictures/ PNG profile pictures sized per platform',
      '  banners/          Social banners in SVG and PNG with safe-area guidance',
      '  copy/             YouTube description, platform bios, taglines, slogans, story',
      '  palette/          Hex values as JSON and CSS custom properties',
      '  handles/          Username availability results with evidence',
      '  brand-guidelines  Self-contained HTML guide you can open or print',
      '',
      'About availability results: every platform check states whether it was verified by the',
      'platform itself or unconfirmed. Unconfirmed entries need a manual look at the profile URL —',
      'they are never presented as proof that a handle is free.',
    ].join('\n'),
  );
  tick('Documentation');

  /* ------------------------------------------------------------------ palette */
  root.file(
    'palette/palette.json',
    JSON.stringify(
      {
        name: palette.name,
        vibe: palette.vibe,
        primary: palette.primary,
        secondary: palette.secondary,
        accent: palette.accent,
        surface: palette.surface,
        ink: palette.ink,
        onPrimary: palette.onPrimary,
        gradient: palette.gradient,
      },
      null,
      2,
    ),
  );
  root.file(
    'palette/palette.css',
    [
      ':root {',
      `  --brand-primary: ${palette.primary};`,
      `  --brand-secondary: ${palette.secondary};`,
      `  --brand-accent: ${palette.accent};`,
      `  --brand-surface: ${palette.surface};`,
      `  --brand-ink: ${palette.ink};`,
      `  --brand-on-primary: ${palette.onPrimary};`,
      `  --brand-gradient: linear-gradient(135deg, ${palette.gradient[0]}, ${palette.gradient[1]});`,
      '}',
      '',
    ].join('\n'),
  );
  tick('Colour palette');

  /* -------------------------------------------------------------------- logos */
  const logos = root.folder('logos') as JSZip;
  for (const style of LOGO_STYLES) {
    const svg = renderLogo({
      text: name,
      subtext: project.tagline || copy.taglines[0] || '',
      style: style.id,
      palette,
      width: 1024,
      height: 1024,
    });
    logos.file(`logo-${style.id}.svg`, svg);
    try {
      logos.file(`logo-${style.id}.png`, await svgToPng(svg, 1024, 1024));
    } catch {
      // PNG is a convenience export; the SVG master is always written.
    }
  }
  tick('Logos');

  /* --------------------------------------------------------- profile pictures */
  const avatars = root.folder('profile-pictures') as JSZip;
  const styles: AvatarStyle[] = ['monogram', 'icon', 'ring', 'solid'];
  for (const style of styles) {
    const svg = renderAvatar({ name, palette, size: 512, style });
    avatars.file(`avatar-${style}-512.svg`, svg);
    try {
      avatars.file(`avatar-${style}-512.png`, await svgToPng(svg, 512, 512));
    } catch {
      // keep the SVG when rasterising is blocked
    }
  }
  for (const platform of PLATFORMS) {
    const svg = renderAvatar({ name, palette, size: platform.avatarSize, style: 'monogram' });
    try {
      avatars.file(`${platform.id}-${platform.avatarSize}.png`, await svgToPng(svg, platform.avatarSize, platform.avatarSize));
    } catch {
      avatars.file(`${platform.id}-${platform.avatarSize}.svg`, svg);
    }
  }
  tick('Profile pictures');

  /* ------------------------------------------------------------------ banners */
  const banners = root.folder('banners') as JSZip;
  for (const spec of BANNERS) {
    const svg = renderBanner({
      spec,
      name,
      tagline: project.tagline || copy.taglines[0] || '',
      handle: project.handles.find((h) => h.status === 'available' || h.confidence === 'verified')?.handle ?? '',
      palette,
      logoStyle: project.logoStyle,
      showSafeArea: false,
    });
    banners.file(`${spec.id}.svg`, svg);
    banners.file(`${spec.id}-safe-area-guide.svg`, renderBanner({
      spec,
      name,
      tagline: project.tagline || copy.taglines[0] || '',
      palette,
      logoStyle: project.logoStyle,
      showSafeArea: true,
    }));
    try {
      banners.file(`${spec.id}.png`, await svgToPng(svg, spec.width, spec.height));
    } catch {
      // SVG remains the master file
    }
  }
  tick('Banners');

  /* --------------------------------------------------------------------- copy */
  const copyFolder = root.folder('copy') as JSZip;
  copyFolder.file('youtube-description.txt', copy.youtubeDescription);
  copyFolder.file('taglines.txt', copy.taglines.map((t, i) => `${i + 1}. ${t}`).join('\n'));
  copyFolder.file('slogans.txt', copy.slogans.map((t, i) => `${i + 1}. ${t}`).join('\n'));
  copyFolder.file('brand-story.txt', copy.brandStory);
  copyFolder.file('mission.txt', copy.mission);
  copyFolder.file('keywords.txt', copy.keywords.join('\n'));
  const bios = copyFolder.folder('bios') as JSZip;
  for (const platform of PLATFORMS) {
    bios.file(`${platform.id}.txt`, `${copy.socialBios[platform.id] ?? ''}\n`);
  }
  tick('Descriptions and bios');

  /* ------------------------------------------------------------------ handles */
  const handlesFolder = root.folder('handles') as JSZip;
  const rows = [
    ['platform', 'handle', 'status', 'confidence', 'evidence', 'profile_url', 'http_status', 'checked_at'],
    ...project.handles.map((h) => [
      h.platform,
      h.handle,
      h.status,
      h.confidence,
      h.evidence,
      h.profileUrl,
      String(h.httpStatus ?? ''),
      h.checkedAt,
    ]),
  ];
  handlesFolder.file('availability.csv', rows.map((row) => row.map(csvEscape).join(',')).join('\n'));
  handlesFolder.file('availability.json', JSON.stringify(project.handles, null, 2));
  tick('Availability results');

  /* --------------------------------------------------------- brand guidelines */
  const logoPreviews = LOGO_STYLES.map(
    (style) =>
      `<figure><div class="logo">${renderLogo({ text: name, style: style.id, palette, width: 320, height: 320 })}</div><figcaption>${style.label}</figcaption></figure>`,
  ).join('');

  const guidelines = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${name} — Brand guidelines</title>
<style>
  :root{--p:${palette.primary};--s:${palette.secondary};--a:${palette.accent};--sur:${palette.surface};--ink:${palette.ink}}
  *{box-sizing:border-box}body{margin:0;font-family:Inter,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:var(--sur);color:var(--ink);line-height:1.6}
  main{max-width:900px;margin:0 auto;padding:32px 20px 64px}
  header{border-bottom:3px solid var(--p);padding-bottom:18px;margin-bottom:26px}
  h1{font-size:32px;margin:0 0 6px}h2{font-size:18px;margin:34px 0 12px;text-transform:uppercase;letter-spacing:.1em;color:var(--p)}
  h3{font-size:14px;margin:18px 0 6px}
  .tag{color:#666;font-size:15px}
  .swatches{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px}
  .sw{border:1px solid rgba(0,0,0,.12);border-radius:10px;overflow:hidden;background:#fff}
  .sw i{display:block;height:64px}.sw div{padding:8px;font-size:11px}
  .logos{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px}
  figure{margin:0;border:1px solid rgba(0,0,0,.1);border-radius:10px;background:#fff;padding:8px;text-align:center}
  figure svg{width:100%;height:auto}figcaption{font-size:11px;color:#666;margin-top:6px}
  pre{background:#fff;border:1px solid rgba(0,0,0,.1);border-radius:10px;padding:12px;white-space:pre-wrap;font-size:12.5px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
  table{width:100%;border-collapse:collapse;font-size:12px;background:#fff}
  th,td{border:1px solid rgba(0,0,0,.1);padding:7px 9px;text-align:left;vertical-align:top}
  th{background:rgba(0,0,0,.04);font-size:11px;text-transform:uppercase;letter-spacing:.05em}
  .muted{color:#666;font-size:12.5px}
  @media print{body{background:#fff}main{padding:0}}
</style></head><body><main>
<header>
  <h1>${name}</h1>
  <p class="tag">${project.tagline || copy.taglines[0] || ''}</p>
  <p class="muted">${niche?.label ?? 'Brand identity'} · Generated by BRANDFORGE AI on ${new Date().toLocaleDateString()}</p>
</header>

<h2>Brand foundation</h2>
<h3>Mission</h3><p>${copy.mission}</p>
<h3>Story</h3><p>${copy.brandStory}</p>
<h3>Taglines</h3><ul>${copy.taglines.map((t) => `<li>${t}</li>`).join('')}</ul>
<h3>Slogans</h3><ul>${copy.slogans.map((t) => `<li>${t}</li>`).join('')}</ul>

<h2>Colour</h2>
<div class="swatches">
  <div class="sw"><i style="background:${palette.primary}"></i><div><b>Primary</b><br>${palette.primary}</div></div>
  <div class="sw"><i style="background:${palette.secondary}"></i><div><b>Secondary</b><br>${palette.secondary}</div></div>
  <div class="sw"><i style="background:${palette.accent}"></i><div><b>Accent</b><br>${palette.accent}</div></div>
  <div class="sw"><i style="background:${palette.surface}"></i><div><b>Surface</b><br>${palette.surface}</div></div>
  <div class="sw"><i style="background:${palette.ink}"></i><div><b>Ink</b><br>${palette.ink}</div></div>
</div>
<p class="muted">${palette.vibe}</p>

<h2>Logo system</h2>
<div class="logos">${logoPreviews}</div>
<p class="muted">Use the wordmark for wide spaces, the monogram or badge for square avatars, and keep at least 1× the cap height clear around every mark.</p>

<h2>Voice</h2>
<p>Speak to ${niche?.audience.slice(0, 3).join(', ') ?? 'your audience'} in plain language. Lead with the outcome, show the reasoning, and avoid claims that cannot be sourced.</p>

<h2>Channel copy</h2>
<h3>YouTube description</h3><pre>${copy.youtubeDescription}</pre>
${PLATFORMS.map((p) => `<h3>${p.label} bio (${p.bioLimit} characters)</h3><pre>${copy.socialBios[p.id] ?? ''}</pre>`).join('')}

<h2>Username availability</h2>
<table><thead><tr><th>Platform</th><th>Handle</th><th>Status</th><th>Confidence</th><th>Evidence</th></tr></thead><tbody>
${project.handles
  .map(
    (h) =>
      `<tr><td>${h.platform}</td><td>@${h.handle}</td><td>${h.status}</td><td>${h.confidence}</td><td>${h.evidence}</td></tr>`,
  )
  .join('') || '<tr><td colspan="5">No availability checks recorded yet.</td></tr>'}
</tbody></table>
<p class="muted">"Unconfirmed" means the platform did not answer definitively for an automated request. Always open the profile URL before registering a handle.</p>
</main></body></html>`;

  root.file('brand-guidelines.html', guidelines);
  root.file(
    'brand-guidelines.md',
    [
      `# ${name}`,
      '',
      project.tagline || copy.taglines[0] || '',
      '',
      '## Mission',
      copy.mission,
      '',
      '## Story',
      copy.brandStory,
      '',
      '## Taglines',
      ...copy.taglines.map((t) => `- ${t}`),
      '',
      '## Slogans',
      ...copy.slogans.map((t) => `- ${t}`),
      '',
      '## Colour',
      `- Primary: ${palette.primary}`,
      `- Secondary: ${palette.secondary}`,
      `- Accent: ${palette.accent}`,
      `- Surface: ${palette.surface}`,
      `- Ink: ${palette.ink}`,
      '',
      '## YouTube description',
      '```',
      copy.youtubeDescription,
      '```',
      '',
      '## Bios',
      ...PLATFORMS.map((p) => `**${p.label}** — ${copy.socialBios[p.id] ?? ''}`),
      '',
    ].join('\n'),
  );
  tick('Brand guidelines');

  onProgress?.({ step: 'Compressing', percent: 96 });
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  onProgress?.({ step: 'Done', percent: 100 });
  return blob;
}
