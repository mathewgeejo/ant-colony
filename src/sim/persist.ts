// Complete-state serialisation. The snapshot is structured-clone friendly (for IndexedDB)
// and can be encoded to JSON with typed-array tagging for portable file export.
import { maskList, TRAITS } from './traits.ts';
import { P, NP } from './genetics.ts';
import { AntStore } from './ants.ts';
import type { Colony } from './colony.ts';
import { makeColonyFields } from './colony.ts';
import { SAVE_VERSION, Sim } from './sim.ts';
import type { SimConfig } from './sim.ts';
import { validateSpecies } from './species.ts';
import { MATERIALS,M,FANTASY_MATERIALS } from './materials.ts';
import { wildlifeById } from './wildlife-defs.ts';
import { NW, validBank } from './brain.ts';

export interface SaveFile {
  format: 'ant-colony-sandbox';
  version: number;
  savedAt: string;
  name: string;
  summary: { tick: number; colonies: number; ants: number; scenario: string; mode: string; seed: number };
  state: any;
}

const COLONY_FIELDS = ['trail', 'nestOdor', 'alarm', 'digCue'] as const;

export function snapshot(sim: Sim, name = 'save'): SaveFile {
  const w = sim.w;
  const cols = sim.colonies.map((c) => {
    if (!c) return null;
    const o: any = structuredClone({...c,trail:null,nestOdor:null,alarm:null,digCue:null});
    for (const f of COLONY_FIELDS) o[f] = c[f].serialize();
    return o;
  });
  const state = {
    cfg: structuredClone(sim.cfg),
    tick: sim.tick,
    rng: sim.rng.state(),
    world: {
      mat: w.mat.slice(), amt: w.amt.slice(), moist: w.moist.slice(), flags: w.flags.slice(), owner: w.owner.slice(), toxin: w.toxin.slice(),
      charge:w.charge.slice(),
      dose:w.dose.slice(),
      carrier:w.carrier.slice(),phase:w.phase.slice(),tint:w.tint.slice(),
      temp: w.temp.slice(), heat: w.heat.slice(), hum: w.hum.slice(), humBias: w.humBias.slice(), surface: w.surface.slice(),
      chunkActive: w.chunkActive.slice(), chunkVer: w.chunkVer.slice(), moved: w.moved.slice(),
      chunkReactive:w.chunkReactive.slice(),
      dirtyColumns:[...w.dirtyColumns],
      lifeCells:[...w.lifeCells],
      ledger: { sources: structuredClone(w.ledger.sources), sinks: structuredClone(w.ledger.sinks), initial: { ...w.ledger.initial } },
    },
    phys: { stamp: sim.phys.stamp, moistureCursor: sim.phys.moistureCursor, raining: sim.phys.raining, rainLocal: sim.phys.rainLocal.map((r) => ({ ...r })), slumps: sim.phys.slumps,topologyChanged:sim.phys.sandbox.topologyChanged },
    player: { ...sim.player }, traitBalance: 2,
    ants: sim.a.serialize(),
    colonies: cols,
    nextColonyId: sim.nextColonyId, broodNextId: sim.broodNextId,
    trailNeighbours: sim.trailNeighbours.map((l) => (l ? l.slice() : l)),
    lineage: structuredClone(sim.lineage), mutations: structuredClone(sim.mutations), mutationCount: sim.mutationCount,
    events: structuredClone(sim.events), journal: structuredClone(sim.journal),
    swarm: sim.swarm.map((s) => ({ ...s, a: s.a.slice(), b: s.b ? s.b.slice() : null })),
    flightDays: structuredClone(sim.flightDays), flightEnd: { ...sim.flightEnd },
    critters: sim.critters.serialize(), carriedFood: sim.carriedFood.slice(),
    commandLog: structuredClone(sim.commandLog), traitHistory: structuredClone(sim.traitHistory),
    activity: sim.activity.slice(), activityOwner: sim.activityOwner.slice(), mortality: sim.mortality.slice(),
    flags: structuredClone(sim.flags), counters: { ...sim.counters },
    reproBrood: [...sim.reproBrood.entries()], unlocked: [...sim.unlocked], ecoCursor: sim.ecoCursor,
    scheduled: structuredClone(sim.scheduled), scenarioInfo: structuredClone(sim.scenarioInfo),
    nestCells: [...sim.nestCells.entries()].map(([k, v]) => [k, v.slice()]), nestDist: sim.nestDist.slice(), occ: sim.occ.slice(),
    createOpts: structuredClone(sim.createOpts), replayable: sim.replayable, brainBank: structuredClone(sim.brainBank), census: structuredClone(sim.census),
    // derived navigation fields, saved so a loaded world continues exactly as the live one would
    navCache: { home: structuredClone([...sim.homeField]), net: structuredClone([...sim.netFields]), front: structuredClone([...sim.frontFields]) },
    pending: structuredClone(sim.pending), navDirty: sim.navDirty, airT: sim.airT, daytime: sim.daytime,
  };
  return {
    format: 'ant-colony-sandbox', version: SAVE_VERSION, savedAt: new Date().toISOString(), name,
    summary: { tick: sim.tick, colonies: sim.aliveColonies().length, ants: sim.a.count, scenario: sim.cfg.scenario, mode: sim.mode, seed: sim.cfg.seed },
    state,
  };
}

/** Schema 1 predates electricity; schema 2 predates mixture carriers and stains. */
export function migrate(file: SaveFile): SaveFile {
  if(!file||typeof file!=='object')throw new Error('Not a save file.');
  if(!Number.isInteger(file.version)||file.version<1)throw new Error('Missing or unsupported save schema version.');
  if (file.version > SAVE_VERSION) throw new Error(`This save was made by a newer version (schema ${file.version}); this build reads up to ${SAVE_VERSION}.`);
  if(file.version===1){const W=file.state?.cfg?.W,H=file.state?.cfg?.H;if(file.state?.world&&!file.state.world.charge&&Number.isInteger(W)&&W>=32&&W<=2048&&Number.isInteger(H)&&H>=32&&H<=1024)file.state.world.charge=new Uint8Array(W*H);file.version=2;}
  if(file.version===2){const W=file.state?.cfg?.W,H=file.state?.cfg?.H;if(file.state?.world&&Number.isInteger(W)&&W>=32&&W<=2048&&Number.isInteger(H)&&H>=32&&H<=1024){file.state.world.carrier??=new Uint8Array(W*H);file.state.world.phase??=new Uint32Array(W*H);file.state.world.tint??=new Uint32Array(W*H);}file.version=3;}
  if(file.version===3){const w=file.state?.world;for(const key of ['mat','amt'])if(w?.[key]){if(w[key].some((n:number)=>!Number.isInteger(n)||n<0||n>65535))throw new Error('Invalid material or quantity in legacy save.');w[key]=Uint16Array.from(w[key]);}const W=file.state?.cfg?.W,H=file.state?.cfg?.H;if(w&&Number.isInteger(W)&&W>=32&&W<=2048&&Number.isInteger(H)&&H>=32&&H<=1024)w.dose??=new Uint8Array(W*H);file.version=4;}
  return file;
}

export function validateSave(file: any): string[] {
  const errs: string[] = [];
  if (!file || typeof file !== 'object') return ['Not a save file.'];
  if (file.format !== 'ant-colony-sandbox') errs.push('Missing format marker "ant-colony-sandbox".');
  if (typeof file.version !== 'number') errs.push('Missing schema version.');
  const s = file.state;
  if (!s) { errs.push('Missing state.'); return errs; }
  const W = s.cfg?.W, H = s.cfg?.H;
  if (!(Number.isInteger(W) && Number.isInteger(H) && W >= 32 && W <= 2048 && H >= 32 && H <= 1024)) errs.push('World size is missing or out of range.');
  if (!['naturalistic','speculative','fantasy'].includes(s.cfg?.mode)) errs.push('Unknown biology mode.');
  if (!Number.isSafeInteger(s.tick) || s.tick < 0) errs.push('Invalid simulation tick.');
  for (const k of ['mat', 'amt', 'moist', 'flags', 'owner', 'toxin']) if (!s.world?.[k] || s.world[k].length !== W * H) errs.push(`Terrain layer "${k}" is missing or has the wrong size.`);
  if(s.world?.mat?.some((m:number)=>!Number.isInteger(m)||!MATERIALS[m]))errs.push('Terrain contains an unknown material id.');
  if(s.world?.amt?.some((n:number,k:number)=>!Number.isInteger(n)||n<0||n>(s.world.mat?.[k]===M.CLONER?MATERIALS.length-1:255)))errs.push('Terrain contains an invalid quantity or cloner template.');
  if(s.cfg?.mode!=='fantasy'&&s.world?.mat?.some((m:number,k:number)=>FANTASY_MATERIALS.includes(m)||(m===M.CLONER&&FANTASY_MATERIALS.includes(s.world?.amt?.[k]))))errs.push('Fictional biological materials and cloner templates require Fantasy mode.');
  for(const key of ['carrier','phase','tint'])if(!s.world?.[key]||s.world[key].length!==W*H)errs.push(`Mixture layer ${key} has the wrong size.`);
  if(s.world?.mat?.length===W*H&&['carrier','phase','tint'].every(key=>s.world[key]?.length===W*H)){
    for(let k=0;k<W*H;k++){
      const m=s.world.mat[k],d=MATERIALS[m],n=s.world.carrier[k],phase=s.world.phase[k],origin=phase&65535;
      if(!d||!Number.isInteger(n)||n<0||n>(d.carrierCapacity??0)){errs.push('Mixture carrier exceeds its material capacity.');break;}
      const frozen=m===M.FROZEN_MIXTURE||(m===M.CLONER&&s.world.amt[k]===M.FROZEN_MIXTURE);
      if(!Number.isInteger(phase)||phase<0||phase>0xffffffff||(frozen?(!MATERIALS[origin]||(origin!==M.WATER&&MATERIALS[origin].freezeAt===undefined)||(phase>>>16)>(origin===M.SODA?8:0)):phase>(m===M.SODA?8:d.phaseMax??0))){errs.push('Mixture contains an invalid origin or reaction progress.');break;}
      const tint=s.world.tint[k];if(!Number.isInteger(tint)||tint<0||tint>0xffffffff){errs.push('Mixture stain color is invalid.');break;}
    }
  }
  if(s.world?.charge&&s.world.charge.length!==W*H)errs.push('Electrical field has the wrong size.');
  if(!s.world?.dose||s.world.dose.length!==W*H||s.world.dose.some((n:number)=>!Number.isInteger(n)||n<0||n>255))errs.push('Radiation exposure layer is invalid.');
  if(s.world?.lifeCells&&(!Array.isArray(s.world.lifeCells)||s.world.lifeCells.some((k:number)=>!Number.isInteger(k)||k<0||k>=W*H||s.world.mat[k]<M.GRASS||s.world.mat[k]>M.MUSHROOM)))errs.push('Living-cell scheduler contains invalid positions.');
  const animals=s.critters?.list;
  if(!Array.isArray(animals)||animals.length>384)errs.push('Wildlife records are invalid (maximum 384).');
  else for(const c of animals){if(!c||![c.id,c.kind,c.x,c.y,c.hp,c.age].every(Number.isFinite)||!Number.isInteger(c.kind)||(c.kind!==0&&c.kind!==1&&!wildlifeById(c.kind))||c.x<0||c.x>=W||c.y<0||c.y>=H||!Number.isInteger(c.x)||!Number.isInteger(c.y))errs.push('A wildlife record has an invalid type, position or health.');if(c?.stage!==undefined&&(!Number.isInteger(c.stage)||c.stage<0||c.stage>3))errs.push('A wildlife life stage is invalid.');}
  if (!Array.isArray(s.rng) || s.rng.length !== 4) errs.push('Random generator state is missing.');
  if (!s.ants || typeof s.ants.n !== 'number') errs.push('Organism data is missing.');
  else if (!Number.isInteger(s.ants.cap) || s.ants.cap < 16 || s.ants.cap > 100000 || !Number.isInteger(s.ants.n) || s.ants.n < 0 || s.ants.n > s.ants.cap) errs.push('Organism capacity is invalid (maximum 100,000).');
  else if (s.ants.brainW && (s.ants.brainW.length !== s.ants.n * NW || s.ants.brainW.some((v: number) => !Number.isFinite(v)))) errs.push('Ant brain weights are missing, the wrong size or not finite.');
  for (const c of Array.isArray(s.colonies) ? s.colonies : []) if (c?.mind && (c.mind.w?.length !== NW || !Number.isFinite(c.mind.gen))) errs.push(`Colony ${c.name ?? '?'} has an invalid brain template.`);
  if (!Array.isArray(s.colonies) || s.colonies.length > 255) errs.push('Colony records are invalid.');
  if (!s.world?.temp || s.world.temp.length !== Math.ceil(W/4)*Math.ceil(H/4)) errs.push('Temperature field has the wrong size.');
  for (const sp of s.cfg?.customSpecies ?? []) { const e = validateSpecies(sp); if (e.length) errs.push(`Custom species invalid: ${e[0]}`); }
  return errs;
}

export function restore(file: SaveFile): Sim {
  const f = migrate(structuredClone(file));
  const errs = validateSave(f);
  if (errs.length) throw new Error(errs.join(' '));
  const s = f.state;
  const cfg: SimConfig = { ...s.cfg, climate: { ...s.cfg.climate }, settings: { ...s.cfg.settings } };
  const sim = new Sim(cfg);
  sim.tick = s.tick;
  sim.rng.s.set(s.rng);
  const w = sim.w;
  for (const k of ['mat', 'amt', 'moist', 'flags', 'owner', 'toxin', 'temp', 'heat', 'hum', 'humBias', 'surface'] as const) (w[k] as any).set(s.world[k]);
  w.ledger.sources = structuredClone(s.world.ledger.sources);
  w.ledger.sinks = structuredClone(s.world.ledger.sinks);
  w.ledger.initial = { ...s.world.ledger.initial };
  w.chunkDirty.fill(1);
  if(s.world.charge)w.charge.set(s.world.charge);
  w.dose.set(s.world.dose);
  w.carrier.set(s.world.carrier);w.phase.set(s.world.phase);w.tint.set(s.world.tint);
  w.rebuildReactive(); // Derived counts also include materials added since older saves.
  if(s.world.lifeCells)w.lifeCells=new Set(s.world.lifeCells);
  w.dirtyColumns=new Set(s.world.dirtyColumns??[]);
  // Older schema-1 snapshots did not keep the CA activity scheduler.
  if (s.world.chunkActive) w.chunkActive.set(s.world.chunkActive); else w.chunkActive.fill(8);
  if (s.world.chunkVer) w.chunkVer.set(s.world.chunkVer);
  if (s.world.moved) w.moved.set(s.world.moved);
  Object.assign(sim.phys, { stamp: s.phys.stamp, moistureCursor: s.phys.moistureCursor, raining: s.phys.raining, rainLocal: s.phys.rainLocal.map((r: any) => ({ ...r })), slumps: s.phys.slumps });
  sim.phys.sandbox.topologyChanged=s.phys.topologyChanged??false;
  sim.a = AntStore.restore(s.ants);
  if (s.player) sim.player = { ...s.player };
  // Older saves baked the original trait modifiers into each adult's phenotype.
  if (!s.traitBalance) {
    for (let i = 0; i < sim.a.n; i++) {
      if (!sim.a.alive[i]) continue;
      for (const t of maskList(sim.a.traits, i * 2)) {
        for (const [key, value] of Object.entries(TRAITS[t].mul ?? {})) {
          sim.a.pheno[i * NP + P[key as keyof typeof P]] *= value / (1 + (value - 1) / 1.5);
        }
        for (const [key, value] of Object.entries(TRAITS[t].add ?? {})) {
          const index = i * NP + P[key as keyof typeof P];
          sim.a.pheno[index] = Math.max(0, sim.a.pheno[index] + value / 3);
        }
      }
    }
  }
  sim.colonies = s.colonies.map((o: any) => {
    if (!o) return null;
    const sp = sim.speciesById(o.speciesId);
    const fields = makeColonyFields(w, sp.communication.trailRetention);
    const c: Colony = { ...o, ...fields };
    for (const k of COLONY_FIELDS) c[k].restore(o[k]);
    c.brood = o.brood.map((b: any) => ({ ...b, a: Float32Array.from(b.a), b: b.b ? Float32Array.from(b.b) : null }));
    c.queens = o.queens.map((q: any) => ({ ...q, sperm: q.sperm.map((sp2: any) => ({ ...sp2, genome: Float32Array.from(sp2.genome) })) }));
    if (o.mind) c.mind = { ...o.mind, w: Float32Array.from(o.mind.w) };
    return c;
  });
  sim.nextColonyId = s.nextColonyId; sim.broodNextId = s.broodNextId;
  sim.trailNeighbours = s.trailNeighbours.map((l: any) => (l ? l.slice() : l));
  sim.lineage = structuredClone(s.lineage); sim.mutations = structuredClone(s.mutations); sim.mutationCount = s.mutationCount;
  sim.events = s.events.slice(); sim.journal = s.journal.slice();
  sim.swarm = s.swarm.map((x: any) => ({ ...x, a: Float32Array.from(x.a), b: x.b ? Float32Array.from(x.b) : null }));
  sim.flightDays = structuredClone(s.flightDays); sim.flightEnd = { ...s.flightEnd };
  sim.critters.restore(s.critters);
  sim.carriedFood = s.carriedFood.slice();
  sim.commandLog = structuredClone(s.commandLog); sim.traitHistory = structuredClone(s.traitHistory);
  sim.activity.set(s.activity); sim.activityOwner.set(s.activityOwner); sim.mortality.set(s.mortality);
  sim.flags = structuredClone(s.flags); sim.counters = { ...s.counters };
  sim.reproBrood = new Map(s.reproBrood); sim.unlocked = new Set(s.unlocked); sim.ecoCursor = s.ecoCursor;
  sim.scheduled = structuredClone(s.scheduled); sim.scenarioInfo = structuredClone(s.scenarioInfo);
  sim.nestCells = new Map(s.nestCells.map(([k, v]: [number, any]) => [k, Int32Array.from(v)]));
  sim.nestDist.set(s.nestDist); sim.occ.set(s.occ);
  sim.createOpts = structuredClone(s.createOpts ?? null); sim.replayable = s.replayable ?? false;
  sim.brainBank = Object.fromEntries(Object.entries(s.brainBank ?? {}).filter(([, e]) => validBank(e)).map(([k, e]: [string, any]) => [k, { ...e, w: Float32Array.from(e.w) }]));
  sim.census = Array.isArray(s.census) ? structuredClone(s.census) : [];
  const nav = s.navCache, fix = (v: any) => ({ ...v, d: Uint16Array.from(v.d) });
  if (nav) {
    sim.homeField = new Map(nav.home.map(([k, v]: [number, any]) => [k, fix(v)]));
    sim.netFields = new Map(nav.net.map(([k, v]: [string, any]) => [k, fix(v)]));
    sim.frontFields = new Map(nav.front.map(([k, v]: [number, any]) => [k, fix(v)]));
  }
  sim.pending = structuredClone(s.pending ?? []); sim.navDirty = s.navDirty ?? false;
  sim.airT = s.airT ?? sim.climate.meanTemp; sim.daytime = s.daytime ?? true;
  return sim;
}

// ---------------- portable JSON encoding (typed arrays as base64) ----------------

const TA: Record<string, any> = { Uint8Array, Int8Array, Uint16Array, Int16Array, Uint32Array, Int32Array, Float32Array, Float64Array };

function toB64(u8: Uint8Array): string {
  if (typeof Buffer !== 'undefined') return Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength).toString('base64');
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000) as unknown as number[]);
  return btoa(s);
}
function fromB64(b: string): Uint8Array {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(b, 'base64'));
  const s = atob(b);
  const u8 = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
  return u8;
}

export function encodeJSON(file: SaveFile): string {
  return JSON.stringify(file, function (_k, v) {
    if (ArrayBuffer.isView(v) && !(v instanceof DataView)) {
      const t = v.constructor.name;
      const u8 = new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
      return { __ta: t, b64: toB64(u8) };
    }
    return v;
  });
}

export function decodeJSON(text: string): SaveFile {
  return JSON.parse(text, (_k, v) => {
    if (v && typeof v === 'object' && typeof v.__ta === 'string') {
      const C = TA[v.__ta];
      if (!C) throw new Error(`Unknown array type ${v.__ta}`);
      const u8 = fromB64(v.b64);
      const buf = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
      return new C(buf);
    }
    return v;
  });
}
