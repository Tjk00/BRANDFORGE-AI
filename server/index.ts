import express from 'express';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { routeApi } from '../shared/api';
import { logEvent } from '../shared/logger';
import { bootstrapD1, bootstrapFile, lazyBootstrap, type StoreBootstrap } from '../shared/bootstrap';
import { d1FromEnv } from './d1-http';
import { FileKv } from './file-store';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const distDir = existsSync(path.join(projectRoot, 'dist')) ? path.join(projectRoot, 'dist') : path.join(here, '..', 'dist');

/*
 * Storage selection, in priority order:
 *   1. Cloudflare D1 over HTTPS when D1_ACCOUNT_ID/D1_DATABASE_ID/CLOUDFLARE_API_TOKEN
 *      are present — the only mode that survives a redeploy.
 *   2. A partially configured D1 fails closed with a visible reason instead of
 *      silently falling back to throwaway storage.
 *   3. The local JSON file, which keeps `npm run dev` and offline work intact.
 * Migrations run once on the first request, before any account route is served.
 */
const dataDir = process.env.BRANDFORGE_DATA_DIR ?? path.join(projectRoot, 'data');
const d1 = d1FromEnv(process.env as Record<string, string | undefined>);

const storageReady: () => Promise<StoreBootstrap> =
  d1.kind === 'configured'
    ? lazyBootstrap(() => bootstrapD1(d1.db))
    : d1.kind === 'incomplete'
      ? async () => ({
          storage: {
            mode: 'd1',
            durable: true,
            error: `Cloudflare D1 is partially configured; missing ${d1.missing.join(', ')}.`,
          },
        })
      : lazyBootstrap(async () => bootstrapFile(new FileKv(path.join(dataDir, 'store.json'))));

const app = express();
app.disable('x-powered-by');
// AppJet and most hosts terminate TLS in front of the app, so trust one proxy hop
// to obtain the real client address used by the shared rate limiter.
app.set('trust proxy', 1);
app.use(express.json({ limit: '512kb' }));

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// Rate limiting lives in the shared router (shared/rate-limit.ts) so Node,
// Cloudflare Pages and the Worker enforce identical budgets.
app.use((req, res, next) => {
  const incoming = req.get('x-request-id');
  const requestId = incoming && incoming.length <= 64 ? incoming : randomUUID();
  res.setHeader('x-request-id', requestId);
  (req as express.Request & { requestId?: string }).requestId = requestId;
  next();
});

app.all('/api/*splat', async (req, res) => {
  try {
    const { repository, storage } = await storageReady();
    const response = await routeApi({
      method: req.method,
      path: req.path,
      body: req.body,
      headers: req.headers as Record<string, string | undefined>,
      env: process.env as Record<string, string | undefined>,
      store: repository,
      storage,
      clientIp: req.ip,
      requestId: (req as express.Request & { requestId?: string }).requestId,
    });
    if (response.headers) res.set(response.headers);
    res.status(response.status).json(response.body);
  } catch (err) {
    logEvent('error', 'server.api_unhandled', {
      path: req.path,
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ error: 'The server could not complete that request.' });
  }
});

app.use(express.static(distDir, { maxAge: '1h', index: false }));

app.use((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const indexPath = path.join(distDir, 'index.html');
  if (existsSync(indexPath)) {
    res.sendFile(indexPath);
    return;
  }
  res
    .status(503)
    .type('text/plain')
    .send('The client bundle is missing. Run "npm run build" before starting the server.');
});

// Malformed JSON and any other framework-level error still answer with JSON.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const parseFailure =
    err instanceof SyntaxError || (err as { type?: string } | null)?.type === 'entity.parse.failed';
  if (parseFailure) {
    res.status(400).json({ error: 'The request body was not valid JSON.' });
    return;
  }
  logEvent('error', 'server.unhandled', { error: err instanceof Error ? err.message : String(err) });
  res.status(500).json({ error: 'The server could not complete that request.' });
});

const port = Number(process.env.PORT ?? 8787);
app.listen(port, '0.0.0.0', async () => {
  const { storage } = await storageReady();
  logEvent(storage.error ? 'error' : 'info', 'server.started', {
    port,
    distDir,
    storage: storage.mode,
    durable: storage.durable,
    ...(storage.error ? { storageError: storage.error } : {}),
    ...(storage.durable ? {} : { warning: 'Accounts are lost on redeploy without D1 or a persistent disk.' }),
  });
});
