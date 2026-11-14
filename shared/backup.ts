/**
 * Backup and restore.
 *
 * The format is deliberately dumb: every key/value row plus every project with
 * its owner. That makes a backup readable, diffable and restorable into either
 * driver (JSON file, D1 binding, D1 over HTTPS).
 *
 * Restores are additive and non-destructive by default:
 *   - a dry run reports what would change and writes nothing;
 *   - an existing record is skipped unless `overwrite` is requested explicitly;
 *   - nothing is ever deleted, so a bad backup cannot erase live data.
 */

import type { BrandProject } from './brand';
import { projectTableOf, type KvDriver } from './store';

export interface StoreBackup {
  version: 1;
  exportedAt: string;
  counts: { keys: number; projects: number };
  kv: { key: string; value: string }[];
  projects: { owner: string; project: BrandProject }[];
}

export interface ImportOptions {
  /** Write the changes. When false (the default) nothing is modified. */
  apply?: boolean;
  /** Replace records that already exist. Off by default. */
  overwrite?: boolean;
}

export interface ImportResult {
  applied: boolean;
  keysWritten: number;
  keysSkipped: number;
  projectsWritten: number;
  projectsSkipped: number;
}

function safeParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** Validate an untrusted backup before anything is written. */
export function parseBackup(value: unknown): StoreBackup {
  if (!isRecord(value)) throw new Error('Backup must be a JSON object.');
  if (value.version !== 1) throw new Error(`Unsupported backup version: ${String(value.version)}.`);
  if (!Array.isArray(value.kv)) throw new Error('Backup is missing its key/value rows.');

  const kv = value.kv.map((row, index) => {
    if (!isRecord(row) || typeof row.key !== 'string' || typeof row.value !== 'string') {
      throw new Error(`Backup key/value row ${index} is invalid.`);
    }
    return { key: row.key, value: row.value };
  });

  const rawProjects = Array.isArray(value.projects) ? value.projects : [];
  const projects = rawProjects.map((row, index) => {
    if (!isRecord(row) || typeof row.owner !== 'string' || !isRecord(row.project)) {
      throw new Error(`Backup project row ${index} is invalid.`);
    }
    const project = row.project as unknown as BrandProject;
    if (typeof project.id !== 'string' || !project.id) {
      throw new Error(`Backup project row ${index} is missing an id.`);
    }
    return { owner: row.owner, project };
  });

  return {
    version: 1,
    exportedAt: typeof value.exportedAt === 'string' ? value.exportedAt : new Date().toISOString(),
    counts: { keys: kv.length, projects: projects.length },
    kv,
    projects,
  };
}

/** Snapshot every record in the store. */
export async function exportStore(kv: KvDriver): Promise<StoreBackup> {
  const rows = await kv.list('');
  const table = projectTableOf(kv);

  let projects: { owner: string; project: BrandProject }[];
  if (table) {
    projects = await table.exportProjects();
  } else {
    projects = [];
    for (const row of rows) {
      if (!row.key.startsWith('project:')) continue;
      const stored = safeParse<{ owner?: string; project?: BrandProject }>(row.value);
      if (stored?.owner && stored.project?.id) {
        projects.push({ owner: stored.owner, project: stored.project });
      }
    }
  }

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    counts: { keys: rows.length, projects: projects.length },
    kv: rows,
    projects,
  };
}

/**
 * Merge a backup into the store. Dry run by default; never deletes.
 */
export async function importStore(
  kv: KvDriver,
  backup: StoreBackup,
  options: ImportOptions = {},
): Promise<ImportResult> {
  const apply = options.apply === true;
  const overwrite = options.overwrite === true;
  const table = projectTableOf(kv);

  let keysWritten = 0;
  let keysSkipped = 0;
  let projectsWritten = 0;
  let projectsSkipped = 0;

  for (const row of backup.kv) {
    // Projects live in their own table on D1; their legacy key/value copies are
    // restored only on key/value-only drivers, otherwise the two would diverge.
    if (table && row.key.startsWith('project:')) continue;

    const existing = await kv.get(row.key);
    if (existing !== null && !overwrite) {
      keysSkipped += 1;
      continue;
    }
    if (apply) await kv.set(row.key, row.value);
    keysWritten += 1;
  }

  const indexAdds = new Map<string, string[]>();

  for (const entry of backup.projects) {
    if (table) {
      const existing = await table.readProject(entry.owner, entry.project.id);
      if (existing && !overwrite) {
        projectsSkipped += 1;
        continue;
      }
      if (apply) await table.putProject(entry.owner, entry.project);
    } else {
      const key = `project:${entry.project.id}`;
      const existing = await kv.get(key);
      if (existing !== null && !overwrite) {
        projectsSkipped += 1;
        continue;
      }
      if (apply) await kv.set(key, JSON.stringify({ owner: entry.owner, project: entry.project }));
      const ids = indexAdds.get(entry.owner) ?? [];
      ids.push(entry.project.id);
      indexAdds.set(entry.owner, ids);
    }
    projectsWritten += 1;
  }

  if (apply && !table) {
    for (const [owner, ids] of indexAdds) {
      const current = safeParse<string[]>(await kv.get(`userprojects:${owner}`)) ?? [];
      const merged = [...ids.filter((id) => !current.includes(id)), ...current];
      await kv.set(`userprojects:${owner}`, JSON.stringify(merged));
    }
  }

  return { applied: apply, keysWritten, keysSkipped, projectsWritten, projectsSkipped };
}

/** Human-readable inventory, used to verify a restore. */
export async function summarizeStore(kv: KvDriver): Promise<{
  users: number;
  sessions: number;
  projects: number;
  activity: number;
  keys: number;
}> {
  const rows = await kv.list('');
  const table = projectTableOf(kv);
  const projects = table
    ? await table.countProjects()
    : rows.filter((row) => row.key.startsWith('project:')).length;

  return {
    users: rows.filter((row) => row.key.startsWith('user:')).length,
    sessions: rows.filter((row) => row.key.startsWith('session:')).length,
    projects,
    activity: rows.filter((row) => row.key.startsWith('activity:')).length,
    keys: rows.length,
  };
}
