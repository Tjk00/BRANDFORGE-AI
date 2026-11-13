import { useState } from 'react';
import { generateCopy } from '../../shared/copy';
import { getNiche } from '../../shared/niches';
import { BANNERS } from '../../shared/graphics';
import { LOGO_STYLES } from '../../shared/logo';
import { PLATFORMS } from '../../shared/platforms';
import { buildBrandKitZip, downloadBlob, resolvePalette } from '../lib/export';
import { IconDownload, IconPackage } from '../components/Icons';
import { Btn, Card, Notice, ProgressBar, SectionHead, useToast } from '../components/ui';
import type { SectionProps } from '../lib/nav';

export default function Export({ project, update, go }: SectionProps) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState('');
  const [percent, setPercent] = useState(0);

  const palette = resolvePalette(project);
  const name = project.chosenName || project.workingTitle || 'Your brand';

  const runExport = async () => {
    setBusy(true);
    setPercent(5);
    setStep('Preparing brand kit…');
    try {
      const blob = await buildBrandKitZip(project, (progress) => {
        setStep(progress.step);
        setPercent(progress.percent);
      });
      const filename = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'brand'}-brand-kit.zip`;
      downloadBlob(blob, filename);
      toast(`Brand kit downloaded (${filename})`);
      setPercent(100);
      setStep('Done');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Export failed.', 'bad');
      setStep('');
      setPercent(0);
    } finally {
      setBusy(false);
    }
  };

  const contents: { label: string; detail: string; ready: boolean }[] = [
    { label: 'Logos', detail: `${LOGO_STYLES.length} styles · SVG master + 1024px PNG`, ready: true },
    { label: 'Profile pictures', detail: `${PLATFORMS.length} platforms at native size`, ready: true },
    { label: 'Banners & covers', detail: `${BANNERS.length} graphics at native size`, ready: true },
    { label: 'Colour palette', detail: `${palette.name} · hex, RGB and CSS tokens`, ready: true },
    { label: 'Descriptions & bios', detail: 'YouTube, 10 platform bios, taglines, slogans', ready: Boolean(project.copy) },
    { label: 'Brand guidelines', detail: 'HTML + Markdown usage guide', ready: true },
    { label: 'Project data', detail: 'brand.json for backup and restore', ready: true },
  ];

  const missing = contents.filter((item) => !item.ready);

  return (
    <div className="section">
      <SectionHead
        title="Export brand kit"
        subtitle="One ZIP with every asset, description and guideline. Built entirely in your browser — nothing is uploaded anywhere."
      />

      <Card title={`${name} kit`} hint={`Palette ${palette.name} · logo ${project.logoStyle}`}>
        <div className="stack">
          {contents.map((item) => (
            <div className="row between" key={item.label}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{item.label}</div>
                <div className="faint">{item.detail}</div>
              </div>
              <span className={item.ready ? 'tick' : 'cross'}>{item.ready ? 'ready' : 'missing'}</span>
            </div>
          ))}

          {missing.length > 0 ? (
            <Notice tone="warn">
              Generate the remaining items first so the kit is complete. The ZIP will still export with everything else.
              <div className="row tight" style={{ marginTop: 8 }}>
                <Btn small variant="ghost" onClick={() => go('copy')}>Add copy</Btn>
                <Btn small variant="ghost" onClick={() => go('names')}>Choose a name</Btn>
              </div>
            </Notice>
          ) : null}

          {busy ? (
            <div className="stack">
              <ProgressBar percent={percent} />
              <div className="faint">{step}</div>
            </div>
          ) : null}

          <div className="row">
            <Btn variant="primary" onClick={runExport} disabled={busy}>
              <IconPackage width={16} height={16} /> {busy ? 'Building…' : 'Download ZIP'}
            </Btn>
            <Btn variant="ghost" onClick={() => go('design')}>
              <IconDownload width={15} height={15} /> Single assets
            </Btn>
          </div>
          {!project.chosenName ? (
            <div className="faint">Tip: set a brand name so every file inside the ZIP is named consistently.</div>
          ) : null}
        </div>
      </Card>

      <Notice>
        PNG files are rasterised from the SVG masters at the exact size each platform expects, so you can upload them
        directly. Keep the SVG masters if you want to resize or edit later.
      </Notice>

      {project.copy ? null : (
        <div className="faint">
          Copy is regenerated on export only if it already exists — BRANDFORGE never silently rewrites your approved
          wording.
        </div>
      )}
    </div>
  );
}
