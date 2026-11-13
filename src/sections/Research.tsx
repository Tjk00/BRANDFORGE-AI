import { useMemo, useState } from 'react';
import { NICHES, competitorLinks, nicheCategories, researchLinks } from '../../shared/niches';
import type { Niche } from '../../shared/types';
import { IconArrowRight, IconExternal, IconSearch } from '../components/Icons';
import { Badge, Btn, Card, Chip, Empty, Notice, SectionHead, TextInput } from '../components/ui';
import type { SectionProps } from '../lib/nav';

function demandKind(demand: Niche['demand']): string {
  return demand === 'very high' || demand === 'high' ? 'available' : 'neutral';
}

export default function Research({ project, update, go }: SectionProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('All');
  const categories = useMemo(() => ['All', ...nicheCategories()], []);
  const selected = NICHES.find((n) => n.id === project.nicheId) ?? null;

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return NICHES.filter((niche) => {
      if (category !== 'All' && niche.category !== category) return false;
      if (!term) return true;
      return (
        niche.label.toLowerCase().includes(term) ||
        niche.summary.toLowerCase().includes(term) ||
        niche.keywords.some((k) => k.toLowerCase().includes(term)) ||
        niche.audience.some((a) => a.toLowerCase().includes(term))
      );
    });
  }, [query, category]);

  const adopt = (niche: Niche) => {
    update({
      nicheId: niche.id,
      keywords: Array.from(new Set([...project.keywords, ...niche.keywords])).slice(0, 8),
    });
  };

  return (
    <div className="section">
      <SectionHead
        title="Niche research"
        subtitle="Editorial briefs on where demand is coming from, who you would be speaking to, and how the niche earns. Every brief links straight to live sources so you can verify demand yourself."
      />

      <Card tight>
        <div className="stack">
          <div className="row" style={{ gap: 8 }}>
            <IconSearch width={18} height={18} />
            <div style={{ flex: 1, minWidth: 160 }}>
              <TextInput value={query} onChange={setQuery} placeholder="Search niches, audiences, keywords" inputMode="search" />
            </div>
          </div>
          <div className="row tight" style={{ overflowX: 'auto', flexWrap: 'nowrap', paddingBottom: 2 }}>
            {categories.map((item) => (
              <Chip key={item} active={category === item} onClick={() => setCategory(item)}>
                {item}
              </Chip>
            ))}
          </div>
        </div>
      </Card>

      {selected ? (
        <Card
          title={selected.label}
          hint={`${selected.category} · ${selected.demand} demand`}
          action={<Badge kind={demandKind(selected.demand)}>{selected.demand}</Badge>}
        >
          <div className="stack">
            <p className="muted">{selected.summary}</p>
            <Notice tone="warn">
              <b>Demand note.</b> {selected.demandNote} Demand is directional guidance, not a live metric — confirm with the
              linked sources before you commit.
            </Notice>

            <div>
              <div className="faint" style={{ marginBottom: 6 }}>AUDIENCE</div>
              <div className="row tight">
                {selected.audience.map((audience) => (
                  <Chip key={audience}>{audience}</Chip>
                ))}
              </div>
            </div>

            <div className="grid two">
              <div>
                <div className="faint" style={{ marginBottom: 6 }}>HOW IT EARNS</div>
                <ul className="list-plain">
                  {selected.monetization.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="faint" style={{ marginBottom: 6 }}>CONTENT OPPORTUNITIES</div>
                <ul className="list-plain">
                  {selected.contentAngles.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div>
              <div className="faint" style={{ marginBottom: 6 }}>COMPETITOR LANDSCAPE</div>
              <p className="muted">{selected.competitorLandscape}</p>
            </div>

            <div>
              <div className="faint" style={{ marginBottom: 6 }}>RESEARCH SOURCES (OPEN IN A NEW TAB)</div>
              <div className="quick-links">
                {[...researchLinks(selected), ...competitorLinks(selected)].map((link) => (
                  <a key={link.url} href={link.url} target="_blank" rel="noreferrer noopener">
                    {link.label} <IconExternal width={11} height={11} style={{ display: 'inline', verticalAlign: '-1px' }} />
                  </a>
                ))}
              </div>
            </div>

            <div>
              <div className="faint" style={{ marginBottom: 6 }}>KEYWORDS</div>
              <div className="row tight">
                {selected.keywords.map((keyword) => (
                  <Chip key={keyword} active={project.keywords.includes(keyword)} onClick={() => {
                    const has = project.keywords.includes(keyword);
                    update({
                      keywords: has ? project.keywords.filter((k) => k !== keyword) : [...project.keywords, keyword].slice(0, 8),
                    });
                  }}>
                    {keyword}
                  </Chip>
                ))}
              </div>
            </div>

            <div className="row">
              <Btn variant="primary" onClick={() => { adopt(selected); go('names'); }}>
                Use this niche <IconArrowRight width={15} height={15} />
              </Btn>
              <Btn variant="ghost" onClick={() => adopt(selected)}>Add keywords only</Btn>
              {project.nicheId ? (
                <Btn variant="ghost" small onClick={() => update({ nicheId: null })}>Clear niche</Btn>
              ) : null}
            </div>
          </div>
        </Card>
      ) : (
        <Notice>
          Pick a niche below to load its brief. Your selection is saved with this project and drives name, copy and
          keyword suggestions.
        </Notice>
      )}

      <div className="grid two">
        {filtered.map((niche) => (
          <Card key={niche.id} tight>
            <div className="stack" style={{ gap: 8 }}>
              <div className="row between">
                <strong style={{ fontSize: 14 }}>{niche.label}</strong>
                <Badge kind={demandKind(niche.demand)}>{niche.demand}</Badge>
              </div>
              <p className="faint" style={{ lineHeight: 1.5 }}>{niche.summary.slice(0, 130)}…</p>
              <div className="row tight">
                <Btn small onClick={() => update({ nicheId: niche.id })}>Open brief</Btn>
                <Btn small variant="ghost" onClick={() => { adopt(niche); go('names'); }}>Generate names</Btn>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {filtered.length === 0 ? <Empty>No niche matches that search. Try a broader term.</Empty> : null}
    </div>
  );
}
