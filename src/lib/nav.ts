import type { BrandProject } from '../../shared/types';
import { DEFAULT_BRAND_TITLE } from '../../shared/brand';

export type SectionId =
  | 'home'
  | 'research'
  | 'names'
  | 'handles'
  | 'design'
  | 'voice'
  | 'copy'
  | 'projects'
  | 'export'
  | 'settings'
  | 'admin';

export interface SectionProps {
  project: BrandProject;
  update: (patch: Partial<BrandProject>) => void;
  go: (id: SectionId) => void;
}

export interface StageDef {
  id: SectionId;
  index: number;
  title: string;
  short: string;
  blurb: string;
}

/** The six-stage workflow, in order. */
export const STAGES: StageDef[] = [
  {
    id: 'research',
    index: 1,
    title: 'Research your niche',
    short: 'Research',
    blurb: 'Niche, audience, competitors and opportunities',
  },
  {
    id: 'names',
    index: 2,
    title: 'Generate brand names',
    short: 'Names',
    blurb: '50–100 names with scores and techniques',
  },
  {
    id: 'handles',
    index: 3,
    title: 'Check social handles',
    short: 'Handles',
    blurb: 'Ten platforms, verified vs unconfirmed',
  },
  {
    id: 'design',
    index: 4,
    title: 'Design brand identity',
    short: 'Design',
    blurb: 'Logos, palettes, avatars and banners',
  },
  {
    id: 'voice',
    index: 5,
    title: 'Create brand voice',
    short: 'Voice',
    blurb: 'Story, bios, SEO and marketing copy',
  },
  {
    id: 'export',
    index: 6,
    title: 'Export complete brand kit',
    short: 'Export',
    blurb: 'One ZIP with every asset and guideline',
  },
];

export interface StageState extends StageDef {
  done: boolean;
  detail: string;
}

/**
 * Real completion state per stage, derived only from what the project actually
 * holds. Nothing is marked complete because a screen was visited.
 */
export function stageStates(project: BrandProject): StageState[] {
  const rawName = project.chosenName || project.workingTitle || '';
  // The placeholder title means the brand is not named yet, so Design must not
  // look complete on a brand-new project.
  const trimmed = rawName.trim();
  const name = trimmed && trimmed !== DEFAULT_BRAND_TITLE ? trimmed : '';

  const state: Record<string, { done: boolean; detail: string }> = {
    research: {
      done: Boolean(project.nicheId),
      detail: project.nicheId ? `Niche locked${project.keywords.length ? ` · ${project.keywords.length} keywords` : ''}` : 'Pick a niche to start',
    },
    names: {
      done: project.names.length > 0,
      detail: project.names.length
        ? `${project.names.length} names${project.chosenName ? ` · ${project.chosenName}` : ''}`
        : 'No names generated yet',
    },
    handles: {
      done: project.handles.length > 0,
      detail: project.handles.length
        ? `${project.handles.filter((item) => item.status === 'available').length} available · ${project.handles.length} checked`
        : 'No handles checked yet',
    },
    design: {
      done: Boolean(name && project.paletteId),
      detail: name ? `${project.palette?.name ?? 'Palette'} · ${project.logoStyle} logo` : 'Name the brand first',
    },
    voice: {
      done: Boolean(project.voice || project.copy),
      detail: project.voice
        ? `${project.voice.tone} voice · ${project.voice.seoKeywords.length} keywords`
        : project.copy
          ? 'Copy generated'
          : 'No brand voice yet',
    },
    export: {
      done: Boolean(project.lastExportedAt),
      detail: project.lastExportedAt
        ? `Last exported ${new Date(project.lastExportedAt).toLocaleDateString()}`
        : 'Kit not exported yet',
    },
  };

  return STAGES.map((stage) => ({ ...stage, ...(state[stage.id] ?? { done: false, detail: '' }) }));
}

/**
 * Completion state for one stage, looked up by id.
 *
 * Always use this (or index the array positionally) instead of
 * `stageStates(project)[stage.index]`: `stage.index` is the 1-based display
 * number, so that expression reads the wrong row for every stage and returns
 * `undefined` for the last one, which crashed the workspace rail.
 */
export function stageStateFor(project: BrandProject, id: SectionId): StageState | null {
  return stageStates(project).find((stage) => stage.id === id) ?? null;
}

export function projectProgress(project: BrandProject): number {
  const states = stageStates(project);
  const done = states.filter((stage) => stage.done).length;
  return Math.round((done / states.length) * 100);
}

export function nextStage(project: BrandProject): StageDef {
  const states = stageStates(project);
  return states.find((stage) => !stage.done) ?? states[states.length - 1];
}
