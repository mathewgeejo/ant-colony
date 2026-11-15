// Diagnostic: where are spoil haulers and why are they not finishing?
import { createSim } from '../src/sim/scenarios.ts';
import { DAY_TICKS } from '../src/sim/physics.ts';
import { TASK, NAV, WHY } from '../src/sim/ants.ts';

const scenario = process.argv[2] ?? 'colony-wars';
const days = Number(process.argv[3] ?? 2);
const sim = createSim({ scenario, seed: Number(process.argv[4] ?? 1) });
const navName = Object.fromEntries(Object.entries(NAV).map(([k, v]) => [v, k]));
const whyName = Object.fromEntries(Object.entries(WHY).map(([k, v]) => [v, k]));
for (let d = 0; d < days * 4; d++) {
  for (let k = 0; k < DAY_TICKS / 4; k++) sim.step();
  const a = sim.a, w = sim.w;
  const buckets: Record<string, number> = {};
  let n = 0, steps = 0, stuck = 0;
  for (let i = 0; i < a.n; i++) {
    if (!a.alive[i] || a.task[i] !== TASK.HAUL) continue;
    n++;
    const c = sim.colonies[a.colony[i]]!;
    const k = a.y[i] * w.W + a.x[i];
    const own = w.owner[k] === c.slot + 1;
    const sky = w.skyExposed(a.x[i], a.y[i]);
    const where = own ? 'own' : sky ? 'sky' : 'buried-foreign';
    const key = `${where}/${navName[a.nav[i]]}/${whyName[a.why[i]]}/carry=${a.carry[i]}`;
    buckets[key] = (buckets[key] ?? 0) + 1;
    steps += a.stepCount[i]; stuck += a.stuck[i];
  }
  console.log(`t=${(sim.tick / DAY_TICKS).toFixed(2)} haulers=${n} avgSteps=${(steps / Math.max(1, n)).toFixed(0)} avgStuck=${(stuck / Math.max(1, n)).toFixed(0)}`);
  for (const [k, v] of Object.entries(buckets).sort((p, q) => q[1] - p[1]).slice(0, 8)) console.log('   ', v, k);
  // follow in-nest EXIT haulers for 200 ticks
  const ids: number[] = [];
  for (let i = 0; i < a.n; i++) if (a.alive[i] && a.task[i] === TASK.HAUL && a.nav[i] === NAV.EXIT && w.owner[a.y[i] * w.W + a.x[i]] === a.colony[i] + 1) ids.push(i);
  const start = ids.map((i) => [a.x[i], a.y[i], sim.nestDist[a.y[i] * w.W + a.x[i]]]);
  let minD: number[] = start.map((s) => s[2] || 9999);
  for (let k = 0; k < 200; k++) { sim.step(); ids.forEach((i, n) => { const d = sim.nestDist[a.y[i] * w.W + a.x[i]]; if (d && d < minD[n]) minD[n] = d; }); }
  const lines = ids.slice(0, 10).map((i, n) => `#${i} c${a.colony[i]} (${start[n][0]},${start[n][1]}) nd=${start[n][2]} -> (${a.x[i]},${a.y[i]}) nd=${sim.nestDist[a.y[i] * w.W + a.x[i]]} min=${minD[n]} task=${a.task[i]} nav=${navName[a.nav[i]]} occ=${sim.occ[a.y[i] * w.W + a.x[i]]} ent=${sim.colonies[a.colony[i]]!.entrance.x},${sim.colonies[a.colony[i]]!.entrance.y}`);
  for (const l of lines) console.log('      ', l);
}
