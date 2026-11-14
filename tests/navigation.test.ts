import { describe, expect, it } from 'vitest';
import { STAGES, nextStage, projectProgress, stageStateFor, stageStates } from '../src/lib/nav';
import { newProject } from '../src/lib/storage';
import type { BrandProject } from '../shared/brand';

function brand(patch: Partial<BrandProject> = {}): BrandProject {
  return { ...newProject(), ...patch };
}

/** A brand with every one of the six stages genuinely completed. */
function completeBrand(): BrandProject {
  return brand({
    nicheId: 'home-fitness',
    keywords: ['home gym', 'kettlebell'],
    names: [{ name: 'Emberly' } as never],
    chosenName: 'Emberly',
    handles: [{ platform: 'youtube', handle: 'emberly', status: 'available' } as never],
    paletteId: 'ember-forge',
    voice: { tone: 'warm', seoKeywords: ['home gym'] } as never,
    lastExportedAt: new Date().toISOString(),
  });
}

describe('stage state lookup (blank-screen regression)', () => {
  it('resolves a defined state for every stage id', () => {
    for (const stage of STAGES) {
      const state = stageStateFor(brand(), stage.id);
      expect(state, `stage ${stage.id} resolved no state`).not.toBeNull();
      expect(typeof state?.done).toBe('boolean');
      expect(typeof state?.detail).toBe('string');
    }
  });

  it('returns six states in workflow order', () => {
    const states = stageStates(brand());
    expect(states).toHaveLength(STAGES.length);
    expect(states.map((state) => state.id)).toEqual(STAGES.map((stage) => stage.id));
  });

  it('never treats the 1-based stage.index as an array position', () => {
    const states = stageStates(brand());
    const indexes = STAGES.map((stage) => stage.index);

    // The rail used `stageStates(project)[stage.index]`. Indexes are 1..6 while
    // the array is 0..5, so every row read the wrong stage and the last one
    // (Export, index 6) produced `undefined`, throwing on `.done` and blanking
    // the whole application. This guards that the expression stays invalid.
    expect(indexes).toEqual([1, 2, 3, 4, 5, 6]);
    expect(states[6]).toBeUndefined();

    for (const stage of STAGES) {
      const byIndex = states[stage.index];
      if (byIndex) expect(byIndex.id).not.toBe(stage.id);
    }
  });
});

describe('stage completion is derived only from real project data', () => {
  it('starts a new brand at zero progress with research next', () => {
    const fresh = brand();
    expect(stageStates(fresh).every((state) => state.done)).toBe(false);
    expect(projectProgress(fresh)).toBe(0);
    expect(nextStage(fresh).id).toBe('research');
  });

  it('marks only the stages that actually hold data', () => {
    const partial = brand({ nicheId: 'home-fitness' });
    expect(stageStateFor(partial, 'research')?.done).toBe(true);
    expect(stageStateFor(partial, 'names')?.done).toBe(false);
    expect(stageStateFor(partial, 'export')?.done).toBe(false);
  });

  it('reports a fully completed brand as 100%', () => {
    const done = completeBrand();
    for (const stage of STAGES) {
      expect(stageStateFor(done, stage.id)?.done, `stage ${stage.id} should be complete`).toBe(true);
    }
    expect(projectProgress(done)).toBe(100);
    expect(nextStage(done).id).toBe('export');
  });

  it('always gives every stage a human readable detail line', () => {
    for (const stage of STAGES) {
      const detail = stageStateFor(brand(), stage.id)?.detail;
      expect(typeof detail).toBe('string');
      expect((detail ?? '').length).toBeGreaterThan(0);
    }
  });
});
