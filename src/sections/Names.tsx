import { useMemo, useState } from 'react';
import { NAME_STYLE_LABELS, generateNames, slugify } from '../../shared/names';
import type { GeneratedName, NameStyle, NameTarget } from '../../shared/types';
import { IconArrowRight, IconCopy, IconSpark } from '../components/Icons';
import { Badge, Btn, Card, Chip, Empty, Field, Notice, SectionHead, Select, TextInput, useToast } from '../components/ui';
import type { SectionProps } from '../lib/nav';

const STYLES = Object.keys(NAME_STYLE_LABELS) as NameStyle[];

const TARGETS: { value: NameTarget; label: string }[] = [
  { value: 'business', label: 'Business / brand' },
  { value: 'youtube', label: 'YouTube channel' },
  { value: 'social', label: 'Social media handle' },
];

export default function Names({ project, update, go }: SectionProps) {
  const toast = useToast();
  const [keywordText, setKeywordText] = useState(project.keywords.join(', '));
  const [target, setTarget] = useState<NameTarget>('business');
  const [count, setCount] = useState(60);
  const [styles, setStyles] = useState<NameStyle[]>(STYLES);
  const [filter, setFilter] = useState<NameStyle | 'all'>('all');
  const [seed, setSeed] = useState(0);

  const results = project.names;
  const visible = useMemo(
    () => (filter === 'all' ? results : results.filter((name) => name.style === filter)),
    [results, filter],
  );

  const generate = () => {
    const keywords = keywordText
      .split(/[,;\n]/)
      .map((k) => k.trim())
      .filter(Boolean)
      .slice(0, 6);
    if (keywords.length === 0) {
      toast('Add at least one keyword first.', 'bad');
      return;
    }
    const generated = generateNames({
      keywords,
      target,
      count,
      styles: styles.length ? styles : STYLES,
      seed: `${keywords.join('-')}-${seed}`,
    });
    update({ names: generated, keywords });
    setSeed((value) => value + 1);
    toast(`${generated.length} names generated`);
  };

  const choose = (name: GeneratedName) => {
    update({ chosenName: name.name });
    toast(`"${name.name}" set as the working brand name`);
  };

  const check = (name: GeneratedName) => {
    update({ chosenName: name.name });
    go('handles');
  };

  return (
    <div className="section">
      <SectionHead
        title="Name forge"
        subtitle="Deterministic naming engine — no API keys, no quotas. Every name comes with a style, the technique used and a pronounceability/memorability score."
      />

      <Card title="Inputs" hint="Comma-separated keywords work best">
        <div className="stack">
          <Field label="Keywords, niche or idea" hint="Example: sourdough, bakery, weekend">
            <TextInput value={keywordText} onChange={setKeywordText} placeholder="sourdough, bakery, weekend" />
          </Field>
          <div className="grid two">
            <Field label="Name type">
              <Select value={target} onChange={setTarget} options={TARGETS} />
            </Field>
            <Field label={`How many names — ${count}`}>
              <input
                type="range"
                min={50}
                max={100}
                step={10}
                value={count}
                onChange={(event) => setCount(Number(event.target.value))}
                style={{ width: '100%', accentColor: '#e2562b' }}
              />
            </Field>
          </div>
          <div>
            <div className="faint" style={{ marginBottom: 6 }}>STYLES</div>
            <div className="row tight">
              {STYLES.map((style) => (
                <Chip
                  key={style}
                  active={styles.includes(style)}
                  onClick={() =>
                    setStyles((prev) => (prev.includes(style) ? prev.filter((s) => s !== style) : [...prev, style]))
                  }
                >
                  {NAME_STYLE_LABELS[style]}
                </Chip>
              ))}
            </div>
          </div>
          <div className="row">
            <Btn variant="primary" onClick={generate}>
              <IconSpark width={16} height={16} /> Generate {count} names
            </Btn>
            {results.length > 0 ? <Btn variant="ghost" onClick={() => update({ names: [] })}>Clear list</Btn> : null}
          </div>
        </div>
      </Card>

      {project.chosenName ? (
        <Notice tone="ok">
          Selected brand name: <b>{project.chosenName}</b> · handle suggestion <b>@{slugify(project.chosenName)}</b>
          <div className="row" style={{ marginTop: 8 }}>
            <Btn small onClick={() => go('handles')}>Check handle availability</Btn>
            <Btn small variant="ghost" onClick={() => go('copy')}>Write descriptions</Btn>
          </div>
        </Notice>
      ) : null}

      {results.length > 0 ? (
        <Card
          title={`${visible.length} names`}
          hint="Tap a name to select it for this project"
          action={
            <div className="row tight" style={{ overflowX: 'auto', flexWrap: 'nowrap' }}>
              <Chip active={filter === 'all'} onClick={() => setFilter('all')}>All</Chip>
              {STYLES.map((style) => (
                <Chip key={style} active={filter === style} onClick={() => setFilter(style)}>
                  {NAME_STYLE_LABELS[style]}
                </Chip>
              ))}
            </div>
          }
        >
          <div className="name-list">
            {visible.map((name) => (
              <button
                key={`${name.name}-${name.style}`}
                type="button"
                className="name-item"
                data-selected={project.chosenName === name.name}
                onClick={() => choose(name)}
              >
                <div className="meta">
                  <strong>{name.name}</strong>
                  <span>
                    {NAME_STYLE_LABELS[name.style]} · {name.technique} · @{name.slug}
                  </span>
                </div>
                <span className="score">{name.score}</span>
                <span
                  role="button"
                  tabIndex={0}
                  title="Check this handle"
                  onClick={(event) => {
                    event.stopPropagation();
                    check(name);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.stopPropagation();
                      check(name);
                    }
                  }}
                  style={{ display: 'inline-flex', color: '#b9ada1' }}
                >
                  <IconArrowRight width={16} height={16} />
                </span>
              </button>
            ))}
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <Btn variant="ghost" small onClick={() => {
              navigator.clipboard.writeText(visible.map((n) => n.name).join('\n')).then(
                () => toast('Names copied'),
                () => toast('Could not copy names', 'bad'),
              );
            }}>
              <IconCopy width={14} height={14} /> Copy all shown
            </Btn>
            <Badge kind="neutral">{results.length} in this project</Badge>
          </div>
        </Card>
      ) : (
        <Empty>No names yet. Add keywords and generate — 50 to 100 names per run.</Empty>
      )}
    </div>
  );
}
