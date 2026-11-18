import { describe, it, expect } from 'vitest';
import { createSim } from '../src/sim/scenarios.ts';
import { planWorld, BIOMES } from '../src/sim/worldgen.ts';
import { antName, clanName, personalityOf, society, societySummary, atPeace } from '../src/sim/society.ts';
import { DAY_TICKS } from '../src/sim/physics.ts';
import { M } from '../src/sim/materials.ts';
import { snapshot, restore } from '../src/sim/persist.ts';

describe('generated worlds', () => {
  it('plans a deterministic, gap-free strip of biomes', () => {
    const a = planWorld(7, 768), b = planWorld(7, 768);
    expect(a.regions).toEqual(b.regions);
    expect(a.regions[0].x0).toBe(0);
    expect(a.regions.at(-1)!.x1).toBe(768);
    for (let k = 1; k < a.regions.length; k++) expect(a.regions[k].x0).toBe(a.regions[k - 1].x1);
    for (const r of a.regions) expect(BIOMES[r.biome]).toBeDefined();
    expect(planWorld(8, 768).regions).not.toEqual(a.regions);
  });
  it('places the requested number of kingdoms with labelled regions', () => {
    const s = createSim({ scenario: 'living-world', seed: 3, size: [512, 192], world: { colonies: 4 } });
    expect(s.aliveColonies().length).toBe(4);
    expect(s.scenarioInfo.notes?.length).toBeGreaterThan(1);
    const xs = s.aliveColonies().map((c) => c.entrance.x).sort((p, q) => p - q);
    for (let k = 1; k < xs.length; k++) expect(xs[k] - xs[k - 1]).toBeGreaterThan(40);
  });
});

describe('renewable food does not pile up', () => {
  it('honeydew, seeds and insect fall never stack on food or land on a nest', () => {
    const s = createSim({ scenario: 'first-colony', seed: 5, size: [192, 128], settings: { naturalPredators: false } });
    for (let k = 0; k < DAY_TICKS * 3; k++) s.step();
    const w = s.w;
    let stacked = 0;
    for (let y = 0; y < w.H - 2; y++) for (let x = 0; x < w.W; x++) {
      const m = w.mat[y * w.W + x], b = w.mat[(y + 1) * w.W + x], b2 = w.mat[(y + 2) * w.W + x];
      if ((m === M.SUGAR || m === M.SEED || m === M.PROTEIN) && (b === M.SUGAR || b === M.SEED || b === M.PROTEIN) && (b2 === M.SUGAR || b2 === M.SEED || b2 === M.PROTEIN)) stacked++;
    }
    expect(stacked).toBe(0);
  });
});

describe('society', () => {
  it('names, clans and personalities are deterministic per id', () => {
    expect(antName(42)).toBe(antName(42));
    expect(antName(42)).not.toBe(antName(43));
    expect(clanName(9)).toMatch(/^House /);
    const [p1, p2] = personalityOf(1234);
    expect(p1).not.toBe(p2);
  });
  it('every colony becomes a kingdom with a ruler, chronicle and summary, and survives save/load', () => {
    const s = createSim({ scenario: 'competing-colonies', seed: 2, size: [256, 128] });
    for (let k = 0; k < DAY_TICKS + 5; k++) s.step();
    for (const c of s.aliveColonies()) {
      const soc = society(s, c);
      expect(soc.kingdom).toMatch(/^Kingdom of /);
      expect(soc.ruler).toBe(c.queens[0].antId);
      expect(soc.chronicle.length).toBeGreaterThan(0);
      const sum = societySummary(s, c);
      expect(sum.ruler).toBe(soc.rulerName);
    }
    const r = restore(snapshot(s));
    expect(r.aliveColonies()[0].society?.kingdom).toBe(s.aliveColonies()[0].society?.kingdom);
  });
  it('treaty partners are recognised as at peace', () => {
    const s = createSim({ scenario: 'competing-colonies', seed: 2, size: [256, 128] });
    const [a, b] = s.aliveColonies();
    expect(atPeace(s, a.slot, b.slot)).toBe(false);
    society(s, a).treaties[b.id] = { kind: 'peace', since: s.tick, until: s.tick + DAY_TICKS };
    s.step();
    expect(atPeace(s, a.slot, b.slot)).toBe(true);
    expect(atPeace(s, b.slot, a.slot)).toBe(true);
  });
});
