// Finds the first tick at which a restored copy diverges from the live sim, and which ant fields differ.
import { createSim } from '../src/sim/scenarios.ts';
import { decodeJSON, encodeJSON, restore, snapshot } from '../src/sim/persist.ts';
import { SOA_KEYS, PER } from '../src/sim/ants.ts';

const s = createSim({ scenario: 'moved-food', seed: 42, size: [192, 128], settings: { weather: false, naturalPredators: false } });
for (let k = 0; k < 600; k++) s.step();
const r = restore(decodeJSON(encodeJSON(snapshot(s))));
for (let t = 0; t < 600; t++) {
  const rs = s.rng.state().join(), rr = r.rng.state().join();
  if (rs !== rr || s.hash() !== r.hash()) {
    console.log(`diverged before step ${t} (tick ${s.tick}) rng same=${rs === rr}`);
    for (const k of SOA_KEYS) {
      const a = (s.a as any)[k], b = (r.a as any)[k], n = s.a.n * (PER[k] ?? 1);
      for (let i = 0; i < n; i++) if (a[i] !== b[i] && !(Number.isNaN(a[i]) && Number.isNaN(b[i]))) { console.log(`  ant field ${k}[${i}] live=${a[i]} restored=${b[i]}`); break; }
    }
    for (const c of s.colonies) if (c) { const o = r.colonies[c.slot]!; for (const key of ['workers', 'adults', 'nestVolume', 'hasExit', 'chamber', 'stim', 'store'] as const) if (JSON.stringify(c[key]) !== JSON.stringify(o[key])) console.log(`  colony ${c.name}.${key} live=${JSON.stringify(c[key])} restored=${JSON.stringify(o[key])}`); }
    break;
  }
  s.step(); r.step();
}
