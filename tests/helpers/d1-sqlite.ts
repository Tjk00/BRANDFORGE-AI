/**
 * A real SQLite engine behind the D1 interface, for tests.
 *
 * Cloudflare D1 is SQLite, so running the production schema and queries against
 * SQLite in-process proves the SQL itself (constraints, indexes, json_extract,
 * upserts) rather than a hand-written mock that would happily accept broken SQL.
 * The adapter implements only the `D1Like` surface the app uses.
 */

import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import type { D1Like, D1StatementLike } from '../../shared/store';

export interface SqliteD1 extends D1Like {
  raw: Database;
  /** Snapshot bytes, to prove data survives a "restart" of the driver. */
  dump(): Uint8Array;
  close(): void;
}

class SqliteStatement implements D1StatementLike {
  constructor(
    private readonly db: Database,
    private readonly sql: string,
    private readonly params: unknown[] = [],
  ) {}

  bind(...values: unknown[]): D1StatementLike {
    return new SqliteStatement(this.db, this.sql, values);
  }

  async first<T = unknown>(): Promise<T | null> {
    const rows = this.select<T>();
    return rows[0] ?? null;
  }

  async all<T = unknown>(): Promise<{ results?: T[] }> {
    return { results: this.select<T>() };
  }

  async run(): Promise<unknown> {
    this.select<unknown>();
    return { success: true };
  }

  private select<T>(): T[] {
    const statement = this.db.prepare(this.sql);
    try {
      if (this.params.length > 0) statement.bind(this.params as never);
      const rows: T[] = [];
      while (statement.step()) rows.push(statement.getAsObject() as T);
      return rows;
    } finally {
      statement.free();
    }
  }
}

let sqlPromise: Promise<SqlJsStatic> | null = null;

function loadSql(): Promise<SqlJsStatic> {
  if (!sqlPromise) sqlPromise = initSqlJs();
  return sqlPromise;
}

/** An empty in-memory database with the D1 interface. */
export async function createSqliteD1(): Promise<SqliteD1> {
  const SQL = await loadSql();
  const db = new SQL.Database();

  return {
    raw: db,
    prepare(query: string): D1StatementLike {
      return new SqliteStatement(db, query);
    },
    async exec(query: string): Promise<unknown> {
      db.exec(query);
      return { success: true };
    },
    dump(): Uint8Array {
      return db.export();
    },
    close(): void {
      db.close();
    },
  };
}

/** Reopen a dumped database, simulating a fresh process against the same file. */
export async function reopenSqliteD1(bytes: Uint8Array): Promise<SqliteD1> {
  const SQL = await loadSql();
  const db = new SQL.Database(bytes);

  return {
    raw: db,
    prepare(query: string): D1StatementLike {
      return new SqliteStatement(db, query);
    },
    async exec(query: string): Promise<unknown> {
      db.exec(query);
      return { success: true };
    },
    dump(): Uint8Array {
      return db.export();
    },
    close(): void {
      db.close();
    },
  };
}

/** A driver whose every call fails, to exercise outage handling. */
export function createFailingD1(message = 'database is unreachable'): D1Like {
  const failure = (): never => {
    throw new Error(message);
  };
  return {
    prepare(): D1StatementLike {
      return {
        bind: () => failure(),
        first: async () => failure(),
        all: async () => failure(),
        run: async () => failure(),
      };
    },
    exec: async () => failure(),
  };
}
