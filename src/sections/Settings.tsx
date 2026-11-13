import { useState } from 'react';
import type { AiSettings } from '../../shared/types';
import { askAi } from '../lib/api';
import { IconCheck, IconSpark } from '../components/Icons';
import { Btn, Card, Field, Notice, SectionHead, TextInput, useToast } from '../components/ui';

export interface SettingsProps {
  settings: AiSettings;
  onSave: (settings: AiSettings) => void;
  onClearData: () => void;
}

export default function Settings({ settings, onSave, onClearData }: SettingsProps) {
  const toast = useToast();
  const [draft, setDraft] = useState<AiSettings>(settings);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const patch = (next: Partial<AiSettings>) => setDraft((prev) => ({ ...prev, ...next }));

  const save = () => {
    onSave(draft);
    toast('Settings saved on this device');
  };

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const text = await askAi(
        'Reply with exactly one word: ready',
        'You are a connectivity test for an AI brand studio. Answer in one word.',
        { ...draft, enabled: true },
      );
      setTestResult(`Provider answered: “${text.slice(0, 120)}”`);
      toast('Provider connected');
    } catch (error) {
      setTestResult(error instanceof Error ? error.message : 'Connection failed.');
      toast('Provider did not answer', 'bad');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="section">
      <SectionHead
        title="Settings"
        subtitle="BRANDFORGE works completely without AI. Connect a provider only if you want an extra drafting layer on top of the built-in engines."
      />

      <Card title="Optional AI provider" hint="Off by default">
        <div className="stack">
          <Notice>
            Every feature in this app runs on deterministic, on-device engines. The AI layer is a bonus for free-form
            brainstorming, and it needs a key you supply. Your key is stored in this browser and sent only to the
            server that serves this app, never to a third party directly.
          </Notice>

          <label className="row" style={{ gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(event) => patch({ enabled: event.target.checked })}
              style={{ width: 18, height: 18, accentColor: '#e2562b' }}
            />
            <span style={{ fontSize: 13 }}>Enable the AI drafting layer</span>
          </label>

          <div className="grid two">
            <Field label="API base URL" hint="Any OpenAI-compatible endpoint">
              <TextInput value={draft.baseUrl} onChange={(value) => patch({ baseUrl: value })} placeholder="https://api.openai.com/v1" />
            </Field>
            <Field label="Model" hint="Provider-specific model id">
              <TextInput value={draft.model} onChange={(value) => patch({ model: value })} placeholder="gpt-4o-mini" />
            </Field>
          </div>

          <Field label="API key" hint="Stored locally in this browser only">
            <TextInput value={draft.apiKey} onChange={(value) => patch({ apiKey: value })} type="password" placeholder="sk-…" />
          </Field>

          <div className="row">
            <Btn variant="primary" onClick={save}>
              <IconCheck width={15} height={15} /> Save settings
            </Btn>
            <Btn onClick={test} disabled={testing || !draft.apiKey}>
              <IconSpark width={15} height={15} /> {testing ? 'Testing…' : 'Test connection'}
            </Btn>
          </div>

          {testResult ? <div className="faint">{testResult}</div> : null}

          <Notice tone="warn">
            Deploying to Cloudflare Pages alone (static hosting) cannot proxy an AI call. Use the included Worker
            configuration — the app detects it automatically and reports honestly when the AI layer is unavailable.
          </Notice>
        </div>
      </Card>

      <Card title="What runs locally" hint="No API keys required">
        <div className="stack">
          {[
            ['Niche research library', 'Curated briefs plus live search links to YouTube, Google Trends, Reddit and TikTok'],
            ['Name generation', '50–100 unique names per run across 7 construction styles'],
            ['Availability checking', 'Server-side probes with verified / unconfirmed labelling'],
            ['Logos, avatars, banners', 'Vector SVG generation with per-platform rasterisation'],
            ['SEO copy', 'Descriptions, bios, taglines and slogans with platform limits'],
            ['ZIP export', 'Complete brand kit assembled in your browser'],
          ].map(([label, detail]) => (
            <div key={label} className="row between">
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
                <div className="faint">{detail}</div>
              </div>
              <span className="tick">ready</span>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Your data" hint="Local-first">
        <div className="stack">
          <div className="faint">
            Projects, settings and API keys never leave this browser unless you export them. Clearing site data removes
            them permanently, so back up from the Projects screen first.
          </div>
          <div className="row">
            <Btn
              variant="danger"
              onClick={() => {
                if (confirm('Delete every BRANDFORGE project and setting stored in this browser?')) onClearData();
              }}
            >
              Clear all local data
            </Btn>
          </div>
        </div>
      </Card>
    </div>
  );
}
