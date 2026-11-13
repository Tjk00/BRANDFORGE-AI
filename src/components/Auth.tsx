import { useState } from 'react';
import { account, ApiError, type SessionState } from '../lib/cloud';
import { IconForge } from '../components/Icons';

interface AuthProps {
  onSignedIn: (session: SessionState) => void;
  onSkip: () => void;
  notice?: string;
}

type Mode = 'login' | 'register';

export default function Auth({ onSignedIn, onSkip, notice }: AuthProps) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      const session =
        mode === 'register'
          ? await account.register({ email: email.trim(), password, name: name.trim() })
          : await account.login({ email: email.trim(), password });
      onSignedIn(session);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Could not reach the server. Check your connection and try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="spark">
            <IconForge width={20} height={20} />
          </span>
          <strong>
            BRANDFORGE<em style={{ fontStyle: 'normal', color: 'var(--gold)' }}> AI</em>
          </strong>
        </div>

        <h1>{mode === 'login' ? 'Welcome back' : 'Create your studio'}</h1>
        <p className="lede">
          {mode === 'login'
            ? 'Sign in to reach your saved brand projects on any device.'
            : 'Build. Brand. Grow. Your projects stay private to your account.'}
        </p>

        <div className="tabs" role="tablist" aria-label="Account mode">
          <button type="button" role="tab" aria-selected={mode === 'login'} data-active={mode === 'login'} onClick={() => setMode('login')}>
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            data-active={mode === 'register'}
            onClick={() => setMode('register')}
          >
            Create account
          </button>
        </div>

        {notice ? <div className="notice-soft" style={{ marginBottom: 12 }}>{notice}</div> : null}
        {error ? (
          <div className="auth-error" role="alert">
            {error}
          </div>
        ) : null}

        <form onSubmit={submit}>
          {mode === 'register' ? (
            <div className="field">
              <label htmlFor="auth-name">Name</label>
              <input
                id="auth-name"
                name="name"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Alex Rivera"
                required
                maxLength={80}
              />
            </div>
          ) : null}

          <div className="field">
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              name="password"
              type="password"
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={mode === 'register' ? 'At least 10 characters' : 'Your password'}
              required
              minLength={mode === 'register' ? 10 : 1}
            />
          </div>

          <button type="submit" className="btn" data-variant="primary" style={{ width: '100%' }} disabled={busy}>
            {busy ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <button type="button" className="auth-skip" onClick={onSkip}>
          Continue without an account
        </button>

        <p className="auth-note">
          Passwords are hashed with PBKDF2-SHA256 and sessions use HttpOnly cookies. No card, no subscription — the Free
          plan is genuinely free. Working offline? Local mode keeps everything in this browser.
        </p>
      </div>
    </div>
  );
}
