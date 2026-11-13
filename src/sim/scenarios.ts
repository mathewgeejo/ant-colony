// World generation and seeded scenarios. Scenarios set up conditions only;
// outcomes are left to the simulation rules.
import type { Mode } from './genetics.ts';
import { L, NL, founderGenome } from './genetics.ts';
import { M, MATERIALS, MOIST_CAP, WATER_UNITS } from './materials.ts';
import { DAY_TICKS, DEFAULT_CLIMATE, type Climate } from './physics.ts';
import { Rng } from './rng.ts';
import type { Command, Settings } from './sim.ts';
import { DEFAULT_SETTINGS, Sim } from './sim.ts';
import type { SpeciesDef } from './species.ts';
import { FLAG_APHID } from './world.ts';

export interface ScenarioDef {
  id: string;
  title: string;
  blurb: string;
  goal: string;
  mode: Mode;
  defaultSize: [number, number];
}

export const SCENARIOS: ScenarioDef[] = [
  { id: 'sandbox', title: 'Free sandbox', mode: 'naturalistic', defaultSize: [512, 256], blurb: 'A temperate meadow with one newly mated black garden ant queen. Everything else is up to you.', goal: 'Build, break and observe.' },
  { id: 'first-colony', title: 'First colony', mode: 'naturalistic', defaultSize: [384, 192], blurb: 'A mild meadow with no predators. A founding queen searches for a site, seals herself in and rears her first workers from body reserves.', goal: 'Watch the queen dig a chamber, lay eggs and rear the first (nanitic) workers. Try warming the chamber with the heat tool.' },
  { id: 'moved-food', title: 'Moved food', mode: 'naturalistic', defaultSize: [384, 192], blurb: 'An established colony exploits a rich sugar patch. Use the scenario button to move the food and watch the colony rediscover it.', goal: 'Let a trail form (signal overlay), then press "Move the sugar". Foragers with route memory return to the old site first.' },
  { id: 'flooded-passage', title: 'Flooded passage', mode: 'naturalistic', defaultSize: [384, 192], blurb: 'A colony nests in a hollow below a dammed pool. Open the dam and see how water spreads through the nest and how workers respond.', goal: 'Press "Open the dam" (or paint water). Watch nurses carry brood away from water and workers re-dig passages.' },
  { id: 'competing-colonies', title: 'Competing colonies', mode: 'naturalistic', defaultSize: [512, 192], blurb: 'A black garden ant colony and a California harvester ant colony share a meadow with one central food patch.', goal: 'Observe overlapping foraging ranges, encounters at the food patch and the territory overlay.' },
  { id: 'environmental-shift', title: 'Environmental shift', mode: 'speculative', defaultSize: [512, 192], blurb: 'Twelve founding queens start in a temperate meadow. From day 30 the climate becomes hotter and drier and stays that way.', goal: 'Over several reproductive generations, compare founder genotypes for water balance and thermal optimum in the evolution panel.' },
  { id: 'fantasy-divergence', title: 'Fantasy divergence', mode: 'fantasy', defaultSize: [512, 192], blurb: 'FICTIONAL mechanics enabled. Founders carry standing variation for an air-film respiration allele and bioluminescence. Frequent storms flood the ground.', goal: 'Does the fictional trait spread? Toggle "Dry climate" to remove its benefit and keep its cost.' },
  { id: 'stress-test', title: 'Stress test (benchmark)', mode: 'naturalistic', defaultSize: [512, 256], blurb: 'Eight introduced colonies totalling about 5,000 workers, with abundant food. For measuring performance.', goal: 'Check the developer metrics panel.' },
  { id: 'inheritance-garden', title: 'Inheritance garden', mode: 'naturalistic', defaultSize: [384, 192], blurb: 'Two mature introduced colonies in a warm, provisioned experimental garden. Follow real mating flights and daughter queens without waiting for a colony to mature.', goal: 'Use Warp, then check Lineage in the field journal after about 20 model days. Food provisioning is an explicit experimental source, not a reward for a trait.' },
];

function fbm(rng: Rng, n: number, octaves: number, scale: number): Float32Array {
  const out = new Float32Array(n);
  let amp = 1, freq = 1 / scale, tot = 0;
  for (let o = 0; o < octaves; o++) {
    const pts = Math.ceil(n * freq) + 2;
    const v = Array.from({ length: pts }, () => rng.next() * 2 - 1);
    for (let x = 0; x < n; x++) {
      const t = x * freq, i = Math.floor(t), f = t - i;
      const s = f * f * (3 - 2 * f);
      out[x] += amp * (v[i] * (1 - s) + v[i + 1] * s);
    }
    tot += amp; amp *= 0.5; freq *= 2;
  }
  for (let x = 0; x < n; x++) out[x] /= tot;
  return out;
}

export interface GenOptions {
  plants: number; // 0..1 density
  ponds: number;
  logs: number;
  sandiness: number;
  clayiness: number;
  surfaceFrac: number;
  roughness: number;
}
const DEFAULT_GEN: GenOptions = { plants: 0.6, ponds: 0, logs: 2, sandiness: 0.5, clayiness: 0.5, surfaceFrac: 0.3, roughness: 7 };

export function generateTerrain(sim: Sim, seed: number, o: GenOptions = DEFAULT_GEN) {
  const w = sim.w;
  const rng = new Rng(seed ^ 0x5eed1234);
  const { W, H } = w;
  const surf = fbm(rng, W, 4, 90);
  const top = fbm(rng, W, 3, 40);
  const rock = fbm(rng, W, 3, 70);
  const base = Math.round(H * o.surfaceFrac);
  for (let x = 0; x < W; x++) {
    const s = Math.round(base + surf[x] * o.roughness);
    const td = 5 + Math.round((top[x] + 1) * 2.5);
    const bed = Math.round(H * 0.86 + rock[x] * 10);
    for (let y = 0; y < H; y++) {
      const i = y * W + x;
      let m: number = M.AIR;
      if (y >= s) m = y < s + td ? M.TOPSOIL : y < bed ? M.SOIL : M.STONE;
      w.mat[i] = m;
      w.amt[i] = MATERIALS[m].nutrient;
    }
  }
  const blob = (cx: number, cy: number, rx: number, ry: number, m: number, only: number[]) => {
    for (let y = Math.max(0, cy - ry); y <= Math.min(H - 1, cy + ry); y++)
      for (let x = Math.max(0, cx - rx); x <= Math.min(W - 1, cx + rx); x++) {
        const dx = (x - cx) / rx, dy = (y - cy) / ry;
        if (dx * dx + dy * dy > 1 + (rng.next() - 0.5) * 0.3) continue;
        const i = y * W + x;
        if (only.includes(w.mat[i])) { w.mat[i] = m; w.amt[i] = MATERIALS[m].nutrient; }
      }
  };
  const area = (W * H) / (512 * 256);
  const nClay = Math.round(10 * o.clayiness * area), nSand = Math.round(10 * o.sandiness * area);
  for (let k = 0; k < nClay; k++) blob(rng.int(W), Math.round(H * (0.45 + rng.next() * 0.35)), 10 + rng.int(30), 3 + rng.int(8), M.CLAY, [M.SOIL]);
  for (let k = 0; k < nSand; k++) blob(rng.int(W), Math.round(H * (0.38 + rng.next() * 0.4)), 8 + rng.int(22), 3 + rng.int(7), M.SAND, [M.SOIL, M.TOPSOIL]);
  for (let k = 0; k < Math.round(8 * area); k++) blob(rng.int(W), Math.round(H * (0.45 + rng.next() * 0.4)), 2 + rng.int(6), 2 + rng.int(4), M.STONE, [M.SOIL, M.CLAY]);
  for (let k = 0; k < Math.round(3 * area); k++) blob(rng.int(W), Math.round(H * (0.6 + rng.next() * 0.25)), 6 + rng.int(10), 2 + rng.int(3), M.GRAVEL, [M.SOIL]);
  w.recomputeAllSurface();
  // ponds: depressions filled with water
  for (let k = 0; k < o.ponds; k++) {
    const cx = 30 + rng.int(W - 60), rx = 10 + rng.int(14), depth = 4 + rng.int(4);
    let level = H;
    for (let x = cx - rx; x <= cx + rx; x++) level = Math.min(level, w.surface[x]);
    for (let x = cx - rx; x <= cx + rx; x++) {
      const d = Math.round(depth * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2)));
      for (let y = level; y < level + d; y++) { const i = y * W + x; w.mat[i] = M.WATER; w.amt[i] = WATER_UNITS; }
      for (let y = w.surface[x]; y < level; y++) { const i = y * W + x; w.mat[i] = M.AIR; }
      const c = (level + d) * W + x; if (w.mat[c] !== M.STONE) { w.mat[c] = M.CLAY; w.amt[c] = 15; }
    }
  }
  // initial soil moisture: wetter with depth, by material capacity
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const cap = MOIST_CAP[w.mat[i]];
      if (!cap || w.mat[i] === M.WATER) continue;
      const depth = (y - w.surface[x]) / H;
      w.moist[i] = Math.round(cap * Math.min(0.85, 0.35 + depth * 0.8 + (rng.next() - 0.5) * 0.1));
    }
  w.recomputeAllSurface();
  // logs and leaf litter
  for (let k = 0; k < o.logs; k++) {
    const x0 = 10 + rng.int(W - 40), len = 10 + rng.int(14);
    let y0 = H;
    for (let x = x0; x < x0 + len; x++) y0 = Math.min(y0, w.surface[x]);
    for (let x = x0; x < x0 + len; x++) for (let y = y0 - 3; y < w.surface[x]; y++) if (y >= 0) w.mat[y * W + x] = M.WOOD;
  }
  w.recomputeAllSurface();
  for (let x = 0; x < W; x++) {
    if (rng.chance(0.35)) {
      const s = w.surface[x];
      if (s > 1 && w.mat[s * W + x] === M.TOPSOIL && rng.chance(0.5)) { const i = (s - 1) * W + x; w.mat[i] = M.ORGANIC; w.amt[i] = 120; w.moist[i] = 100; }
    }
  }
  w.recomputeAllSurface();
  // plants with some aphid groups
  for (let x = 2; x < W - 2; x++) {
    if (!rng.chance(o.plants * 0.18)) continue;
    const s = w.surface[x];
    if (w.mat[s * W + x] !== M.TOPSOIL && w.mat[s * W + x] !== M.ORGANIC) continue;
    if (w.mat[(s - 1) * W + x - 1] === M.PLANT) continue;
    const h = 3 + rng.int(7);
    for (let k = 1; k <= h; k++) { const i = (s - k) * W + x; if (w.mat[i] !== M.AIR) break; w.mat[i] = M.PLANT; w.amt[i] = 15; if (k > 2 && rng.chance(0.06)) w.flags[i] |= FLAG_APHID; }
    for (let d = 1; d <= 3 + rng.int(4); d++) { const i = (s + d) * W + x; if (w.mat[i] === M.TOPSOIL || w.mat[i] === M.SOIL) w.mat[i] = M.ROOT; }
  }
  w.recomputeAllSurface();
  for (let i = 0; i < w.N; i++) if (w.moist[i] > MOIST_CAP[w.mat[i]]) w.moist[i] = MOIST_CAP[w.mat[i]];
}

function spinUp(sim: Sim) {
  const w = sim.w;
  // initialise temperature profile, then relax fields without advancing time
  for (let ty = 0; ty < w.TH; ty++) for (let tx = 0; tx < w.TW; tx++) w.temp[ty * w.TW + tx] = sim.climate.meanTemp - 2 + (sim.climate.deepTemp - sim.climate.meanTemp) * (ty / w.TH);
  for (let k = 0; k < 120; k++) sim.phys.stepTemperature(0, sim.climate);
  for (let k = 0; k < 10; k++) sim.phys.stepHumidity(sim.climate);
}

function setInitialLedger(sim: Sim) {
  const w = sim.w;
  const [s, p, d] = w.cellFood();
  const [ss, sp, sd] = sim.storeFood();
  w.ledger.initial = { water: w.totalWater(), sugar: s + ss, protein: p + sp, seed: d + sd };
  // anything ledgered during setup is folded into the initial inventory
  for (const r of ['water', 'sugar', 'protein', 'seed']) { w.ledger.sources[r] = {}; w.ledger.sinks[r] = {}; }
}

function surfaceY(sim: Sim, x: number) { return sim.w.surface[Math.max(0, Math.min(sim.w.W - 1, x))]; }

function patch(sim: Sim, mat: number, cx: number, r: number, units?: number) {
  const w = sim.w;
  for (let dx = -r; dx <= r; dx++) {
    const x = cx + dx;
    const s = surfaceY(sim, x);
    const hgt = Math.max(1, Math.round((r - Math.abs(dx)) / 1.5));
    for (let k = 1; k <= hgt; k++) {
      const i = (s - k) * w.W + x;
      if (w.mat[i] !== M.AIR) continue;
      w.mat[i] = mat; w.amt[i] = units ?? MATERIALS[mat].foodUnits;
    }
  }
  w.recomputeAllSurface();
}

function clearPlantsNear(sim: Sim, cx: number, r: number) {
  const w = sim.w;
  for (let x = cx - r; x <= cx + r; x++) for (let y = 0; y < w.H; y++) { const i = y * w.W + x; if (w.mat[i] === M.PLANT) { w.mat[i] = M.AIR; w.flags[i] = 0; } }
  w.recomputeAllSurface();
}

export interface CreateOptions {
  scenario: string;
  seed: number;
  mode?: Mode;
  size?: [number, number];
  settings?: Partial<Settings>;
  climate?: Partial<Climate>;
  customSpecies?: SpeciesDef[];
}

export function createSim(opt: CreateOptions): Sim {
  const def = SCENARIOS.find((s) => s.id === opt.scenario) ?? SCENARIOS[0];
  const [W, H] = opt.size ?? def.defaultSize;
  const climate: Climate = { ...DEFAULT_CLIMATE, ...opt.climate };
  const settings: Settings = { ...DEFAULT_SETTINGS, ...opt.settings };
  const mode = opt.mode ?? def.mode;
  const seed = opt.seed >>> 0;
  let gen: GenOptions = { ...DEFAULT_GEN };
  if (def.id === 'first-colony') { climate.meanTemp = 21; climate.rainChancePerDay = 0.15; settings.naturalPredators = false; gen = { ...gen, plants: 0.8 }; }
  if (def.id === 'moved-food' || def.id === 'flooded-passage') { settings.naturalPredators = false; climate.rainChancePerDay = 0.05; gen = { ...gen, plants: 0.15, logs: 0 }; }
  if (def.id === 'competing-colonies') { settings.naturalPredators = false; climate.meanTemp = 23; gen = { ...gen, plants: 0.12, logs: 0 }; }
  if (def.id === 'fantasy-divergence') { climate.rainChancePerDay = 0.6; climate.rainIntensity = 3; gen = { ...gen, ponds: 2 }; }
  if (def.id === 'stress-test') { settings.naturalPredators = false; settings.maxColonies = 30; gen = { ...gen, plants: 0.9 }; }
  if (def.id === 'inheritance-garden') { Object.assign(climate,{meanTemp:27,deepTemp:25,dayAmp:2,seasonAmp:2,rainChancePerDay:0}); settings.weather=false;settings.naturalPredators=false; }
  if (opt.climate) Object.assign(climate, opt.climate);
  if (opt.settings) Object.assign(settings, opt.settings);
  const sim = new Sim({ W, H, seed, mode, scenario: def.id, climate, settings, customSpecies: opt.customSpecies });
  sim.createOpts = structuredClone(opt);
  generateTerrain(sim, seed, gen);
  sim.scenarioInfo = { id: def.id, title: def.title, goal: def.goal, actions: [] };
  const lasius = sim.speciesById('lasius-niger');
  const pogo = sim.speciesById('pogonomyrmex-californicus');
  const rng = new Rng(seed ^ 0xa11ce);
  const queenAt = (sp: SpeciesDef, x: number, g?: (g: Float32Array) => void) => {
    const ga = founderGenome(sim.rng), gb = founderGenome(sim.rng);
    if (g) { g(ga); g(gb); }
    sim.foundColony(sp, x, surfaceY(sim, x) - 1, ga, gb, sim.sampleMates(sp, [], 0), 0, 0, null);
  };
  switch (def.id) {
    case 'sandbox':
      queenAt(lasius, Math.round(W * 0.5));
      break;
    case 'first-colony':
      patch(sim, M.PROTEIN, Math.round(W * 0.52), 3);
      queenAt(lasius, Math.round(W * 0.45));
      break;
    case 'moved-food': {
      const nx = Math.round(W * 0.4), fx = Math.round(W * 0.62), alt = Math.round(W * 0.2);
      clearPlantsNear(sim, fx, 6);
      sim.establishedColony(lasius, nx, surfaceY(sim, nx) - 1, 45);
      patch(sim, M.SUGAR, fx, 4);
      patch(sim, M.PROTEIN, fx + 7, 1);
      clearPlantsNear(sim, alt, 6);
      const sy = surfaceY(sim, fx), ay = surfaceY(sim, alt);
      sim.scenarioInfo.actions = [{
        label: 'Move the sugar',
        cmds: [{ t: 'erase', x: fx, y: sy - 2, r: 5 } as Command, { t: 'paint', mat: M.SUGAR, x: alt, y: ay - 2, r: 3 } as Command],
      }];
      break;
    }
    case 'flooded-passage': {
      const nx = Math.round(W * 0.55);
      // carve a hollow around the nest site so surface water collects there
      const w = sim.w;
      const s0 = surfaceY(sim, nx);
      for (let x = nx - 18; x <= nx + 18; x++) {
        const dip = Math.round(5 * Math.cos(((x - nx) / 18) * (Math.PI / 2)));
        for (let y = surfaceY(sim, x); y < s0 + dip; y++) { const i = y * w.W + x; if (w.mat[i] !== M.STONE) { w.mat[i] = M.AIR; w.moist[i] = 0; w.amt[i] = 0; } }
      }
      w.recomputeAllSurface();
      clearPlantsNear(sim, nx, 20);
      const nest = sim.establishedColony(lasius, nx, surfaceY(sim, nx) - 1, 40);
      // dammed pool uphill (left)
      const px0 = nx - 60, px1 = nx - 30;
      let top = H;
      for (let x = px0; x <= px1; x++) top = Math.min(top, surfaceY(sim, x));
      const damTop = top - 12;
      for (let y = damTop; y < surfaceY(sim, px1 + 1) + 1; y++) for (const x of [px0 - 1, px1 + 1]) { const i = y * w.W + x; w.mat[i] = M.BARRIER; w.amt[i] = 0; w.moist[i] = 0; }
      for (let x = px0; x <= px1; x++) for (let y = damTop + 1; y < surfaceY(sim, x); y++) { const i = y * w.W + x; w.mat[i] = M.WATER; w.amt[i] = WATER_UNITS; }
      // Impermeable experimental reservoir and a connected, downhill spillway.
      // This sets flood exposure; mortality/rescue outcomes still follow agent rules.
      for (let x = px0; x <= px1; x++) { const k = surfaceY(sim, x) * w.W + x; w.mat[k] = M.BARRIER; w.moist[k] = 0; w.amt[k] = 0; }
      const inlet = nest?.entrance.y ?? s0;
      for (let x = px1 + 2; x < nx; x++) {
        const yy = Math.round(damTop + 6 + (inlet - damTop - 6) * (x - px1 - 1) / (nx - px1 - 1));
        for (let dy = -1; dy <= 0; dy++) { const k = (yy + dy) * w.W + x; w.mat[k] = M.AIR; w.moist[k] = 0; w.amt[k] = 0; }
        const k = (yy + 1) * w.W + x; w.mat[k] = M.BARRIER; w.moist[k] = 0; w.amt[k] = 0;
      }
      w.recomputeAllSurface();
      sim.scenarioInfo.actions = [
        { label: 'Open the dam', cmds: [{ t: 'erase', x: px1 + 1, y: damTop + 6, r: 6 } as Command] },
        { label: 'Heavy rain over the nest', cmds: [{ t: 'rain', x: nx, y: 0, r: 30 } as Command] },
      ];
      break;
    }
    case 'competing-colonies': {
      const a = Math.round(W * 0.3), b = Math.round(W * 0.7), mid = Math.round(W * 0.5);
      clearPlantsNear(sim, mid, 10);
      sim.establishedColony(lasius, a, surfaceY(sim, a) - 1, 50);
      sim.establishedColony(pogo, b, surfaceY(sim, b) - 1, 50);
      patch(sim, M.SUGAR, mid - 3, 3);
      patch(sim, M.SEED, mid + 4, 3, 1);
      patch(sim, M.PROTEIN, mid, 1);
      break;
    }
    case 'environmental-shift': {
      for (let k = 0; k < 12; k++) queenAt(lasius, Math.round(((k + 0.5) / 12) * W));
      const t1 = 30 * DAY_TICKS;
      sim.scheduled.push(
        { tick: t1, cmd: { t: 'climate', key: 'meanTemp', value: climate.meanTemp + 5 }, note: 'Climate shift: mean temperature +5 C (sustained).' },
        { tick: t1, cmd: { t: 'climate', key: 'baseHumidity', value: climate.baseHumidity - 0.2 }, note: 'Climate shift: surface air humidity -0.2 (sustained).' },
        { tick: t1, cmd: { t: 'climate', key: 'rainChancePerDay', value: 0.08 }, note: 'Climate shift: rain becomes rare (sustained).' },
        { tick: t1, cmd: { t: 'climate', key: 'evaporation', value: 1.8 }, note: '' },
      );
      break;
    }
    case 'fantasy-divergence': {
      for (let k = 0; k < 10; k++) queenAt(lasius, Math.round(((k + 0.5) / 10) * W), (g) => {
        // standing variation in fictional loci (explicit scenario setup, not pressure-induced mutation)
        if (rng.chance(0.4)) g[L.plastron] = rng.range(0.3, 0.9);
        if (rng.chance(0.3)) g[L.biolum] = rng.range(0.3, 0.9);
        g[L.waterbal] = Math.max(g[L.waterbal], 0.5);
      });
      sim.scenarioInfo.actions = [
        { label: 'Dry climate (remove the benefit)', cmds: [{ t: 'climate', key: 'rainChancePerDay', value: 0.05 } as Command, { t: 'climate', key: 'baseHumidity', value: 0.35 } as Command] },
        { label: 'Stormy climate', cmds: [{ t: 'climate', key: 'rainChancePerDay', value: 0.6 } as Command, { t: 'climate', key: 'baseHumidity', value: 0.55 } as Command] },
      ];
      break;
    }
    case 'stress-test': {
      for (let k = 0; k < 8; k++) {
        const x = Math.round(((k + 0.5) / 8) * W);
        const sp = k % 2 ? pogo : lasius;
        const c = sim.establishedColony(sp, x, surfaceY(sim, x) - 1, 620);
        if (c) { c.store.sugar += 400; c.store.protein += 300; c.store.seed += 200; }
        patch(sim, M.SUGAR, x + 25, 3);
        patch(sim, M.SEED, x - 25, 2, 1);
      }
      break;
    }
    case 'inheritance-garden': {
      for (const x of [Math.round(W * .26), Math.round(W * .73)]) {
        const c = sim.establishedColony(lasius, x, surfaceY(sim,x)-1, 100);
        if(c){ c.store.sugar+=3000; c.store.protein+=3000; }
      }
      sim.event('experiment','Experimental garden: each mature colony starts with 3,000 additional sugar and protein units.');
      break;
    }
  }
  void NL;
  sim.w.recomputeAllSurface();
  spinUp(sim);
  setInitialLedger(sim);
  for (const c of sim.colonies) if (c && c.alive) sim.scanNest(c);
  return sim;
}
