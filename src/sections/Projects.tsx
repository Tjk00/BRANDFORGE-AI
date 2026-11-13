import { useRef, useState } from 'react';
import { getNiche } from '../../shared/niches';
import { renderAvatar } from '../../shared/graphics';
import { PALETTES } from '../../shared/palettes';
import type { BrandProject } from '../../shared/types';
import { exportJson, importJson } from '../lib/storage';
import { downloadText, resolvePalette } from '../lib/export';
import { IconPlus, IconTrash, IconUpload } from '../components/Icons';
import { Badge, Btn, Card, Notice, SectionHead, TextInput, useToast } from '../components/ui';

export interface ProjectsProps {
  projects: BrandProject[];
  activeId: string | null;
  onOpen: (id: string) => void;
  onNew: () => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onImport: (projects: BrandProject[]) => void;
}

function progressOf(project: BrandProject): number {
  let done = 0;
  if (project.nicheId) done += 1;
  if (project.chosenName) done += 1;
  if (project.names.length > 0) done += 1;
  if (project.handles.some((h) => h.status === 'available' || h.status === 'taken')) done += 1;
  if (project.copy) done += 1;
  return Math.round((done / 5) * 100);
}

export default function Projects({
  projects,
  activeId,
  onOpen,
  onNew,
  onDuplicate,
  onDelete,
  onRename,
  onImport,
}: ProjectsProps) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const startRename = (project: BrandProject) => {
    setRenaming(project.id);
    setDraft(project.chosenName || project.workingTitle);
  };

  const commitRename = () => {
    if (renaming && draft.trim()) {
      onRename(renaming, draft.trim());
      toast('Project renamed');
    }
    setRenaming(null);
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      const imported = importJson(text);
      if (!imported.length) {
        toast('That file does not contain BRANDFORGE projects.', 'bad');
        return;
      }
      onImport(imported);
      toast(`${imported.length} project${imported.length === 1 ? '' : 's'} restored`);
    } catch {
      toast('Could not read that file.', 'bad');
    }
  };

  return (
    <div className="section">
      <SectionHead
        title="Brand projects"
        subtitle="Every project keeps its own names, handles, palette, logos and copy. Stored privately in this browser — no account, no server, no subscription."
      />

      <div className="row">
        <Btn variant="primary" onClick={onNew}>
          <IconPlus width={15} height={15} /> New project
        </Btn>
        <Btn onClick={() => downloadText(exportJson(projects), `brandforge-backup-${new Date().toISOString().slice(0, 10)}.json`, 'application/json')}>
          Back up all
        </Btn>
        <Btn onClick={() => fileRef.current?.click()}>
          <IconUpload width={15} height={15} /> Restore
        </Btn>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => {
            void handleFile(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </div>

      {projects.length === 0 ? (
        <Notice>No projects yet. Create one to start researching, naming and designing.</Notice>
      ) : null}

      <div className="project-list">
        {projects.map((project) => {
          const palette = resolvePalette(project);
          const name = project.chosenName || project.workingTitle || 'Untitled brand';
          const niche = getNiche(project.nicheId);
          return (
            <Card key={project.id} title={name} hint={`Updated ${new Date(project.updatedAt).toLocaleString()}`}>
              <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
                <span
                  className="avatar-sm"
                  dangerouslySetInnerHTML={{ __html: renderAvatar({ name, palette, size: 96, style: 'monogram' }) }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row tight">
                    {project.id === activeId ? <Badge kind="verified">open</Badge> : null}
                    <Badge kind="unconfirmed">{niche ? niche.label : 'no niche yet'}</Badge>
                    <Badge kind={progressOf(project) === 100 ? 'available' : 'unconfirmed'}>{progressOf(project)}% complete</Badge>
                  </div>
                  <div className="faint" style={{ marginTop: 6 }}>
                    {project.names.length} names · {project.handles.length} handles · {project.copy ? 'copy ready' : 'no copy yet'} ·{' '}
                    {PALETTES.find((p) => p.id === project.paletteId)?.name ?? 'custom palette'}
                  </div>
                </div>
              </div>

              {renaming === project.id ? (
                <div className="row" style={{ marginTop: 12 }}>
                  <div style={{ flex: 1 }}>
                    <TextInput value={draft} onChange={setDraft} onEnter={commitRename} placeholder="Brand name" />
                  </div>
                  <Btn small variant="primary" onClick={commitRename}>Save</Btn>
                  <Btn small variant="ghost" onClick={() => setRenaming(null)}>Cancel</Btn>
                </div>
              ) : (
                <div className="row tight" style={{ marginTop: 12 }}>
                  <Btn small variant="primary" onClick={() => onOpen(project.id)}>Open studio</Btn>
                  <Btn small variant="ghost" onClick={() => startRename(project)}>Rename</Btn>
                  <Btn small variant="ghost" onClick={() => onDuplicate(project.id)}>Duplicate</Btn>
                  <Btn
                    small
                    variant="danger"
                    onClick={() => {
                      if (confirm(`Delete “${name}”? This cannot be undone.`)) onDelete(project.id);
                    }}
                  >
                    <IconTrash width={13} height={13} /> Delete
                  </Btn>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Notice>
        Projects live in this browser's local storage. Use “Back up all” to download a JSON file you can restore on
        another device or after clearing browser data.
      </Notice>
    </div>
  );
}
