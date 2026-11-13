import { useCallback, useEffect, useState } from 'react';
import type { AiSettings, BrandProject } from '../shared/types';
import {
  deleteProject,
  loadActiveId,
  loadProjects,
  loadSettings,
  newProject,
  saveActiveId,
  saveProjects,
  saveSettings as persistSettings,
  upsertProject,
} from './lib/storage';
import { ToastProvider, useToast } from './components/ui';
import {
  IconAt,
  IconDownload,
  IconFolder,
  IconForge,
  IconHome,
  IconPalette,
  IconPlus,
  IconSearch,
  IconSettings,
  IconSpark,
  IconType,
} from './components/Icons';
import type { SectionId } from './lib/nav';
import Home from './sections/Home';
import Research from './sections/Research';
import Names from './sections/Names';
import Handles from './sections/Handles';
import Design from './sections/Design';
import Copy from './sections/Copy';
import Projects from './sections/Projects';
import Export from './sections/Export';
import Settings from './sections/Settings';

const NAV: { id: SectionId; label: string; Icon: typeof IconHome }[] = [
  { id: 'home', label: 'Studio', Icon: IconHome },
  { id: 'research', label: 'Research', Icon: IconSearch },
  { id: 'names', label: 'Names', Icon: IconSpark },
  { id: 'handles', label: 'Handles', Icon: IconAt },
  { id: 'design', label: 'Design', Icon: IconPalette },
  { id: 'copy', label: 'Copy', Icon: IconType },
  { id: 'projects', label: 'Projects', Icon: IconFolder },
  { id: 'export', label: 'Export', Icon: IconDownload },
  { id: 'settings', label: 'Settings', Icon: IconSettings },
];

function Studio() {
  const toast = useToast();
  const [projects, setProjects] = useState<BrandProject[]>(() => {
    const stored = loadProjects();
    if (stored.length) return stored;
    const seed = newProject();
    saveProjects([seed]);
    saveActiveId(seed.id);
    return [seed];
  });
  const [activeId, setActiveId] = useState<string>(() => {
    const stored = loadProjects();
    const saved = loadActiveId();
    return saved && stored.some((project) => project.id === saved) ? saved : stored[0]?.id ?? '';
  });
  const [settings, setSettings] = useState<AiSettings>(() => loadSettings());
  const [section, setSection] = useState<SectionId>('home');

  const active = projects.find((project) => project.id === activeId) ?? projects[0];

  useEffect(() => {
    saveProjects(projects);
  }, [projects]);

  useEffect(() => {
    if (active) saveActiveId(active.id);
  }, [active]);

  const update = useCallback(
    (patch: Partial<BrandProject>) => {
      setProjects((prev) =>
        prev.map((project) =>
          project.id === active.id ? { ...project, ...patch, updatedAt: new Date().toISOString() } : project,
        ),
      );
    },
    [active.id],
  );

  const go = (id: SectionId) => {
    setSection(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNew = () => {
    const created = newProject();
    setProjects((prev) => [created, ...prev]);
    setActiveId(created.id);
    setSection('home');
    toast('New brand project created');
  };

  const handleDuplicate = (id: string) => {
    const source = projects.find((project) => project.id === id);
    if (!source) return;
    const clone: BrandProject = {
      ...source,
      id: `bp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      chosenName: source.chosenName ? `${source.chosenName} copy` : '',
      workingTitle: source.chosenName ? `${source.chosenName} copy` : source.workingTitle,
    };
    setProjects((prev) => [clone, ...prev]);
    toast('Project duplicated');
  };

  const handleDelete = (id: string) => {
    const next = deleteProject(id);
    setProjects(next);
    if (id === active.id) setActiveId(next[0]?.id ?? '');
    toast('Project deleted');
  };

  const handleRename = (id: string, name: string) => {
    setProjects((prev) =>
      prev.map((project) =>
        project.id === id
          ? {
              ...project,
              chosenName: name,
              workingTitle: name,
              updatedAt: new Date().toISOString(),
            }
          : project,
      ),
    );
  };

  const handleImport = (imported: BrandProject[]) => {
    setProjects((prev) => {
      const existing = new Set(prev.map((project) => project.id));
      const additions = imported.map((project) =>
        existing.has(project.id)
          ? { ...project, id: `bp_${Math.random().toString(36).slice(2, 10)}` }
          : project,
      );
      return [...additions, ...prev];
    });
  };

  const handleSaveSettings = (next: AiSettings) => {
    persistSettings(next);
    setSettings(next);
  };

  const handleClearData = () => {
    localStorage.removeItem('brandforge.projects.v1');
    localStorage.removeItem('brandforge.settings.v1');
    localStorage.removeItem('brandforge.active.v1');
    const fresh = newProject();
    saveProjects([fresh]);
    saveActiveId(fresh.id);
    setProjects([fresh]);
    setActiveId(fresh.id);
    setSettings(loadSettings());
    setSection('home');
    toast('Local data cleared');
  };

  if (!active) return null;

  const shared = { project: active, update, go };
  const displayName = active.chosenName || active.workingTitle || 'Untitled brand';

  return (
    <div className="app">
      <header className="topbar">
        <button type="button" className="brandmark" onClick={() => go('home')} title="BRANDFORGE AI">
          <span className="mark">
            <IconForge width={20} height={20} />
          </span>
          <span className="brand-text">
            BRANDFORGE<span>AI</span>
          </span>
        </button>
        <button type="button" className="project-pill" onClick={() => go('projects')} title="Switch project">
          <span className="pill-dot" />
          <span className="pill-name">{displayName}</span>
        </button>
        <button type="button" className="icon-btn" onClick={handleNew} title="New project" aria-label="New project">
          <IconPlus width={17} height={17} />
        </button>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <nav className="nav">
            {NAV.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                className="nav-item"
                data-active={section === id}
                onClick={() => go(id)}
              >
                <Icon width={17} height={17} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
          <div className="sidebar-note">
            <strong>Research. Name. Design. Launch.</strong>
            <span>Runs offline. No subscription.</span>
          </div>
        </aside>

        <main className="main">
          {section === 'home' ? <Home {...shared} /> : null}
          {section === 'research' ? <Research {...shared} /> : null}
          {section === 'names' ? <Names {...shared} /> : null}
          {section === 'handles' ? <Handles {...shared} /> : null}
          {section === 'design' ? <Design {...shared} /> : null}
          {section === 'copy' ? <Copy {...shared} /> : null}
          {section === 'export' ? <Export {...shared} /> : null}
          {section === 'projects' ? (
            <Projects
              projects={projects}
              activeId={active.id}
              onOpen={(id) => {
                setActiveId(id);
                go('home');
              }}
              onNew={handleNew}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
              onRename={handleRename}
              onImport={handleImport}
            />
          ) : null}
          {section === 'settings' ? (
            <Settings settings={settings} onSave={handleSaveSettings} onClearData={handleClearData} />
          ) : null}
        </main>
      </div>

      <nav className="bottomnav" aria-label="Sections">
        {NAV.filter((item) => ['home', 'research', 'names', 'handles', 'design', 'export'].includes(item.id)).map(
          ({ id, label, Icon }) => (
            <button key={id} type="button" className="nav-item" data-active={section === id} onClick={() => go(id)}>
              <Icon width={19} height={19} />
              <span>{label}</span>
            </button>
          ),
        )}
        <button type="button" className="nav-item" data-active={section === 'projects' || section === 'settings'} onClick={() => go('projects')}>
          <IconFolder width={19} height={19} />
          <span>More</span>
        </button>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <Studio />
    </ToastProvider>
  );
}
