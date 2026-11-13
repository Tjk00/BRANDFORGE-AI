/**
 * Account, project, admin and billing routes.
 *
 * Mounted inside the single shared router (shared/api.ts) so the Express server,
 * Cloudflare Pages Functions and the Worker all expose identical behaviour.
 * Sessions are HttpOnly cookies; every project route is scoped to the caller.
 */

import {
  buildClearedSessionCookie,
  buildSessionCookie,
  emailProblem,
  hashPassword,
  isSecureRequest,
  normalizeEmail,
  normalizeName,
  passwordProblem,
  randomToken,
  sessionTokenFrom,
  sha256Hex,
  verifyPassword,
} from './auth';
import { getPlan, isPlanId, planList } from './plans';
import {
  AppError,
  publicProviders,
  publicUser,
  SESSION_TTL_MS,
  type ProviderConfig,
  type Repository,
  type UserRecord,
} from './store';
import type { ApiResponse } from './api';
import type { BrandProject } from './brand';

export interface AccountContext {
  method: string;
  path: string;
  payload: Record<string, unknown>;
  env: Record<string, string | undefined>;
  headers: Record<string, string | undefined>;
  store: Repository;
}

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };
const STARTED_AT = Date.now();

function ok(body: unknown, headers: Record<string, string> = {}): ApiResponse {
  return { status: 200, body, headers: { ...JSON_HEADERS, ...headers } };
}

function fail(status: number, error: string, detail?: string, headers: Record<string, string> = {}): ApiResponse {
  return { status, body: { error, detail }, headers: { ...JSON_HEADERS, ...headers } };
}

/* ------------------------------------------------------------- rate limiting */

const attempts = new Map<string, { count: number; resetAt: number }>();
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const ATTEMPT_LIMIT = 8;

function throttleKey(ctx: AccountContext, email: string): string {
  const ip =
    ctx.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    ctx.headers['cf-connecting-ip'] ||
    ctx.headers['x-real-ip'] ||
    'unknown';
  return `${ip}|${email}`;
}

function tooManyAttempts(key: string): boolean {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) {
    attempts.delete(key);
    return false;
  }
  return entry.count >= ATTEMPT_LIMIT;
}

function recordAttempt(key: string): void {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + ATTEMPT_WINDOW_MS });
    return;
  }
  entry.count += 1;
}

/* ------------------------------------------------------------------ sessions */

function splitToken(token: string): { userId: string; secret: string } | null {
  const index = token.indexOf('~');
  if (index < 3) return null;
  const userId = token.slice(0, index);
  const secret = token.slice(index + 1);
  if (!userId.startsWith('u_') || secret.length < 16) return null;
  return { userId, secret };
}

async function issueSession(
  ctx: AccountContext,
  user: UserRecord,
): Promise<{ token: string; cookie: string }> {
  const secret = randomToken(32);
  const token = `${user.id}~${secret}`;
  const hash = await sha256Hex(secret);
  await ctx.store.createSession(user.id, hash);
  const cookie = buildSessionCookie(token, Math.floor(SESSION_TTL_MS / 1000), isSecureRequest(ctx.headers));
  return { token, cookie };
}

async function currentUser(ctx: AccountContext): Promise<UserRecord | null> {
  const token = sessionTokenFrom(ctx.headers);
  if (!token) return null;
  const parts = splitToken(token);
  if (!parts) return null;
  const hash = await sha256Hex(parts.secret);
  return ctx.store.resolveSession(parts.userId, hash);
}

async function requireUser(ctx: AccountContext): Promise<UserRecord> {
  const user = await currentUser(ctx);
  if (!user) throw new AppError(401, 'Sign in to continue.');
  return user;
}

async function requireAdmin(ctx: AccountContext): Promise<UserRecord> {
  const user = await requireUser(ctx);
  if (user.role !== 'admin') throw new AppError(403, 'Administrator access is required.');
  return user;
}

/* ------------------------------------------------------------------- helpers */

function asProject(value: unknown): BrandProject | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as BrandProject;
  if (typeof candidate.id !== 'string' || !candidate.id.trim()) return null;
  return candidate;
}

function cleanProject(project: BrandProject): BrandProject {
  return {
    ...project,
    id: project.id.slice(0, 120),
    updatedAt: new Date().toISOString(),
  };
}

/* -------------------------------------------------------------------- router */

export async function routeAccounts(ctx: AccountContext): Promise<ApiResponse | null> {
  const path = ctx.path.replace(/\/+$/, '') || '/';
  const method = ctx.method;
  const { store, payload, env } = ctx;

  /* ---------------------------------------------------------------- register */

  if (path === '/api/auth/register' && method === 'POST') {
    const email = normalizeEmail(payload.email);
    const name = normalizeName(payload.name, email.split('@')[0] ?? 'Brand builder');
    const password = payload.password;
    const key = throttleKey(ctx, email || 'unknown');
    if (tooManyAttempts(key)) {
      return fail(429, 'Too many attempts. Wait a few minutes and try again.');
    }

    const emailIssue = emailProblem(email);
    if (emailIssue) return fail(400, emailIssue);
    const passwordIssue = passwordProblem(password);
    if (passwordIssue) return fail(400, passwordIssue);

    recordAttempt(key);

    try {
      const isFirstUser = (await store.countUsers()) === 0;
      const adminEmail = normalizeEmail(env.ADMIN_EMAIL);
      const role = isFirstUser || (adminEmail && adminEmail === email) ? 'admin' : 'user';
      const user = await store.createUser({
        email,
        name,
        password: await hashPassword(String(password)),
        role,
      });
      const { cookie } = await issueSession(ctx, user);
      await store.logActivity({ userId: user.id, email: user.email, action: 'account.created', detail: role });
      return ok({ user: publicUser(user), plans: planList() }, { 'Set-Cookie': cookie });
    } catch (error) {
      if (error instanceof AppError) return fail(error.status, error.message);
      throw error;
    }
  }

  /* ------------------------------------------------------------------- login */

  if (path === '/api/auth/login' && method === 'POST') {
    const email = normalizeEmail(payload.email);
    const password = typeof payload.password === 'string' ? payload.password : '';
    const key = throttleKey(ctx, email || 'unknown');
    if (tooManyAttempts(key)) {
      return fail(429, 'Too many sign-in attempts. Wait a few minutes and try again.');
    }
    recordAttempt(key);

    const user = email ? await store.findUserByEmail(email) : null;
    const valid = user ? await verifyPassword(password, user.password) : false;
    if (!user || !valid) {
      // Same message for unknown email and wrong password: no account enumeration.
      return fail(401, 'Email or password is incorrect.');
    }
    const updated = await store.updateUser(user.id, { lastLoginAt: new Date().toISOString() });
    const { cookie } = await issueSession(ctx, updated);
    await store.logActivity({ userId: user.id, email: user.email, action: 'account.login' });
    return ok({ user: publicUser(updated), plans: planList() }, { 'Set-Cookie': cookie });
  }

  /* ------------------------------------------------------------------ logout */

  if (path === '/api/auth/logout' && method === 'POST') {
    const token = sessionTokenFrom(ctx.headers);
    if (token) {
      const parts = splitToken(token);
      if (parts) await store.deleteSession(parts.userId, await sha256Hex(parts.secret));
    }
    return ok({ ok: true }, { 'Set-Cookie': buildClearedSessionCookie(isSecureRequest(ctx.headers)) });
  }

  /* ---------------------------------------------------------------------- me */

  if (path === '/api/auth/me' && method === 'GET') {
    const user = await currentUser(ctx);
    return ok({
      user: user ? publicUser(user) : null,
      plans: planList(),
      projectLimit: user ? getPlan(user.plan).projectLimit : getPlan('free').projectLimit,
    });
  }

  if (path === '/api/auth/profile' && method === 'PATCH') {
    const user = await requireUser(ctx);
    const name = normalizeName(payload.name, user.name);
    const updated = await store.updateUser(user.id, { name });
    return ok({ user: publicUser(updated) });
  }

  /* ----------------------------------------------------------------- projects */

  if (path === '/api/projects' && method === 'GET') {
    const user = await requireUser(ctx);
    const projects = await store.listProjects(user.id);
    const plan = getPlan(user.plan);
    return ok({ projects, limit: plan.projectLimit, plan: plan.id });
  }

  if (path === '/api/projects/import' && method === 'POST') {
    const user = await requireUser(ctx);
    const incoming = Array.isArray(payload.projects) ? payload.projects : [];
    const plan = getPlan(user.plan);
    const existing = await store.listProjects(user.id);
    const ids = new Set(existing.map((project) => project.id));
    let saved = 0;
    let skipped = 0;

    for (const item of incoming) {
      const project = asProject(item);
      if (!project || ids.has(project.id)) {
        skipped += 1;
        continue;
      }
      if (ids.size >= plan.projectLimit) {
        skipped += 1;
        continue;
      }
      await store.saveProject(user.id, cleanProject(project));
      ids.add(project.id);
      saved += 1;
    }

    await store.logActivity({
      userId: user.id,
      email: user.email,
      action: 'projects.imported',
      detail: `${saved} imported, ${skipped} skipped`,
    });
    return ok({ saved, skipped, projects: await store.listProjects(user.id) });
  }

  const projectMatch = path.match(/^\/api\/projects\/([^/]+)$/);
  if (projectMatch) {
    const user = await requireUser(ctx);
    const projectId = decodeURIComponent(projectMatch[1]);

    if (method === 'GET') {
      const project = await store.getProject(user.id, projectId);
      if (!project) return fail(404, 'Project not found.');
      return ok({ project });
    }

    if (method === 'PUT' || method === 'POST') {
      const incoming = asProject(payload.project ?? payload);
      if (!incoming) return fail(400, 'That project payload is not valid.');
      if (incoming.id !== projectId) return fail(400, 'Project id does not match the request path.');
      try {
        const saved = await store.saveProject(user.id, cleanProject(incoming));
        return ok({ project: saved });
      } catch (error) {
        if (error instanceof AppError) return fail(error.status, error.message);
        throw error;
      }
    }

    if (method === 'DELETE') {
      const removed = await store.deleteProject(user.id, projectId);
      if (!removed) return fail(404, 'Project not found.');
      await store.logActivity({ userId: user.id, email: user.email, action: 'project.deleted', detail: projectId });
      return ok({ ok: true });
    }
  }

  /* -------------------------------------------------------------------- admin */

  if (path === '/api/admin/overview' && method === 'GET') {
    await requireAdmin(ctx);
    const users = await store.listUsers();
    const providers = await store.getProviders();
    const byPlan = { free: 0, pro: 0, business: 0 };
    for (const user of users) byPlan[user.plan] += 1;
    return ok({
      users: users.length,
      admins: users.filter((user) => user.role === 'admin').length,
      projects: await store.allProjectsCount(),
      byPlan,
      providers: publicProviders(providers),
      aiFromEnvironment: Boolean(env.AI_API_KEY),
      uptimeSeconds: Math.round((Date.now() - STARTED_AT) / 1000),
      runtime: typeof (globalThis as { process?: unknown }).process === 'undefined' ? 'edge' : 'node',
      recentUsers: users.slice(0, 6),
      activity: await store.listActivity(20),
      plans: planList(),
    });
  }

  if (path === '/api/admin/users' && method === 'GET') {
    await requireAdmin(ctx);
    return ok({ users: await store.listUsers() });
  }

  const userMatch = path.match(/^\/api\/admin\/users\/([^/]+)$/);
  if (userMatch) {
    const admin = await requireAdmin(ctx);
    const targetId = decodeURIComponent(userMatch[1]);

    if (method === 'PATCH') {
      if (targetId === admin.id && payload.role && payload.role !== 'admin') {
        return fail(400, 'You cannot remove your own administrator access.');
      }
      const patch: { role?: 'user' | 'admin'; plan?: ProviderConfig extends never ? never : ReturnType<typeof getPlan>['id'] } = {};
      if (payload.role === 'admin' || payload.role === 'user') patch.role = payload.role;
      if (isPlanId(payload.plan)) patch.plan = payload.plan;
      try {
        const updated = await store.updateUser(targetId, patch);
        await store.logActivity({
          userId: admin.id,
          email: admin.email,
          action: 'admin.user_updated',
          detail: `${updated.email} → ${updated.role}/${updated.plan}`,
        });
        return ok({ user: publicUser(updated) });
      } catch (error) {
        if (error instanceof AppError) return fail(error.status, error.message);
        throw error;
      }
    }

    if (method === 'DELETE') {
      if (targetId === admin.id) return fail(400, 'You cannot delete your own account.');
      const target = await store.getUser(targetId);
      if (!target) return fail(404, 'Account not found.');
      await store.deleteUser(targetId);
      await store.logActivity({
        userId: admin.id,
        email: admin.email,
        action: 'admin.user_deleted',
        detail: target.email,
      });
      return ok({ ok: true });
    }
  }

  if (path === '/api/admin/providers') {
    await requireAdmin(ctx);
    if (method === 'GET') {
      return ok({ providers: publicProviders(await store.getProviders()) });
    }
    if (method === 'PUT') {
      const patch: Partial<ProviderConfig> = {};
      if (typeof payload.baseUrl === 'string') patch.baseUrl = payload.baseUrl;
      if (typeof payload.model === 'string') patch.model = payload.model;
      if (typeof payload.enabled === 'boolean') patch.enabled = payload.enabled;
      if (typeof payload.apiKey === 'string' && payload.apiKey.trim()) patch.apiKey = payload.apiKey;
      if (payload.clearKey === true) patch.apiKey = '';
      const saved = await store.saveProviders(patch);
      const admin = await currentUser(ctx);
      await store.logActivity({
        userId: admin?.id ?? 'system',
        email: admin?.email ?? 'system',
        action: 'admin.providers_updated',
        detail: saved.apiKey ? 'key stored' : 'key cleared',
      });
      return ok({ providers: publicProviders(saved) });
    }
  }

  /* ------------------------------------------------------------------ billing */

  if (path === '/api/billing/plans' && method === 'GET') {
    return ok({ plans: planList(), billingEnabled: false });
  }

  if (path === '/api/billing/checkout' && method === 'POST') {
    const user = await requireUser(ctx);
    return fail(
      501,
      'Billing is not activated on this deployment.',
      `No payment provider is configured, so ${user.email} cannot be charged. An administrator can add STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET to enable checkout.`,
    );
  }

  return null;
}
