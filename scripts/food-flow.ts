// Food-flow diagnostic: surface food available vs delivered vs eaten, per colony, every N days.
// usage: node --experimental-strip-types --no-warnings scripts/food-flow.ts <scenario> <days> [seed]
import { createSim } from '../src/sim/scenarios.ts';
import { DAY_TICKS } from '../src/sim/physics.ts';
import { TASK } from '../src/sim/ants.ts';

const [scenario = 'first-colony', daysArg = '30', seedArg = '1'] = process.argv.slice(2);
const sim = createSim({ scenario, seed: Number(seedArg) });
const t0 = performance.now();
for (let d = 1; d <= Number(daysArg); d++) {
  for (let k = 0; k < DAY_TICKS; k++) sim.step();
  const [s, p, sd] = sim.w.cellFood();
  const L = sim.w.ledger;
  const sum = (o: Record<string, number> | undefined) => Object.entries(o ?? {}).map(([k, v]) => `${k}:${Math.round(v)}`).join(',');
  let forage = 0, idle = 0, workers = 0, eAvg = 0;
  for (let i = 0; i < sim.a.n; i++) if (sim.a.alive[i] && sim.a.caste[i] === 0) { workers++; eAvg += sim.a.energy[i]; if (sim.a.task[i] === TASK.FORAGE || sim.a.task[i] === TASK.RETURN) forage++; if (sim.a.task[i] === TASK.IDLE) idle++; }
  if (d % 3 === 0) {
    console.log(`d${d} world food s/p/seed=${s}/${p}/${sd} workers=${workers} foraging=${forage} idle=${idle} eAvg=${(eAvg / Math.max(1, workers)).toFixed(2)}`);
    for (const c of sim.aliveColonies()) console.log(`   ${c.name} in=${c.stats.foodIn.join('/')} store=${c.store.sugar}/${c.store.protein}/${c.store.seed} brood=${c.brood.length} stim.forage=${c.stim.forage.toFixed(2)} hasExit=${c.hasExit}`);
    console.log(`   src sugar{${sum(L.sources.sugar)}} protein{${sum(L.sources.protein)}}`);
    console.log(`   sink sugar{${sum(L.sinks.sugar)}} protein{${sum(L.sinks.protein)}}`);
  }
}
console.log(`${((performance.now() - t0) / 1000).toFixed(0)} s`);
