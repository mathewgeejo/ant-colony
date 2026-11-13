import { createSim } from '../src/sim/scenarios.ts';
import { M } from '../src/sim/materials.ts';

const sim = createSim({ scenario: 'moved-food', seed: 1 });
const c = sim.aliveColonies()[0];
console.log('entrance', c.entrance, 'chamber', c.chamber, 'exit', c.hasExit, 'vol', c.nestVolume, 'sealed', c.sealed);
const w = sim.w;
for (let y = c.entrance.y - 3; y < c.entrance.y + 8; y++) {
  let row = '';
  for (let x = c.entrance.x - 6; x < c.entrance.x + 8; x++) {
    const k = y * w.W + x;
    const m = w.mat[k];
    row += m === M.AIR ? (w.owner[k] ? 'o' : '.') : m === M.TOPSOIL ? 'T' : m === M.SOIL ? 'S' : m === M.PLANT ? 'p' : m === M.LOOSE ? 'L' : String(m % 10);
  }
  console.log(y, row, 'surf', w.surface[c.entrance.x]);
}
for (let t = 0; t < 3600; t++) {
  sim.step();
  if (!c.hasExit) {
    console.log('lost exit at', t, 'surface', w.surface[c.entrance.x], 'sealed', c.sealed);
    const qi = sim.a.findById(c.queens[0].antId);
    console.log('queen at', sim.a.x[qi], sim.a.y[qi], 'owner', w.owner[sim.a.y[qi] * w.W + sim.a.x[qi]], 'mat', w.mat[sim.a.y[qi] * w.W + sim.a.x[qi]], 'chamber', c.chamber);
    for (let y = c.entrance.y; y < c.entrance.y + 6; y++) console.log(y, w.skyExposed(c.entrance.x, y), w.owner[y * w.W + c.entrance.x]);
    break;
  }
}
console.log('exit', c.hasExit, 'vol', c.nestVolume, 'entrance', c.entrance);
for (let y = c.entrance.y - 6; y < c.entrance.y + 30; y++) {
  let row = '';
  for (let x = c.entrance.x - 20; x < c.entrance.x + 20; x++) {
    const k = y * w.W + x;
    const m = w.mat[k];
    row += m === M.AIR ? (w.owner[k] ? 'o' : '.') : m === M.TOPSOIL ? 'T' : m === M.SOIL ? 'S' : m === M.PLANT ? 'p' : m === M.LOOSE ? 'L' : String(m % 10);
  }
  console.log(y, row);
}
