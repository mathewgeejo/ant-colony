// Diagnostic: sample haulers stuck outside / in unowned enclosed space and show their surroundings.
import { createSim } from '../src/sim/scenarios.ts';
import { DAY_TICKS } from '../src/sim/physics.ts';
import { TASK, NAV } from '../src/sim/ants.ts';
import { M, MATERIALS } from '../src/sim/materials.ts';

const sim = createSim({ scenario: process.argv[2] ?? 'colony-wars', seed: 1 });
const navName = Object.fromEntries(Object.entries(NAV).map(([k, v]) => [v, k]));
for (let k = 0; k < DAY_TICKS * 0.6; k++) sim.step();
const a = sim.a, w = sim.w;
const glyph = (x: number, y: number) => {
  if (!w.inb(x, y)) return '#';
  const k = y * w.W + x, m = w.mat[k];
  if (sim.occ[k]) return 'a';
  if (m === M.AIR) return w.owner[k] ? (w.skyExposed(x, y) ? ',' : '.') : (w.skyExposed(x, y) ? ' ' : '_');
  if (m === M.PLANT) return 'p';
  if (m === M.LOOSE) return 'l';
  return MATERIALS[m].name[0].toUpperCase();
};
let shown = 0;
for (let i = 0; i < a.n && shown < 6; i++) {
  if (!a.alive[i] || a.task[i] !== TASK.HAUL) continue;
  const c = sim.colonies[a.colony[i]]!;
  const k = a.y[i] * w.W + a.x[i];
  const own = w.owner[k] === c.slot + 1, sky = w.skyExposed(a.x[i], a.y[i]);
  if (own || (process.argv[3] === 'buried' && sky)) continue;
  shown++;
  console.log(`#${i} at ${a.x[i]},${a.y[i]} sky=${sky} owner=${w.owner[k]} nav=${navName[a.nav[i]]} steps=${a.stepCount[i]} stuck=${a.stuck[i]} ent=${c.entrance.x},${c.entrance.y} surf=${w.surface[a.x[i]]}`);
  for (let y = a.y[i] - 6; y <= a.y[i] + 4; y++) {
    let row = '';
    for (let x = a.x[i] - 14; x <= a.x[i] + 14; x++) row += x === a.x[i] && y === a.y[i] ? '@' : glyph(x, y);
    console.log('   |' + row + '|');
  }
}
