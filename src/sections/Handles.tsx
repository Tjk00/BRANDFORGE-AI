import { useMemo, useState } from 'react';
import { validateHandle } from '../../shared/availability';
import { slugify } from '../../shared/names';
import { PLATFORMS, getPlatform } from '../../shared/platforms';
import type { AvailabilityResult, AvailabilityStatus, PlatformId } from '../../shared/types';
import { checkAvailability } from '../lib/api';
import { IconAlert, IconCheck, IconExternal, IconRefresh } from '../components/Icons';
import { Badge, Btn, Card, Chip, Notice, ProgressBar, SectionHead, TextInput, useToast } from '../components/ui';
import type { SectionProps } from '../lib/nav';

function placeholder(platform: PlatformId, handle: string): AvailabilityResult {
  return {
    platform,
    handle,
    status: 'unconfirmed',
    confidence: 'unconfirmed',
    evidence: 'Not checked yet. Run a check, or open the profile link and record what you see.',
    profileUrl: getPlatform(platform).profileUrl(handle),
    httpStatus: null,
    checkedAt: '',
  };
}

function dotColor(result: AvailabilityResult): string {
  if (result.status === 'available') return '#3ecf8e';
  if (result.status === 'taken') return '#ef5f5f';
  if (result.status === 'invalid') return '#8a7f74';
  return '#f0a43a';
}

function statusLabel(result: AvailabilityResult): string {
  if (result.manual) return `marked ${result.manual}`;
  return result.status;
}

export default function Handles({ project, update }: SectionProps) {
  const toast = useToast();
  const initial = project.chosenName ? slugify(project.chosenName) : '';
  const [handle, setHandle] = useState(initial);
  const [platforms, setPlatforms] = useState<PlatformId[]>(PLATFORMS.map((p) => p.id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clean = handle.trim().replace(/^@+/, '').toLowerCase();

  const results = useMemo(() => {
    const stored = new Map(project.handles.map((item) => [item.platform, item]));
    return platforms
      .map((platform) => {
        const existing = stored.get(platform);
        if (existing && existing.handle === clean) return existing;
        return existing && clean ? { ...existing, handle: clean, profileUrl: getPlatform(platform).profileUrl(clean) } : placeholder(platform, clean);
      })
      .sort((a, b) => PLATFORMS.findIndex((p) => p.id === a.platform) - PLATFORMS.findIndex((p) => p.id === b.platform));
  }, [project.handles, platforms, clean]);

  const summary = useMemo(
    () => ({
      verified: results.filter((r) => r.confidence === 'verified').length,
      available: results.filter((r) => r.status === 'available').length,
      taken: results.filter((r) => r.status === 'taken').length,
      unconfirmed: results.filter((r) => r.status === 'unconfirmed').length,
      invalid: results.filter((r) => r.status === 'invalid').length,
    }),
    [results],
  );

  const runCheck = async () => {
    if (!clean) {
      toast('Enter a handle to check.', 'bad');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await checkAvailability(clean, platforms);
      const merged = new Map(project.handles.map((item) => [item.platform, item]));
      for (const result of response.results) merged.set(result.platform, result);
      update({ handles: Array.from(merged.values()) });
      toast(`${response.summary.verified} verified · ${response.summary.unconfirmed} need a manual look`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'The availability service did not respond.';
      setError(message);
      toast('Automatic check unavailable — use the manual route.', 'bad');
    } finally {
      setBusy(false);
    }
  };

  const mark = (platform: PlatformId, status: Extract<AvailabilityStatus, 'available' | 'taken'>) => {
    const existing = project.handles.find((item) => item.platform === platform) ?? placeholder(platform, clean);
    const next: AvailabilityResult = {
      ...existing,
      handle: clean || existing.handle,
      status,
      confidence: 'unconfirmed',
      manual: status,
      evidence: `You checked this manually on ${new Date().toLocaleDateString()} and marked it ${status}. Re-verify before you register.`,
      profileUrl: getPlatform(platform).profileUrl(clean || existing.handle),
    };
    const others = project.handles.filter((item) => item.platform !== platform);
    update({ handles: [...others, next] });
    toast(`${getPlatform(platform).label} marked ${status}`);
  };

  const togglePlatform = (id: PlatformId) => {
    setPlatforms((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  };

  return (
    <div className="section">
      <SectionHead
        title="Username availability"
        subtitle="Ten platforms. Results are labelled verified only when the platform itself answered the automated request; everything else is unconfirmed and needs a human look."
      />

      <Card title="Handle to check" hint="Letters, numbers, dots, dashes and underscores">
        <div className="stack">
          <div className="row" style={{ gap: 8 }}>
            <span style={{ color: '#8a7f74', fontSize: 18 }}>@</span>
            <div style={{ flex: 1, minWidth: 140 }}>
              <TextInput value={handle} onChange={setHandle} placeholder="yourbrand" inputMode="text" onEnter={runCheck} />
            </div>
          </div>
          <div className="row tight">
            {PLATFORMS.map((platform) => (
              <Chip key={platform.id} active={platforms.includes(platform.id)} onClick={() => togglePlatform(platform.id)}>
                {platform.label}
              </Chip>
            ))}
          </div>
          <div className="row">
            <Btn variant="primary" onClick={runCheck} disabled={busy || !clean}>
              {busy ? 'Checking platforms…' : 'Check availability'} <IconRefresh width={15} height={15} />
            </Btn>
            <Btn variant="ghost" small onClick={() => setPlatforms(PLATFORMS.map((p) => p.id))}>Select all</Btn>
            <Btn variant="ghost" small onClick={() => setPlatforms([])}>Select none</Btn>
          </div>
          {busy ? <ProgressBar percent={70} /> : null}
        </div>
      </Card>

      {error ? (
        <Notice tone="bad">
          <b>Automatic checking is not reachable right now.</b> {error}
          <div style={{ marginTop: 6 }}>
            You can still complete this step: open each profile link below and mark what you find. Those entries are
            recorded as your own manual observation, never as platform-verified.
          </div>
        </Notice>
      ) : null}

      <div className="metrics">
        <div className="metric"><strong>{summary.verified}</strong><span>verified by platform</span></div>
        <div className="metric"><strong style={{ color: '#3ecf8e' }}>{summary.available}</strong><span>available</span></div>
        <div className="metric"><strong style={{ color: '#ef5f5f' }}>{summary.taken}</strong><span>taken</span></div>
        <div className="metric"><strong style={{ color: '#f0a43a' }}>{summary.unconfirmed}</strong><span>unconfirmed</span></div>
      </div>

      <Card title={`Results for @${clean || '—'}`} hint="Tap the profile link to confirm anything unconfirmed">
        <div className="handle-list">
          {results.map((result) => {
            const platform = getPlatform(result.platform);
            const problem = clean ? validateHandle(result.platform, clean) : 'Enter a handle.';
            return (
              <div className="handle-row" key={result.platform}>
                <div className="top">
                  <span className="dot" style={{ background: dotColor(result) }} />
                  <span className="platform">{platform.label}</span>
                  <Badge kind={result.status === 'invalid' ? 'invalid' : result.status}>{statusLabel(result)}</Badge>
                  <Badge kind={result.confidence === 'verified' ? 'verified' : 'unconfirmed'}>
                    {result.confidence === 'verified' ? 'verified' : 'unconfirmed'}
                  </Badge>
                </div>
                <div className="url">
                  {result.profileUrl || `${platform.label} profile`}{' '}
                  {clean ? (
                    <a href={platform.profileUrl(clean)} target="_blank" rel="noreferrer noopener">
                      open <IconExternal width={11} height={11} style={{ display: 'inline', verticalAlign: '-1px' }} />
                    </a>
                  ) : null}
                </div>
                <div className="evidence">
                  {problem ? <span style={{ color: '#f0a43a' }}>{problem}</span> : result.evidence}
                </div>
                <div className="row tight">
                  <Btn small variant="ghost" onClick={() => mark(result.platform, 'available')}>
                    <IconCheck width={13} height={13} /> Mark available
                  </Btn>
                  <Btn small variant="ghost" onClick={() => mark(result.platform, 'taken')}>
                    <IconAlert width={13} height={13} /> Mark taken
                  </Btn>
                  {result.checkedAt ? <span className="faint">checked {new Date(result.checkedAt).toLocaleString()}</span> : null}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Notice tone="warn">
        <b>How to read these results.</b> A platform is only marked verified when it returns an unambiguous answer to an
        automated request (for example YouTube's 404 for a free handle or a real channel payload for a taken one).
        Most networks put automated visitors behind a login wall, so they come back unconfirmed with a direct link —
        BRANDFORGE will never guess that a handle is free.
      </Notice>
    </div>
  );
}
