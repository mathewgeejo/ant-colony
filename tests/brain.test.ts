import { describe, it, expect } from 'vitest';
import { createSim } from '../src/sim/scenarios.ts';
import type { Sim } from '../src/sim/sim.ts';
import { CASTE } from '../src/sim/ants.ts';
import { ACT, NA, NI, NW, S, actMask, bankEntries, brainDeath, forward, reward, think } from '../src/sim/brain.ts';
import { decodeJSON, encodeJSON, restore, snapshot } from '../src/sim/persist.ts';

const small = (seed = 42) => createSim({ scenario: 'moved-food', seed, size: [192, 128], settings: { weather: false, naturalPredators: false } });
const tick = (s: Sim, n: number) => { for (let k = 0; k < n; k++) s.step(); };
const firstWorker = (s: Sim) => { for (let i = 0; i < s.a.n; i++) if (s.a.alive[i] && s.a.caste[i] === CASTE.WORKER) return i; return -1; };
const q = (s: Sim, i: number, x: Float32Array) => Array.from(forward(s.a.brainW, i * NW, x, 0));

describe('learning brain', () => {
  it('every worker is born with its own brain copied (with variation) from the colony template', () => {
    const s = small(), c = s.aliveColonies()[0];
    expect(c.mind?.w.length).toBe(NW);
    const ws: number[][] = [];
    for (let i = 0; i < s.a.n && ws.length < 3; i++) if (s.a.alive[i] && s.a.caste[i] === CASTE.WORKER) {
      expect(s.a.brainOk[i]).toBe(1);
      ws.push(Array.from(s.a.brainW.subarray(i * NW, i * NW + NW)));
    }
    expect(ws[0]).not.toEqual(ws[1]);
    const diff = ws[0].reduce((n, v, k) => n + Math.abs(v - c.mind!.w[k]), 0) / NW;
    expect(diff).toBeGreaterThan(0.005);
    expect(diff).toBeLessThan(0.1);
  });

  it('instincts: a hungry ant values eating, a thirsty one drinking', () => {
    const s = small(), i = firstWorker(s), x = new Float32Array(NI);
    x[S.HUNGER] = 1; let v = q(s, i, x); expect(v[ACT.EAT]).toBeGreaterThan(v[ACT.FORAGE]); expect(v[ACT.EAT]).toBeGreaterThan(v[ACT.DIG]);
    x.fill(0); x[S.THIRST] = 1; v = q(s, i, x); expect(v[ACT.DRINK]).toBeGreaterThan(v[ACT.REST]);
  });

  it('actually learns from reward: it comes to prefer an action its instincts did not favour', () => {
    const s = small(), c = s.aliveColonies()[0], i = firstWorker(s), x = new Float32Array(NI);
    x[S.DIG_CUE] = 1;
    const before = q(s, i, x);
    expect(before[ACT.DIG]).toBeGreaterThan(before[ACT.CLEAN]);
    const mask = actMask(ACT.DIG, ACT.CLEAN, ACT.REST);
    for (let k = 0; k < 400; k++) {
      const act = think(s, c, i, x, mask);
      reward(s, i, act === ACT.CLEAN ? 1 : -0.5);
      s.tick += 50;
    }
    const after = q(s, i, x);
    expect(after[ACT.CLEAN]).toBeGreaterThan(after[ACT.DIG]);
    expect(s.a.brainN[i]).toBeGreaterThanOrEqual(400);
  });

  it('a successful lifetime is blended into the colony template that newborns inherit', () => {
    const s = small(), c = s.aliveColonies()[0], i = firstWorker(s);
    const m = c.mind!, before = m.w.slice();
    m.lifetimes = 10; m.meanFit = 0;
    s.a.brainN[i] = 50; s.a.brainLife[i] = 40;
    for (let k = 0; k < NW; k++) s.a.brainW[i * NW + k] += 0.5;
    const gen = m.gen;
    brainDeath(s, c, i, 'old age');
    expect(m.gen).toBe(gen + 1);
    expect(m.w[0]).toBeGreaterThan(before[0]);
    expect(bankEntries(s).some((e) => e.speciesId === c.speciesId)).toBe(true);
  });

  it('workers make brain decisions while the colony runs, and all weights stay finite', () => {
    const s = small();
    tick(s, 1200);
    let decided = 0;
    for (let i = 0; i < s.a.n; i++) if (s.a.alive[i] && s.a.caste[i] === CASTE.WORKER && s.a.brainN[i] > 0) decided++;
    expect(decided).toBeGreaterThan(5);
    expect(s.a.brainW.subarray(0, s.a.n * NW).every(Number.isFinite)).toBe(true);
  });

  it('weights, learning state and the colony template survive save/load (IndexedDB clone and portable JSON)', () => {
    const s = small();
    tick(s, 600);
    const viaClone = restore(structuredClone(snapshot(s)));
    const viaJson = restore(decodeJSON(encodeJSON(snapshot(s))));
    for (const r of [viaClone, viaJson]) {
      expect(Array.from(r.a.brainW.subarray(0, s.a.n * NW))).toEqual(Array.from(s.a.brainW.subarray(0, s.a.n * NW)));
      expect(Array.from(r.a.brainN.subarray(0, s.a.n))).toEqual(Array.from(s.a.brainN.subarray(0, s.a.n)));
      expect(Array.from(r.aliveColonies()[0].mind!.w)).toEqual(Array.from(s.aliveColonies()[0].mind!.w));
    }
  });

  it('a new world seeded from the brain bank starts from the learnt template', () => {
    const s = small(), c = s.aliveColonies()[0];
    const w = new Float32Array(NW).map((_, k) => Math.sin(k) * 0.3);
    const seeded = createSim({ scenario: 'moved-food', seed: 42, size: [192, 128], settings: { weather: false, naturalPredators: false }, brains: [{ speciesId: c.speciesId, w, gen: 7, meanFit: 0.2, lifetimes: 30 }] });
    const m = seeded.aliveColonies()[0].mind!;
    expect(m.gen).toBe(7);
    expect(m.source).toMatch(/brain bank/);
    expect(Array.from(m.w)).toEqual(Array.from(w));
    expect(NA).toBe(9);
  });
});
