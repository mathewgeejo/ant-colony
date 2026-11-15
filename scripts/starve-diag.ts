// Diagnostic: what were ants doing when they starved?
import { createSim } from '../src/sim/scenarios.ts';
import { DAY_TICKS } from '../src/sim/physics.ts';
import { TASK_NAMES, WHY, NAV } from '../src/sim/ants.ts';
import { MATERIALS } from '../src/sim/materials.ts';

const sim = createSim({ scenario: process.argv[2] ?? 'colony-wars', seed: 1 });
const whyName = Object.fromEntries(Object.entries(WHY).map(([k, v]) => [v, k]));
const navName = Object.fromEntries(Object.entries(NAV).map(([k, v]) => [v, k]));
const tally: Record<string, number> = {};
let shown = 0;
const orig = sim.killAnt.bind(sim);
sim.killAnt = (i: number, cause: string) => {
  if (cause === 'starvation') {
    const a = sim.a, w = sim.w, c = sim.colonies[a.colony[i]]!;
    const k = a.y[i] * w.W + a.x[i];
    const where = w.owner[k] === c.slot + 1 ? 'own' : w.owner[k] ? 'foreign' : w.skyExposed(a.x[i], a.y[i]) ? 'sky' : 'enclosed';
    const key = `${where} ${TASK_NAMES[a.task[i]]}/${whyName[a.why[i]]}/${navName[a.nav[i]]} major=${a.major[i]} d=${Math.round(Math.hypot(a.x[i] - c.entrance.x, a.y[i] - c.entrance.y))}`;
    tally[key] = (tally[key] ?? 0) + 1;
    if (where === 'sky' && Math.hypot(a.x[i] - c.entrance.x, a.y[i] - c.entrance.y) > 20 && (shown++ < 2)) {
      console.log(`${key} at ${a.x[i]},${a.y[i]} ent=${c.entrance.x},${c.entrance.y} hasExit=${c.hasExit} sealed=${c.sealed} stuck=${a.stuck[i]} memLen=${a.memLen[i]}`);
      const cx = Math.round((a.x[i] + c.entrance.x) / 2), cy = Math.round((a.y[i] + c.entrance.y) / 2);
      for (let y = cy - 10; y <= cy + 4; y++) { let row = ''; for (let x = cx - 20; x <= cx + 20; x++) { const m = w.get(x, y); row += x === a.x[i] && y === a.y[i] ? '@' : x === c.entrance.x && y === c.entrance.y ? 'E' : m === 0 ? (w.owner[y * w.W + x] === c.slot + 1 ? '.' : ' ') : MATERIALS[m].name[0]; } console.log('   |' + row + '|'); }
    }
  }
  orig(i, cause);
};
for (let k = 0; k < DAY_TICKS * Number(process.argv[3] ?? 6); k++) sim.step();
for (const [k, v] of Object.entries(tally).sort((p, q) => q[1] - p[1])) console.log(v, k);
