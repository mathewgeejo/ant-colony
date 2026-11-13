import { createSim } from '../src/sim/scenarios.ts';
import { NAV, MEM } from '../src/sim/ants.ts';
import { M } from '../src/sim/materials.ts';

const sim = createSim({ scenario: 'moved-food', seed: 1 });
for (let t = 1; t <= 10800; t++) sim.step();
const a = sim.a, w = sim.w;
const c = sim.aliveColonies()[0];
let shown = 0;
for (let i = 0; i < a.n && shown < 6; i++) {
  if (!a.alive[i] || a.nav[i] !== NAV.ROUTE_OUT) continue;
  shown++;
  const route = [];
  for (let k = 0; k < a.frLen[i]; k++) route.push(`${a.frX[i * MEM + k] - c.entrance.x},${a.frY[i * MEM + k] - c.entrance.y}`);
  console.log(i, 'at', a.x[i] - c.entrance.x, a.y[i] - c.entrance.y, 'target', a.tx[i] - c.entrance.x, a.ty[i] - c.entrance.y, 'idx', a.frIdx[i], '/', a.frLen[i], 'stuck', a.stuck[i], 'steps', a.stepCount[i]);
  console.log('   route', route.join(' '));
  for (let y = a.y[i] - 4; y <= a.y[i] + 3; y++) {
    let row = '';
    for (let x = a.x[i] - 8; x <= a.x[i] + 8; x++) {
      const m = w.mat[y * w.W + x];
      row += x === a.x[i] && y === a.y[i] ? '@' : x === a.tx[i] && y === a.ty[i] ? 'X' : m === M.AIR ? '.' : m === M.PLANT ? 'p' : m === M.SUGAR ? 's' : '#';
    }
    console.log('   ', row);
  }
}
