import type { BrandProject } from '../../shared/types';
import { STAGES, nextStage, projectProgress, stageStates, type SectionId } from '../lib/nav';
import { planLabel, usageLabel, type AccountUser, type PlanInfo } from '../lib/cloud';
import { Btn, ProgressBar } from './ui';
import {
  IconArrowRight,
  IconAt,
  IconCheck,
  IconDownload,
  IconFolder,
  IconPalette,
  IconPlus,
  IconSpark,
  IconTrash,
  IconType,
} from './Icons';

interface DashboardProps {
  user: AccountUser | null;
  projects: BrandProject[];
  active: BrandProject | null;
  plan: PlanInfo | null;
  limit: number;
  accountsAvailable: boolean;
  hasLocalProjects: boolean;
  onOpen: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onNavigate: (id: SectionId) => void;
  onSignOut: () => void;
  onImportLocal: () => void;
  onOpenAccount: () => void;
}

const QUICK_TOOLS: { id: SectionId; label: string; hint: string; Icon: typeof IconSpark }[] = [
  { id: 'research', label: 'Research', hint: 'Niches, audiences, gaps', Icon: IconSpark },
  { id: 'names', label: 'Names', hint: '50–100 scored names', Icon: IconFolder },
  { id: 'handles', label: 'Handles', hint: 'Ten platforms checked', Icon: IconAt },
  { id: 'design', label: 'Design', hint: 'Logos, avatars, banners', Icon: IconPalette },
  { id: 'voice', label: 'Voice', hint: 'Story, bios, SEO', Icon: IconType },
  { id: 'export', label: 'Brand kit', hint: 'One complete ZIP', Icon: IconDownload },
];

export default function Dashboard({
  user,
  projects,
  active,
  plan,
  limit,
  accountsAvailable,
  hasLocalProjects,
  onOpen,
  onCreate,
  onDelete,
  onNavigate,
  onSignOut,
  onImportLocal,
  onOpenAccount,
}: DashboardProps) {
  const progress = active ? projectProgress(active) : 0;
  const states = active ? stageStates(active) : [];
  const next = active ? nextStage(active) : STAGES[0];
  const completed = states.filter((stage) => stage.done).length;

  return (
    <div className="bf-dash">
      <section className="bf-hero">
        <div className="bf-hero-glow" aria-hidden="true" />
        <span className="bf-eyebrow">BrandForge AI · Build. Brand. Grow.</span>
        <h1 className="bf-hero-title">
          {active ? `Welcome back to ${active.chosenName || active.workingTitle || 'your brand'}` : 'Forge a brand worth following'}
        </h1>
        <p className="bf-hero-sub">
          {active
            ? `${completed} of ${STAGES.length} stages complete. Next up: ${next.title.toLowerCase()}.`
            : 'Research, name, design and launch a complete brand identity — with no paid API required.'}
        </p>
        <div className="bf-hero-actions">
          <Btn variant="primary" onClick={onCreate}>
            <IconPlus width={16} height={16} /> Create new brand
          </Btn>
          {active ? (
            <Btn onClick={() => onNavigate(next.id)}>
              Continue: {next.short} <IconArrowRight width={15} height={15} />
            </Btn>
          ) : (
            <Btn onClick={() => onNavigate('research')}>
              Start with research <IconArrowRight width={15} height={15} />
            </Btn>
          )}
        </div>

        <div className="bf-metrics">
          <div className="bf-metric">
            <span className="bf-metric-value">{projects.length}</span>
            <span className="bf-metric-label">Saved brands</span>
          </div>
          <div className="bf-metric">
            <span className="bf-metric-value">{active ? `${progress}%` : '—'}</span>
            <span className="bf-metric-label">Active progress</span>
          </div>
          <div className="bf-metric">
            <span className="bf-metric-value">{planLabel(plan, user?.plan ?? 'free')}</span>
            <span className="bf-metric-label">Current plan</span>
          </div>
        </div>
      </section>

      {!accountsAvailable ? (
        <div className="bf-panel bf-panel-note">
          <div>
            <h2 className="bf-panel-title">Local-only mode</h2>
            <p className="bf-panel-hint">
              This deployment has no account database configured, so brands are stored in this browser only. Everything
              else — research, naming, handle checks, design and exports — works fully.
            </p>
          </div>
        </div>
      ) : null}

      {hasLocalProjects ? (
        <div className="bf-panel bf-panel-note">
          <div>
            <h2 className="bf-panel-title">Brands found in this browser</h2>
            <p className="bf-panel-hint">
              Copy your local brands into your account. Existing projects are never overwritten or deleted.
            </p>
          </div>
          <Btn onClick={onImportLocal}>Bring them into my account</Btn>
        </div>
      ) : null}

      <div className="bf-grid-2">
        <section className="bf-panel">
          <header className="bf-panel-head">
            <div>
              <h2 className="bf-panel-title">Project progress</h2>
              <p className="bf-panel-hint">
                {active ? active.chosenName || active.workingTitle || 'Untitled brand' : 'No active brand yet'}
              </p>
            </div>
            {active ? <span className="bf-pill">{progress}%</span> : null}
          </header>

          {active ? <ProgressBar percent={progress} /> : null}

          <ol className="bf-stage-list">
            {STAGES.map((stage) => {
              const state = states.find((item) => item.id === stage.id);
              return (
                <li key={stage.id}>
                  <button
                    type="button"
                    className={`bf-stage${state?.done ? ' is-done' : ''}`}
                    onClick={() => onNavigate(stage.id)}
                  >
                    <span className="bf-stage-index">{state?.done ? <IconCheck width={14} height={14} /> : stage.index}</span>
                    <span className="bf-stage-body">
                      <span className="bf-stage-title">{stage.title}</span>
                      <span className="bf-stage-detail">{state?.detail ?? stage.blurb}</span>
                    </span>
                    <IconArrowRight width={15} height={15} />
                  </button>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="bf-panel">
          <header className="bf-panel-head">
            <div>
              <h2 className="bf-panel-title">Quick tools</h2>
              <p className="bf-panel-hint">Jump straight into any workspace</p>
            </div>
          </header>
          <div className="bf-quick-grid">
            {QUICK_TOOLS.map(({ id, label, hint, Icon }) => (
              <button type="button" className="bf-quick" key={id} onClick={() => onNavigate(id)}>
                <span className="bf-quick-icon">
                  <Icon width={18} height={18} />
                </span>
                <span className="bf-quick-label">{label}</span>
                <span className="bf-quick-hint">{hint}</span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="bf-grid-2">
        <section className="bf-panel">
          <header className="bf-panel-head">
            <div>
              <h2 className="bf-panel-title">Recent projects</h2>
              <p className="bf-panel-hint">{usageLabel(projects.length, limit)}</p>
            </div>
            <Btn small onClick={onCreate}>
              <IconPlus width={14} height={14} /> New
            </Btn>
          </header>

          {projects.length === 0 ? (
            <p className="bf-empty">No brands yet. Create your first brand to unlock the six-stage workflow.</p>
          ) : (
            <ul className="bf-recent">
              {projects.slice(0, 5).map((project) => (
                <li className="bf-recent-row" key={project.id}>
                  <button type="button" className="bf-recent-main" onClick={() => onOpen(project.id)}>
                    <span className="bf-recent-name">{project.chosenName || project.workingTitle || 'Untitled brand'}</span>
                    <span className="bf-recent-meta">
                      {projectProgress(project)}% · updated {new Date(project.updatedAt).toLocaleDateString()}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="bf-icon-btn"
                    aria-label={`Delete ${project.chosenName || project.workingTitle || 'brand'}`}
                    onClick={() => onDelete(project.id)}
                  >
                    <IconTrash width={15} height={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bf-panel">
          <header className="bf-panel-head">
            <div>
              <h2 className="bf-panel-title">Account</h2>
              <p className="bf-panel-hint">
                {user ? user.email : accountsAvailable ? 'Not signed in' : 'Local-only deployment'}
              </p>
            </div>
          </header>

          {user ? (
            <>
              <div className="bf-plan">
                <div className="bf-plan-row">
                  <span className="bf-pill bf-pill-gold">{planLabel(plan, user.plan)}</span>
                  <span className="bf-panel-hint">
                    {limit > 0 ? `${limit} saved brands included` : 'Unlimited saved brands'}
                  </span>
                </div>
                <div className="bf-usage">
                  <div className="bf-usage-fill" style={{ width: `${limit > 0 ? Math.min(100, (projects.length / limit) * 100) : 0}%` }} />
                </div>
                <p className="bf-panel-hint">
                  {limit > 0 && projects.length >= limit
                    ? 'Plan limit reached — delete a brand or upgrade in Settings to save another.'
                    : 'Billing is not activated on this deployment, so no payment is ever requested.'}
                </p>
              </div>
              <div className="bf-hero-actions">
                <Btn small onClick={onOpenAccount}>
                  Account settings
                </Btn>
                <Btn small variant="ghost" onClick={onSignOut}>
                  Sign out
                </Btn>
              </div>
            </>
          ) : (
            <div className="bf-hero-actions">
              <Btn small variant="primary" onClick={onOpenAccount}>
                Sign in or create account
              </Btn>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
