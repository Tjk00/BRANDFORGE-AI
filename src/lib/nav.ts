import type { BrandProject } from '../../shared/types';

export type SectionId =
  | 'home'
  | 'research'
  | 'names'
  | 'handles'
  | 'design'
  | 'copy'
  | 'projects'
  | 'export'
  | 'settings';

export interface SectionProps {
  project: BrandProject;
  update: (patch: Partial<BrandProject>) => void;
  go: (id: SectionId) => void;
}
