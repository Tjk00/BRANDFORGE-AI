import { useCallback, useEffect, useRef, useState } from 'react';
import type { AiSettings, BrandProject } from '../shared/types';
import {
  loadActiveId,
  loadProjects,
  loadSettings,
  newProject,
  saveActiveId,
  saveProjects,
  saveSettings as persistSettings,
} from './lib/storage';
import { account, ApiError, type PlanInfo, type SessionState } from './lib/cloud';
import { STAGES, nextStage, projectProgress, stageStateFor, stageStates, type SectionId } from './lib/nav';
import { Btn, Notice, ToastProvider, useToast } from './components/ui';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import Admin from './components/Admin';
import ErrorBoundary from './components/ErrorBoundary';
import Research from './sections/Research';
import Names from './sections/Names';
import Handles from './sections/Handles';
import Design from './sections/Design';
import Voice from './sections/Voice';
import Copy from './sections/Copy';
import Projects from './sections/Projects';
import Export from './sections/Export';
import Settings from './sections/Settings';
import {
  IconAt,
  IconCheck,
  IconFolder,
  IconForge,
  IconHome,
  IconPackage,
  IconPalette,
  IconPlus,
  IconSearch,
  IconSettings,
  IconSpark,
  IconType,
} from './components/Icons';

const EMPTY_SESSION: SessionState = { user: null, plans: [], projectLimit: 0, available: true };

const STAGE_IDS = STAGES.map((stage) => stage.id);

function stageIcon(id: SectionId) {
  switch (id) {
    case 'research':
      return <IconSearch width={16} height={16} />;
    case 'names':
      return <IconSpark width={16} height={16} />;
    case 'handles':
      return <IconAt width={16} height={16} />;
    case 'design':
      return <IconPalette width={16} height={16} />;
    case 'voice':
      return <IconType width={16} height={16} />;
    default:
      return <IconPackage width={16} height={16} />;
  }
}

function Studio() {
  const toast = useToast();
  const [booted, setBooted] = useState(false);
  const [session, setSession] = useState<SessionState>(EMPTY_SESSION);
  const [projects, setProjects] = useState<BrandProject[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [settings, setSettings] = useState<AiSettings>(() => loadSettings());
  const [view, setView] = useState<SectionId>('home');
  const [showAuth, setShowAuth] = useState(false);
  const [localSnapshot, setLocalSnapshot] = useState<BrandProject[]>([]);
  const saveTimer = useRef<number | null>(null);
  const signedIn = Boolean(session.user);

  const plan: PlanInfo | null = session.plans.find((item) => item.id === session.user?.plan) ?? null;
  const active = projects.find((project) => project.id === activeId) ?? null;

  /** Replace the working set, persisting to the account when signed in. */
  const commit = useCallback(
    (next: BrandProject[], targetId: string | null) => {
      setProjects(next);
      if (!signedIn) {
        saveProjects(next);
        return;
      }
      const changed = targetId ? next.find((project) => project.id === targetId) : undefined;
      if (!changed) return;
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        account.saveProject(changed).catch((error: unknown) => {
          toast(error instanceof ApiError ? error.message : 'Could not save that brand to your account', 'bad');
        });
      }, 800);
    },
    [signedIn, toast],
  );

  /** Load the account's brands, copying browser-only brands once if the account is empty. */
  const adoptAccount = useCallback(
    async (current: SessionState) => {
      const list = await account.projects();
      const local = loadProjects();
      if (list.projects.length === 0 && local.length > 0) {
        const result = await account.importProjects(local);
        const refreshed = await account.projects();
        setProjects(refreshed.projects);
        setActiveId(refreshed.projects[0]?.id ?? null);
        setSession({ ...current, projectLimit: refreshed.limit });
        if (result.saved > 0) {
          toast(`${result.saved} browser brand${result.saved === 1 ? '' : 's'} copied into your account`);
        }
        return;
      }
      setProjects(list.projects);
      setActiveId(list.projects[0]?.id ?? null);
      setSession({ ...current, projectLimit: list.limit });
    },
    [toast],
  );

  useEffect(() => {
    const local = loadProjects();
    setLocalSnapshot(local);
    setProjects(local);
    const saved = loadActiveId();
    setActiveId(saved && local.some((project) => project.id === saved) ? saved : local[0]?.id ?? null);

    let cancelled = false;
    void (async () => {
      try {
        const next = await account.session();
        if (cancelled) return;
        setSession(next);
        if (next.user) {
          await adoptAccount(next);
        } else if (next.available) {
          setShowAuth(true);
        }
      } catch {
        if (!cancelled) setSession({ ...EMPTY_SESSION, available: false });
      } finally {
        if (!cancelled) setBooted(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [adoptAccount]);

  const update = useCallback(
    (patch: Partial<BrandProject>) => {
      if (!activeId) return;
      const stamp = new Date().toISOString();
      const next = projects.map((project) =>
        project.id === activeId ? { ...project, ...patch, updatedAt: stamp } : project,
      );
      commit(next, activeId);
    },
    [activeId, projects, commit],
  );

  const openBrand = useCallback((id: string) => {
    setActiveId(id);
    saveActiveId(id);
    setView('research');
  }, []);

  const createBrand = useCallback(async () => {
    if (signedIn && session.projectLimit > 0 && projects.length >= session.projectLimit) {
      toast(
        `Your ${plan ? plan.name : 'current'} plan includes ${session.projectLimit} brands. Delete one or upgrade to add more.`,
        'bad',
      );
      setView('settings');
      return;
    }
    const project = newProject();
    if (signedIn) {
      try {
        await account.saveProject(project);
      } catch (error) {
        toast(error instanceof ApiError ? error.message : 'Could not create that brand', 'bad');
        return;
      }
    }
    const next = [project, ...projects];
    setProjects(next);
    setActiveId(project.id);
    saveActiveId(project.id);
    if (!signedIn) saveProjects(next);
    setView('research');
    toast('New brand created — start with your niche');
  }, [signedIn, session.projectLimit, projects, plan, toast]);

  const removeBrand = useCallback(
    async (id: string) => {
      const target = projects.find((project) => project.id === id);
      if (!window.confirm(`Delete “${target?.workingTitle ?? 'this brand'}”? This cannot be undone.`)) return;
      const next = projects.filter((project) => project.id !== id);
      const nextActive = activeId === id ? next[0]?.id ?? null : activeId;
      setProjects(next);
      setActiveId(nextActive);
      saveActiveId(nextActive);
      if (signedIn) {
        try {
          await account.deleteProject(id);
        } catch (error) {
          toast(error instanceof ApiError ? error.message : 'Could not delete that brand', 'bad');
          return;
        }
      } else {
        saveProjects(next);
      }
      toast('Brand deleted');
    },
    [projects, activeId, signedIn, toast],
  );

  const importLocal = useCallback(async () => {
    if (!signedIn || localSnapshot.length === 0) return;
    try {
      const result = await account.importProjects(localSnapshot);
      const refreshed = await account.projects();
      setProjects(refreshed.projects);
      setActiveId(refreshed.projects[0]?.id ?? null);
      toast(`${result.saved} brand${result.saved === 1 ? '' : 's'} imported${result.skipped ? `, ${result.skipped} already existed` : ''}`);
    } catch (error) {
      toast(error instanceof ApiError ? error.message : 'Could not import browser brands', 'bad');
    }
  }, [signedIn, localSnapshot, toast]);

  const signOut = useCallback(async () => {
    try {
      await account.logout();
    } catch {
      /* the cookie is cleared locally regardless */
    }
    const local = loadProjects();
    setLocalSnapshot(local);
    setProjects(local);
    setActiveId(local[0]?.id ?? null);
    setSession({ user: null, plans: session.plans, projectLimit: 0, available: session.available });
    setView('home');
    // Return to the sign-in screen after an explicit sign-out so the next person on
    // this device is not shown the browser's local brands. Local mode stays one tap
    // away through "Continue without an account".
    setShowAuth(session.available);
    toast(session.available ? 'Signed out' : 'Signed out — browser brands restored');
  }, [session.plans, session.available, toast]);

  const afterSignIn = useCallback(
    async (next: SessionState) => {
      setSession(next);
      setShowAuth(false);
      try {
        await adoptAccount(next);
        toast(`Welcome, ${next.user?.name ?? 'brand builder'}`);
      } catch (error) {
        toast(error instanceof ApiError ? error.message : 'Signed in, but your brands could not be loaded', 'bad');
      }
    },
    [adoptAccount, toast],
  );

  const saveAiSettings = useCallback(
    (next: AiSettings) => {
      setSettings(next);
      persistSettings(next);
      toast('Provider settings saved on this device');
    },
    [toast],
  );

  const clearLocalData = useCallback(() => {
    if (!window.confirm('Delete brands stored in this browser? Account brands are not affected.')) return;
    saveProjects([]);
    setLocalSnapshot([]);
    if (!signedIn) {
      setProjects([]);
      setActiveId(null);
      saveActiveId(null);
    }
    toast('Browser data cleared');
  }, [signedIn, toast]);

  const stageIndex = STAGE_IDS.indexOf(view);
  const isStage = stageIndex >= 0;

  const next = active ? nextStage(active) : STAGES[0];

  const renderSection = () => {
    if (!active) {
      return (
        <div className="bf-panel">
          <h2 className="bf-panel-title">No brand selected</h2>
          <p className="bf-panel-hint">Create a brand to open the workspace.</p>
          <div className="bf-inline">
            <Btn variant="primary" onClick={() => void createBrand()}>
              <IconPlus width={15} height={15} /> Create brand
            </Btn>
            <Btn onClick={() => setView('home')}>Back to dashboard</Btn>
          </div>
        </div>
      );
    }

    const props = { project: active, update, go: setView };

    switch (view) {
      case 'research':
        return <Research {...props} />;
      case 'names':
        return <Names {...props} />;
      case 'handles':
        return <Handles {...props} />;
      case 'design':
        return <Design {...props} />;
      case 'voice':
        return <Voice {...props} />;
      case 'copy':
        return <Copy {...props} />;
      case 'export':
        return <Export {...props} />;
      case 'projects':
        return (
          <Projects
            projects={projects}
            activeId={activeId}
            onOpen={openBrand}
            onNew={() => void createBrand()}
            onDuplicate={(id) => {
              const source = projects.find((project) => project.id === id);
              if (!source) return;
              const copy: BrandProject = {
                ...source,
                id: `bp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
                workingTitle: `${source.workingTitle} copy`,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              const nextProjects = [copy, ...projects];
              setProjects(nextProjects);
              setActiveId(copy.id);
              saveActiveId(copy.id);
              if (signedIn) {
                account.saveProject(copy).catch(() => toast('Could not save the duplicate', 'bad'));
              } else {
                saveProjects(nextProjects);
              }
              toast('Brand duplicated');
            }}
            onDelete={(id) => void removeBrand(id)}
            onRename={(id, name) => {
              const nextProjects = projects.map((project) =>
                project.id === id ? { ...project, name, updatedAt: new Date().toISOString() } : project,
              );
              commit(nextProjects, id);
            }}
            onImport={(imported) => {
              const nextProjects = [...imported, ...projects];
              setProjects(nextProjects);
              if (signedIn) {
                for (const project of imported) {
                  account.saveProject(project).catch(() => toast('Could not save an imported brand', 'bad'));
                }
              } else {
                saveProjects(nextProjects);
              }
              toast(`${imported.length} brand${imported.length === 1 ? '' : 's'} imported`);
            }}
          />
        );
      case 'settings':
        return (
          <>
            <section className="bf-panel">
              <header className="bf-panel-head">
                <div>
                  <h2 className="bf-panel-title">Account</h2>
                  <p className="bf-panel-hint">
                    {session.user
                      ? 'Your brands sync to this account and are isolated from every other customer.'
                      : session.available
                        ? 'You are working in local mode. Sign in to sync brands across devices.'
                        : 'This host has no account store, so brands stay in this browser.'}
                  </p>
                </div>
                <span className="bf-pill bf-pill-gold">{session.user ? (plan?.name ?? session.user.plan) : 'Local mode'}</span>
              </header>

              {session.user ? (
                <>
                  <div className="bf-plan-row">
                    <div>
                      <span className="bf-metric-label">Signed in as</span>
                      <div className="bf-table-name">{session.user.email}</div>
                    </div>
                    <div>
                      <span className="bf-metric-label">Brands</span>
                      <div className="bf-table-name">
                        {projects.length}
                        {session.projectLimit > 0 ? ` / ${session.projectLimit}` : ''}
                      </div>
                    </div>
                    <Btn variant="ghost" onClick={() => void signOut()}>
                      Sign out
                    </Btn>
                  </div>
                  {session.user.role === 'admin' ? (
                    <div className="bf-inline">
                      <Btn onClick={() => setView('admin')}>Open administration</Btn>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="bf-inline">
                  {session.available ? (
                    <Btn variant="primary" onClick={() => setShowAuth(true)}>
                      Sign in or create an account
                    </Btn>
                  ) : null}
                  {localSnapshot.length > 0 ? (
                    <span className="bf-panel-hint">{localSnapshot.length} brand(s) stored in this browser</span>
                  ) : null}
                </div>
              )}

              <div className="bf-plan">
                <span className="bf-metric-label">Plans</span>
                <p className="bf-panel-hint">
                  Billing is not activated. No payment provider is contacted and no card is ever required — plan limits
                  simply describe what each tier includes.
                </p>
                {session.plans.map((item) => (
                  <div className="bf-plan-row" key={item.id}>
                    <div>
                      <span className="bf-table-name">
                        {item.name} · {item.price}
                      </span>
                      <span className="bf-table-meta">
                        {item.projectLimit} brands · {item.features.slice(0, 3).join(' · ')}
                      </span>
                    </div>
                    <span className={`bf-pill${session.user?.plan === item.id ? ' bf-pill-gold' : ''}`}>
                      {session.user?.plan === item.id ? 'Current' : item.cadence}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <Settings settings={settings} onSave={saveAiSettings} onClearData={clearLocalData} />
          </>
        );
      case 'admin':
        return session.user?.role === 'admin' ? (
          <Admin currentUserId={session.user.id} />
        ) : (
          <Notice tone="bad">Administrator access is required for this page.</Notice>
        );
      default:
        return null;
    }
  };

  if (!booted) {
    return (
      <div className="bf-app">
        <div className="bf-main">
          <div className="bf-panel">
            <span className="bf-eyebrow">BRANDFORGE AI</span>
            <h1 className="bf-hero-title">Build. Brand. Grow.</h1>
            <p className="bf-panel-hint">Loading your studio…</p>
            <div className="loading-bar" aria-hidden="true" />
          </div>
        </div>
      </div>
    );
  }

  if (showAuth && !session.user && session.available) {
    return (
      <Auth
        onSignedIn={(nextSession) => void afterSignIn(nextSession)}
        onSkip={() => setShowAuth(false)}
        notice={localSnapshot.length > 0 ? 'Your browser brands can be copied into a new account.' : undefined}
      />
    );
  }

  return (
    <div className="bf-app">
      <header className="bf-topbar">
        <button type="button" className="bf-brand" onClick={() => setView('home')}>
          <span className="bf-brand-mark">
            <IconForge width={18} height={18} />
          </span>
          <span className="bf-brand-text">
            <span className="bf-brand-name">BRANDFORGE</span>
            <span className="bf-brand-tag">Build. Brand. Grow.</span>
          </span>
        </button>

        <div className="bf-top-actions">
          <span className="bf-pill">{signedIn ? (plan?.name ?? session.user?.plan) : 'Local'}</span>
          <Btn small variant="primary" onClick={() => void createBrand()}>
            <IconPlus width={14} height={14} /> New brand
          </Btn>
          {signedIn ? (
            <button type="button" className="bf-userchip" onClick={() => setView('settings')} title={session.user?.email}>
              {(session.user?.name ?? '?').slice(0, 1).toUpperCase()}
            </button>
          ) : session.available ? (
            <Btn small onClick={() => setShowAuth(true)}>
              Sign in
            </Btn>
          ) : null}
        </div>
      </header>

      <div className="bf-layout">
        <aside className="bf-side">
          <button
            type="button"
            className={`bf-side-link${view === 'home' ? ' is-active' : ''}`}
            onClick={() => setView('home')}
          >
            <IconHome width={16} height={16} /> Dashboard
          </button>

          <span className="bf-eyebrow">Workflow</span>
          {STAGES.map((stage) => {
            const state = active ? stageStateFor(active, stage.id) : null;
            return (
              <button
                key={stage.id}
                type="button"
                className={`bf-side-link${view === stage.id ? ' is-active' : ''}`}
                onClick={() => setView(stage.id)}
              >
                {stageIcon(stage.id)}
                <span>{stage.title}</span>
                {state?.done ? <IconCheck width={13} height={13} /> : null}
              </button>
            );
          })}

          <span className="bf-eyebrow">Library</span>
          <button
            type="button"
            className={`bf-side-link${view === 'projects' ? ' is-active' : ''}`}
            onClick={() => setView('projects')}
          >
            <IconFolder width={16} height={16} /> Brands
          </button>
          <button
            type="button"
            className={`bf-side-link${view === 'copy' ? ' is-active' : ''}`}
            onClick={() => setView('copy')}
          >
            <IconType width={16} height={16} /> Copy lab
          </button>
          <button
            type="button"
            className={`bf-side-link${view === 'export' ? ' is-active' : ''}`}
            onClick={() => setView('export')}
          >
            <IconPackage width={16} height={16} /> Brand kit
          </button>
          <button
            type="button"
            className={`bf-side-link${view === 'settings' ? ' is-active' : ''}`}
            onClick={() => setView('settings')}
          >
            <IconSettings width={16} height={16} /> Settings
          </button>
          {session.user?.role === 'admin' ? (
            <button
              type="button"
              className={`bf-side-link${view === 'admin' ? ' is-active' : ''}`}
              onClick={() => setView('admin')}
            >
              <IconSpark width={16} height={16} /> Administration
            </button>
          ) : null}
        </aside>

        <main className="bf-main">
          {!session.available ? (
            <Notice tone="warn">
              Accounts are not enabled on this host, so brands are stored in this browser only. Add a Cloudflare D1
              database or run the Node server to enable sign-in.
            </Notice>
          ) : null}

          {view === 'home' ? (
            <Dashboard
              user={session.user}
              projects={projects}
              active={active}
              plan={plan}
              limit={session.projectLimit}
              accountsAvailable={session.available}
              hasLocalProjects={signedIn && localSnapshot.length > 0}
              onOpen={openBrand}
              onCreate={() => void createBrand()}
              onDelete={(id) => void removeBrand(id)}
              onNavigate={setView}
              onSignOut={() => void signOut()}
              onImportLocal={() => void importLocal()}
              onOpenAccount={() => setView('settings')}
            />
          ) : (
            <>
              {isStage && active ? (
                <>
                  <div className="bf-stage-rail">
                    {STAGES.map((stage) => {
                      const state = stageStateFor(active, stage.id);
                      return (
                        <button
                          key={stage.id}
                          type="button"
                          className={`bf-stage${view === stage.id ? ' is-active' : ''}${state?.done ? ' is-done' : ''}`}
                          onClick={() => setView(stage.id)}
                        >
                          <span className="bf-stage-index">{state?.done ? <IconCheck width={12} height={12} /> : stage.index}</span>
                          <span className="bf-stage-body">
                            <span className="bf-stage-title">{stage.short}</span>
                            <span className="bf-stage-detail">{state?.done ? 'Complete' : stage.blurb}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="bf-panel-head">
                    <div>
                      <span className="bf-eyebrow">
                        Stage {stageIndex + 1} of {STAGES.length} · {active.workingTitle || active.chosenName}
                      </span>
                      <h1 className="bf-panel-title">{STAGES[stageIndex].title}</h1>
                      <p className="bf-panel-hint">{STAGES[stageIndex].blurb}</p>
                    </div>
                    <div className="bf-usage">
                      <span className="bf-metric-label">{projectProgress(active)}% complete</span>
                      <div className="bf-usage-fill" style={{ width: `${projectProgress(active)}%` }} />
                    </div>
                  </div>
                </>
              ) : null}

              <ErrorBoundary
                key={view}
                label={
                  isStage
                    ? STAGES[stageIndex].title
                    : `${view.slice(0, 1).toUpperCase()}${view.slice(1)} screen`
                }
                onReset={() => setView('home')}
              >
                {renderSection()}
              </ErrorBoundary>

              {isStage && active ? (
                <div className="bf-inline">
                  {stageIndex > 0 ? (
                    <Btn onClick={() => setView(STAGE_IDS[stageIndex - 1])}>Previous stage</Btn>
                  ) : null}
                  <Btn variant="primary" onClick={() => setView(next.id)}>
                    Continue to {next.title}
                  </Btn>
                </div>
              ) : null}
            </>
          )}
        </main>
      </div>

      <nav className="bf-bottomnav" aria-label="Primary">
        {[
          { id: 'home' as SectionId, label: 'Home', icon: <IconHome width={18} height={18} /> },
          { id: 'research' as SectionId, label: 'Research', icon: <IconSearch width={18} height={18} /> },
          { id: 'names' as SectionId, label: 'Names', icon: <IconSpark width={18} height={18} /> },
          { id: 'design' as SectionId, label: 'Design', icon: <IconPalette width={18} height={18} /> },
          { id: 'export' as SectionId, label: 'Kit', icon: <IconPackage width={18} height={18} /> },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            className={`bf-bottom-link${view === item.id ? ' is-active' : ''}`}
            onClick={() => setView(item.id)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <ErrorBoundary label="BrandForge AI" onReset={() => window.location.reload()}>
        <Studio />
      </ErrorBoundary>
    </ToastProvider>
  );
}
