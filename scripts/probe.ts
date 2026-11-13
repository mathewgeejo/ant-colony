// Headless probe: run a scenario and print colony progress per game day.
import { createSim } from '../src/sim/scenarios.ts';
import { DAY_TICKS } from '../src/sim/physics.ts';
import { TASK_NAMES } from '../src/sim/ants.ts';

const scenario = process.argv[2] ?? 'first-colony';
const days = Number(process.argv[3] ?? 10);
const seed = Number(process.argv[4] ?? 1);
const sim = createSim({ scenario, seed });
const t0 = performance.now();
for (let d = 0; d < days; d++) {
  const ts = performance.now();
  for (let k = 0; k < DAY_TICKS; k++) sim.step();
  const ms = performance.now() - ts;
  const tasks: Record<string, number> = {};
  for (let i = 0; i < sim.a.n; i++) if (sim.a.alive[i]) tasks[TASK_NAMES[sim.a.task[i]]] = (tasks[TASK_NAMES[sim.a.task[i]]] ?? 0) + 1;
  const cols = sim.aliveColonies().map((c) => {
    const q = c.queens[0];
    const qi = q ? sim.a.findById(q.antId) : -1;
    const qh = qi >= 0 ? `h2o=${sim.a.hydration[qi].toFixed(2)} e=${sim.a.energy[qi].toFixed(2)} hp=${sim.a.health[qi].toFixed(2)}` : '';
    return `${qh} ${c.name}[${c.stage}] w=${c.workers} ad=${c.adults} brood=${c.brood.length}(${c.brood.map((b) => 'ELP'[b.stage]).join('')}) store=${c.store.sugar}/${c.store.protein}/${c.store.seed} vol=${c.nestVolume} depth=${c.nestDepth} exit=${c.hasExit} q=${q ? q.reserves.toFixed(0) : '-'} stim=${JSON.stringify(c.stim, (k, v) => typeof v === 'number' ? +v.toFixed(2) : v)} in=${c.stats.foodIn} deaths=${JSON.stringify(c.stats.adultDeaths)} bd=${JSON.stringify(c.stats.broodDeaths)}`;
  });
  const au = sim.audit();
  console.log(`day ${d + 1} (${(ms / DAY_TICKS).toFixed(2)} ms/tick) ants=${sim.a.count} T=${sim.airT.toFixed(1)}`);
  for (const c of cols) console.log('   ' + c);
  console.log('   tasks', JSON.stringify(tasks));
  console.log('   audit', JSON.stringify(au));
}
console.log('events:');
for (const e of sim.events.slice(-25)) console.log(`  [${(e.tick / DAY_TICKS).toFixed(2)}] ${e.text}`);
console.log('total s', ((performance.now() - t0) / 1000).toFixed(1));
