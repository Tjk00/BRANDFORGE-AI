import { beforeEach, describe, expect, it } from 'vitest';
import { routeApi } from '../shared/api';
import { MemoryKv, Repository } from '../shared/store';
import { hashPassword, verifyPassword } from '../shared/auth';
import { PALETTES } from '../shared/palettes';
import type { BrandProject } from '../shared/brand';

const PALETTE = PALETTES[0];
const PASSWORD = 'ForgePass123!';

let store: Repository;

beforeEach(() => {
  store = new Repository(new MemoryKv());
});

interface CallOptions {
  body?: unknown;
  cookie?: string;
}

async function call(method: string, path: string, options: CallOptions = {}) {
  return routeApi({
    method,
    path,
    body: options.body,
    headers: options.cookie ? { cookie: options.cookie } : {},
    env: {},
    store,
  });
}

function sessionCookie(response: { headers?: Record<string, string> }): string {
  const raw = response.headers?.['Set-Cookie'] ?? '';
  return raw.split(';')[0] ?? '';
}

async function register(email: string, name = 'Test Builder') {
  const response = await call('POST', '/api/auth/register', {
    body: { email, password: PASSWORD, name },
  });
  expect(response.status).toBe(200);
  const body = response.body as { user: { id: string; role: string; email: string } };
  return { cookie: sessionCookie(response), user: body.user };
}

function project(id: string, title: string): BrandProject {
  const now = new Date().toISOString();
  return {
    id,
    createdAt: now,
    updatedAt: now,
    workingTitle: title,
    chosenName: '',
    tagline: '',
    nicheId: null,
    keywords: [],
    paletteId: PALETTE.id,
    palette: PALETTE,
    logoStyle: 'wordmark',
    names: [],
    copy: null,
    handles: [],
    notes: '',
  };
}

describe('password storage', () => {
  it('verifies the correct password and rejects a wrong one', async () => {
    const record = await hashPassword(PASSWORD);
    expect(record.hash).toBeTruthy();
    expect(JSON.stringify(record)).not.toContain(PASSWORD);
    expect(await verifyPassword(PASSWORD, record)).toBe(true);
    expect(await verifyPassword('WrongPass123!', record)).toBe(false);
  });

  it('salts each record so identical passwords hash differently', async () => {
    const a = await hashPassword(PASSWORD);
    const b = await hashPassword(PASSWORD);
    expect(a.hash).not.toBe(b.hash);
  });
});

describe('accounts', () => {
  it('makes the first account an administrator and sets a session cookie', async () => {
    const first = await register('owner@example.com');
    expect(first.user.role).toBe('admin');
    expect(first.cookie.startsWith('bf_session=')).toBe(true);
  });

  it('rejects a duplicate email and a weak password', async () => {
    await register('dup@example.com');
    const duplicate = await call('POST', '/api/auth/register', {
      body: { email: 'dup@example.com', password: PASSWORD, name: 'Again' },
    });
    expect(duplicate.status).toBe(409);

    const weak = await call('POST', '/api/auth/register', {
      body: { email: 'weak@example.com', password: 'short', name: 'Weak' },
    });
    expect(weak.status).toBe(400);
  });

  it('resolves the session from the cookie and clears it on logout', async () => {
    const { cookie, user } = await register('session@example.com');

    const me = await call('GET', '/api/auth/me', { cookie });
    expect(me.status).toBe(200);
    expect((me.body as { user: { id: string } }).user.id).toBe(user.id);

    const out = await call('POST', '/api/auth/logout', { cookie });
    expect(out.status).toBe(200);

    const after = await call('GET', '/api/auth/me', { cookie });
    expect((after.body as { user: unknown }).user).toBeNull();
  });

  it('refuses project access without a session', async () => {
    const anonymous = await call('GET', '/api/projects');
    expect(anonymous.status).toBe(401);
  });

  it('never reveals whether an email exists when sign-in fails', async () => {
    await register('known@example.com');
    const unknown = await call('POST', '/api/auth/login', {
      body: { email: 'nobody@example.com', password: PASSWORD },
    });
    const wrong = await call('POST', '/api/auth/login', {
      body: { email: 'known@example.com', password: 'WrongPass123!' },
    });
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect((unknown.body as { error: string }).error).toBe((wrong.body as { error: string }).error);
  });
});

describe('project isolation', () => {
  it('shows each account only its own projects', async () => {
    const owner = await register('owner@example.com');
    const other = await register('other@example.com');

    const saved = await call('PUT', '/api/projects/bp_shared', {
      cookie: owner.cookie,
      body: { project: project('bp_shared', 'Owner brand') },
    });
    expect(saved.status).toBe(200);

    const ownList = await call('GET', '/api/projects', { cookie: owner.cookie });
    expect((ownList.body as { projects: BrandProject[] }).projects).toHaveLength(1);

    const otherList = await call('GET', '/api/projects', { cookie: other.cookie });
    expect((otherList.body as { projects: BrandProject[] }).projects).toHaveLength(0);

    const read = await call('GET', '/api/projects/bp_shared', { cookie: other.cookie });
    expect(read.status).toBe(404);

    const remove = await call('DELETE', '/api/projects/bp_shared', { cookie: other.cookie });
    expect(remove.status).toBe(404);

    // The owner's copy is untouched by the failed attempts.
    const stillThere = await call('GET', '/api/projects/bp_shared', { cookie: owner.cookie });
    expect(stillThere.status).toBe(200);
  });

  it('refuses to overwrite another account\'s project', async () => {
    const owner = await register('owner@example.com');
    const other = await register('other@example.com');

    await call('PUT', '/api/projects/bp_guard', {
      cookie: owner.cookie,
      body: { project: project('bp_guard', 'Owner brand') },
    });

    const hijack = await call('PUT', '/api/projects/bp_guard', {
      cookie: other.cookie,
      body: { project: project('bp_guard', 'Hijacked') },
    });
    expect(hijack.status).toBe(403);
  });

  it('enforces the free plan project limit', async () => {
    const { cookie } = await register('limit@example.com');
    for (let index = 0; index < 3; index += 1) {
      const saved = await call('PUT', `/api/projects/bp_${index}`, {
        cookie,
        body: { project: project(`bp_${index}`, `Brand ${index}`) },
      });
      expect(saved.status).toBe(200);
    }

    const overflow = await call('PUT', '/api/projects/bp_3', {
      cookie,
      body: { project: project('bp_3', 'Brand 3') },
    });
    expect(overflow.status).toBe(402);
  });
});

describe('administration', () => {
  it('blocks normal accounts from admin routes', async () => {
    await register('owner@example.com');
    const member = await register('member@example.com');

    const forbidden = await call('GET', '/api/admin/overview', { cookie: member.cookie });
    expect(forbidden.status).toBe(403);

    const anonymous = await call('GET', '/api/admin/overview');
    expect(anonymous.status).toBe(401);
  });

  it('lets an administrator read statistics and change a plan', async () => {
    const admin = await register('owner@example.com');
    const member = await register('member@example.com');

    const overview = await call('GET', '/api/admin/overview', { cookie: admin.cookie });
    expect(overview.status).toBe(200);
    expect((overview.body as { users: number }).users).toBe(2);

    const promoted = await call('PATCH', `/api/admin/users/${member.user.id}`, {
      cookie: admin.cookie,
      body: { plan: 'pro' },
    });
    expect(promoted.status).toBe(200);
    expect((promoted.body as { user: { plan: string } }).user.plan).toBe('pro');

    // The higher plan raises the limit for that account immediately.
    const me = await call('GET', '/api/auth/me', { cookie: member.cookie });
    expect((me.body as { projectLimit: number }).projectLimit).toBeGreaterThan(3);
  });

  it('never exposes a stored provider key to the browser', async () => {
    const admin = await register('owner@example.com');
    await call('PUT', '/api/admin/providers', {
      cookie: admin.cookie,
      body: { apiKey: 'sk-secret-value', enabled: true, model: 'test-model' },
    });

    const read = await call('GET', '/api/admin/providers', { cookie: admin.cookie });
    expect(read.status).toBe(200);
    const serialized = JSON.stringify(read.body);
    expect(serialized).not.toContain('sk-secret-value');
    expect((read.body as { providers: { hasKey: boolean } }).providers.hasKey).toBe(true);
  });

  it('keeps billing inactive until a payment provider is configured', async () => {
    const { cookie } = await register('owner@example.com');
    const checkout = await call('POST', '/api/billing/checkout', { cookie, body: { plan: 'pro' } });
    expect(checkout.status).toBe(501);

    const plans = await call('GET', '/api/billing/plans');
    expect((plans.body as { billingEnabled: boolean }).billingEnabled).toBe(false);
  });
});
