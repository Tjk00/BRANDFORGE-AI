import type { AiSettings, BrandProject, ProjectSummary } from '../../shared/types';

const PROJECT_KEY = 'brandforge.projects.v1';
const SETTINGS_KEY = 'brandforge.settings.v1';
const ACTIVE_KEY = 'brandforge.active.v1';

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadProjects(): BrandProject[] {
  const list = safeParse<BrandProject[]>(localStorage.getItem(PROJECT_KEY), []);
  return Array.isArray(list) ? list.filter((p) => p && typeof p.id === 'string') : [];
}

export function saveProjects(projects: BrandProject[]): void {
  localStorage.setItem(PROJECT_KEY, JSON.stringify(projects));
}

export function upsertProject(project: BrandProject): BrandProject[] {
  const projects = loadProjects();
  const next = projects.some((p) => p.id === project.id)
    ? projects.map((p) => (p.id === project.id ? project : p))
    : [project, ...projects];
  saveProjects(next);
  return next;
}

export function deleteProject(id: string): BrandProject[] {
  const next = loadProjects().filter((p) => p.id !== id);
  saveProjects(next);
  return next;
}

export function summarise(project: BrandProject): ProjectSummary {
  return {
    id: project.id,
    name: project.chosenName || project.workingTitle || 'Untitled brand',
    updatedAt: project.updatedAt,
    nicheId: project.nicheId,
    paletteId: project.paletteId,
  };
}

export function loadSettings(): AiSettings {
  const stored = safeParse<Partial<AiSettings>>(localStorage.getItem(SETTINGS_KEY), {});
  return {
    enabled: Boolean(stored.enabled),
    baseUrl: typeof stored.baseUrl === 'string' && stored.baseUrl ? stored.baseUrl : 'https://api.openai.com/v1',
    model: typeof stored.model === 'string' && stored.model ? stored.model : 'gpt-4o-mini',
    apiKey: typeof stored.apiKey === 'string' ? stored.apiKey : '',
  };
}

export function saveSettings(settings: AiSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadActiveId(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}

export function saveActiveId(id: string | null): void {
  if (id) localStorage.setItem(ACTIVE_KEY, id);
  else localStorage.removeItem(ACTIVE_KEY);
}

export function newProject(paletteId = 'ember-forge'): BrandProject {
  const now = new Date().toISOString();
  const id = `bp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  return {
    id,
    createdAt: now,
    updatedAt: now,
    workingTitle: 'Untitled brand',
    chosenName: '',
    tagline: '',
    nicheId: null,
    keywords: [],
    paletteId,
    palette: {
      id: paletteId,
      name: paletteId,
      vibe: '',
      primary: '#E2562B',
      secondary: '#1F1A17',
      accent: '#F2B705',
      surface: '#FFF8F2',
      ink: '#1B1512',
      gradient: ['#E2562B', '#F2B705'],
      onPrimary: '#FFFFFF',
    },
    logoStyle: 'wordmark',
    names: [],
    copy: null,
    handles: [],
    notes: '',
  };
}

export function exportJson(projects: BrandProject[]): string {
  return JSON.stringify({ app: 'BRANDFORGE AI', version: 1, exportedAt: new Date().toISOString(), projects }, null, 2);
}

export function importJson(raw: string): BrandProject[] {
  const parsed = safeParse<{ projects?: BrandProject[] } | BrandProject[]>(raw, []);
  const list = Array.isArray(parsed) ? parsed : parsed.projects ?? [];
  return list.filter((p): p is BrandProject => Boolean(p && typeof p.id === 'string' && typeof p.chosenName === 'string'));
}
