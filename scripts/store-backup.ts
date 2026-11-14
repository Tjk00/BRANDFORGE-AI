/**
 * Store backup, restore and verification from the command line.
 *
 * Works against whichever store the environment selects, so the same commands
 * cover local development (JSON file) and production (Cloudflare D1):
 *
 *   npx tsx scripts/store-backup.ts export [--out backups/store-2026-01-01.json]
 *   npx tsx scripts/store-backup.ts verify [backup.json]
 *   npx tsx scripts/store-backup.ts import backup.json [--apply] [--overwrite]
 *
 * `import` is a dry run unless `--apply` is passed, and never deletes a record.
 * `--overwrite` is required to replace an existing record with the backup copy.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { exportStore, importStore, parseBackup, summarizeStore } from '../shared/backup';
import { D1Kv, type KvDriver } from '../shared/store';
import { d1FromEnv } from '../server/d1-http';
import { FileKv } from '../server/file-store';

function resolveDriver(): { kv: KvDriver; label: string } {
  const d1 = d1FromEnv(process.env as Record<string, string | undefined>);

  if (d1.kind === 'configured') {
    return { kv: new D1Kv(d1.db), label: `d1:${d1.databaseId}` };
  }
  if (d1.kind === 'incomplete') {
    throw new Error(`Cloudflare D1 is partially configured; missing ${d1.missing.join(', ')}.`);
  }

  const dir = process.env.BRANDFORGE_DATA_DIR ?? path.join(process.cwd(), 'data');
  const file = path.join(dir, 'store.json');
  return { kv: new FileKv(file), label: `file:${file}` };
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function valueOf(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function positional(): string | undefined {
  return process.argv.slice(2).find((arg) => !arg.startsWith('--') && arg !== valueOf('out'));
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'export';
  const { kv, label } = resolveDriver();

  if (command === 'export') {
    const backup = await exportStore(kv);
    const out =
      valueOf('out') ??
      path.join(process.cwd(), 'backups', `store-${backup.exportedAt.replace(/[:.]/g, '-')}.json`);

    mkdirSync(path.dirname(out), { recursive: true });
    writeFileSync(out, `${JSON.stringify(backup, null, 2)}\n`, 'utf8');
    console.log(
      JSON.stringify({ ok: true, source: label, out, counts: backup.counts, exportedAt: backup.exportedAt }, null, 2),
    );
    return;
  }

  if (command === 'verify') {
    const summary = await summarizeStore(kv);
    console.log(JSON.stringify({ ok: true, source: label, summary }, null, 2));

    const file = positional();
    if (file) {
      const backup = parseBackup(JSON.parse(readFileSync(file, 'utf8')));
      console.log(JSON.stringify({ ok: true, backup: file, counts: backup.counts }, null, 2));
    }
    return;
  }

  if (command === 'import') {
    const file = positional();
    if (!file) throw new Error('Usage: store-backup.ts import <backup.json> [--apply] [--overwrite]');

    const backup = parseBackup(JSON.parse(readFileSync(file, 'utf8')));
    const apply = flag('apply');
    const overwrite = flag('overwrite');

    if (!apply) {
      const preview = await importStore(kv, backup, { apply: false, overwrite });
      console.log(
        JSON.stringify(
          { ok: true, dryRun: true, target: label, preview, hint: 'Re-run with --apply to write these changes.' },
          null,
          2,
        ),
      );
      return;
    }

    const result = await importStore(kv, backup, { apply: true, overwrite });
    const summary = await summarizeStore(kv);
    console.log(JSON.stringify({ ok: true, dryRun: false, target: label, result, summary }, null, 2));
    return;
  }

  throw new Error(`Unknown command "${command}". Use export, verify or import.`);
}

main().catch((error: unknown) => {
  console.error(
    JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2),
  );
  process.exit(1);
});
