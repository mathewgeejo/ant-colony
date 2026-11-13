import { createSim } from '../src/sim/scenarios.ts';
import { TASK, NAV } from '../src/sim/ants.ts';

const sim = createSim({ scenario: 'moved-food', seed: 1 });
const c = sim.aliveColonies()[0];
const navNames = Object.fromEntries(Object.entries(NAV).map(([k, v]) => [v, k]));
for (let t = 1; t <= 3600 * 3; t++) {
  sim.step();
  if (t % 1800 === 0) {
    const a = sim.a;
    const hist: Record<string, number> = {};
    const xs: number[] = [];
    let strong = 0, cells = 0;
    for (const ci of c.trail.live) for (const v of c.trail.chunks[ci]!) { if (v > 0.05) cells++; if (v > 1) strong++; }
    for (let i = 0; i < a.n; i++) {
      if (!a.alive[i] || a.task[i] !== TASK.FORAGE && a.task[i] !== TASK.RETURN) continue;
      const k = `${a.task[i] === TASK.FORAGE ? 'F' : 'R'}:${navNames[a.nav[i]]}`;
      hist[k] = (hist[k] ?? 0) + 1;
      xs.push(a.x[i] - c.entrance.x);
    }
    xs.sort((p, q) => p - q);
    console.log(`t=${t} deliveries=${sim.counters.deliveries} trailCells=${cells} strong=${strong} hist=${JSON.stringify(hist)}`);
    console.log('   dx from nest:', xs.join(','));
    let fr = 0;
    for (let i = 0; i < a.n; i++) if (a.alive[i] && a.frLen[i] > 0) fr++;
    console.log('   ants with food memory', fr, 'memFails', sim.flags.memoryFailures, 'routeBlocks', sim.flags.routeBlocks);
    const all: Record<string, number> = {};
    for (let i = 0; i < a.n; i++) if (a.alive[i]) { const k = `${a.task[i]}:${navNames[a.nav[i]]}:w${a.why[i]}`; all[k] = (all[k] ?? 0) + 1; }
    console.log('   all', JSON.stringify(all), 'store', JSON.stringify(c.store), 'stim', JSON.stringify(c.stim), 'adults', c.adults, 'exit', c.hasExit);
  }
}
