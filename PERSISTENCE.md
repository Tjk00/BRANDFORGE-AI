# Persistence, migrations and backups

This document describes how BRANDFORGE AI stores accounts, brands and generated
assets, and how that data survives logging out, refreshing and redeploying.

## Storage drivers

`shared/bootstrap.ts` picks one driver at startup, in this order:

| Host | Driver | Durable across redeploys? |
| --- | --- | --- |
| Cloudflare Pages / Workers with a D1 binding | Cloudflare D1 (native binding) | Yes |
| Node host (AppJet, VPS, Docker) with D1 credentials | Cloudflare D1 over the HTTPS API (`server/d1-http.ts`) | Yes |
| Anything else / local dev | JSON file on disk (`bootstrapFile`) | No — development only |

D1 is SQLite, so every schema, migration and query in this repository is plain
SQL and runs identically on Cloudflare and on a Node server.

The chosen driver and whether it is durable is reported by `GET /api/health`
under `storage`. That endpoint never claims persistence it does not have.

### Enabling D1 on a Node host (AppJet, Docker, VPS)

Create a free D1 database, then set three environment variables:

```bash
D1_ACCOUNT_ID=...          # Cloudflare account id
D1_DATABASE_ID=...         # id printed by `wrangler d1 create`
CLOUDFLARE_API_TOKEN=...   # token with the D1:Edit permission
# optional, for tests or a proxy:
# D1_API_BASE_URL=https://api.cloudflare.com/client/v4
```

Create the database and apply the schema:

```bash
npx wrangler d1 create brandforge-ai
npx wrangler d1 execute brandforge-ai --remote --file=./schema.sql
```

Keep `CLOUDFLARE_API_TOKEN` server-side only. It is never sent to the browser.

### Enabling D1 on Cloudflare Pages / Workers

Uncomment the `[[d1_databases]]` block in `wrangler.toml` and paste the printed
`database_id`. The binding name must stay `BF_KV`.

## Migrations

`shared/migrations.ts` holds an ordered, append-only list of migrations plus a
ledger table so each one runs exactly once per database.

- Migrations run inside a transaction on startup, before the API accepts work.
- Already-applied migrations are skipped by id, so restarts are safe.
- Statements are split and executed individually; a failure rolls back and the
  error is logged with the failing statement, rather than leaving a half-built
  schema.

### Schema

| Table | Purpose |
| --- | --- |
| `bf_kv` | Key/value documents: users, sessions, settings, admin config |
| `bf_projects` | One row per brand project, `PRIMARY KEY (owner, id)` |
| `bf_migrations` | Applied-migration ledger |

Indexes:

| Index | Serves |
| --- | --- |
| `bf_projects_owner_updated` | A user's dashboard list, newest first |
| `bf_projects_id` | Direct project lookup |
| `bf_projects_updated` | Admin statistics and cleanup |

### Migrating existing JSON data

Projects previously stored as JSON documents are imported by the migration
using `json_extract`, with `INSERT OR IGNORE`. This means:

- Existing rows are never overwritten or deleted.
- Re-running the migration cannot duplicate a project.
- A project that already exists in SQL keeps its SQL copy.

## Account isolation

Every project query is scoped by `owner`. Reading, updating or deleting another
account's brand returns `404`, so the API does not reveal that the id exists.
This is enforced in `shared/store.ts` and covered by tests in
`tests/persistence.test.ts`.

## Backup and restore

```bash
npm run store:export -- --out backup.json    # dump every table to JSON
npm run store:verify -- backup.json          # validate a backup without importing
npm run store:import -- backup.json          # restore; skips existing rows
```

The backup format is a versioned JSON document containing users, projects,
settings and migration state. `verify` checks structure and reports counts, so
you can confirm a backup is complete before you need it. `import` never
destroys rows that already exist.

## What the tests actually prove

`tests/persistence.test.ts` runs the production SQL against a real SQLite
engine (Cloudflare D1 is SQLite), and simulates a redeploy by dumping the
database and reopening it in a fresh driver:

- a brand and all six stage outputs survive logout, login and a redeploy
- the dashboard list is still populated after a redeploy
- migrations are idempotent and the ledger records them
- legacy JSON records are imported once, without overwriting SQL rows
- one account cannot read, claim or delete another account's brand
- backup → wipe → restore returns the same data
- a database outage returns `503` instead of pretending accounts work, and the
  app recovers when the database comes back

## Honest limits

- A Node host without D1 credentials falls back to a file inside the container.
  That file survives restarts but **not** a rebuilt image, and AppJet's Free
  plan does not include persistent disks. Set the three D1 variables above for
  data that must survive redeploys.
- D1's free tier has real quotas (rows read/written, storage). Check Cloudflare's
  current limits before importing a large backup.
- Backups are plain JSON containing account records. Store them privately.
