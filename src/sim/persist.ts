// Complete-state serialisation. The snapshot is structured-clone friendly (for IndexedDB)
// and can be encoded to JSON with typed-array tagging for portable file export.
import { AntStore } from './ants.ts';
import type { Colony } from './colony.ts';
import { makeColonyFields } from './colony.ts';
import { SAVE_VERSION, Sim } from './sim.ts';
import type { SimConfig } from './sim.ts';
import { validateSpecies } from './species.ts';
import { MATERIALS } from './materials.ts';

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
      temp: w.temp.slice(), heat: w.heat.slice(), hum: w.hum.slice(), humBias: w.humBias.slice(), surface: w.surface.slice(),
      chunkActive: w.chunkActive.slice(), chunkVer: w.chunkVer.slice(), moved: w.moved.slice(),
      chunkReactive:w.chunkReactive.slice(),
      dirtyColumns:[...w.dirtyColumns],
      ledger: { sources: structuredClone(w.ledger.sources), sinks: structuredClone(w.ledger.sinks), initial: { ...w.ledger.initial } },
    },
    phys: { stamp: sim.phys.stamp, moistureCursor: sim.phys.moistureCursor, raining: sim.phys.raining, rainLocal: sim.phys.rainLocal.map((r) => ({ ...r })), slumps: sim.phys.slumps,topologyChanged:sim.phys.sandbox.topologyChanged },
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
    createOpts: structuredClone(sim.createOpts), replayable: sim.replayable,
    pending: structuredClone(sim.pending), navDirty: sim.navDirty, airT: sim.airT, daytime: sim.daytime,
  };
  return {
    format: 'ant-colony-sandbox', version: SAVE_VERSION, savedAt: new Date().toISOString(), name,
    summary: { tick: sim.tick, colonies: sim.aliveColonies().length, ants: sim.a.count, scenario: sim.cfg.scenario, mode: sim.mode, seed: sim.cfg.seed },
    state,
  };
}

/** Schema 1 predates the electrical field. Unknown versions never enter the simulator. */
export function migrate(file: SaveFile): SaveFile {
  if(!file||typeof file!=='object')throw new Error('Not a save file.');
  if(!Number.isInteger(file.version)||file.version<1)throw new Error('Missing or unsupported save schema version.');
  if (file.version > SAVE_VERSION) throw new Error(`This save was made by a newer version (schema ${file.version}); this build reads up to ${SAVE_VERSION}.`);
  if(file.version===1){const W=file.state?.cfg?.W,H=file.state?.cfg?.H;if(file.state?.world&&!file.state.world.charge&&Number.isInteger(W)&&W>=32&&W<=2048&&Number.isInteger(H)&&H>=32&&H<=1024)file.state.world.charge=new Uint8Array(W*H);file.version=2;}
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
  if(s.world?.charge&&s.world.charge.length!==W*H)errs.push('Electrical field has the wrong size.');
  if (!Array.isArray(s.rng) || s.rng.length !== 4) errs.push('Random generator state is missing.');
  if (!s.ants || typeof s.ants.n !== 'number') errs.push('Organism data is missing.');
  else if (!Number.isInteger(s.ants.cap) || s.ants.cap < 16 || s.ants.cap > 100000 || !Number.isInteger(s.ants.n) || s.ants.n < 0 || s.ants.n > s.ants.cap) errs.push('Organism capacity is invalid (maximum 100,000).');
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
  if(s.world.chunkReactive)w.chunkReactive.set(s.world.chunkReactive);else w.rebuildReactive();
  w.dirtyColumns=new Set(s.world.dirtyColumns??[]);
  // Older schema-1 snapshots did not keep the CA activity scheduler.
  if (s.world.chunkActive) w.chunkActive.set(s.world.chunkActive); else w.chunkActive.fill(8);
  if (s.world.chunkVer) w.chunkVer.set(s.world.chunkVer);
  if (s.world.moved) w.moved.set(s.world.moved);
  Object.assign(sim.phys, { stamp: s.phys.stamp, moistureCursor: s.phys.moistureCursor, raining: s.phys.raining, rainLocal: s.phys.rainLocal.map((r: any) => ({ ...r })), slumps: s.phys.slumps });
  sim.phys.sandbox.topologyChanged=s.phys.topologyChanged??false;
  sim.a = AntStore.restore(s.ants);
  sim.colonies = s.colonies.map((o: any) => {
    if (!o) return null;
    const sp = sim.speciesById(o.speciesId);
    const fields = makeColonyFields(w, sp.communication.trailRetention);
    const c: Colony = { ...o, ...fields };
    for (const k of COLONY_FIELDS) c[k].restore(o[k]);
    c.brood = o.brood.map((b: any) => ({ ...b, a: Float32Array.from(b.a), b: b.b ? Float32Array.from(b.b) : null }));
    c.queens = o.queens.map((q: any) => ({ ...q, sperm: q.sperm.map((sp2: any) => ({ ...sp2, genome: Float32Array.from(sp2.genome) })) }));
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
