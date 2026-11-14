/**
 * Portable persistence.
 *
 * One repository implementation runs everywhere: Node (JSON file driver),
 * Cloudflare D1 (SQL driver) and tests (memory driver). Every record is stored
 * under its own key and every project carries its owner, so customer data
 * isolation is enforced in code rather than trusted from the client.
 */

import type { PasswordRecord } from './auth';
import type { BrandProject } from './brand';
import { getPlan, isPlanId, type PlanId } from './plans';

export interface KvDriver {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  del(key: string): Promise<void>;
  list(prefix: string): Promise<{ key: string; value: string }[]>;
}

export class MemoryKv implements KvDriver {
  private map = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }

  async set(key: string, value: string): Promise<void> {
    this.map.set(key, value);
  }

  async del(key: string): Promise<void> {
    this.map.delete(key);
  }

  async list(prefix: string): Promise<{ key: string; value: string }[]> {
    return [...this.map.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => ({ key, value }));
  }
}

/* ------------------------------------------------------------------ D1 driver */

export interface D1StatementLike {
  bind(...values: unknown[]): D1StatementLike;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results?: T[] }>;
  run(): Promise<unknown>;
}

export interface D1Like {
  prepare(query: string): D1StatementLike;
  /** Optional multi-statement execution, used by migrations when available. */
  exec?(query: string): Promise<unknown>;
}

/** How the running host stores data, reported by /api/health. */
export interface StorageInfo {
  mode: 'd1' | 'file' | 'memory' | 'none';
  /** True only when the store survives a redeploy (D1). */
  durable: boolean;
  migrationsApplied?: number;
  migrationsPending?: number;
  error?: string;
}

/**
 * A SQL project table.
 *
 * When the driver provides one, projects are read and written with an owner in
 * the WHERE clause, so isolation is enforced by the database instead of by a
 * JavaScript comparison after a full read.
 */
export interface ProjectTable {
  putProject(owner: string, project: BrandProject): Promise<void>;
  readProject(owner: string, projectId: string): Promise<BrandProject | null>;
  listProjects(owner: string): Promise<BrandProject[]>;
  removeProject(owner: string, projectId: string): Promise<boolean>;
  ownerOf(projectId: string): Promise<string | null>;
  countProjects(): Promise<number>;
  /** Every owner's projects, used only by backup and admin statistics. */
  exportProjects(): Promise<{ owner: string; project: BrandProject }[]>;
}

export function projectTableOf(kv: KvDriver): ProjectTable | null {
  const candidate = kv as Partial<ProjectTable>;
  return typeof candidate.putProject === 'function' && typeof candidate.readProject === 'function'
    ? (kv as unknown as ProjectTable)
    : null;
}

function readBody(body: string): BrandProject | null {
  return parseJson<BrandProject>(body);
}

/** D1 implementation of the project table (see shared/migrations.ts). */
export class D1Projects implements ProjectTable {
  constructor(private readonly db: D1Like) {}

  async putProject(owner: string, project: BrandProject): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO bf_projects (owner, id, created_at, updated_at, body) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(owner, id) DO UPDATE SET updated_at = excluded.updated_at, body = excluded.body`,
      )
      .bind(owner, project.id, project.createdAt ?? '', project.updatedAt ?? '', JSON.stringify(project))
      .run();
  }

  async readProject(owner: string, projectId: string): Promise<BrandProject | null> {
    const row = await this.db
      .prepare('SELECT body FROM bf_projects WHERE owner = ? AND id = ?')
      .bind(owner, projectId)
      .first<{ body: string }>();
    return row ? readBody(row.body) : null;
  }

  async listProjects(owner: string): Promise<BrandProject[]> {
    const result = await this.db
      .prepare('SELECT body FROM bf_projects WHERE owner = ? ORDER BY updated_at DESC')
      .bind(owner)
      .all<{ body: string }>();
    return (result.results ?? [])
      .map((row) => readBody(row.body))
      .filter((project): project is BrandProject => Boolean(project));
  }

  async removeProject(owner: string, projectId: string): Promise<boolean> {
    const existing = await this.readProject(owner, projectId);
    if (!existing) return false;
    await this.db.prepare('DELETE FROM bf_projects WHERE owner = ? AND id = ?').bind(owner, projectId).run();
    return true;
  }

  async ownerOf(projectId: string): Promise<string | null> {
    const row = await this.db
      .prepare('SELECT owner FROM bf_projects WHERE id = ? LIMIT 1')
      .bind(projectId)
      .first<{ owner: string }>();
    return row?.owner ?? null;
  }

  async countProjects(): Promise<number> {
    const row = await this.db.prepare('SELECT COUNT(*) AS total FROM bf_projects').first<{ total: number }>();
    return Number(row?.total ?? 0);
  }

  async exportProjects(): Promise<{ owner: string; project: BrandProject }[]> {
    const result = await this.db
      .prepare('SELECT owner, body FROM bf_projects ORDER BY updated_at DESC')
      .all<{ owner: string; body: string }>();
    return (result.results ?? [])
      .map((row) => {
        const project = readBody(row.body);
        return project ? { owner: row.owner, project } : null;
      })
      .filter((entry): entry is { owner: string; project: BrandProject } => Boolean(entry));
  }
}

/** D1 needs `CREATE TABLE IF NOT EXISTS bf_kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)`. */
export class D1Kv implements KvDriver, ProjectTable {
  private readonly projects: D1Projects;

  constructor(private readonly db: D1Like) {
    this.projects = new D1Projects(db);
  }

  putProject(owner: string, project: BrandProject): Promise<void> {
    return this.projects.putProject(owner, project);
  }

  readProject(owner: string, projectId: string): Promise<BrandProject | null> {
    return this.projects.readProject(owner, projectId);
  }

  listProjects(owner: string): Promise<BrandProject[]> {
    return this.projects.listProjects(owner);
  }

  removeProject(owner: string, projectId: string): Promise<boolean> {
    return this.projects.removeProject(owner, projectId);
  }

  ownerOf(projectId: string): Promise<string | null> {
    return this.projects.ownerOf(projectId);
  }

  countProjects(): Promise<number> {
    return this.projects.countProjects();
  }

  exportProjects(): Promise<{ owner: string; project: BrandProject }[]> {
    return this.projects.exportProjects();
  }

  async get(key: string): Promise<string | null> {
    const row = await this.db.prepare('SELECT v FROM bf_kv WHERE k = ?').bind(key).first<{ v: string }>();
    return row?.v ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    await this.db
      .prepare('INSERT INTO bf_kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v')
      .bind(key, value)
      .run();
  }

  async del(key: string): Promise<void> {
    await this.db.prepare('DELETE FROM bf_kv WHERE k = ?').bind(key).run();
  }

  async list(prefix: string): Promise<{ key: string; value: string }[]> {
    const result = await this.db
      .prepare('SELECT k, v FROM bf_kv WHERE k LIKE ?')
      .bind(`${prefix}%`)
      .all<{ k: string; v: string }>();
    return (result.results ?? []).map((row) => ({ key: row.k, value: row.v }));
  }
}

/* -------------------------------------------------------------------- records */

export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export type UserRole = 'user' | 'admin';

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  plan: PlanId;
  password: PasswordRecord;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  plan: PlanId;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface SessionRecord {
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export interface ActivityRecord {
  id: string;
  at: string;
  userId: string;
  email: string;
  action: string;
  detail: string;
}

export interface ProviderConfig {
  enabled: boolean;
  baseUrl: string;
  model: string;
  apiKey: string;
}

export interface PublicProviderConfig {
  enabled: boolean;
  baseUrl: string;
  model: string;
  configured: boolean;
}

export interface StoredProject {
  owner: string;
  project: BrandProject;
}

export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const MAX_PROJECT_BYTES = 512 * 1024;

export function publicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    plan: user.plan,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export const DEFAULT_PROVIDERS: ProviderConfig = {
  enabled: false,
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  apiKey: '',
};

/* ---------------------------------------------------------------- repository */

export class Repository {
  /** Non-null on hosts whose driver exposes the SQL project table (D1). */
  private readonly table: ProjectTable | null;

  constructor(private readonly kv: KvDriver) {
    this.table = projectTableOf(kv);
  }

  /* ---------------------------------------------------------------- accounts */

  async countUsers(): Promise<number> {
    return (await this.kv.list('user:')).length;
  }

  async getUser(id: string): Promise<UserRecord | null> {
    return parseJson<UserRecord>(await this.kv.get(`user:${id}`));
  }

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const id = await this.kv.get(`email:${email}`);
    return id ? this.getUser(id) : null;
  }

  async listUsers(): Promise<PublicUser[]> {
    const rows = await this.kv.list('user:');
    return rows
      .map((row) => parseJson<UserRecord>(row.value))
      .filter((user): user is UserRecord => Boolean(user))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(publicUser);
  }

  async createUser(input: {
    email: string;
    name: string;
    password: PasswordRecord;
    role?: UserRole;
    plan?: PlanId;
  }): Promise<UserRecord> {
    if (await this.findUserByEmail(input.email)) {
      throw new AppError(409, 'An account with that email already exists.');
    }
    const user: UserRecord = {
      id: newId('u'),
      email: input.email,
      name: input.name,
      role: input.role ?? 'user',
      plan: input.plan ?? 'free',
      password: input.password,
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
    };
    await this.kv.set(`user:${user.id}`, JSON.stringify(user));
    await this.kv.set(`email:${user.email}`, user.id);
    return user;
  }

  async updateUser(
    id: string,
    patch: Partial<Pick<UserRecord, 'name' | 'role' | 'plan' | 'lastLoginAt'>>,
  ): Promise<UserRecord> {
    const user = await this.getUser(id);
    if (!user) throw new AppError(404, 'Account not found.');
    const next: UserRecord = {
      ...user,
      name: patch.name ?? user.name,
      role: patch.role ?? user.role,
      plan: patch.plan && isPlanId(patch.plan) ? patch.plan : user.plan,
      lastLoginAt: patch.lastLoginAt === undefined ? user.lastLoginAt : patch.lastLoginAt,
    };
    await this.kv.set(`user:${next.id}`, JSON.stringify(next));
    return next;
  }

  async deleteUser(id: string): Promise<void> {
    const user = await this.getUser(id);
    if (!user) return;
    const projects = await this.listProjects(id);
    for (const project of projects) await this.deleteProject(id, project.id);
    const sessionKeys = await this.kv.list(`session:${id}:`);
    for (const row of sessionKeys) await this.kv.del(row.key);
    await this.kv.del(`usersessions:${id}`);
    await this.kv.del(`email:${user.email}`);
    await this.kv.del(`user:${id}`);
  }

  /* ---------------------------------------------------------------- sessions */

  async createSession(userId: string, tokenHash: string): Promise<SessionRecord> {
    const now = Date.now();
    const session: SessionRecord = {
      userId,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
    };
    await this.kv.set(`session:${userId}:${tokenHash}`, JSON.stringify(session));
    const index = parseJson<string[]>(await this.kv.get(`usersessions:${userId}`)) ?? [];
    const next = [tokenHash, ...index.filter((hash) => hash !== tokenHash)].slice(0, 25);
    await this.kv.set(`usersessions:${userId}`, JSON.stringify(next));
    return session;
  }

  async resolveSession(userId: string, tokenHash: string): Promise<UserRecord | null> {
    const session = parseJson<SessionRecord>(await this.kv.get(`session:${userId}:${tokenHash}`));
    if (!session) return null;
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      await this.kv.del(`session:${userId}:${tokenHash}`);
      return null;
    }
    return this.getUser(userId);
  }

  async deleteSession(userId: string, tokenHash: string): Promise<void> {
    await this.kv.del(`session:${userId}:${tokenHash}`);
    const index = parseJson<string[]>(await this.kv.get(`usersessions:${userId}`)) ?? [];
    await this.kv.set(`usersessions:${userId}`, JSON.stringify(index.filter((hash) => hash !== tokenHash)));
  }

  /* ---------------------------------------------------------------- projects */

  async projectIds(userId: string): Promise<string[]> {
    if (this.table) return (await this.table.listProjects(userId)).map((project) => project.id);
    return parseJson<string[]>(await this.kv.get(`userprojects:${userId}`)) ?? [];
  }

  async projectCount(userId: string): Promise<number> {
    if (this.table) return (await this.table.listProjects(userId)).length;
    return (await this.projectIds(userId)).length;
  }

  async allProjectsCount(): Promise<number> {
    if (this.table) return this.table.countProjects();
    return (await this.kv.list('project:')).length;
  }

  async listProjects(userId: string): Promise<BrandProject[]> {
    if (this.table) return this.table.listProjects(userId);
    const ids = await this.projectIds(userId);
    const rows = await Promise.all(ids.map((id) => this.getProject(userId, id)));
    return rows
      .filter((project): project is BrandProject => Boolean(project))
      .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
  }

  async getProject(userId: string, projectId: string): Promise<BrandProject | null> {
    if (this.table) return this.table.readProject(userId, projectId);
    const stored = parseJson<StoredProject>(await this.kv.get(`project:${projectId}`));
    if (!stored || stored.owner !== userId) return null;
    return stored.project;
  }

  async saveProject(userId: string, project: BrandProject): Promise<BrandProject> {
    if (!project || typeof project.id !== 'string' || !project.id.trim()) {
      throw new AppError(400, 'That project is missing an id.');
    }
    const serialized = JSON.stringify(project);
    if (serialized.length > MAX_PROJECT_BYTES) {
      throw new AppError(413, 'That project is too large to save.');
    }

    if (this.table) {
      const user = await this.getUser(userId);
      if (!user) throw new AppError(401, 'Sign in to save projects.');

      const owner = await this.table.ownerOf(project.id);
      if (owner && owner !== userId) {
        throw new AppError(403, 'That project belongs to another account.');
      }

      if (!owner) {
        const limit = getPlan(user.plan).projectLimit;
        const used = (await this.table.listProjects(userId)).length;
        if (used >= limit) {
          throw new AppError(
            402,
            `Your ${getPlan(user.plan).name} plan allows ${limit} saved brands. Delete a project to free a slot.`,
          );
        }
      }

      await this.table.putProject(userId, project);
      return project;
    }

    const existing = parseJson<StoredProject>(await this.kv.get(`project:${project.id}`));
    if (existing && existing.owner !== userId) {
      throw new AppError(403, 'That project belongs to another account.');
    }

    const user = await this.getUser(userId);
    if (!user) throw new AppError(401, 'Sign in to save projects.');
    const ids = await this.projectIds(userId);

    if (!existing) {
      const limit = getPlan(user.plan).projectLimit;
      if (ids.length >= limit) {
        throw new AppError(
          402,
          `Your ${getPlan(user.plan).name} plan allows ${limit} saved brands. Delete a project to free a slot.`,
        );
      }
    }

    const record: StoredProject = { owner: userId, project };
    await this.kv.set(`project:${project.id}`, JSON.stringify(record));
    if (!ids.includes(project.id)) {
      await this.kv.set(`userprojects:${userId}`, JSON.stringify([project.id, ...ids]));
    }
    return project;
  }

  async deleteProject(userId: string, projectId: string): Promise<boolean> {
    if (this.table) return this.table.removeProject(userId, projectId);
    const stored = parseJson<StoredProject>(await this.kv.get(`project:${projectId}`));
    if (!stored || stored.owner !== userId) return false;
    await this.kv.del(`project:${projectId}`);
    const ids = await this.projectIds(userId);
    await this.kv.set(`userprojects:${userId}`, JSON.stringify(ids.filter((id) => id !== projectId)));
    return true;
  }

  /* ---------------------------------------------------------------- activity */

  async logActivity(input: { userId: string; email: string; action: string; detail?: string }): Promise<void> {
    const at = new Date().toISOString();
    const record: ActivityRecord = {
      id: newId('act'),
      at,
      userId: input.userId,
      email: input.email,
      action: input.action,
      detail: input.detail ?? '',
    };
    await this.kv.set(`activity:${at}:${record.id}`, JSON.stringify(record));
    // Keep the log bounded so the store cannot grow without limit.
    const rows = await this.kv.list('activity:');
    if (rows.length > 300) {
      const stale = rows.sort((a, b) => a.key.localeCompare(b.key)).slice(0, rows.length - 300);
      for (const row of stale) await this.kv.del(row.key);
    }
  }

  async listActivity(limit = 40): Promise<ActivityRecord[]> {
    const rows = await this.kv.list('activity:');
    return rows
      .map((row) => parseJson<ActivityRecord>(row.value))
      .filter((record): record is ActivityRecord => Boolean(record))
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, limit);
  }

  /* --------------------------------------------------------------- providers */

  async getProviders(): Promise<ProviderConfig> {
    const stored = parseJson<Partial<ProviderConfig>>(await this.kv.get('config:providers'));
    return { ...DEFAULT_PROVIDERS, ...(stored ?? {}) };
  }

  async saveProviders(patch: Partial<ProviderConfig>): Promise<ProviderConfig> {
    const current = await this.getProviders();
    const next: ProviderConfig = {
      enabled: patch.enabled ?? current.enabled,
      baseUrl: (patch.baseUrl ?? current.baseUrl).trim() || DEFAULT_PROVIDERS.baseUrl,
      model: (patch.model ?? current.model).trim() || DEFAULT_PROVIDERS.model,
      apiKey: patch.apiKey === undefined ? current.apiKey : patch.apiKey.trim(),
    };
    await this.kv.set('config:providers', JSON.stringify(next));
    return next;
  }

  async clearProviderKey(): Promise<ProviderConfig> {
    return this.saveProviders({ apiKey: '', enabled: false });
  }
}

export function publicProviders(config: ProviderConfig): PublicProviderConfig {
  return {
    enabled: config.enabled,
    baseUrl: config.baseUrl,
    model: config.model,
    configured: Boolean(config.apiKey),
  };
}
