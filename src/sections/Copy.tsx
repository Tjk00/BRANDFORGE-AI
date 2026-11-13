import { useState } from 'react';
import { TONE_OPTIONS, generateCopy, truncate } from '../../shared/copy';
import { getNiche } from '../../shared/niches';
import { PLATFORMS } from '../../shared/platforms';
import { Btn, Card, CopyBlock, Field, Notice, SectionHead, Select, TextInput, useToast } from '../components/ui';
import type { SectionProps } from '../lib/nav';

export default function Copy({ project, update, go }: SectionProps) {
  const toast = useToast();
  const [tone, setTone] = useState('friendly');
  const [audience, setAudience] = useState('');
  const copy = project.copy;
  const name = project.chosenName || project.workingTitle;

  const generate = () => {
    if (!name.trim()) {
      toast('Choose a brand name first.', 'bad');
      return;
    }
    const result = generateCopy({
      name,
      niche: getNiche(project.nicheId),
      keywords: project.keywords,
      audience,
      tone,
    });
    update({ copy: result });
    toast('Descriptions, bios and slogans generated');
  };

  return (
    <div className="section">
      <SectionHead
        title="Voice & SEO copy"
        subtitle="Channel descriptions, platform bios, taglines and slogans built from your niche, keywords and audience — all generated on-device."
      />

      <Card title="Brief" hint={name ? `Writing for ${name}` : 'Pick a brand name first'}>
        <div className="stack">
          <div className="grid two">
            <Field label="Tone">
              <Select
                value={tone}
                onChange={setTone}
                options={TONE_OPTIONS.map((item) => ({ value: item, label: item.charAt(0).toUpperCase() + item.slice(1) }))}
              />
            </Field>
            <Field label="Audience (optional)" hint="Example: new creators in their 20s">
              <TextInput value={audience} onChange={setAudience} placeholder="who you are speaking to" />
            </Field>
          </div>
          <div className="row">
            <Btn variant="primary" onClick={generate}>{copy ? 'Regenerate copy' : 'Generate copy'}</Btn>
            {!project.chosenName ? <Btn variant="ghost" onClick={() => go('names')}>Choose a name</Btn> : null}
          </div>
          {project.keywords.length > 0 ? (
            <div className="faint">Using keywords: {project.keywords.join(' · ')}</div>
          ) : (
            <Notice>Add keywords in the research or name step so the copy targets real search terms.</Notice>
          )}
        </div>
      </Card>

      {!copy ? (
        <Notice>Nothing generated yet. Press “Generate copy” to create your descriptions, bios and slogans.</Notice>
      ) : (
        <>
          <Card title="Taglines" hint="Short, repeatable lines for a channel trailer or homepage">
            <div className="stack">
              {copy.taglines.map((line, index) => (
                <div key={`${line}-${index}`} className="row between" style={{ alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <CopyBlock label={`Tagline ${index + 1}`} text={line} />
                  </div>
                  <Btn small variant="ghost" onClick={() => { update({ tagline: line }); toast('Tagline set for this project'); }}>
                    Use
                  </Btn>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Slogans" hint="Campaign-length lines">
            <div className="stack">
              {copy.slogans.map((line, index) => (
                <CopyBlock key={`${line}-${index}`} label={`Slogan ${index + 1}`} text={line} />
              ))}
            </div>
          </Card>

          <Card title="YouTube channel description" hint={`${copy.youtubeDescription.length} characters`}>
            <div className="stack">
              <CopyBlock label="Description" text={copy.youtubeDescription} mono />
              <Notice>
                Keep the first 150 characters self-contained: that is what shows in search results before the “more”
                cutoff.
              </Notice>
            </div>
          </Card>

          <Card title="Social bios" hint="Trimmed to each platform's limit">
            <div className="stack">
              {PLATFORMS.map((platform) => {
                const text = copy.socialBios[platform.id] ?? '';
                return (
                  <div key={platform.id}>
                    <div className="row between" style={{ marginBottom: 4 }}>
                      <strong style={{ fontSize: 13 }}>{platform.label}</strong>
                      <span className="faint">
                        {text.length} / {platform.bioLimit}
                      </span>
                    </div>
                    <CopyBlock label={platform.label} text={text || truncate('', platform.bioLimit)} />
                  </div>
                );
              })}
            </div>
          </Card>

          <Card title="Brand story & mission">
            <div className="stack">
              <CopyBlock label="Story" text={copy.brandStory} mono />
              <CopyBlock label="Mission" text={copy.mission} mono />
              <div className="faint">Keywords in this brief: {copy.keywords.join(' · ')}</div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
