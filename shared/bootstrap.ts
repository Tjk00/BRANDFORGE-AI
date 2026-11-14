/**
 * Per-host storage bootstrap.
 *
 * Every host (Node, Workers, Pages Functions) calls one of these helpers. Each
 * returns the repository plus a description of where data actually lives, and
 * never throws: if the database cannot be reached the repository is omitted, so
 * account routes answer 503 with a real reason instead of silently writing to
 * throwaway storage.
 */

import { applyMigrations } from './migrations';
import { D1Kv, Repository, type D1Like, type KvDriver, type StorageInfo } from './store';

export interface StoreBootstrap {
  repository?: Repository;
  storage: StorageInfo;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** D1 (binding or HTTPS): migrate, then serve. */
export async function bootstrapD1(db: D1Like): Promise<StoreBootstrap> {
  try {
    const result = await applyMigrations(db);
    return {
      repository: new Repository(new D1Kv(db)),
      storage: {
        mode: 'd1',
        durable: true,
        migrationsApplied: result.applied.length,
        migrationsPending: 0,
      },
    };
  } catch (error) {
    return {
      storage: { mode: 'd1', durable: true, error: describeError(error) },
    };
  }
}

/** Node file store: durable only while the container lives. */
export function bootstrapFile(kv: KvDriver): StoreBootstrap {
  return { repository: new Repository(kv), storage: { mode: 'file', durable: false } };
}

/**
 * Single-flight cache so a cold start migrates once, not once per request.
 * A failed attempt is not cached, so the next request retries after the
 * database becomes reachable.
 */
export function lazyBootstrap(factory: () => Promise<StoreBootstrap>): () => Promise<StoreBootstrap> {
  let pending: Promise<StoreBootstrap> | null = null;

  return async () => {
    if (!pending) {
      pending = factory().then((result) => {
        if (result.storage.error) pending = null;
        return result;
      });
    }
    return pending;
  };
}
