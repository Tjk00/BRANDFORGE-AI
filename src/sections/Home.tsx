import { NICHES, getNiche } from '../../shared/niches';
import { renderAvatar } from '../../shared/graphics';
import { resolvePalette } from '../lib/export';
import { IconArrowRight, IconCheck } from '../components/Icons';
import { Badge, Btn, Card, Notice, SectionHead } from '../components/ui';
import type { SectionProps } from '../lib/nav';

interface Step {
  id: 'research' | 'names' | 'handles' | 'design' | 'copy' | 'export';
  title: string;
  detail: string;
  done: boolean;
}

export default function Home({ project, go }: SectionProps) {
  const palette = resolvePalette(project);
  const name = project.chosenName || project.workingTitle || 'Untitled brand';
  const niche = getNiche(project.nicheId);
  const availableHandles = project.handles.filter((h) => h.status === 'available').length;
  const verifiedHandles = project.handles.filter((h) => h.confidence === 'verified').length;

  const steps: Step[] = [
    { id: 'research', title: 'Research the niche', detail: 'Audience, competitors and content gaps', done: Boolean(project.nicheId) },
    { id: 'names', title: 'Generate names', detail: '50–100 options, filtered and scored', done: project.names.length > 0 },
    { id: 'handles', title: 'Check handles', detail: 'Ten platforms, verified vs unconfirmed', done: availableHandles > 0 },
    { id: 'design', title: 'Design the identity', detail: 'Logos, profile pictures, banners', done: Boolean(project.chosenName) },
    { id: 'copy', title: 'Write the voice', detail: 'Descriptions, bios, taglines', done: Boolean(project.copy) },
    { id: 'export', title: 'Export the kit', detail: 'One ZIP with every asset', done: false },
  ];
  const completed = steps.filter((step) => step.done).length;

  return (
    <div className="section">
      <div className="hero">
        <div className="hero-avatar" dangerouslySetInnerHTML={{ __html: renderAvatar({ name, palette, size: 160, style: 'monogram' }) }} />
        <div className="hero-body">
          <div className="eyebrow">Current project</div>
          <h1>{name}</h1>
          <p className="tagline">Research. Name. Design. Launch.</p>
          <div className="row tight">
            <Badge kind={niche ? 'available' : 'unconfirmed'}>{niche ? niche.label : 'No niche selected'}</Badge>
            <Badge kind="verified">{completed}/6 steps</Badge>
            {verifiedHandles > 0 ? <Badge kind="available">{verifiedHandles} verified handles</Badge> : null}
          </div>
        </div>
      </div>

      <div className="pipeline">
        {steps.map((step, index) => (
          <button key={step.id} type="button" className="pipeline-step" data-done={step.done} onClick={() => go(step.id)}>
            <span className="index">{step.done ? <IconCheck width={14} height={14} /> : index + 1}</span>
            <span className="body">
              <strong>{step.title}</strong>
              <em>{step.detail}</em>
            </span>
            <IconArrowRight width={15} height={15} />
          </button>
        ))}
      </div>

      <Card title="Start from a niche" hint="Curated briefs with live research links">
        <div className="row tight">
          {NICHES.slice(0, 8).map((item) => (
            <button key={item.id} type="button" className="chip" onClick={() => go('research')}>
              {item.label}
            </button>
          ))}
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <Btn variant="primary" onClick={() => go('research')}>
            Browse all {NICHES.length} niches
          </Btn>
          <Btn variant="ghost" onClick={() => go('projects')}>
            Switch project
          </Btn>
        </div>
      </Card>

      <Notice>
        Everything here runs without paid APIs: names, logos, graphics, copy and the ZIP export are generated on your
        device. Username checks use your own server or Cloudflare Worker, and are labelled verified only when the
        platform itself gave a definitive answer.
      </Notice>
    </div>
  );
}
