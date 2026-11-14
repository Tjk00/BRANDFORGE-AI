/**
 * Versioned database migrations.
 *
 * The same migration list runs on every SQL host: Cloudflare D1 (binding or
 * HTTPS), and the SQLite engine used by the test suite. Each migration is
 * applied at most once and recorded in `bf_migrations`, so a redeploy, a retry
 * or a second instance can never re-run it and never rewrites existing rows.
 *
 * Rules for adding a migration:
 *   1. Never edit or reorder a migration that has shipped — append a new one.
 *   2. Only additive DDL (CREATE TABLE/INDEX IF NOT EXISTS, guarded ALTER).
 *   3. Never DELETE or UPDATE customer rows; import legacy data with INSERT OR
 *      IGNORE so an existing record always wins.
 */

import type { D1Like } from './store';

export interface Migration {
  /** Ordered, stable id. Prefix with a sequence number. */
  id: string;
  /** One or more statements; executed in order inside the migration. */
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    id: '0001_bf_kv',
    sql: `
      CREATE TABLE IF NOT EXISTS bf_kv (
        k TEXT PRIMARY KEY,
        v TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS bf_kv_prefix ON bf_kv (k);
    `,
  },
  {
    id: '0002_bf_projects',
    // Projects move into their own table so every read is owner-scoped in SQL
    // and listing is served by an index instead of a full scan plus JS sort.
    sql: `
      CREATE TABLE IF NOT EXISTS bf_projects (
        owner TEXT NOT NULL,
        id TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT '',
        body TEXT NOT NULL,
        PRIMARY KEY (owner, id)
      );
      CREATE INDEX IF NOT EXISTS bf_projects_owner_updated ON bf_projects (owner, updated_at DESC);
      CREATE INDEX IF NOT EXISTS bf_projects_id ON bf_projects (id);
      CREATE INDEX IF NOT EXISTS bf_projects_updated ON bf_projects (updated_at DESC);
    `,
  },
  {
    id: '0003_import_legacy_projects',
    // Copy any project that only exists in the legacy key/value table into
    // bf_projects. INSERT OR IGNORE means an already-migrated project is never
    // overwritten, and the original bf_kv row is deliberately left in place as
    // a rollback copy.
    sql: `
      INSERT OR IGNORE INTO bf_projects (owner, id, created_at, updated_at, body)
      SELECT
        json_extract(v, '$.owner'),
        json_extract(v, '$.project.id'),
        COALESCE(json_extract(v, '$.project.createdAt'), ''),
        COALESCE(json_extract(v, '$.project.updatedAt'), ''),
        json_extract(v, '$.project')
      FROM bf_kv
      WHERE k LIKE 'project:%'
        AND json_valid(v)
        AND json_extract(v, '$.owner') IS NOT NULL
        AND json_extract(v, '$.project.id') IS NOT NULL;
    `,
  },
  {
    id: '0004_session_index',
    // Sessions are looked up by `session:<userId>:<hash>` and swept by prefix,
    // so the primary key already serves them. This index keeps the admin
    // activity scan cheap as the log grows.
    sql: `
      CREATE INDEX IF NOT EXISTS bf_kv_kind ON bf_kv (substr(k, 1, instr(k || ':', ':') - 1));
    `,
  },
];

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

const LEDGER_SQL = `
  CREATE TABLE IF NOT EXISTS bf_migrations (
    id TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  );
`;

/**
 * Split a migration into individual statements.
 *
 * D1 executes one statement per call, so a migration body with several
 * statements has to be split. This splitter understands single-quoted strings
 * and `--` comments, which is everything the migrations above use.
 */
export function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inString = false;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];

    if (inString) {
      current += char;
      if (char === "'") {
        if (sql[index + 1] === "'") {
          current += "'";
          index += 1;
        } else {
          inString = false;
        }
      }
      continue;
    }

    if (char === "'") {
      inString = true;
      current += char;
      continue;
    }

    if (char === '-' && sql[index + 1] === '-') {
      while (index < sql.length && sql[index] !== '\n') index += 1;
      current += '\n';
      continue;
    }

    if (char === ';') {
      const statement = current.trim();
      if (statement) statements.push(statement);
      current = '';
      continue;
    }

    current += char;
  }

  const tail = current.trim();
  if (tail) statements.push(tail);
  return statements;
}

async function runStatement(db: D1Like, statement: string): Promise<void> {
  await db.prepare(statement).run();
}

async function runScript(db: D1Like, sql: string): Promise<void> {
  if (typeof db.exec === 'function') {
    await db.exec(sql);
    return;
  }
  for (const statement of splitStatements(sql)) await runStatement(db, statement);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * DDL that a previous partial run may already have applied. Treating these as
 * success makes a migration resumable instead of permanently stuck; any other
 * error is rethrown so a real failure is never hidden.
 */
function isAlreadyApplied(message: string): boolean {
  return /already exists|duplicate column name/i.test(message);
}

/**
 * Apply every pending migration. Safe to call on every cold start: an
 * up-to-date database costs one ledger read and writes nothing.
 */
export async function applyMigrations(db: D1Like): Promise<MigrationResult> {
  await runScript(db, LEDGER_SQL);

  const existing = await db.prepare('SELECT id FROM bf_migrations').all<{ id: string }>();
  const done = new Set((existing.results ?? []).map((row) => row.id));

  const applied: string[] = [];
  const skipped: string[] = [];

  for (const migration of MIGRATIONS) {
    if (done.has(migration.id)) {
      skipped.push(migration.id);
      continue;
    }

    for (const statement of splitStatements(migration.sql)) {
      try {
        await runStatement(db, statement);
      } catch (error) {
        if (!isAlreadyApplied(errorMessage(error))) throw error;
      }
    }

    await db
      .prepare('INSERT OR IGNORE INTO bf_migrations (id, applied_at) VALUES (?, ?)')
      .bind(migration.id, new Date().toISOString())
      .run();
    applied.push(migration.id);
  }

  return { applied, skipped };
}

/** Which migrations this database has recorded, newest last. */
export async function appliedMigrations(db: D1Like): Promise<string[]> {
  const rows = await db.prepare('SELECT id FROM bf_migrations ORDER BY id').all<{ id: string }>();
  return (rows.results ?? []).map((row) => row.id);
}
