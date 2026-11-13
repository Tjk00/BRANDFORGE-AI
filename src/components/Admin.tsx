import { useCallback, useEffect, useState } from 'react';
import type { PlanId } from '../../shared/plans';
import { account, ApiError, type AccountUser, type AdminOverview } from '../lib/cloud';
import { Btn, Notice, SectionHead, useToast } from './ui';
import { IconRefresh, IconTrash } from './Icons';

interface AdminProps {
  currentUserId: string;
}

const PLAN_OPTIONS: PlanId[] = ['free', 'pro', 'business'];

function uptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

export default function Admin({ currentUserId }: AdminProps) {
  const toast = useToast();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AccountUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, list] = await Promise.all([account.overview(), account.users()]);
      setOverview(data);
      setUsers(list);
      setBaseUrl(data.providers.baseUrl);
      setModel(data.providers.model);
      setEnabled(data.providers.enabled);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load administration data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveProviders = async () => {
    setSaving(true);
    try {
      const patch: { baseUrl: string; model: string; enabled: boolean; apiKey?: string } = { baseUrl, model, enabled };
      if (apiKey.trim()) patch.apiKey = apiKey.trim();
      const providers = await account.saveProviders(patch);
      setApiKey('');
      setOverview((prev) => (prev ? { ...prev, providers } : prev));
      toast(providers.configured ? 'Provider configuration saved' : 'Saved — no key stored yet');
    } catch (caught) {
      toast(caught instanceof ApiError ? caught.message : 'Could not save provider settings', 'bad');
    } finally {
      setSaving(false);
    }
  };

  const clearKey = async () => {
    if (!window.confirm('Remove the stored provider key? Text generation falls back to the offline engines.')) return;
    try {
      const providers = await account.saveProviders({ clearKey: true });
      setOverview((prev) => (prev ? { ...prev, providers } : prev));
      toast('Provider key removed');
    } catch (caught) {
      toast(caught instanceof ApiError ? caught.message : 'Could not remove the key', 'bad');
    }
  };

  const changeUser = async (id: string, patch: { role?: 'user' | 'admin'; plan?: PlanId }) => {
    try {
      const updated = await account.updateUser(id, patch);
      if (updated) setUsers((prev) => prev.map((user) => (user.id === updated.id ? updated : user)));
      toast('Account updated');
    } catch (caught) {
      toast(caught instanceof ApiError ? caught.message : 'Could not update that account', 'bad');
    }
  };

  const removeUser = async (user: AccountUser) => {
    if (!window.confirm(`Delete ${user.email} and all of their brands? This cannot be undone.`)) return;
    try {
      await account.deleteUser(user.id);
      setUsers((prev) => prev.filter((item) => item.id !== user.id));
      toast('Account deleted');
    } catch (caught) {
      toast(caught instanceof ApiError ? caught.message : 'Could not delete that account', 'bad');
    }
  };

  return (
    <div className="bf-admin">
      <SectionHead
        title="Administration"
        subtitle="Accounts, plans, AI provider configuration and system activity. Every action here is authorised server-side."
      />

      {error ? <Notice tone="bad">{error}</Notice> : null}

      <div className="bf-inline">
        <Btn small onClick={load} disabled={loading}>
          <IconRefresh width={14} height={14} /> {loading ? 'Refreshing…' : 'Refresh'}
        </Btn>
        <span className="bf-panel-hint">
          Runtime: {overview?.runtime ?? '—'} · uptime {overview ? uptime(overview.uptimeSeconds) : '—'}
        </span>
      </div>

      <div className="bf-stat-grid">
        <div className="bf-stat-card">
          <span className="bf-stat-value">{overview?.users ?? '—'}</span>
          <span className="bf-stat-label">Accounts</span>
        </div>
        <div className="bf-stat-card">
          <span className="bf-stat-value">{overview?.admins ?? '—'}</span>
          <span className="bf-stat-label">Admins</span>
        </div>
        <div className="bf-stat-card">
          <span className="bf-stat-value">{overview?.projects ?? '—'}</span>
          <span className="bf-stat-label">Saved brands</span>
        </div>
        <div className="bf-stat-card">
          <span className="bf-stat-value">
            {overview ? overview.byPlan.free + overview.byPlan.pro + overview.byPlan.business : '—'}
          </span>
          <span className="bf-stat-label">Plan records</span>
        </div>
      </div>

      <section className="bf-panel">
        <header className="bf-panel-head">
          <div>
            <h2 className="bf-panel-title">AI provider</h2>
            <p className="bf-panel-hint">
              Optional. The studio works without it — every engine runs offline in the browser and server.
            </p>
          </div>
          <span className={`bf-pill${overview?.providers.configured ? ' bf-pill-gold' : ''}`}>
            {overview?.providers.configured ? 'Key stored' : 'No key'}
          </span>
        </header>

        <div className="bf-form">
          <label>
            Base URL
            <input
              type="url"
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="https://api.openai.com/v1"
            />
          </label>
          <label>
            Model
            <input type="text" value={model} onChange={(event) => setModel(event.target.value)} placeholder="gpt-4o-mini" />
          </label>
          <label>
            API key (write-only — never displayed again)
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={overview?.providers.configured ? '•••••• stored' : 'paste a key to enable'}
              autoComplete="off"
            />
          </label>
          <label className="bf-check">
            <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
            Enable the provider for text generation
          </label>

          <div className="bf-inline">
            <Btn variant="primary" onClick={saveProviders} disabled={saving}>
              {saving ? 'Saving…' : 'Save provider'}
            </Btn>
            {overview?.providers.configured ? (
              <Btn variant="ghost" onClick={clearKey}>
                Remove key
              </Btn>
            ) : null}
            {overview?.aiFromEnvironment ? <span className="bf-panel-hint">An environment key is also present.</span> : null}
          </div>
        </div>
      </section>

      <section className="bf-panel">
        <header className="bf-panel-head">
          <div>
            <h2 className="bf-panel-title">Accounts</h2>
            <p className="bf-panel-hint">Plan changes apply project limits immediately. Billing stays off.</p>
          </div>
        </header>

        {users.length === 0 ? (
          <p className="bf-empty">{loading ? 'Loading accounts…' : 'No accounts yet.'}</p>
        ) : (
          <div className="bf-table">
            {users.map((user) => (
              <div className="bf-table-row" key={user.id}>
                <div className="bf-table-main">
                  <span className="bf-table-name">{user.name}</span>
                  <span className="bf-table-meta">
                    {user.email} · joined {new Date(user.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <select
                  className="bf-select"
                  value={user.role}
                  aria-label={`Role for ${user.email}`}
                  onChange={(event) => void changeUser(user.id, { role: event.target.value as 'user' | 'admin' })}
                >
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
                <select
                  className="bf-select"
                  value={user.plan}
                  aria-label={`Plan for ${user.email}`}
                  onChange={(event) => void changeUser(user.id, { plan: event.target.value as PlanId })}
                >
                  {PLAN_OPTIONS.map((plan) => (
                    <option key={plan} value={plan}>
                      {plan}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="bf-icon-btn"
                  aria-label={`Delete ${user.email}`}
                  disabled={user.id === currentUserId}
                  onClick={() => void removeUser(user)}
                >
                  <IconTrash width={15} height={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="bf-grid-2">
        <section className="bf-panel">
          <header className="bf-panel-head">
            <div>
              <h2 className="bf-panel-title">Plan distribution</h2>
              <p className="bf-panel-hint">Prepared for monetization — no payment provider is active.</p>
            </div>
          </header>
          <div className="bf-table">
            {(overview?.plans ?? []).map((plan) => (
              <div className="bf-table-row" key={plan.id}>
                <div className="bf-table-main">
                  <span className="bf-table-name">
                    {plan.name} · {plan.price}
                  </span>
                  <span className="bf-table-meta">
                    {plan.projectLimit} brands · {plan.features.slice(0, 2).join(' · ') || 'core studio'}
                  </span>
                </div>
                <span className="bf-pill">{overview?.byPlan[plan.id] ?? 0} accounts</span>
              </div>
            ))}
            {!overview?.plans.length ? <p className="bf-empty">Plan definitions load with the overview.</p> : null}
          </div>
        </section>

        <section className="bf-panel">
          <header className="bf-panel-head">
            <div>
              <h2 className="bf-panel-title">System activity</h2>
              <p className="bf-panel-hint">Recent account and admin events</p>
            </div>
          </header>
          {overview?.activity.length ? (
            <ul className="bf-activity">
              {overview.activity.map((entry) => (
                <li className="bf-activity-row" key={entry.id}>
                  <span>
                    {entry.action}
                    {entry.detail ? ` — ${entry.detail}` : ''}
                    <br />
                    <span className="bf-table-meta">{entry.email}</span>
                  </span>
                  <time dateTime={entry.at}>{new Date(entry.at).toLocaleTimeString()}</time>
                </li>
              ))}
            </ul>
          ) : (
            <p className="bf-empty">No activity recorded yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}
