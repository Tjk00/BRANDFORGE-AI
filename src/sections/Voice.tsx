import { useState } from 'react';
import { generateVoice } from '../../shared/voice';
import type { PlatformId } from '../../shared/domain';
import { Btn, Card, Notice, SectionHead, useToast } from '../components/ui';
import { IconSpark, IconType } from '../components/Icons';
import type { SectionProps } from '../lib/nav';

const LABELS: Record<PlatformId, string> = {
  youtube: 'YouTube',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  facebook: 'Facebook',
  x: 'X',
  pinterest: 'Pinterest',
  threads: 'Threads',
  linkedin: 'LinkedIn',
  twitch: 'Twitch',
  reddit: 'Reddit',
};

const LIMITS: Record<PlatformId, number> = {
  youtube: 1000,
  tiktok: 80,
  instagram: 150,
  facebook: 255,
  x: 160,
  pinterest: 160,
  threads: 160,
  linkedin: 220,
  twitch: 200,
  reddit: 200,
};

const PLATFORM_ORDER = Object.keys(LABELS) as PlatformId[];

type LongField = 'businessDescription' | 'brandStory' | 'mission' | 'vision' | 'positioning' | 'youtubeDescription';

const LONG_FIELDS: { key: LongField; label: string; rows: number }[] = [
  { key: 'businessDescription', label: 'Business description', rows: 4 },
  { key: 'positioning', label: 'Brand positioning', rows: 3 },
  { key: 'brandStory', label: 'Brand story', rows: 5 },
  { key: 'mission', label: 'Mission statement', rows: 3 },
  { key: 'vision', label: 'Vision statement', rows: 3 },
  { key: 'youtubeDescription', label: 'YouTube channel description', rows: 6 },
];

export default function Voice({ project, update, go }: SectionProps) {
  const toast = useToast();
  const voice = project.voice ?? null;
  const [audience, setAudience] = useState(project.audience ?? '');
  const [tone, setTone] = useState(project.tone ?? '');

  const name = project.chosenName || project.workingTitle || '';

  const generate = () => {
    if (!name) {
      toast('Pick a brand name first — the voice is written around it.', 'bad');
      go('names');
      return;
    }
    const next = generateVoice({ name, keywords: project.keywords, audience, tone });
    update({ voice: next, audience, tone });
    toast('Brand voice generated');
  };

  const setField = (field: LongField, value: string) => {
    if (!voice) return;
    update({ voice: { ...voice, [field]: value } });
  };

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${label} copied`);
    } catch {
      toast('The browser blocked clipboard access. Select and copy manually.', 'bad');
    }
  };

  return (
    <div className="section">
      <SectionHead
        title="Create brand voice"
        subtitle="Story, positioning, bios and SEO copy — written from your own name, keywords and audience. Nothing is invented as fact."
      />

      <Card title="Voice inputs" hint="These shape every generated line">
        <div className="stack">
          <div className="row wrap">
            <label className="field" style={{ flex: '1 1 220px' }}>
              <span>Audience</span>
              <input
                value={audience}
                onChange={(event) => setAudience(event.target.value)}
                placeholder="e.g. new freelance designers"
                maxLength={120}
              />
            </label>
            <label className="field" style={{ flex: '1 1 180px' }}>
              <span>Tone</span>
              <input
                value={tone}
                onChange={(event) => setTone(event.target.value)}
                placeholder="e.g. confident and warm"
                maxLength={60}
              />
            </label>
          </div>

          <div className="row wrap">
            <span className="faint">Keywords:</span>
            {project.keywords.length ? (
              <div className="chip-list">
                {project.keywords.map((keyword) => (
                  <span className="chip-item" key={keyword}>
                    {keyword}
                  </span>
                ))}
              </div>
            ) : (
              <span className="faint">none yet — add them in Research</span>
            )}
          </div>

          <div className="row">
            <Btn variant="primary" onClick={generate}>
              <IconSpark width={15} height={15} /> {voice ? 'Regenerate voice' : 'Generate brand voice'}
            </Btn>
            {voice ? (
              <Btn
                variant="ghost"
                onClick={() =>
                  copy(
                    [
                      `Business description\n${voice.businessDescription}`,
                      `Brand story\n${voice.brandStory}`,
                      `Mission\n${voice.mission}`,
                      `Vision\n${voice.vision}`,
                      `Positioning\n${voice.positioning}`,
                      `Values\n${voice.values.map((value) => `- ${value}`).join('\n')}`,
                      `Taglines\n${voice.taglines.join('\n')}`,
                      `Slogans\n${voice.slogans.join('\n')}`,
                      `SEO keywords\n${voice.seoKeywords.join(', ')}`,
                    ].join('\n\n'),
                    'Full brand voice',
                  )
                }
              >
                <IconType width={15} height={15} /> Copy all
              </Btn>
            ) : null}
          </div>
        </div>
      </Card>

      {!voice ? (
        <Notice>
          Generate the voice to unlock editable descriptions, mission, vision, values, bios for all ten platforms and an
          SEO keyword set. Everything stays editable, and nothing is sent to a third party.
        </Notice>
      ) : (
        <>
          <div className="voice-grid">
            {LONG_FIELDS.map((field) => (
              <div className="voice-block" key={field.key} data-span={field.rows > 4 ? '2' : undefined}>
                <header>
                  <h3>{field.label}</h3>
                  <Btn small variant="ghost" onClick={() => copy(voice[field.key], field.label)}>
                    Copy
                  </Btn>
                </header>
                <textarea
                  value={voice[field.key]}
                  rows={field.rows}
                  onChange={(event) => setField(field.key, event.target.value)}
                  aria-label={field.label}
                />
                <div className="counter" data-over={voice[field.key].length > (field.key === 'youtubeDescription' ? 1000 : 600)}>
                  {voice[field.key].length} characters
                </div>
              </div>
            ))}

            <div className="voice-block">
              <header>
                <h3>Brand values</h3>
                <Btn small variant="ghost" onClick={() => copy(voice.values.join('\n'), 'Values')}>
                  Copy
                </Btn>
              </header>
              <div className="chip-list">
                {voice.values.map((value) => (
                  <span className="chip-item" key={value}>
                    {value}
                  </span>
                ))}
              </div>
            </div>

            <div className="voice-block">
              <header>
                <h3>Taglines</h3>
                <Btn small variant="ghost" onClick={() => copy(voice.taglines.join('\n'), 'Taglines')}>
                  Copy
                </Btn>
              </header>
              <div className="chip-list">
                {voice.taglines.map((tagline) => (
                  <span className="chip-item" key={tagline}>
                    {tagline}
                  </span>
                ))}
              </div>
            </div>

            <div className="voice-block">
              <header>
                <h3>Slogans</h3>
                <Btn small variant="ghost" onClick={() => copy(voice.slogans.join('\n'), 'Slogans')}>
                  Copy
                </Btn>
              </header>
              <div className="chip-list">
                {voice.slogans.map((slogan) => (
                  <span className="chip-item" key={slogan}>
                    {slogan}
                  </span>
                ))}
              </div>
            </div>

            <div className="voice-block">
              <header>
                <h3>Marketing messages</h3>
                <Btn small variant="ghost" onClick={() => copy(voice.marketingMessages.join('\n'), 'Marketing messages')}>
                  Copy
                </Btn>
              </header>
              <div className="chip-list">
                {voice.marketingMessages.map((message) => (
                  <span className="chip-item" key={message}>
                    {message}
                  </span>
                ))}
              </div>
            </div>

            <div className="voice-block">
              <header>
                <h3>SEO keywords</h3>
                <Btn small variant="ghost" onClick={() => copy(voice.seoKeywords.join(', '), 'Keywords')}>
                  Copy
                </Btn>
              </header>
              <div className="chip-list">
                {voice.seoKeywords.map((keyword) => (
                  <span className="chip-item" key={keyword}>
                    {keyword}
                  </span>
                ))}
              </div>
            </div>

            {PLATFORM_ORDER.map((platform) => {
              const bio = voice.socialBios[platform] ?? '';
              const limit = LIMITS[platform];
              return (
                <div className="voice-block" key={platform}>
                  <header>
                    <h3>{LABELS[platform]} bio</h3>
                    <Btn small variant="ghost" onClick={() => copy(bio, `${LABELS[platform]} bio`)}>
                      Copy
                    </Btn>
                  </header>
                  <textarea
                    value={bio}
                    rows={3}
                    onChange={(event) =>
                      update({
                        voice: {
                          ...voice,
                          socialBios: { ...voice.socialBios, [platform]: event.target.value },
                        },
                      })
                    }
                    aria-label={`${LABELS[platform]} bio`}
                  />
                  <div className="counter" data-over={bio.length > limit}>
                    {bio.length} / {limit}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="row" style={{ marginTop: 14 }}>
            <Btn variant="primary" onClick={() => go('export')}>
              <IconType width={15} height={15} /> Add voice to brand kit
            </Btn>
            <span className="faint">Saved automatically · generated {new Date(voice.generatedAt).toLocaleString()}</span>
          </div>
        </>
      )}
    </div>
  );
}
