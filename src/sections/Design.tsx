import { useState } from 'react';
import { AVATAR_STYLES, BANNERS, renderAvatar, renderBanner, type AvatarStyle } from '../../shared/graphics';
import { LOGO_STYLES, renderLogo } from '../../shared/logo';
import { PALETTES } from '../../shared/palettes';
import { PLATFORMS } from '../../shared/platforms';
import type { LogoSvgStyle } from '../../shared/types';
import { downloadBlob, resolvePalette, svgToPng } from '../lib/export';
import { IconDownload } from '../components/Icons';
import { Btn, Card, Chip, Notice, SectionHead, useToast } from '../components/ui';
import type { SectionProps } from '../lib/nav';

type Tab = 'logos' | 'avatars' | 'banners';

const TABS: { id: Tab; label: string }[] = [
  { id: 'logos', label: 'Logos' },
  { id: 'avatars', label: 'Profile pictures' },
  { id: 'banners', label: 'Banners & covers' },
];

export default function Design({ project, update }: SectionProps) {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('logos');
  const [avatarStyle, setAvatarStyle] = useState<AvatarStyle>('monogram');
  const [safeArea, setSafeArea] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const palette = resolvePalette(project);
  const name = project.chosenName || project.workingTitle || 'Your brand';
  const tagline = project.tagline;

  const saveSvg = (svg: string, filename: string) => {
    downloadBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), filename);
    toast(`${filename} downloaded`);
  };

  const savePng = async (svg: string, width: number, height: number, filename: string) => {
    setBusy(filename);
    try {
      const blob = await svgToPng(svg, width, height);
      downloadBlob(blob, filename);
      toast(`${filename} downloaded`);
    } catch {
      saveSvg(svg, filename.replace(/\.png$/, '.svg'));
      toast('PNG export was blocked by the browser — saved the SVG master instead.', 'bad');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="section">
      <SectionHead
        title="Design studio"
        subtitle="Every asset is generated locally as vector SVG and rasterised on your device. No image API, no credits, no watermarks."
      />

      <div className="row tight" style={{ overflowX: 'auto', flexWrap: 'nowrap' }}>
        {TABS.map((item) => (
          <Chip key={item.id} active={tab === item.id} onClick={() => setTab(item.id)}>
            {item.label}
          </Chip>
        ))}
      </div>

      <Card title="Brand palette" hint={palette.vibe}>
        <div className="row tight" style={{ overflowX: 'auto', flexWrap: 'nowrap' }}>
          {PALETTES.map((item) => (
            <button
              key={item.id}
              type="button"
              className="chip"
              aria-pressed={project.paletteId === item.id}
              onClick={() => update({ paletteId: item.id, palette: item })}
              title={item.vibe}
            >
              <span style={{ display: 'inline-flex', gap: 2 }}>
                <i style={{ width: 10, height: 10, borderRadius: 3, background: item.primary }} />
                <i style={{ width: 10, height: 10, borderRadius: 3, background: item.accent }} />
                <i style={{ width: 10, height: 10, borderRadius: 3, background: item.secondary }} />
              </span>
              {item.name}
            </button>
          ))}
        </div>
        <div className="swatches" style={{ marginTop: 12 }}>
          {[
            ['primary', palette.primary],
            ['secondary', palette.secondary],
            ['accent', palette.accent],
            ['surface', palette.surface],
            ['ink', palette.ink],
          ].map(([label, hex]) => (
            <div className="swatch" key={label}>
              <i style={{ background: hex }} />
              <code>{hex}</code>
            </div>
          ))}
        </div>
      </Card>

      {tab === 'logos' ? (
        <>
          <Card title="Logo styles" hint="Tap a style to make it the project default">
            <div className="logo-grid">
              {LOGO_STYLES.map((style) => {
                const svg = renderLogo({ text: name, subtext: tagline, style: style.id, palette, width: 340, height: 340 });
                return (
                  <button
                    key={style.id}
                    type="button"
                    className="logo-tile"
                    data-selected={project.logoStyle === style.id}
                    title={style.blurb}
                    onClick={() => update({ logoStyle: style.id as LogoSvgStyle })}
                  >
                    <span dangerouslySetInnerHTML={{ __html: svg }} />
                    <span className="tag">{style.label}</span>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card title="Selected logo" hint={LOGO_STYLES.find((s) => s.id === project.logoStyle)?.blurb}>
            {(() => {
              const svg = renderLogo({ text: name, subtext: tagline, style: project.logoStyle, palette, width: 1024, height: 1024 });
              return (
                <div className="stack">
                  <div className="preview" dangerouslySetInnerHTML={{ __html: svg }} />
                  <div className="row">
                    <Btn onClick={() => saveSvg(svg, `${project.id}-logo-${project.logoStyle}.svg`)}>
                      <IconDownload width={15} height={15} /> SVG master
                    </Btn>
                    <Btn
                      variant="primary"
                      disabled={busy !== null}
                      onClick={() => savePng(svg, 1024, 1024, `${project.id}-logo-${project.logoStyle}.png`)}
                    >
                      <IconDownload width={15} height={15} /> PNG 1024
                    </Btn>
                  </div>
                  <Notice>
                    Logos are drawn with real vector paths and text, so they stay sharp at any size and can be edited in
                    Figma, Illustrator or Inkscape after export.
                  </Notice>
                </div>
              );
            })()}
          </Card>
        </>
      ) : null}

      {tab === 'avatars' ? (
        <>
          <Card title="Profile picture styles" hint="Square and circle-safe">
            <div className="row tight">
              {AVATAR_STYLES.map((style) => (
                <Chip key={style.id} active={avatarStyle === style.id} onClick={() => setAvatarStyle(style.id)}>
                  {style.label}
                </Chip>
              ))}
            </div>
            <div className="avatar-grid" style={{ marginTop: 12 }}>
              {AVATAR_STYLES.map((style) => (
                <div className="avatar-tile" key={style.id}>
                  <div className="round" dangerouslySetInnerHTML={{ __html: renderAvatar({ name, palette, size: 256, style: style.id }) }} />
                  <span>{style.label}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Platform-ready sizes" hint="Correct pixel size for each network">
            <div className="stack">
              {PLATFORMS.map((platform) => {
                const size = platform.avatarSize;
                const svg = renderAvatar({ name, palette, size, style: avatarStyle });
                return (
                  <div className="row between" key={platform.id} style={{ gap: 10 }}>
                    <div className="row" style={{ gap: 10 }}>
                      <span
                        style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', flex: 'none' }}
                        dangerouslySetInnerHTML={{ __html: svg }}
                      />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{platform.label}</div>
                        <div className="faint">{size} × {size} px</div>
                      </div>
                    </div>
                    <div className="row tight">
                      <Btn small variant="ghost" onClick={() => saveSvg(svg, `${project.id}-${platform.id}-avatar.svg`)}>SVG</Btn>
                      <Btn small disabled={busy !== null} onClick={() => savePng(svg, size, size, `${project.id}-${platform.id}-${size}.png`)}>
                        PNG
                      </Btn>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      ) : null}

      {tab === 'banners' ? (
        <>
          <Card title="Banner options">
            <div className="row">
              <Chip active={safeArea} onClick={() => setSafeArea((value) => !value)}>
                {safeArea ? 'Showing safe-area guide' : 'Show safe-area guide'}
              </Chip>
              <span className="faint">Guides are for preview only and are never included in downloaded files.</span>
            </div>
          </Card>

          {BANNERS.map((spec) => {
            const svg = renderBanner({
              spec,
              name,
              tagline,
              handle: project.handles.find((h) => h.status === 'available')?.handle ?? '',
              palette,
              logoStyle: project.logoStyle,
              showSafeArea: safeArea,
            });
            return (
              <Card key={spec.id} title={spec.label} hint={`${spec.width} × ${spec.height} px · ${spec.note}`}>
                <div className="stack">
                  <div className="preview" dangerouslySetInnerHTML={{ __html: svg }} />
                  <div className="row">
                    <Btn small onClick={() => saveSvg(svg, `${project.id}-${spec.id}.svg`)}>SVG master</Btn>
                    <Btn
                      small
                      variant="primary"
                      disabled={busy !== null}
                      onClick={() => savePng(svg, spec.width, spec.height, `${project.id}-${spec.id}.png`)}
                    >
                      PNG {spec.width}px
                    </Btn>
                  </div>
                </div>
              </Card>
            );
          })}
        </>
      ) : null}
    </div>
  );
}
