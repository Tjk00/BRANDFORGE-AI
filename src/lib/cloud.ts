/**
 * Account client.
 *
 * All calls are same-origin and rely on the HttpOnly session cookie, so no token
 * is ever kept in JavaScript or localStorage.
 */

import type { BrandProject } from '../../shared/brand';
import type { PlanId } from '../../shared/plans';

export interface AccountUser {
  id: string;
  email: string;
  name: string;
  plan: PlanId;
  role: 'admin' | 'user';
  createdAt: string;
}

export interface PlanLimits {
  id: PlanId;
  name: string;
  price: number;
  projectLimit: number;
  features: string[];
}

export interface SessionState {
  user: AccountUser | null;
  plan: PlanLimits;
  accountsEnabled: boolean;
}

export interface ProjectSummary {
  id: string;
  name: string;
  niche: string;
  updatedAt: string;
  createdAt: string;
  progress: number;
  stage: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail?: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const response = await fetch(path, {
    method: init?.method ?? 'GET',
    credentials: 'same-origin',
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });

  let payload: { ok?: boolean; data?: T; error?: string; detail?: string } = {};
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    throw new ApiError('The server returned an unreadable response.', response.status);
  }

  if (!response.ok || payload.ok === false) {
    throw new ApiError(payload.error ?? 'Request failed.', response.status, payload.detail);
  }
  return payload.data as T;
}

export const account = {
  session: () => request<SessionState>('/api/auth/me'),
  register: (email: string, password: string, name: string) =>
    request<SessionState>('/api/auth/register', { method: 'POST', body: { email, password, name } }),
  login: (email: string, password: string) =>
    request<SessionState>('/api/auth/login', { method: 'POST', body: { email, password } }),
  logout: () => request<{ signedOut: boolean }>('/api/auth/logout', { method: 'POST' }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ changed: boolean }>('/api/auth/password', {
      method: 'POST',
      body: { currentPassword, newPassword },
    }),
  listProjects: () => request<{ projects: ProjectSummary[] }>('/api/projects'),
  getProject: (id: string) => request<{ project: BrandProject }>(`/api/projects/${encodeURIComponent(id)}`),
  saveProject: (project: BrandProject) =>
    request<{ project: BrandProject }>('/api/projects', { method: 'POST', body: { project } }),
  deleteProject: (id: string) =>
    request<{ deleted: boolean }>(`/api/projects/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  setPlan: (plan: PlanId) => request<SessionState>('/api/billing/plan', { method: 'POST', body: { plan } }),
  adminOverview: () => request<AdminOverview>('/api/admin/overview'),
  adminProviders: () => request<{ providers: ProviderConfig }>('/api/admin/providers'),
  saveProviders: (providers: ProviderConfig) =>
    request<{ providers: ProviderConfig }>('/api/admin/providers', { method: 'POST', body: providers }),
};

export interface ProviderConfig {
  enabled: boolean;
  baseUrl: string;
  model: string;
  hasKey: boolean;
  lastCheckedAt?: string | null;
}

export interface AdminOverview {
  stats: {
    users: number;
    projects: number;
    activeProjects: number;
    signupsThisWeek: number;
    planBreakdown: Record<string, number>;
  };
  users: {
    id: string;
    email: string;
    name: string;
    plan: PlanId;
    role: 'admin' | 'user';
    createdAt: string;
    projectCount: number;
  }[];
  activity: { id: string; at: string; label: string; userId: string; projectId?: string }[];
  health: { accountsEnabled: boolean; aiConfigured: boolean; storage: string; uptimeSeconds: number };
}
