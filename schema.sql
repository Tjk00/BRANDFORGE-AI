-- BRANDFORGE AI — Cloudflare D1 schema
--
-- Create the database (free tier), then apply this file:
--   npx wrangler d1 create brandforge-ai
--   npx wrangler d1 execute brandforge-ai --remote --file=./schema.sql
--
-- Copy the printed database_id into wrangler.toml (Pages) and/or
-- workers/wrangler.toml (standalone Worker) under [[d1_databases]].
--
-- One table is all the repository needs: every record (user, session, project,
-- activity entry, provider config) is stored under its own key.

CREATE TABLE IF NOT EXISTS bf_kv (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS bf_kv_prefix ON bf_kv (k);
