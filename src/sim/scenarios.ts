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
import { BIOMES, colonySites, decorateWorld, plantTrees, planWorld, type WorldOptions } from './worldgen.ts';
import { validBank, type BankEntry } from './brain.ts';

export interface ScenarioDef {
  id: string;
  title: string;
  blurb: string;
  goal: string;
  mode: Mode;
  defaultSize: [number, number];
}

export const SCENARIOS: ScenarioDef[] = [
  {id:'powder-lab',title:'Powder workshop',mode:'naturalistic',defaultSize:[384,192],blurb:'Six stations for fluttering grains, floating flakes, borax/glue, metal/water, hot phases and shielded exposure. All reactions use the live rules.',goal:'Pour powder, change heat, inspect products and try the exposure overlay. Open the shield window and compare the field on either side. Chemistry, radiation and time are game abstractions.'},
  {id:'liquid-lab',title:'Liquid reaction lab',mode:'naturalistic',defaultSize:[384,192],blurb:'Eight labeled vessels for curdling, cement, emulsions, fermentation, cryogens, stains, mercury and heated sugar. Reactions run locally.',goal:'Inspect the vessels, change heat or add a reagent. Carrier water, food units, finite doses and reaction progress are saved. These are authored sandbox rules, not a chemistry prediction.'},
  {id:'life-garden',title:'Living garden',mode:'naturalistic',defaultSize:[384,192],blurb:'A provisioned experimental garden with a pond, flowers, decomposers, grazers and predators. Wildlife uses simplified sandbox profiles.',goal:'Inspect animals to see their tasks and stages. Move food, cut a plant, drain the pond or add a wall. Watch locally available resources affect survival and reproduction.'},
  { id:'empty',title:'Empty particle sandbox',mode:'naturalistic',defaultSize:[384,192],blurb:'An empty canvas for falling sand, fluids, heat and circuits. Paint terrain before introducing a queen.',goal:'Choose powders, liquids, gases or energy devices. Draw containers, mix materials and inspect the results.' },
  { id:'physics-lab',title:'Particle physics lab',mode:'naturalistic',defaultSize:[384,192],blurb:'Prepared density tanks, a gated reservoir, combustible wood and a battery circuit. All motion and reactions use the live simulation.',goal:'Open the guide to pour grains, release the reservoir, ignite fuel or break the circuit. Inspect materials and use heat/cool/shock to experiment.' },
  { id: 'living-world', title: 'Living world (generated)', mode: 'naturalistic', defaultSize: [768, 256], blurb: 'A procedurally generated strip of biomes (meadows, woodland, steppe, wetlands, hills, dunes) with renewable food and water. Several ant kingdoms start in the best sites and run on their own: rulers, clans, diplomacy and wars emerge.', goal: 'Leave it running. Open the observatory to follow each kingdom\'s ruler, clans, chronicle and relations. Change the seed for a different world.' },
  { id: 'sandbox', title: 'Free sandbox', mode: 'naturalistic', defaultSize: [512, 256], blurb: 'A temperate meadow with one newly mated black garden ant queen. Everything else is up to you.', goal: 'Build, break and observe.' },
  { id: 'first-colony', title: 'First colony', mode: 'naturalistic', defaultSize: [384, 192], blurb: 'A mild meadow with no predators. A founding queen searches for a site, seals herself in and rears her first workers from body reserves.', goal: 'Watch the queen dig a chamber, lay eggs and rear the first (nanitic) workers. Try warming the chamber with the heat tool.' },
  { id: 'moved-food', title: 'Moved food', mode: 'naturalistic', defaultSize: [384, 192], blurb: 'An established colony exploits a rich sugar patch. Use the scenario button to move the food and watch the colony rediscover it.', goal: 'Let a trail form (signal overlay), then press "Move the sugar". Foragers with route memory return to the old site first.' },
  { id: 'flooded-passage', title: 'Flooded passage', mode: 'naturalistic', defaultSize: [384, 192], blurb: 'A colony occupies a lined experimental nest beneath a sealed reservoir. Open its gate to expose the passages to a gravity-fed flood.', goal: 'Press "Open the dam" (or paint water). Inspect submerged ants and brood; rescue requires surviving workers and somewhere dry to go.' },
  { id: 'competing-colonies', title: 'Competing colonies', mode: 'naturalistic', defaultSize: [512, 192], blurb: 'A black garden ant colony and a California harvester ant colony share a meadow with one central food patch.', goal: 'Observe overlapping foraging ranges, encounters at the food patch and the territory overlay.' },
  { id: 'colony-wars', title: 'Colony wars', mode: 'naturalistic', defaultSize: [640, 192], blurb: 'Five established colonies of three species, unequal in size, share a meadow with contested food. Big-headed ants (Pheidole) field a soldier subcaste. Colonies learn about each other only through encounters, then defend, muster and fight at the front, raid for brood or absorb beaten rivals.', goal: 'Open the observatory and pick a colony: its war room shows its strategy, rivals, losses and battle reports. Use Warp and watch fronts form, Pheidole majors guard the entrance and answer strong alarm, raids carry off pupae, and queenless colonies get absorbed.' },
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
  /** optional per-column hooks used by the world generator (worldgen.ts) */
  lift?: Float32Array;
  plantMul?: Float32Array;
  pondAt?: number[];
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
    const s = Math.round(base + surf[x] * o.roughness + (o.lift ? o.lift[x] : 0));
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
  for (let k = 0; k < (o.pondAt ? o.pondAt.length : o.ponds); k++) {
    const cx = o.pondAt ? o.pondAt[k] : 30 + rng.int(W - 60), rx = 10 + rng.int(14), depth = 4 + rng.int(4);
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
    if (!rng.chance(o.plants * 0.18 * (o.plantMul ? o.plantMul[x] : 1))) continue;
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
  /** generated-world options (living-world scenario) */
  world?: WorldOptions;
  /** learnt brain templates carried in from earlier worlds (brain bank); part of the replayable creation options */
  brains?: BankEntry[];
}

export function createSim(opt: CreateOptions): Sim {
  const def = SCENARIOS.find((s) => s.id === opt.scenario) ?? SCENARIOS.find(s=>s.id==='sandbox')!;
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
  if(['empty','physics-lab','liquid-lab','powder-lab'].includes(def.id)){settings.weather=false;settings.naturalPredators=false;}
  if(def.id==='life-garden'){Object.assign(climate,{meanTemp:24,deepTemp:22,baseHumidity:.8,dayAmp:2,seasonAmp:1});settings.weather=false;settings.naturalPredators=false;gen={...gen,plants:0,logs:0};}
  const plan = def.id === 'living-world' ? planWorld(seed, W) : null;
  if (plan) { Object.assign(climate, plan.climate); settings.maxColonies = Math.max(settings.maxColonies, 16); gen = { ...gen, plants: 0.75, logs: 0, lift: plan.lift, plantMul: plan.plantMul, pondAt: plan.pondAt }; }
  if (opt.climate) Object.assign(climate, opt.climate);
  if (opt.settings) Object.assign(settings, opt.settings);
  const sim = new Sim({ W, H, seed, mode, scenario: def.id, climate, settings, customSpecies: opt.customSpecies });
  sim.createOpts = structuredClone(opt);
  for (const e of opt.brains ?? []) if (validBank(e)) sim.brainBank[e.speciesId] = { ...e, w: Float32Array.from(e.w) };
  if(!['empty','physics-lab','liquid-lab','powder-lab'].includes(def.id))generateTerrain(sim, seed, gen);
  else sim.w.recomputeAllSurface();
  sim.scenarioInfo = { id: def.id, title: def.title, goal: def.goal, actions: [] };
  if (plan) decorateWorld(sim, seed, plan);
  const lasius = sim.speciesById('lasius-niger');
  const pogo = sim.speciesById('pogonomyrmex-californicus');
  const pheidole = sim.speciesById('pheidole-pallidula');
  const rng = new Rng(seed ^ 0xa11ce);
  const queenAt = (sp: SpeciesDef, x: number, g?: (g: Float32Array) => void) => {
    const ga = founderGenome(sim.rng), gb = founderGenome(sim.rng);
    if (g) { g(ga); g(gb); }
    sim.foundColony(sp, x, surfaceY(sim, x) - 1, ga, gb, sim.sampleMates(sp, [], 0), 0, 0, null);
  };
  switch (def.id) {
    case 'powder-lab':{
      const w=sim.w,X=(n:number)=>Math.round(n*W/384),Y=(n:number)=>Math.round(n*H/192);
      const put=(x:number,y:number,m:number)=>{if(!w.inb(x,y))return;const d=MATERIALS[m];sim.setCell(y*W+x,m,d.food?d.foodUnits:m===M.WATER?64:d.nutrient,'player workshop setup');};
      const patch=(x:number,y:number,m:number,r=2)=>{for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++)if(dx*dx+dy*dy<=r*r+r)put(x+dx,y+dy,m);};
      const names=['FLUTTER & GRAVITY','FLOATING FLAKES','BORAX + GLUE','METAL + WATER','THERMAL REACTIONS','EXPOSURE & SHIELD'];sim.scenarioInfo.notes=[];
      for(let n=0;n<6;n++){const x=X(12+n%3*126),top=Y(n<3?32:116),bottom=Y(n<3?90:176);for(let y=top;y<=bottom;y++){put(x,y,M.BARRIER);put(x+X(108),y,M.BARRIER);}for(let xx=x;xx<=x+X(108);xx++)put(xx,bottom,M.BARRIER);sim.scenarioInfo.notes.push({x:x+X(54),y:top-4,text:names[n]});}
      patch(X(43),Y(44),M.FEATHER);patch(X(65),Y(44),M.CONFETTI);patch(X(93),Y(44),M.SAND);
      for(let y=Y(77);y<Y(90);y++)for(let x=X(139);x<X(246);x++)put(x,y,M.WATER);patch(X(160),Y(65),M.GLITTER);patch(X(189),Y(65),M.SAWDUST);patch(X(219),Y(65),M.GOLD_COIN);
      for(let y=Y(85);y<Y(90);y++)for(let x=X(285);x<=X(293);x++)put(x,y,x<=X(288)?M.BORAX:M.GLUE);
      for(let y=Y(165);y<Y(176);y++)for(let x=X(13);x<X(120);x++)put(x,y,M.WATER);patch(X(39),Y(164),M.SODIUM,1);patch(X(85),Y(164),M.CALCIUM,1);
      patch(X(165),Y(174),M.WAX,1);patch(X(195),Y(173),M.THERMITE,1);put(X(195),Y(175),M.HEATER);patch(X(222),Y(174),M.GOLD_COIN,1);
      for(let y=Y(116);y<Y(176);y++)put(X(320),y,M.BARRIER);for(let x=X(314);x<X(320);x++)put(x,Y(171),M.BARRIER);patch(X(317),Y(169),M.URANIUM,1);
      sim.scenarioInfo.actions=[
        {label:'Pour another feather / sand pair',cmds:[{t:'paint',mat:M.FEATHER,x:X(43),y:Y(44),r:3,replace:false},{t:'paint',mat:M.SAND,x:X(93),y:Y(44),r:3,replace:false}]},
        {label:'Open the shield window',cmds:Array.from({length:Math.max(1,Y(172)-Y(167))},(_,n)=>({t:'erase' as const,x:X(320),y:Y(167)+n,r:0}))},
        {label:'Heat the wax',cmds:[{t:'heat',x:X(165),y:Y(173),r:7,amount:90}]},
        {label:'Add a sodium grain to water',cmds:[{t:'paint',mat:M.SODIUM,x:X(55),y:Y(166),r:0,replace:true}]},
      ];
      sim.event('experiment','Workshop containers, reagents and heater are introduced conditions. Products, exposure and grain motion are computed, not scripted.');break;
    }
    case 'liquid-lab':{
      const w=sim.w,X=(n:number)=>Math.round(n*W/384),Y=(n:number)=>Math.round(n*H/192);
      const put=(x:number,y:number,m:number)=>{if(!w.inb(x,y))return;const d=MATERIALS[m];sim.setCell(y*W+x,m,d.food?d.foodUnits:m===M.WATER?64:d.nutrient,'player lab setup');};
      const patch=(cx:number,cy:number,m:number)=>{for(let y=cy-2;y<=cy;y++)for(let x=cx-3;x<=cx+3;x++)put(x,y,m);};
      const names=['MILK + ACID','CEMENT + WATER','SOAP + OIL','JUICE + YEAST','CRYOGENS','DYE + WOOD','MERCURY','HEATED SYRUP'];
      sim.scenarioInfo.notes=[];
      for(let n=0;n<8;n++){const x=X(12+n%4*94),top=Y(n<4?36:112),bottom=Y(n<4?92:168);for(let y=top;y<=bottom;y++){put(x,y,M.GLASS);put(x+X(78),y,M.GLASS);}for(let xx=x;xx<=x+X(78);xx++)put(xx,bottom,M.GLASS);sim.scenarioInfo.notes.push({x:x+X(39),y:top-4,text:names[n]});}
      patch(X(42),Y(90),M.MILK);patch(X(49),Y(90),M.VINEGAR);
      patch(X(139),Y(90),M.CONCRETE);patch(X(146),Y(90),M.WATER);
      patch(X(233),Y(90),M.SOAP);patch(X(240),Y(90),M.OIL);patch(X(247),Y(90),M.WATER);
      patch(X(327),Y(90),M.JUICE);for(let x=X(324);x<=X(330);x++)put(x,Y(87),M.YEAST);
      patch(X(40),Y(166),M.LIQUID_NITROGEN);patch(X(62),Y(166),M.LIQUID_HYDROGEN);
      for(let x=X(139);x<X(148);x++)put(x,Y(166),M.WOOD);patch(X(139),Y(165),M.DYE);
      patch(X(235),Y(166),M.MERCURY);
      patch(X(329),Y(166),M.SAP);put(X(329),Y(167),M.HEATER);
      sim.scenarioInfo.actions=[
        {label:'Add vinegar to the milk vessel',cmds:[{t:'paint',mat:M.VINEGAR,x:X(42),y:Y(70),r:2,replace:false}]},
        {label:'Heat milk vessel',cmds:[{t:'heat',x:X(46),y:Y(86),r:10,amount:120}]},
        {label:'Cool mercury below freezing',cmds:[{t:'heat',x:X(235),y:Y(163),r:8,amount:-90}]},
        {label:'Add bleach to the stained wood',cmds:[{t:'paint',mat:M.BLEACH,x:X(142),y:Y(150),r:2,replace:false}]},
      ];
      sim.event('experiment','Liquid lab: vessels, reagents and one continuous heater are experimental sources. No reaction products or outcomes are scripted.');
      break;
    }
    case 'life-garden': {
      const w=sim.w,Y=Math.round(H*.38),X=(n:number)=>Math.round(n*W/384);
      const put=(x:number,y:number,m:number,n?:number)=>{if(!w.inb(x,y))return;const d=MATERIALS[m];w.setRaw(y*W+x,m,n??(m===M.WATER?64:d.food?d.foodUnits:d.nutrient));if(MOIST_CAP[m])w.moist[y*W+x]=Math.min(MOIST_CAP[m],d.initialMoisture??100);};
      for(let x=1;x<W-1;x++){for(let y=0;y<Y;y++)put(x,y,M.AIR,0);for(let y=Y;y<Math.min(H,Y+6);y++)put(x,y,M.TOPSOIL,80);}
      for(let x=X(240);x<=X(310);x++)for(let y=Y-3;y<=Y+10;y++)put(x,y,x===X(240)||x===X(310)||y===Y+10?M.BARRIER:M.WATER);
      for(const n of [40,41,42,68,69,126,127,140,145,146])put(X(n),Y-1,M.GRASS);
      for(const n of [54,82]){put(X(n),Y-1,M.PLANT,20);put(X(n),Y-2,M.PETAL,40);put(X(n)+1,Y-1,M.POLLEN);}
      for(const [n,m] of [[90,M.SAPLING],[94,M.PINECONE],[112,M.CACTUS],[132,M.BAMBOO_PLANT],[156,M.MUSHROOM_SPORE],[162,M.LICHEN],[176,M.FLOWER_SEED],[180,M.SEED],[188,M.BONE],[265,M.ALGAE],[280,M.KELP],[296,M.CORAL]] as const)put(X(n),m===M.ALGAE?Y+1:m===M.KELP||m===M.CORAL?Y+8:Y-1,m);
      put(X(156),Y,M.ORGANIC,80);put(X(162)-1,Y-1,M.ROCK);put(X(200),Y-1,M.VINE);put(X(200)+1,Y-1,M.WOOD);
      for(let y=Y-4;y<Y;y++)put(X(102),y,M.WOOD);
      for(const n of [66,72,122,150,175]){put(X(n),Y-1,M.SEED,8);put(X(n)+1,Y-1,M.PROTEIN,20);}
      for(const n of [54,82])put(X(n)-1,Y-1,M.HONEY,16);
      for(let x=X(320);x<X(328);x++){put(x,Y,M.BARRIER);put(x,Y-1,M.WATER);}put(X(323),Y-1,M.CELL,60);
      if(mode==='fantasy'){put(X(325),Y-1,M.PRIMORDIAL_SOUP,80);put(X(326),Y-1,M.PLAGUE,20);}
      w.recomputeAllSurface();queenAt(lasius,X(25));
      const introduce=(key:string,x:number,y:number)=>sim.critters.spawn(sim,key,X(x),y);
      for(const [key,x] of [['flea',67],['termite',101],['stinkbug',125],['human',74],['rat',65],['slug',140],['snail',146],['spider',172],['springtail',155]] as const)introduce(key,x,Y-1);
      for(const [key,x] of [['fly',121],['firefly',160],['bee',55],['bird',180]] as const)introduce(key,x,Y-4);
      introduce('worm',150,Y+2);introduce('fish',275,Y+3);introduce('frog',290,Y+3);
      // Experimental paired adults are initial conditions, not scripted births.
      for(const [key,x,y] of [['rat',67,Y-1],['fly',122,Y-4],['bee',56,Y-2],['fish',276,Y+3]] as const){const first=sim.critters.list.find(c=>c.kind===({rat:11,fly:5,bee:7,fish:13}[key])),mate=introduce(key,x,y);if(first&&mate)mate.sex=1-first.sex;}
      sim.scenarioInfo.actions=[{label:'Cut a drain in the pond floor',cmds:[{t:'erase',x:X(275),y:Y+10,r:1}]},{label:'Add sugar beside the flowers',cmds:[{t:'paint',mat:M.SUGAR,x:X(54),y:Y-3,r:1,replace:false}]}];
      sim.event('experiment','Living garden: planted beds, water, food and wildlife are introduced experimental conditions. Outcomes remain autonomous.');
      break;
    }
    case 'physics-lab': {
      const X=(n:number)=>Math.round(W*n/384),Y=(n:number)=>Math.round(H*n/192);
      const put=(x:number,y:number,m:number)=>{if(!sim.w.inb(x,y))return;const d=MATERIALS[m];sim.setCell(y*W+x,m,m===M.WATER?64:d.food?d.foodUnits:d.nutrient,'lab setup');};
      const row=(x0:number,x1:number,y:number,m:number)=>{for(let x=x0;x<=x1;x++)put(x,y,m);};
      const tank=(x0:number,x1:number,y0:number,y1:number)=>{for(let y=y0;y<=y1;y++){put(x0,y,M.BARRIER);put(x1,y,M.BARRIER);}row(x0,x1,y1,M.BARRIER);};
      tank(X(25),X(120),Y(75),Y(155));
      for(let y=Y(135);y<Y(155);y++)row(X(26),X(119),y,M.WATER);
      for(let y=Y(125);y<Y(135);y++)row(X(26),X(119),y,M.OIL);
      tank(X(150),X(225),Y(65),Y(155));
      row(X(150),X(225),Y(102),M.BARRIER);
      for(let y=Y(78);y<Y(102);y++)row(X(151),X(224),y,M.WATER);
      for(let y=Y(75);y<=Y(78);y++)row(X(265),X(310),y,M.WOOD);
      row(X(260),X(316),Y(150),M.BARRIER);
      row(X(268),X(307),Y(135),M.WIRE);put(X(267),Y(135),M.BATTERY);put(X(308),Y(135),M.LAMP);
      sim.scenarioInfo.actions=[
        {label:'Pour sand into the density tank',cmds:[{t:'paint',mat:M.SAND,x:X(70),y:Y(55),r:5,replace:true}]},
        {label:'Open the reservoir gate',cmds:[{t:'erase',x:X(188),y:Y(102),r:1}]},
        {label:'Ignite the wood',cmds:[{t:'paint',mat:M.FIRE,x:X(263),y:Y(76),r:2,replace:true}]},
        {label:'Break the circuit',cmds:[{t:'erase',x:X(287),y:Y(135),r:0}]},
      ];
      break;
    }
    case 'sandbox':
      queenAt(lasius, Math.round(W * 0.5));
      break;
    case 'living-world': {
      const n = Math.max(1, Math.min(8, Math.round(opt.world?.colonies ?? 3)));
      for (const site of colonySites(sim, plan!, n)) {
        const c = sim.establishedColony(sim.speciesById(site.species), site.x, surfaceY(sim, site.x) - 1, 30);
        if (c) { c.store.sugar += 40; c.store.protein += 40; c.store.seed += 20; }
      }
      const mid = Math.round(W / 2);
      sim.scenarioInfo.actions = [
        { label: 'Bountiful season: drop food in the middle of the world', cmds: [{ t: 'paint', mat: M.SUGAR, x: mid - 4, y: surfaceY(sim, mid) - 3, r: 3 } as Command, { t: 'paint', mat: M.PROTEIN, x: mid + 4, y: surfaceY(sim, mid) - 3, r: 2 } as Command] },
      ];
      sim.event('experiment', `A new world: ${plan!.regions.map((r) => `${r.name} (${BIOMES[r.biome].name.toLowerCase()})`).join(', ')}. ${n} kingdom${n === 1 ? '' : 's'} founded; nothing further is scripted.`);
      break;
    }
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
      const inlet = nest?.entrance.y ?? s0;
      // An explicitly engineered tank exposes a lined nest to a gravity-fed pulse.
      // Geometry is controlled; rescue, mortality and survival are not scripted.
      const put=(x:number,y:number,m:number)=>{const k=y*w.W+x;w.mat[k]=m;w.moist[k]=0;w.amt[k]=m===M.WATER?WATER_UNITS:0;};
      for(let x=nx-13;x<=nx+13;x++)put(x,inlet-2,M.BARRIER);
      for(let y=inlet-14;y<inlet-2;y++){
        put(nx-13,y,M.BARRIER);put(nx+13,y,M.BARRIER);
        for(let x=nx-12;x<=nx+12;x++)put(x,y,M.WATER);
      }
      if(nest){
        const cy=nest.chamber.y;
        for(let y=inlet-1;y<=cy;y++)for(const x of [nx,nx+1]){put(x,y,M.AIR);w.owner[y*w.W+x]=nest.slot+1;}
        for(let y=inlet;y<cy-1;y++){put(nx-1,y,M.BARRIER);put(nx+2,y,M.BARRIER);}
        for(let x=nx-6;x<=nx+7;x++)put(x,cy+2,M.BARRIER);
        for(let y=cy-1;y<=cy+2;y++){put(nx-6,y,M.BARRIER);put(nx+7,y,M.BARRIER);}
      }
      w.recomputeAllSurface();
      sim.scenarioInfo.actions = [
        { label: 'Open the dam', cmds: [{ t: 'erase', x: nx, y: inlet-2, r: 0 } as Command, { t: 'erase', x: nx+1, y: inlet-2, r: 0 } as Command] },
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
    case 'colony-wars': {
      const sites: [SpeciesDef, number, number][] = [[lasius, 0.1, 70], [pheidole, 0.3, 50], [pogo, 0.5, 40], [lasius, 0.7, 28], [pogo, 0.9, 75]];
      for (const [sp, f, n] of sites) {
        const x = Math.round(W * f);
        const c = sim.establishedColony(sp, x, surfaceY(sim, x) - 1, n);
        if (c) { c.store.sugar += 30; c.store.protein += 30; c.store.seed += 20; }
      }
      for (const f of [0.2, 0.4, 0.6, 0.8]) { const x = Math.round(W * f); clearPlantsNear(sim, x, 6); patch(sim, M.SUGAR, x - 2, 3); patch(sim, M.PROTEIN, x + 3, 2); patch(sim, M.SEED, x + 6, 2, 1); }
      const mid = Math.round(W * 0.5);
      sim.scenarioInfo.actions = [
        { label: 'Drop a sugar windfall in no-man\'s land', cmds: [{ t: 'paint', mat: M.SUGAR, x: mid, y: surfaceY(sim, mid) - 3, r: 3 } as Command] },
        { label: 'Drop protein between the two smallest colonies', cmds: [{ t: 'paint', mat: M.PROTEIN, x: Math.round(W * 0.5), y: surfaceY(sim, Math.round(W * 0.5)) - 3, r: 2 } as Command] },
      ];
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
  if (!['empty', 'physics-lab', 'liquid-lab', 'powder-lab'].includes(def.id)) {
    plantTrees(sim, gen.plantMul);
    sim.w.recomputeAllSurface();
  }
  spinUp(sim);
  sim.w.rebuildReactive();
  setInitialLedger(sim);
  for (const c of sim.colonies) if (c && c.alive) sim.scanNest(c);
  return sim;
}
