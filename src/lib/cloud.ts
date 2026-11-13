/**
 * Account client.
 *
 * All calls are same-origin and rely on the HttpOnly session cookie, so no token
 * is ever stored in JavaScript or localStorage. When a host has no account store
 * the API answers 503 and the studio continues in local-only mode.
 */

import type { BrandProject } from '../../shared/brand';
import type { PlanId } from '../../shared/plans';

export interface AccountUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  plan: PlanId;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface PlanInfo {
  id: PlanId;
  name: string;
  price: string;
  cadence: string;
  projectLimit: number;
  summary: string;
  features: string[];
}

export interface SessionState {
  user: AccountUser | null;
  plans: PlanInfo[];
  projectLimit: number;
  available: boolean;
}

export interface ProjectList {
  projects: BrandProject[];
  limit: number;
  plan: PlanId;
}

export interface AdminActivity {
  id: string;
  at: string;
  email: string;
  action: string;
  detail: string;
}

export interface AdminOverview {
  users: number;
  admins: number;
  projects: number;
  byPlan: Record<PlanId, number>;
  providers: { enabled: boolean; baseUrl: string; model: string; configured: boolean };
  aiFromEnvironment: boolean;
  uptimeSeconds: number;
  runtime: string;
  recentUsers: AccountUser[];
  activity: AdminActivity[];
  plans: PlanInfo[];
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...init,
    headers: init.body ? { 'Content-Type': 'application/json', ...(init.headers ?? {}) } : init.headers,
  });

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    const record = (body ?? {}) as { error?: string; detail?: string };
    throw new ApiError(response.status, record.error ?? record.detail ?? `Request failed (${response.status})`);
  }

  return body as T;
}

/* --------------------------------------------------------------- normalising */

const PLAN_IDS: PlanId[] = ['free', 'pro', 'business'];

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function toPlan(raw: unknown): PlanInfo | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const id = PLAN_IDS.find((candidate) => candidate === record.id);
  if (!id) return null;
  const priceValue = record.price ?? record.priceMonthly ?? record.monthlyPrice;
  return {
    id,
    name: text(record.name, id.toUpperCase()),
    price: typeof priceValue === 'number' ? (priceValue === 0 ? 'Free' : `$${priceValue}/mo`) : text(priceValue, 'Free'),
    cadence: text(record.cadence, 'monthly'),
    projectLimit: typeof record.projectLimit === 'number' ? record.projectLimit : 0,
    summary: text(record.summary, text(record.blurb)),
    features: Array.isArray(record.features) ? record.features.filter((item): item is string => typeof item === 'string') : [],
  };
}

function toPlans(raw: unknown): PlanInfo[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(toPlan).filter((plan): plan is PlanInfo => Boolean(plan));
}

function toUser(raw: unknown): AccountUser | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.id !== 'string' || typeof record.email !== 'string') return null;
  return {
    id: record.id,
    email: record.email,
    name: text(record.name, record.email.split('@')[0] ?? 'Brand builder'),
    role: record.role === 'admin' ? 'admin' : 'user',
    plan: PLAN_IDS.find((plan) => plan === record.plan) ?? 'free',
    createdAt: text(record.createdAt, new Date().toISOString()),
    lastLoginAt: typeof record.lastLoginAt === 'string' ? record.lastLoginAt : null,
  };
}

function toActivity(raw: unknown): AdminActivity[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      return {
        id: text(record.id, Math.random().toString(36).slice(2)),
        at: text(record.at, new Date().toISOString()),
        email: text(record.email, 'unknown'),
        action: text(record.action, 'event'),
        detail: text(record.detail),
      };
    })
    .filter((item): item is AdminActivity => Boolean(item));
}

function toOverview(raw: unknown): AdminOverview {
  const record = (raw ?? {}) as Record<string, unknown>;
  const byPlanRaw = (record.byPlan ?? {}) as Record<string, unknown>;
  const providersRaw = (record.providers ?? {}) as Record<string, unknown>;
  return {
    users: typeof record.users === 'number' ? record.users : 0,
    admins: typeof record.admins === 'number' ? record.admins : 0,
    projects: typeof record.projects === 'number' ? record.projects : 0,
    byPlan: {
      free: typeof byPlanRaw.free === 'number' ? byPlanRaw.free : 0,
      pro: typeof byPlanRaw.pro === 'number' ? byPlanRaw.pro : 0,
      business: typeof byPlanRaw.business === 'number' ? byPlanRaw.business : 0,
    },
    providers: {
      enabled: providersRaw.enabled === true,
      baseUrl: text(providersRaw.baseUrl),
      model: text(providersRaw.model),
      configured: providersRaw.configured === true,
    },
    aiFromEnvironment: record.aiFromEnvironment === true,
    uptimeSeconds: typeof record.uptimeSeconds === 'number' ? record.uptimeSeconds : 0,
    runtime: text(record.runtime, 'unknown'),
    recentUsers: Array.isArray(record.recentUsers)
      ? record.recentUsers.map(toUser).filter((user): user is AccountUser => Boolean(user))
      : [],
    activity: toActivity(record.activity),
    plans: toPlans(record.plans),
  };
}

/* ------------------------------------------------------------------- client */

const unavailable = (): SessionState => ({ user: null, plans: [], projectLimit: 0, available: false });

export const account = {
  async session(): Promise<SessionState> {
    try {
      const raw = await request<Record<string, unknown>>('/api/auth/me');
      return {
        user: toUser(raw.user),
        plans: toPlans(raw.plans),
        projectLimit: typeof raw.projectLimit === 'number' ? raw.projectLimit : 0,
        available: true,
      };
    } catch (error) {
      if (error instanceof ApiError && (error.status === 503 || error.status === 404)) return unavailable();
      throw error;
    }
  },

  async register(input: { email: string; password: string; name: string }): Promise<SessionState> {
    const raw = await request<Record<string, unknown>>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return { user: toUser(raw.user), plans: toPlans(raw.plans), projectLimit: 0, available: true };
  },

  async login(input: { email: string; password: string }): Promise<SessionState> {
    const raw = await request<Record<string, unknown>>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return { user: toUser(raw.user), plans: toPlans(raw.plans), projectLimit: 0, available: true };
  },

  async logout(): Promise<void> {
    await request('/api/auth/logout', { method: 'POST' });
  },

  async updateProfile(name: string): Promise<AccountUser | null> {
    const raw = await request<Record<string, unknown>>('/api/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });
    return toUser(raw.user);
  },

  async projects(): Promise<ProjectList> {
    const raw = await request<Record<string, unknown>>('/api/projects');
    return {
      projects: Array.isArray(raw.projects) ? (raw.projects as BrandProject[]) : [],
      limit: typeof raw.limit === 'number' ? raw.limit : 0,
      plan: PLAN_IDS.find((plan) => plan === raw.plan) ?? 'free',
    };
  },

  async saveProject(project: BrandProject): Promise<BrandProject> {
    const raw = await request<Record<string, unknown>>(`/api/projects/${encodeURIComponent(project.id)}`, {
      method: 'PUT',
      body: JSON.stringify({ project }),
    });
    return (raw.project as BrandProject) ?? project;
  },

  async deleteProject(id: string): Promise<void> {
    await request(`/api/projects/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  async importProjects(projects: BrandProject[]): Promise<{ saved: number; skipped: number }> {
    const raw = await request<Record<string, unknown>>('/api/projects/import', {
      method: 'POST',
      body: JSON.stringify({ projects }),
    });
    return {
      saved: typeof raw.saved === 'number' ? raw.saved : 0,
      skipped: typeof raw.skipped === 'number' ? raw.skipped : 0,
    };
  },

  async overview(): Promise<AdminOverview> {
    return toOverview(await request<Record<string, unknown>>('/api/admin/overview'));
  },

  async users(): Promise<AccountUser[]> {
    const raw = await request<Record<string, unknown>>('/api/admin/users');
    return Array.isArray(raw.users)
      ? raw.users.map(toUser).filter((user): user is AccountUser => Boolean(user))
      : [];
  },

  async updateUser(id: string, patch: { role?: 'user' | 'admin'; plan?: PlanId }): Promise<AccountUser | null> {
    const raw = await request<Record<string, unknown>>(`/api/admin/users/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    return toUser(raw.user);
  },

  async deleteUser(id: string): Promise<void> {
    await request(`/api/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  async providers(): Promise<AdminOverview['providers']> {
    const raw = await request<Record<string, unknown>>('/api/admin/providers');
    return toOverview({ providers: raw.providers }).providers;
  },

  async saveProviders(patch: {
    baseUrl?: string;
    model?: string;
    enabled?: boolean;
    apiKey?: string;
    clearKey?: boolean;
  }): Promise<AdminOverview['providers']> {
    const raw = await request<Record<string, unknown>>('/api/admin/providers', {
      method: 'PUT',
      body: JSON.stringify(patch),
    });
    return toOverview({ providers: raw.providers }).providers;
  },

  async billingPlans(): Promise<{ plans: PlanInfo[]; billingEnabled: boolean }> {
    const raw = await request<Record<string, unknown>>('/api/billing/plans');
    return { plans: toPlans(raw.plans), billingEnabled: raw.billingEnabled === true };
  },
};

export function planLabel(plan: PlanInfo | null, fallback: PlanId = 'free'): string {
  return plan?.name ?? fallback.toUpperCase();
}

export function usageLabel(used: number, limit: number): string {
  return limit > 0 ? `${used} / ${limit} brands` : `${used} brands`;
}
