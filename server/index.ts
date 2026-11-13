import express from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { routeApi } from '../shared/api';
import { Repository } from '../shared/store';
import { FileKv } from './file-store';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const distDir = existsSync(path.join(projectRoot, 'dist')) ? path.join(projectRoot, 'dist') : path.join(here, '..', 'dist');

// Accounts persist to disk on this host. Cloudflare deployments use D1 instead.
const dataDir = process.env.BRANDFORGE_DATA_DIR ?? path.join(projectRoot, 'data');
const repository = new Repository(new FileKv(path.join(dataDir, 'store.json')));

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '512kb' }));

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

// Simple per-IP throttle so the availability endpoint is not used as a proxy for bulk scraping.
const buckets = new Map<string, { tokens: number; updated: number }>();
const CAPACITY = 40;
const REFILL_PER_SECOND = 0.5;

function allowRequest(ip: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(ip) ?? { tokens: CAPACITY, updated: now };
  const elapsed = (now - bucket.updated) / 1000;
  bucket.tokens = Math.min(CAPACITY, bucket.tokens + elapsed * REFILL_PER_SECOND);
  bucket.updated = now;
  if (bucket.tokens < 1) {
    buckets.set(ip, bucket);
    return false;
  }
  bucket.tokens -= 1;
  buckets.set(ip, bucket);
  return true;
}

app.use('/api', (req, res, next) => {
  if (req.path === '/health') return next();
  if (!allowRequest(req.ip ?? 'unknown')) {
    res.status(429).json({ error: 'Too many requests. Wait a moment and try again.' });
    return;
  }
  return next();
});

app.all('/api/*splat', async (req, res) => {
  try {
    const response = await routeApi({
      method: req.method,
      path: req.path,
      body: req.body,
      headers: req.headers as Record<string, string | undefined>,
      env: process.env as Record<string, string | undefined>,
      store: repository,
    });
    if (response.headers) res.set(response.headers);
    res.status(response.status).json(response.body);
  } catch (err) {
    console.error('[api] unhandled error', err instanceof Error ? err.message : err);
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

const port = Number(process.env.PORT ?? 8787);
app.listen(port, '0.0.0.0', () => {
  console.log(`BRANDFORGE AI API listening on http://0.0.0.0:${port}`);
  console.log(`Serving client from ${distDir}`);
});
