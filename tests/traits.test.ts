import { describe, it, expect } from 'vitest';
import { createSim } from '../src/sim/scenarios.ts';
import type { Sim } from '../src/sim/sim.ts';
import { Rng } from '../src/sim/rng.ts';
import { NP, P } from '../src/sim/genetics.ts';
import { CASTE, TASK } from '../src/sim/ants.ts';
import { TRAITS, TR, NT, birthStory, has, inheritTraits, founderTraits, maskList } from '../src/sim/traits.ts';
import { snapshot, restore } from '../src/sim/persist.ts';
import { PHEIDOLE_PALLIDULA, validateSpecies } from '../src/sim/species.ts';
import { broodCost, founderGenome } from '../src/sim/genetics.ts';

const small = (scenario = 'moved-food', seed = 42) => createSim({ scenario, seed, size: [192, 128], settings: { weather: false, naturalPredators: false } });
const tick = (s: Sim, n: number) => { for (let k = 0; k < n; k++) s.step(); };
const mask = (...keys: string[]) => { const m = [0, 0]; for (const k of keys) { const t = TR[k]; m[t >> 5] = (m[t >> 5] | (1 << (t & 31))) >>> 0; } return m; };

describe('named traits: inheritance', () => {
  it('a trait carried by both parents passes on more often than one carried by one parent, and far more than by chance', () => {
    const rng = new Rng(3), both = mask('strong'), one = mask('strong'), none = [0, 0];
    let b = 0, o = 0, n = 0;
    for (let k = 0; k < 4000; k++) {
      if (has(inheritTraits(rng, 'naturalistic', both, 0, both), 0, TR.strong)) b++;
      if (has(inheritTraits(rng, 'naturalistic', one, 0, none), 0, TR.strong)) o++;
      if (has(inheritTraits(rng, 'naturalistic', none, 0, none), 0, TR.strong)) n++;
    }
    expect(b / 4000).toBeCloseTo(1 - (1 - TRAITS[TR.strong].inherit) ** 2, 1);
    expect(o).toBeGreaterThan(n * 10);
    expect(o / 4000).toBeCloseTo(TRAITS[TR.strong].inherit, 1);
  });
  it('opposite traits never co-occur and fantasy traits never appear outside Fantasy mode', () => {
    const rng = new Rng(9), parent = mask('strong', 'fast', 'tough'), other = mask('weak', 'slow', 'fragile');
    for (let k = 0; k < 3000; k++) {
      const m = inheritTraits(rng, 'naturalistic', parent, 0, other);
      for (let t = 0; t < NT; t++) {
        if (TRAITS[t].fantasy) expect(has(m, 0, t)).toBe(false);
        const opp = TRAITS[t].opposite;
        if (opp && has(m, 0, t)) expect(has(m, 0, TR[opp])).toBe(false);
      }
      const f = founderTraits(rng, 'naturalistic');
      for (const t of maskList(f)) expect(TRAITS[t].fantasy).toBeFalsy();
    }
  });
  it('records parental carriers and spontaneous traits across both mask words', () => {
    expect(birthStory(mask('fast', 'shield_wall', 'ambusher', 'treaty_weaver'),
      mask('fast', 'shield_wall'), 0, mask('fast', 'treaty_weaver'))).toBe(
      'Fast (both parents carried it), Shield wall (from mother), Ambusher (new at birth), Treaty weaver (from father)');
  });
  it('queen traits are passed to the brood she lays', () => {
    const s = small(), c = s.colonies[0]!;
    const qi = s.a.findById(c.queens[0].antId);
    s.a.traits[qi * 2] = mask('strong', 'fertile')[0]; s.a.traits[qi * 2 + 1] = mask('strong', 'fertile')[1];
    c.brood.length = 0;
    // sample enough eggs that the inherited share is not a coin toss
    for (let k = 0; k < 12 && c.brood.filter((b) => b.tr).length < 12; k++) tick(s, 1800);
    const laid = c.brood.filter((b) => b.tr);
    expect(laid.length).toBeGreaterThan(3);
    const share = laid.filter((b) => has(b.tr!, 0, TR.strong)).length / laid.length;
    expect(share).toBeGreaterThan(0.2);
  });
});

describe('named traits: effects and management', () => {
  it('adding then removing a trait restores the phenotype exactly; opposites replace each other', () => {
    const s = small();
    const i = s.a.alive.findIndex((v, k) => v > 0 && s.a.caste[k] === CASTE.WORKER && !has(s.a.traits, k * 2, TR.fast) && !has(s.a.traits, k * 2, TR.slow));
    const before = s.a.pheno.slice(i * NP, i * NP + NP);
    s.applyNow({ t: 'editTraits', antId: s.a.id[i], trait: TR.fast, on: true });
    expect(s.a.pheno[i * NP + P.SPEED]).toBeCloseTo(before[P.SPEED] * 1.3, 5);
    s.applyNow({ t: 'editTraits', antId: s.a.id[i], trait: TR.slow, on: true });
    expect(has(s.a.traits, i * 2, TR.fast)).toBe(false);
    expect(has(s.a.traits, i * 2, TR.slow)).toBe(true);
    s.applyNow({ t: 'editTraits', antId: s.a.id[i], trait: TR.slow, on: false });
    const after = s.a.pheno.slice(i * NP, i * NP + NP);
    for (let k = 0; k < NP; k++) expect(after[k]).toBeCloseTo(before[k], 5);
  });
  it('fantasy traits cannot be added outside Fantasy mode', () => {
    const s = small();
    const i = s.a.alive.findIndex((v, k) => v > 0 && s.a.caste[k] === CASTE.WORKER);
    s.applyNow({ t: 'editTraits', antId: s.a.id[i], trait: TR.fire_proof, on: true });
    expect(has(s.a.traits, i * 2, TR.fire_proof)).toBe(false);
  });
  it('immune ants take no toxin damage', () => {
    const s = small();
    const i = s.a.alive.findIndex((v, k) => v > 0 && s.a.caste[k] === CASTE.WORKER && s.a.task[k] !== TASK.FORAGE);
    s.applyNow({ t: 'editTraits', antId: s.a.id[i], trait: TR.immune, on: true });
    s.w.toxin[s.a.y[i] * s.w.W + s.a.x[i]] = 255;
    const h = s.a.health[i];
    tick(s, 10);
    expect(s.a.health[i]).toBeGreaterThanOrEqual(h - 1e-6);
  });
  it('traits survive save and restore and the run continues identically', () => {
    const s = small();
    tick(s, 300);
    const r = restore(snapshot(s));
    expect(Array.from(r.a.traits.subarray(0, s.a.n * 2))).toEqual(Array.from(s.a.traits.subarray(0, s.a.n * 2)));
    tick(s, 300); tick(r, 300);
    expect(r.hash()).toBe(s.hash());
  });
});

describe('soldier subcaste', () => {
  it('the dimorphic Pheidole profile validates and majors cost more larval protein', () => {
    expect(validateSpecies(PHEIDOLE_PALLIDULA)).toEqual([]);
    const rng = new Rng(5), g = founderGenome(rng);
    expect(broodCost(PHEIDOLE_PALLIDULA, 'naturalistic', g, g, 3)).toBeGreaterThan(broodCost(PHEIDOLE_PALLIDULA, 'naturalistic', g, g, 0) * 1.8);
  });
  it('colony wars fields majors that mostly stay on standby or guard rather than doing routine work', () => {
    const s = createSim({ scenario: 'colony-wars', seed: 2 });
    tick(s, 1800);
    let majors = 0, routine = 0;
    for (let i = 0; i < s.a.n; i++) if (s.a.alive[i] && s.a.major[i]) { majors++; if (s.a.task[i] === TASK.FORAGE || s.a.task[i] === TASK.NURSE) routine++; }
    expect(majors).toBeGreaterThan(0);
    expect(routine / majors).toBeLessThan(0.5);
  });
});
