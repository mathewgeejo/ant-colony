// Underground kingdoms: highways, outposts, borders, breaches and infiltration raids over time.
// usage: node --experimental-strip-types --no-warnings scripts/tunnel-probe.ts [scenario] [days] [seed]
import { createSim } from '../src/sim/scenarios.ts';
import { DAY_TICKS } from '../src/sim/physics.ts';
import { territorySummary } from '../src/sim/architecture.ts';

const [scenario = 'living-world', daysArg = '30', seedArg = '1'] = process.argv.slice(2);
const sim = createSim({ scenario, seed: Number(seedArg), world: { colonies: 4 } });
const t0 = performance.now();
for (let d = 1; d <= Number(daysArg); d++) {
  for (let k = 0; k < DAY_TICKS; k++) sim.step();
  if (d % 5 && d !== Number(daysArg)) continue;
  console.log(`day ${d} ants=${sim.a.count} ${((performance.now() - t0) / d / 1000).toFixed(1)} s/day`);
  for (const c of sim.aliveColonies()) {
    const t = territorySummary(sim, c);
    console.log(`  ${c.name} w=${c.workers} cells=${t.cells} todo=${t.todo} span=${t.span}% outposts=${t.outposts} shafts=${t.shafts} strat=${c.war?.strategy ?? '-'} raids=${c.war?.raids ?? 0}`);
    for (const r of t.roads) console.log(`     ${r.name}: ${r.len} cells, ${r.outposts} outposts, ${r.status}`);
    for (const k of t.contacts) console.log(`     contact with ${k.colony} at x=${k.x}${k.breached ? ' (BREACHED)' : ''}`);
  }
}
console.log('events:');
for (const e of sim.events.filter((e) => /tunnel|infiltr|border|raid/i.test(e.text)).slice(-25)) console.log(`  [${(e.tick / DAY_TICKS).toFixed(1)}] ${e.text}`);
