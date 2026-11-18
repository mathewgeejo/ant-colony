// What does a nest actually look like? ASCII cross-section of each colony's territory, plus depth,
// tunnel cells, chambers, share of workers underground, brood hatching and unsupported ("floating") ants.
// usage: node --experimental-strip-types --no-warnings scripts/nest-probe.ts [scenario] [days] [seed]
import { createSim } from '../src/sim/scenarios.ts';
import { DAY_TICKS } from '../src/sim/physics.ts';
import { CASTE, TASK_NAMES, WHY_TEXT } from '../src/sim/ants.ts';
import { supported } from '../src/sim/behavior.ts';
import { IS_LIQUID, IS_SOLID, M } from '../src/sim/materials.ts';

const [scenario = 'sandbox', daysArg = '20', seedArg = '1'] = process.argv.slice(2);
const sim = createSim({ scenario, seed: Number(seedArg) });
const days = Number(daysArg);
let under = 0, samples = 0, floating = 0, floatSamples = 0;
const surfaceTasks: Record<string, number> = {};
for (let d = 1; d <= days; d++) {
  for (let k = 0; k < DAY_TICKS; k++) {
    sim.step();
    if (k % 300) continue;
    const a = sim.a, w = sim.w;
    for (let i = 0; i < a.n; i++) {
      if (!a.alive[i] || a.caste[i] !== CASTE.WORKER) continue;
      samples++; if (!w.skyExposed(a.x[i], a.y[i])) under++; else { const t = `${TASK_NAMES[a.task[i]]}/${WHY_TEXT[a.why[i]].slice(0, 40)}`; surfaceTasks[t] = (surfaceTasks[t] ?? 0) + 1; }
      const m = w.mat[a.y[i] * w.W + a.x[i]];
      floatSamples++; if (!IS_LIQUID[m] && !supported(sim, a.x[i], a.y[i])) floating++;
    }
  }
  const line = sim.aliveColonies().map((c) => {
    const st = [0, 0, 0]; for (const b of c.brood) st[b.stage]++;
    const ch = c.chamber.x >= 0 ? c.chamber : c.entrance;
    return `${c.name} w${c.workers} brood e${st[0]}/l${st[1]}/p${st[2]} ecl${c.stats.workersEclosed} died${JSON.stringify(c.stats.broodDeaths)} T${sim.w.tempAt(ch.x, ch.y).toFixed(1)} s${c.store.sugar}/${c.store.protein}/${c.store.seed} vol${c.nestVolume} depth${c.nestDepth}`;
  }).join(' | ');
  if (d % Math.max(1, Math.round(days / 10)) === 0 || d === days) console.log(`d${d} ants=${sim.a.count} ${line}`);
}
console.log(`workers underground: ${(100 * under / Math.max(1, samples)).toFixed(0)}% of samples; unsupported (floating) ${(100 * floating / Math.max(1, floatSamples)).toFixed(1)}%`);
console.log('on the surface, doing:'); for (const [t, n] of Object.entries(surfaceTasks).sort((p, q) => q[1] - p[1]).slice(0, 12)) console.log(`  ${(100 * n / Math.max(1, samples)).toFixed(1)}%  ${t}`);
const w = sim.w;
for (const c of sim.aliveColonies()) {
  const own = c.slot + 1;
  let x0 = w.W, x1 = 0, y0 = w.H, y1 = 0;
  for (let k = 0; k < w.N; k++) if (w.owner[k] === own) { const x = k % w.W, y = (k / w.W) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (x1 < x0) { console.log(`${c.name}: no nest cells`); continue; }
  const ground = w.surface[c.entrance.x];
  console.log(`\n${c.name}: x ${x0}-${x1} (${x1 - x0 + 1} wide), y ${y0}-${y1}, deepest ${y1 - ground} below ground, chambers ${c.plan?.chambers.length ?? 0}, todo ${c.plan?.todo ?? 0}`);
  const ants = new Set<number>(); for (let i = 0; i < sim.a.n; i++) if (sim.a.alive[i] && sim.a.colony[i] === c.slot) ants.add(sim.a.y[i] * w.W + sim.a.x[i]);
  const brood = new Set(c.brood.map((b) => b.y * w.W + b.x));
  const step = Math.max(1, Math.ceil((x1 - x0 + 8) / 160));
  for (let y = Math.max(0, y0 - 4); y <= Math.min(w.H - 1, y1 + 1); y++) {
    let s = '';
    for (let x = Math.max(0, x0 - 4); x <= Math.min(w.W - 1, x1 + 4); x += step) {
      const k = y * w.W + x, m = w.mat[k];
      s += brood.has(k) ? 'o' : ants.has(k) ? 'a' : w.owner[k] === own && !IS_SOLID[m] ? ' ' : m === M.AIR ? (y < w.surface[x] ? '.' : '_') : m === M.WATER ? '~' : IS_SOLID[m] ? '#' : '+';
    }
    console.log(s);
  }
}
