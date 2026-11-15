// Headless probe for war and soldier behaviour: per-day colony strength, majors, strategy and war events.
import { createSim } from '../src/sim/scenarios.ts';
import { DAY_TICKS } from '../src/sim/physics.ts';
import { TASK_NAMES, WHY } from '../src/sim/ants.ts';

const days = Number(process.argv[2] ?? 6);
const sim = createSim({ scenario: process.argv[3] ?? 'colony-wars', seed: Number(process.argv[4] ?? 1) });
const whyName = Object.fromEntries(Object.entries(WHY).map(([k, v]) => [v, k]));
for (let d = 0; d < days; d++) {
  const t0 = performance.now();
  for (let k = 0; k < DAY_TICKS; k++) sim.step();
  const a = sim.a;
  console.log(`day ${d + 1} ants=${a.count} ${((performance.now() - t0) / DAY_TICKS).toFixed(2)} ms/tick`);
  for (const c of sim.aliveColonies()) {
    let majors = 0, haul = 0;
    const majorTasks: Record<string, number> = {};
    for (let i = 0; i < a.n; i++) {
      if (!a.alive[i] || a.colony[i] !== c.slot || a.caste[i] !== 0) continue;
      if (a.task[i] === 4) haul++;
      if (!a.major[i]) continue;
      majors++;
      const k = `${TASK_NAMES[a.task[i]]}/${whyName[a.why[i]]}`;
      majorTasks[k] = (majorTasks[k] ?? 0) + 1;
    }
    const w = c.war;
    console.log(`  ${c.name} ${sim.speciesOf(c).id} w=${c.workers} majors=${majors} haul=${haul} brood=${c.brood.length} store=${c.store.sugar}/${c.store.protein}/${c.store.seed} in=${c.stats.foodIn} stim=${c.stim.forage.toFixed(2)} vol=${c.nestVolume} depth=${c.nestDepth} galleries=${c.plan?.tunnels?.length ?? 0} todo=${c.plan?.todo} strat=${w?.strategy} raids=${w?.raids}/${w?.raidsWon} stolen=${w?.broodStolen} recapt=${w?.recaptured ?? 0} target%=${((w?.majorTarget ?? 0) * 100).toFixed(0)} deaths=${JSON.stringify(c.stats.adultDeaths)}`);
    if (majors) console.log('     majors:', JSON.stringify(majorTasks));
  }
}
console.log('events:');
for (const e of sim.events.filter((e) => /raid|war|battle|absorb|plug|major|strategy|siege|recruit|scout/.test(e.kind + e.text)).slice(-30)) console.log(`  [${(e.tick / DAY_TICKS).toFixed(2)}] ${e.text}`);
