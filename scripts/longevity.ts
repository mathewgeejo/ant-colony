// Long unattended run: does each colony survive? Prints a compact daily line and causes of death.
// usage: node --experimental-strip-types --no-warnings scripts/longevity.ts <scenario> <days> [seed] [W H]
import { createSim } from '../src/sim/scenarios.ts';
import { DAY_TICKS } from '../src/sim/physics.ts';

const [scenario = 'first-colony', daysArg = '30', seedArg = '1', wArg, hArg] = process.argv.slice(2);
const sim = createSim({ scenario, seed: Number(seedArg), ...(wArg ? { size: [Number(wArg), Number(hArg)] as [number, number] } : {}) });
const days = Number(daysArg);
const t0 = performance.now();
for (let d = 1; d <= days; d++) {
  for (let k = 0; k < DAY_TICKS; k++) sim.step();
  const cols = sim.aliveColonies();
  const line = cols.map((c) => `${c.name}:${c.stage[0]} w${c.workers} b${c.brood.length} q${c.queens.length} s${c.store.sugar}/${c.store.protein}/${c.store.seed}`).join(' | ');
  if (d % Math.max(1, Math.round(days / 30)) === 0 || d === days) console.log(`d${d} T=${sim.airT.toFixed(0)} ants=${sim.a.count} cols=${cols.length} ${line}`);
}
console.log('deaths per colony (lineage):');
for (const c of sim.colonies) if (c && (c.stats.workersEclosed || c.workers)) console.log(`  ${c.name} alive=${c.alive} peak=${c.stats.peakWorkers} eclosed=${c.stats.workersEclosed} adult=${JSON.stringify(c.stats.adultDeaths)} brood=${JSON.stringify(c.stats.broodDeaths)}`);
for (const r of sim.lineage.filter((r) => r.diedTick >= 0).slice(-12)) console.log(`  ended: ${r.name} day ${(r.diedTick / DAY_TICKS).toFixed(1)} - ${r.causeOfEnd}`);
console.log('events tail:'); for (const e of sim.events.slice(-12)) console.log(`  [${(e.tick / DAY_TICKS).toFixed(1)}] ${e.text}`);
console.log(`${((performance.now() - t0) / 1000).toFixed(0)} s`);
