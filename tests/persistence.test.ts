/**
 * Persistence, isolation and recovery.
 *
 * These tests run the production SQL (schema, migrations, owner-scoped queries)
 * against a real SQLite engine, because Cloudflare D1 is SQLite. A redeploy is
 * simulated by dumping the database and reopening it in a fresh driver, so a
 * passing test means the data is genuinely on disk rather than in process
 * memory.
 */

import { describe, expect, it } from 'vitest';
import { routeApi } from '../shared/api';
import { bootstrapD1, lazyBootstrap } from '../shared/bootstrap';
import { exportStore, importStore, parseBackup, summarizeStore } from '../shared/backup';
import { appliedMigrations, applyMigrations, MIGRATIONS, splitStatements } from '../shared/migrations';
import { PALETTES } from '../shared/palettes';
import { D1Kv, Repository, type D1Like, type StorageInfo } from '../shared/store';
import type { BrandCopy, BrandProject } from '../shared/brand';
import { PLATFORM_IDS } from '../shared/platforms';
import { createFailingD1, createSqliteD1, reopenSqliteD1 } from './helpers/d1-sqlite';

const PASSWORD = 'ForgePass123!';
const DURABLE: StorageInfo = { mode: 'd1', durable: true };
const NOW = '2026-02-01T10:00:00.000Z';

/* ------------------------------------------------------------------ helpers */

async function freshDatabase() {
  const db = await createSqliteD1();
  const boot = await bootstrapD1(db);
  expect(boot.storage.mode).toBe('d1');
  expect(boot.storage.error).toBeUndefined();
  return { db, store: boot.repository as Repository, storage: boot.storage };
}

async function call(store: Repository, method: string, path: string, body?: unknown, cookie?: string) {
  return routeApi({
    method,
    path,
    body,
    headers: cookie ? { cookie } : {},
    env: {},
    store,
    storage: DURABLE,
  });
}

function sessionCookie(response: { headers?: Record<string, string> }): string {
  return (response.headers?.['Set-Cookie'] ?? '').split(';')[0] ?? '';
}

async function register(store: Repository, email: string) {
  const response = await call(store, 'POST', '/api/auth/register', {
    body: { email, password: PASSWORD, name: 'Persistence Test' },
  });
  expect(response.status).toBe(200);
  const body = response.body as { user: { id: string } };
  return { cookie: sessionCookie(response), id: body.user.id };
}

async function login(store: Repository, email: string) {
  const response = await call(store, 'POST', '/api/auth/login', { body: { email, password: PASSWORD } });
  expect(response.status).toBe(200);
  return sessionCookie(response);
}

function socialBios(name: string): BrandCopy['socialBios'] {
  return Object.fromEntries(
    PLATFORM_IDS.map((platform) => [platform, `${name} — ${platform} bio for the studio.`]),
  ) as BrandCopy['socialBios'];
}

/** A project with every one of the six stages filled in. */
function brandProject(id: string, name: string): BrandProject {
  const palette = PALETTES[0];
  const bios = socialBios(name);

  return {
    id,
    createdAt: NOW,
    updatedAt: NOW,
    workingTitle: 'Home fitness studio',
    chosenName: name,
    tagline: 'Train like you mean it',
    nicheId: 'home-fitness',
    keywords: ['kettlebell', 'mobility'],
    paletteId: palette.id,
    palette,
    logoStyle: 'wordmark',
    names: [
      { name, slug: 'ember-forge', style: 'compound', technique: 'Two real words fused', score: 86, source: 'engine' },
    ],
    copy: {
      taglines: ['Train like you mean it', 'Strength you can schedule'],
      slogans: ['Built for the long game'],
      youtubeDescription: `${name} publishes kettlebell and mobility sessions for busy professionals.`,
      socialBios: bios,
      brandStory: `${name} began in a garage with one kettlebell.`,
      mission: 'Make strength training fit a real schedule.',
      keywords: ['kettlebell', 'mobility', 'home fitness'],
    },
    handles: [
      {
        platform: 'youtube',
        handle: 'emberforge',
        status: 'available',
        confidence: 'verified',
        evidence: 'HTTP 404 from youtube.com/@emberforge — no profile is served.',
        profileUrl: 'https://www.youtube.com/@emberforge',
        httpStatus: 404,
        checkedAt: NOW,
      },
    ],
    notes: 'Six-stage fixture used by the persistence suite.',
    voice: {
      businessDescription: `${name} is a home fitness studio.`,
      brandStory: `${name} began in a garage.`,
      mission: 'Make strength training fit a real schedule.',
      vision: 'A kettlebell in every hallway.',
      values: ['Discipline', 'Clarity'],
      positioning: 'Strength coaching for people who train at 6am.',
      taglines: ['Train like you mean it'],
      slogans: ['Built for the long game'],
      socialBios: bios,
      youtubeDescription: `${name} publishes kettlebell sessions.`,
      seoKeywords: ['kettlebell', 'mobility'],
      marketingMessages: ['Start with one bell.'],
      tone: 'bold',
      generatedAt: NOW,
    },
    audience: 'Busy professionals',
    tone: 'bold',
    favorites: [name],
    lastExportedAt: NOW,
  };
}

/* --------------------------------------------------------------- migrations */

describe('D1 migrations', () => {
  it('applies each migration once and records it', async () => {
    const db = await createSqliteD1();

    const first = await applyMigrations(db);
    expect(first.applied).toEqual(MIGRATIONS.map((migration) => migration.id));

    const second = await applyMigrations(db);
    expect(second.applied).toEqual([]);
    expect(second.skipped).toEqual(MIGRATIONS.map((migration) => migration.id));

    expect(await appliedMigrations(db)).toEqual(MIGRATIONS.map((migration) => migration.id));
  });

  it('creates the owner-scoped indexes the project queries rely on', async () => {
    const db = await createSqliteD1();
    await applyMigrations(db);

    const rows = await db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'bf_projects'")
      .all<{ name: string }>();
    const names = (rows.results ?? []).map((row) => row.name);

    expect(names).toContain('bf_projects_owner_updated');
    expect(names).toContain('bf_projects_id');
    expect(names).toContain('bf_projects_updated');
  });

  it('splits statements without breaking quoted semicolons or comments', () => {
    const parts = splitStatements(
      "CREATE TABLE t (a TEXT DEFAULT 'x;y');\n-- a comment; with a semicolon\nCREATE INDEX i ON t (a);",
    );

    expect(parts).toHaveLength(2);
    expect(parts[0]).toContain("'x;y'");
    expect(parts[1]).toContain('CREATE INDEX');
  });
});

/* ------------------------------------------------------- survival of a brand */

describe('brand data survives real persistence events', () => {
  it('keeps a brand and all six stages after logout, login and a redeploy', async () => {
    const { db, store } = await freshDatabase();
    const owner = await register(store, 'keeper@example.com');
    const project = brandProject('bp_keep', 'Ember Forge');

    expect((await call(store, 'PUT', '/api/projects/bp_keep', { project }, owner.cookie)).status).toBe(200);

    /* Log out: the session is revoked, so the old cookie no longer works. */
    expect((await call(store, 'POST', '/api/auth/logout', undefined, owner.cookie)).status).toBe(200);
    const afterLogout = await call(store, 'GET', '/api/projects/bp_keep', undefined, owner.cookie);
    expect(afterLogout.status).toBeGreaterThanOrEqual(400);

    /* Log back in: a new session, same brand. */
    const cookie = await login(store, 'keeper@example.com');

    /* Redeploy: dump the database and reopen it as a fresh process. */
    const restarted = await reopenSqliteD1(db.dump());
    const boot = await bootstrapD1(restarted);
    const afterRedeploy = boot.repository as Repository;
    expect(afterRedeploy).toBeDefined();

    const read = await call(afterRedeploy, 'GET', '/api/projects/bp_keep', undefined, cookie);
    expect(read.status).toBe(200);

    const stored = (read.body as { project: BrandProject }).project;
    expect(stored.chosenName).toBe('Ember Forge');
    expect(stored.tagline).toBe(project.tagline);
    expect(stored.keywords).toEqual(project.keywords);
    expect(stored.palette.id).toBe(project.palette.id);
    expect(stored.names).toHaveLength(1);
    expect(stored.handles[0]?.confidence).toBe('verified');
    expect(stored.copy?.socialBios.youtube).toContain('Ember Forge');
    expect(stored.voice?.values).toContain('Discipline');
    expect(stored.audience).toBe('Busy professionals');
    expect(stored.tone).toBe('bold');
    expect(stored.favorites).toEqual(['Ember Forge']);
    expect(stored.lastExportedAt).toBe(project.lastExportedAt);
    expect(stored.notes).toBe(project.notes);
  });

  it('lists saved brands after a redeploy so the dashboard is not empty', async () => {
    const { db, store } = await freshDatabase();
    const owner = await register(store, 'lister@example.com');
    await call(store, 'PUT', '/api/projects/bp_list', { project: brandProject('bp_list', 'Northwind') }, owner.cookie);

    const restarted = await reopenSqliteD1(db.dump());
    const boot = await bootstrapD1(restarted);
    const cookie = await login(boot.repository as Repository, 'lister@example.com');

    const list = await call(boot.repository as Repository, 'GET', '/api/projects', undefined, cookie);
    expect(list.status).toBe(200);
    const body = list.body as { projects: { id: string; name: string }[] };
    expect(body.projects.map((entry) => entry.id)).toContain('bp_list');
    expect(body.projects[0]?.name).toBe('Northwind');
  });

  it('enforces the plan limit through the SQL project count', async () => {
    const { store } = await freshDatabase();
    const owner = await register(store, 'limits@example.com');

    for (let index = 1; index <= 3; index += 1) {
      const response = await call(
        store,
        'PUT',
        `/api/projects/bp_limit_${index}`,
        { project: brandProject(`bp_limit_${index}`, `Limit ${index}`) },
        owner.cookie,
      );
      expect(response.status).toBe(200);
    }

    const fourth = await call(
      store,
      'PUT',
      '/api/projects/bp_limit_4',
      { project: brandProject('bp_limit_4', 'Limit 4') },
      owner.cookie,
    );
    expect(fourth.status).toBe(402);

    /* Editing an existing brand must still work at the limit. */
    const edit = await call(
      store,
      'PUT',
      '/api/projects/bp_limit_1',
      { project: brandProject('bp_limit_1', 'Limit One Edited') },
      owner.cookie,
    );
    expect(edit.status).toBe(200);
  });
});

/* -------------------------------------------------------------- isolation */

describe('account isolation on the SQL table', () => {
  it('never lets one account read, claim or delete another account’s brand', async () => {
    const { db, store } = await freshDatabase();
    const owner = await register(store, 'owner@example.com');
    const stranger = await register(store, 'stranger@example.com');
    const project = brandProject('bp_private', 'Private Brand');

    expect((await call(store, 'PUT', '/api/projects/bp_private', { project }, owner.cookie)).status).toBe(200);

    expect((await call(store, 'GET', '/api/projects/bp_private', undefined, stranger.cookie)).status).toBe(404);
    expect((await call(store, 'DELETE', '/api/projects/bp_private', undefined, stranger.cookie)).status).toBe(404);
    expect(
      (
        await call(
          store,
          'PUT',
          '/api/projects/bp_private',
          { project: { ...project, chosenName: 'Hijacked' } },
          stranger.cookie,
        )
      ).status,
    ).toBe(403);

    const strangerList = (await call(store, 'GET', '/api/projects', undefined, stranger.cookie)).body as {
      projects: unknown[];
    };
    expect(strangerList.projects).toHaveLength(0);

    const ownerRead = (await call(store, 'GET', '/api/projects/bp_private', undefined, owner.cookie)).body as {
      project: BrandProject;
    };
    expect(ownerRead.project.chosenName).toBe('Private Brand');

    /* The owner is recorded in SQL, so isolation is not a client-side promise. */
    const row = await db
      .prepare('SELECT owner FROM bf_projects WHERE id = ?')
      .bind('bp_private')
      .first<{ owner: string }>();
    expect(row?.owner).toBe(owner.id);
  });
});

/* -------------------------------------------------------- legacy JSON data */

describe('legacy JSON records', () => {
  it('imports pre-D1 projects without deleting or overwriting anything', async () => {
    const db = await createSqliteD1();
    await applyMigrations(db);

    const legacy = brandProject('bp_legacy', 'Legacy Brand');
    await db
      .prepare('INSERT INTO bf_kv (k, v) VALUES (?, ?)')
      .bind('project:bp_legacy', JSON.stringify({ owner: 'u_legacy', project: legacy }))
      .run();

    /* Re-run the import migration, as a deployment would after a restore. */
    await db.prepare('DELETE FROM bf_migrations WHERE id = ?').bind('0003_import_legacy_projects').run();
    const rerun = await applyMigrations(db);
    expect(rerun.applied).toContain('0003_import_legacy_projects');

    const table = new D1Kv(db);
    const imported = await table.readProject('u_legacy', 'bp_legacy');
    expect(imported?.chosenName).toBe('Legacy Brand');
    expect(imported?.voice?.values).toContain('Discipline');

    /* The original key/value row stays behind as a rollback copy. */
    const kept = await db
      .prepare("SELECT COUNT(*) AS total FROM bf_kv WHERE k = 'project:bp_legacy'")
      .first<{ total: number }>();
    expect(kept?.total).toBe(1);

    /* A brand edited in D1 must win over the stale legacy copy. */
    await table.putProject('u_legacy', { ...legacy, chosenName: 'Edited In D1' });
    await db.prepare('DELETE FROM bf_migrations WHERE id = ?').bind('0003_import_legacy_projects').run();
    await applyMigrations(db);
    expect((await table.readProject('u_legacy', 'bp_legacy'))?.chosenName).toBe('Edited In D1');
  });
});

/* -------------------------------------------------------- backup / restore */

describe('backup and restore', () => {
  it('exports everything and restores it without touching live data', async () => {
    const { db, store } = await freshDatabase();
    const owner = await register(store, 'backup@example.com');
    await call(
      store,
      'PUT',
      '/api/projects/bp_backup',
      { project: brandProject('bp_backup', 'Backup Brand') },
      owner.cookie,
    );

    const source = new D1Kv(db);
    const backup = await exportStore(source);
    expect(backup.counts.projects).toBe(1);
    expect(backup.kv.some((row) => row.key.startsWith('user:'))).toBe(true);

    const target = await createSqliteD1();
    await applyMigrations(target);
    const targetKv = new D1Kv(target);

    /* A dry run reports the work but writes nothing. */
    const dry = await importStore(targetKv, backup, {});
    expect(dry.applied).toBe(false);
    expect(dry.projectsWritten).toBe(1);
    expect((await summarizeStore(targetKv)).projects).toBe(0);

    const applied = await importStore(targetKv, backup, { apply: true });
    expect(applied.projectsWritten).toBe(1);

    const summary = await summarizeStore(targetKv);
    expect(summary.projects).toBe(1);
    expect(summary.users).toBeGreaterThan(0);
    expect((await targetKv.readProject(owner.id, 'bp_backup'))?.chosenName).toBe('Backup Brand');

    /* Restoring twice is a no-op, so a repeated run cannot duplicate or clobber. */
    const again = await importStore(targetKv, backup, { apply: true });
    expect(again.projectsSkipped).toBe(1);
    expect((await summarizeStore(targetKv)).projects).toBe(1);
  });

  it('rejects an unusable backup before writing anything', () => {
    expect(() => parseBackup({ version: 2, kv: [] })).toThrow(/Unsupported backup version/);
    expect(() => parseBackup({ version: 1, kv: [{ key: 'a' }] })).toThrow(/invalid/);
    expect(() => parseBackup({ version: 1, kv: [], projects: [{ owner: 'u1', project: {} }] })).toThrow(/id/);
  });
});

/* ------------------------------------------------------- outage and recovery */

describe('database outage handling', () => {
  it('reports the outage instead of pretending accounts work', async () => {
    const boot = await bootstrapD1(createFailingD1('D1 is unreachable'));
    expect(boot.repository).toBeUndefined();
    expect(boot.storage.mode).toBe('d1');
    expect(boot.storage.durable).toBe(true);
    expect(boot.storage.error).toContain('D1 is unreachable');

    const health = await routeApi({ method: 'GET', path: '/api/health', headers: {}, env: {}, storage: boot.storage });
    expect(health.status).toBe(200);
    const healthBody = health.body as { storage: StorageInfo; accountsEnabled: boolean };
    expect(healthBody.accountsEnabled).toBe(false);
    expect(healthBody.storage.error).toContain('D1 is unreachable');

    const register = await routeApi({
      method: 'POST',
      path: '/api/auth/register',
      body: { email: 'outage@example.com', password: PASSWORD, name: 'Outage' },
      headers: {},
      env: {},
      store: boot.repository,
      storage: boot.storage,
    });
    expect(register.status).toBe(503);
    expect(JSON.stringify(register.body)).toContain('D1 is unreachable');
  });

  it('retries after a failed start and recovers when the database answers', async () => {
    const db = await createSqliteD1();
    await applyMigrations(db);

    let healthy = false;
    const flaky: D1Like = {
      prepare: (query: string) => (healthy ? db.prepare(query) : createFailingD1().prepare(query)),
      exec: async (query: string) => {
        if (!healthy) throw new Error('offline');
        return db.exec?.(query);
      },
    };

    const storage = lazyBootstrap(() => bootstrapD1(flaky));

    const first = await storage();
    expect(first.repository).toBeUndefined();
    expect(first.storage.error).toBeTruthy();

    healthy = true;
    const second = await storage();
    expect(second.storage.error).toBeUndefined();
    expect(second.repository).toBeDefined();
  });
});
