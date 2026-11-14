// Simulation orchestrator: fixed-step tick scheduling, player commands,
// ledgered terrain operations, colony lifecycle, reproduction and inheritance.
import { AntStore, CASTE, NAV, SpatialIndex, TASK } from './ants.ts';
import { contactPhase, canStand, inOwnNest, moveTo, updateAnt } from './behavior.ts';
import type { Brood, Colony, LineageRecord, QueenData, Sperm } from './colony.ts';
import { COLONY_MARKINGS, DESTINY, STAGE, makeColonyFields, newStats } from './colony.ts';
import { Critters } from './critters.ts';
import { lifeEcology } from './life-ecology.ts';
import { ecologyStep } from './ecology.ts';
import type { Mode, MutationRecord } from './genetics.ts';
import { LOCI, MODES, NL, NP, P, broodCost, founderGenome, gval, makeEgg, phenotype } from './genetics.ts';
import { FOOD_OF, IS_SOLID, IS_WATER, IS_LIQUID, M, MATERIALS, MOIST_CAP, WATER_UNITS,FANTASY_MATERIALS } from './materials.ts';
import type { Climate } from './physics.ts';
import { DAY_TICKS, DEFAULT_CLIMATE, Physics, SEASON_DAYS, airTemperature, isDaytime, seasonName, yearFrac } from './physics.ts';
import { Rng } from './rng.ts';
import type { SpeciesDef } from './species.ts';
import { BUILTIN_SPECIES } from './species.ts';
import { CS, FLAG_NEST, FLAG_PLAYER, FLAG_PLUG, TS, World } from './world.ts';
import { checkJournal, JOURNAL_DEFS } from './journal.ts';
import { STRATEGY_EVERY, underSiege, updateStrategy } from './warfare.ts';
import { architectureStep } from './architecture.ts';

export const SAVE_VERSION = 4;

export interface Settings {
  /** fraction of mates drawn from an off-map background population (drift buffer) */
  immigration: number;
  maxColonies: number;
  maxLandings: number;
  naturalPredators: boolean;
  weather: boolean;
  allToolsUnlocked: boolean;
}
export const DEFAULT_SETTINGS: Settings = {
  immigration: 0.25, maxColonies: 24, maxLandings: 6, naturalPredators: true, weather: true, allToolsUnlocked: false,
};

export interface SimConfig {
  W: number;
  H: number;
  seed: number;
  mode: Mode;
  scenario: string;
  climate: Climate;
  settings: Settings;
  customSpecies?: SpeciesDef[];
}

export type Command =
  | {t:'color';x:number;y:number;r:number;tint:number}
  | { t:'fill';mat:number;x:number;y:number }
  | { t:'charge';x:number;y:number;r:number;amount?:number }
  | {t:'editCell';x:number;y:number;mat:number;amount:number;temperature:number;charge:number;toxin:number}
  | {t:'mix'|'smash';x:number;y:number;r:number;intense?:boolean}
  | {t:'move';x:number;y:number;toX:number;toY:number;r:number}
  | { t: 'paint'; mat: number; x: number; y: number; r: number; replace?: boolean;tint?:number }
  | { t: 'dig'; x: number; y: number; r: number }
  | { t: 'erase'; x: number; y: number; r: number }
  | { t: 'heat'; x: number; y: number; r: number; amount: number }
  | { t: 'humidity'; x: number; y: number; r: number; amount: number }
  | { t: 'toxin'; x: number; y: number; r: number }
  | { t: 'rain'; x: number; y: number; r: number }
  | { t: 'queen'; species: string; x: number; y: number }
  | { t: 'colony'; species: string; x: number; y: number; workers: number }
  | { t: 'critter'; kind: string; x: number; y: number }
  | { t: 'editGenome'; colonyId: number; locus: number; value: number }
  | { t: 'setting'; key: keyof Settings; value: number | boolean }
  | { t: 'climate'; key: keyof Climate; value: number };

export interface SimEvent { tick: number; kind: string; text: string; colony: number }
export interface JournalEntry { key: string; tick: number; title: string; text: string; kind: 'discovery' | 'unlock' }

const INTERNAL = new Set(['picked', 'dropped', 'drunk', 'removed waste', 'scavenged', 'excavated', 'moved']);

export class Sim {
  cfg: SimConfig;
  mode: Mode;
  tick = 0;
  rng: Rng;
  w: World;
  phys: Physics;
  a: AntStore;
  idx: SpatialIndex;
  occ: Uint8Array;
  colonies: (Colony | null)[] = [];
  nextColonyId = 1;
  broodNextId = 1;
  species: SpeciesDef[];
  trailNeighbours: number[][] = [];
  lineage: LineageRecord[] = [];
  mutations: MutationRecord[] = [];
  mutationCount = 0;
  events: SimEvent[] = [];
  journal: JournalEntry[] = [];
  swarm: { species: string; sex: 'F' | 'M'; a: Float32Array; b: Float32Array | null; colonyId: number; antId: number; generation: number }[] = [];
  flightDays: Record<string, number[]> = {};
  flightEnd: Record<string, number> = {};
  critters: Critters;
  carriedFood = [0, 0, 0];
  commandLog: { tick: number; cmd: Command }[] = [];
  pending: Command[] = [];
  traitHistory: { day: number; species: string; n: number; mean: number[]; sd: number[]; workerMean: number[] }[] = [];
  activity: Float32Array; // coarse visit counts (decaying)
  activityOwner: Uint8Array; // dominant colony slot+1 per coarse cell
  mortality: Float32Array; // coarse recent deaths (decaying)
  scratchW = new Float32Array(8);
  airT = 20;
  daytime = true;
  flags = { biolumUsed: false, memoryFailures: 0, routeBlocks: 0, rescues: 0, foodFoundTicks: [] as number[] };
  counters = { dispersedQueens: 0, unmatedQueens: 0, landedQueens: 0, flights: 0, deliveries: 0 };
  perf = { antMs: 0, caMs: 0, fieldMs: 0, colonyMs: 0, signalMs: 0, ecoMs: 0 };
  reproBrood = new Map<number, number>(); // reproductive ant id -> brood id (for mutation fate tracking)
  unlocked = new Set<string>();
  ecoCursor = 0;
  /** the options this world was created from (for deterministic replay verification) */
  createOpts: any = null;
  replayable = true;
  /** scenario rules: commands applied automatically at given ticks (part of saved state) */
  scheduled: { tick: number; cmd: Command; note: string }[] = [];
  scenarioInfo:{id:string;title:string;goal:string;actions:{label:string;cmds:Command[]}[];notes?:{x:number;y:number;text:string}[]} = { id: 'sandbox', title: 'Free sandbox', goal: '', actions: [] };

  constructor(cfg: SimConfig) {
    this.cfg = cfg;
    this.mode = cfg.mode;
    this.rng = new Rng(cfg.seed);
    this.w = new World(cfg.W, cfg.H);
    this.phys = new Physics(this.w, this.rng);
    this.phys.sandbox.canClone=m=>this.mode==='fantasy'||!FANTASY_MATERIALS.includes(m);
    this.a = new AntStore(2048);
    this.idx = new SpatialIndex(cfg.W, cfg.H);
    this.occ = new Uint8Array(this.w.N);
    this.species = [...BUILTIN_SPECIES, ...(cfg.customSpecies ?? [])];
    this.critters = new Critters();
    this.activity = new Float32Array(this.w.TW * this.w.TH);
    this.activityOwner = new Uint8Array(this.w.TW * this.w.TH);
    this.mortality = new Float32Array(this.w.TW * this.w.TH);
    this.nestDist = new Uint16Array(this.w.N);
  }

  get climate() { return this.cfg.climate; }
  get settings() { return this.cfg.settings; }

  speciesById(id: string): SpeciesDef {
    return this.species.find((s) => s.id === id) ?? this.species[0];
  }
  speciesOf(c: Colony): SpeciesDef {
    return this.speciesById(c.speciesId);
  }

  event(kind: string, text: string, c?: Colony | null) {
    this.events.push({ tick: this.tick, kind, text, colony: c ? c.id : 0 });
    if (this.events.length > 400) this.events.splice(0, this.events.length - 400);
  }

  // ------------------------------------------------------------ main loop

  queue(cmd: Command) {
    this.pending.push(cmd);
  }

  /** Apply a player command immediately while paused (logged at the current tick for replay). */
  applyNow(cmd: Command) {
    this.queue(cmd);this.flushCommands();
  }

  /** One navigation invalidation per input batch, including edits made while paused. */
  flushCommands(){
    for(const cmd of this.pending){
      this.commandLog.push({tick:this.tick,cmd});this.apply(cmd);
      if(cmd.t==='paint'||cmd.t==='dig'||cmd.t==='erase'||cmd.t==='fill'||cmd.t==='editCell')this.navDirty=true;
    }
    this.pending.length=0;
    if(this.navDirty){this.w.flushSurface();for(const c of this.colonies)if(c&&c.alive)this.scanNest(c);this.navDirty=false;}
  }

  step() {
    const t0 = now();
    for (let k = 0; k < this.scheduled.length; k++) {
      const s = this.scheduled[k];
      if (s.tick === this.tick) { this.apply(s.cmd); if (s.note) this.event('scenario', s.note); }
    }
    this.flushCommands();
    if (this.commandLog.length > 20000) { this.commandLog.splice(0, this.commandLog.length - 20000); this.replayable = false; }
    const tick = this.tick;
    this.airT = airTemperature(this.climate, tick);
    this.daytime = isDaytime(tick);
    // --- environment ---
    if (this.settings.weather) this.phys.stepWeather(tick, this.climate);
    else if (this.phys.rainLocal.length) this.phys.stepWeather(tick, { ...this.climate, rainChancePerDay: 0 });
    this.phys.stepCA(tick);
    if(this.phys.sandbox.topologyChanged){this.navDirty=true;this.phys.sandbox.topologyChanged=false;}
    const t1 = now();
    this.phys.stepMoisture(tick, this.climate);
    if ((tick & 7) === 0) this.phys.stepTemperature(tick, this.climate);
    if ((tick & 15) === 0) this.phys.stepHumidity(this.climate);
    this.w.flushSurface();
    const t2 = now();
    // --- agents ---
    this.idx.rebuild(this.a);
    const a = this.a;
    for (let i = 0; i < a.n; i++) if (a.alive[i]) updateAnt(this, i);
    contactPhase(this);
    this.critters.step(this);
    const t3 = now();
    // --- signals ---
    if ((tick & 3) === 0) {
      for (const c of this.colonies) {
        if (!c) continue;
        c.alarm.step();
        if ((tick & 7) === 0) { c.trail.step(); c.nestOdor.step(); c.digCue.step(); }
      }
    }
    const t4 = now();
    // --- colonies ---
    if (tick % 30 === 0) for (const c of this.colonies) if (c && c.alive) this.updateColony(c);
    for (const c of this.colonies) {
      if (!c || !c.alive) continue;
      if (tick % 60 === (c.slot * 11) % 60) architectureStep(this, c);
      if (tick % STRATEGY_EVERY === (c.slot * 7) % STRATEGY_EVERY) updateStrategy(this, c);
    }
    if (tick % 300 === 0) {
      for (const c of this.colonies) if (c && c.alive) this.scanNest(c);
      this.computeTrailNeighbours();
    }
    this.flightSchedule(tick);
    const t5 = now();
    if (tick % 60 === 0) ecologyStep(this);
    lifeEcology(this);
    if (tick % 10 === 0) this.sampleActivity();
    if (tick % DAY_TICKS === 0 && tick > 0) this.daily();
    if (tick % 120 === 0) checkJournal(this);
    const t6 = now();
    const k = 0.05;
    this.perf.caMs += k * (t1 - t0 - this.perf.caMs);
    this.perf.fieldMs += k * (t2 - t1 - this.perf.fieldMs);
    this.perf.antMs += k * (t3 - t2 - this.perf.antMs);
    this.perf.signalMs += k * (t4 - t3 - this.perf.signalMs);
    this.perf.colonyMs += k * (t5 - t4 - this.perf.colonyMs);
    this.perf.ecoMs += k * (t6 - t5 - this.perf.ecoMs);
    this.tick++;
  }

  // ------------------------------------------------------------ terrain ops (ledgered)

  /** Replace a cell, recording any food/water created or destroyed under `cause`. */
  setCell(i: number, m: number, amt: number, cause: string) {
    const w = this.w;
    const old = w.mat[i];
    const internal = INTERNAL.has(cause);
    if(internal&&m===M.AIR&&FOOD_OF[old]&&w.carrier[i]){m=M.WATER;amt=w.carrier[i];w.carrier[i]=0;}
    if (!internal) {
      const f = w.foodType(i);
      if (f && w.amt[i]) w.ledger.sink(foodKey(f), cause, w.amt[i]);
      if (IS_WATER[old] && w.amt[i]) w.ledger.sink('water', cause, w.amt[i]);
      const nf = FOOD_OF[m];
      if (nf && amt) w.ledger.source(foodKey(nf), cause, amt);
      if (IS_WATER[m] && amt) w.ledger.source('water', cause, amt);
    }
    const lost = w.setRaw(i, m, amt);
    if(old!==m&&cause.startsWith('player')){
      const d=MATERIALS[m],n=d.initialMoisture??0;
      if(n>w.moist[i]){w.ledger.source('water','player material moisture',n-w.moist[i]);w.moist[i]=n;}
      if(d.initialTemperature!==undefined)w.temp[w.tIdx(i%w.W,(i/w.W)|0)]=d.initialTemperature;
      const carrier=d.initialCarrier??0,delta=carrier-w.carrier[i];if(delta>0)w.ledger.source('water','player mixture carrier',delta);else if(delta<0)w.ledger.sink('water','player mixture carrier',-delta);w.carrier[i]=carrier;
      w.setTint(i,d.defaultTint??0);if(m===M.FROZEN_MIXTURE)w.phase[i]=M.WATER;
      if(d.randomTints)w.setTint(i,d.randomTints[this.rng.int(d.randomTints.length)]);if(d.phaseMax)w.phase[i]=this.rng.int(d.phaseMax+1);
    }
    if(old!==m&&cause.startsWith('player')){
      const tc=w.tIdx(i%w.W,(i/w.W)|0),hot=m===M.LAVA?1100:m===M.FIRE?350:m===M.STEAM?110:m===M.MOLTEN_GLASS?1200:m===M.MOLTEN_METAL?800:null;
      if(hot!==null)w.temp[tc]=Math.max(w.temp[tc],hot);if(m===M.ICE||m===M.SNOW)w.temp[tc]=Math.min(w.temp[tc],-8);
    }
    if (lost) w.ledger.sink('water', cause === 'excavated' ? 'excavation' : cause, lost);
    if (IS_SOLID[m] && this.occ[i]) this.displaceAntsAt(i);
  }

  private displaceAntsAt(i: number) {
    const w = this.w, a = this.a;
    const x = i % w.W, y = (i / w.W) | 0;
    this.idx.rebuild(a);
    this.idx.query(a, x, y, 0, (j) => {
      for (let r = 1; r <= 3; r++)
        for (let dy = -r; dy <= r; dy++)
          for (let dx = -r; dx <= r; dx++)
            if (a.x[j] === x && a.y[j] === y && canStand(this, x + dx, y + dy, false)) moveTo(this, j, x + dx, y + dy);
    });
  }

  /** Ant excavation: removes the cell, keeps moisture in neighbouring soil where possible. */
  excavate(k: number, c: Colony) {
    const w = this.w;
    let water = w.moist[k];
    w.moist[k] = 0;
    const x = k % w.W, y = (k / w.W) | 0;
    for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
      if (!water || !w.inb(x + dx, y + dy)) continue;
      const j = (y + dy) * w.W + x + dx;
      const cap = MOIST_CAP[w.mat[j]];
      if (!cap || w.mat[j] === M.WATER) continue;
      const t = Math.min(water, cap - w.moist[j]);
      w.moist[j] += t; water -= t;
    }
    if (water) w.ledger.sink('water', 'excavation', water);
    w.flags[k] = (w.flags[k] | FLAG_NEST) & ~FLAG_PLUG;
    w.owner[k] = c.slot + 1;
    this.setCell(k, M.AIR, 0, 'excavated');
  }

  apply(cmd: Command) {
    if(this.mode!=='fantasy'&&(cmd.t==='paint'||cmd.t==='fill'||cmd.t==='editCell')&&(FANTASY_MATERIALS.includes(cmd.mat)||(cmd.t==='editCell'&&cmd.mat===M.CLONER&&FANTASY_MATERIALS.includes(Math.round(cmd.amount))))){this.event('sandbox','This fictional biological material requires Fantasy mode.');return;}
    const w = this.w;
    const circle = (x: number, y: number, r: number, fn: (i: number, cx: number, cy: number) => void) => {
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy > r * r + r) continue;
          const cx = x + dx, cy = y + dy;
          if (cx < 0 || cy < 0 || cx >= w.W || cy >= w.H) continue;
          fn(cy * w.W + cx, cx, cy);
        }
    };
    switch (cmd.t) {
      case 'color':{circle(cmd.x,cmd.y,cmd.r,i=>{if(w.mat[i]!==M.AIR)w.setTint(i,cmd.tint);});break;}
      case 'smash':{circle(cmd.x,cmd.y,cmd.r,(i)=>{const old=w.mat[i],m=cmd.intense&&[M.STONE,M.GRAVEL,M.ROCK,M.BASALT].includes(old as any)?M.SAND:old===M.STONE?M.GRAVEL:old===M.GLASS?M.GLASS_SHARD:old===M.WOOD?M.SAWDUST:old===M.ICE?M.SNOW:old===M.CLAY?M.CLAY_POWDER:old===M.SUGAR?M.SUGAR_POWDER:old===M.SANDSTONE?M.SAND:old===M.MUDSTONE?M.DIRT:old===M.BASALT?M.ROCK:old===M.TUFF?M.ASH:old===M.LIMESTONE?M.DUST:old===M.BONE?M.DUST:old;if(m!==old)this.phys.sandbox.transform(i,m,w.amt[i],'player crushing');});this.navDirty=true;break;}
      case 'mix':{const movable=(m:number)=>{const d=MATERIALS[m];return(!d.solid||d.granular)&&(cmd.intense||![M.FIRE,M.SPARK,M.SMOKE].includes(m as any));};for(let n=0;n<Math.min(96,(cmd.r*2+1)**2);n++){const x=cmd.x+this.rng.int(cmd.r*2+1)-cmd.r,y=cmd.y+this.rng.int(cmd.r*2+1)-cmd.r,xx=cmd.x+this.rng.int(cmd.r*2+1)-cmd.r,yy=cmd.y+this.rng.int(cmd.r*2+1)-cmd.r;if(!w.inb(x,y)||!w.inb(xx,yy))continue;const i=y*w.W+x,j=yy*w.W+xx;if(movable(w.mat[i])&&movable(w.mat[j]))w.swap(i,j);}this.navDirty=true;break;}
      case 'move':{const dx=cmd.toX-cmd.x,dy=cmd.toY-cmd.y;for(let iy=0;iy<=cmd.r*2;iy++)for(let ix=0;ix<=cmd.r*2;ix++){const oy=dy>0?cmd.r-iy:iy-cmd.r,ox=dx>0?cmd.r-ix:ix-cmd.r;if(ox*ox+oy*oy>cmd.r*cmd.r+cmd.r)continue;const x=cmd.x+ox,y=cmd.y+oy,xx=x+dx,yy=y+dy;if(!w.inb(x,y)||!w.inb(xx,yy))continue;const i=y*w.W+x,j=yy*w.W+xx,m=MATERIALS[w.mat[i]];if(m.id!==M.AIR&&(!m.solid||m.granular)&&w.mat[j]===M.AIR)w.swap(i,j);}this.navDirty=true;break;}
      case 'editCell':{if(!w.inb(cmd.x,cmd.y)||!MATERIALS[cmd.mat])break;const k=cmd.y*w.W+cmd.x;const n=Math.max(0,Math.min(cmd.mat===M.CLONER?MATERIALS.length-1:IS_WATER[cmd.mat]?64:255,Math.round(cmd.amount)));this.setCell(k,(FOOD_OF[cmd.mat]||IS_WATER[cmd.mat])&&!n?M.AIR:cmd.mat,n,'player properties');w.temp[w.tIdx(cmd.x,cmd.y)]=Math.max(-273,Math.min(2000,cmd.temperature));w.charge[k]=Math.max(0,Math.min(255,cmd.charge));w.toxin[k]=Math.max(0,Math.min(255,cmd.toxin));break;}
      case 'fill': {
        if(!w.inb(cmd.x,cmd.y)||!MATERIALS[cmd.mat])break;
        const start=cmd.y*w.W+cmd.x,old=w.mat[start];if(old===cmd.mat)break;
        const seen=new Uint8Array(w.N),queue=new Uint32Array(w.N);let head=0,tail=1;queue[0]=start;seen[start]=1;
        const def=MATERIALS[cmd.mat],amt=def.food?def.foodUnits:IS_WATER[cmd.mat]?WATER_UNITS:def.nutrient;
        while(head<tail){const k=queue[head++],x=k%w.W;this.setCell(k,cmd.mat,amt,'player fill');w.owner[k]=0;
          for(let d=0;d<4;d++){const j=d===0?k-1:d===1?k+1:d===2?k-w.W:k+w.W;if(j<0||j>=w.N||seen[j]||Math.abs(j%w.W-x)>1||w.mat[j]!==old)continue;seen[j]=1;queue[tail++]=j;}
        }
        this.navDirty=true;break;
      }
      case 'paint': {
        const m = cmd.mat;
        const def = MATERIALS[m];
        circle(cmd.x, cmd.y, cmd.r, (i, cx, cy) => {
          const old = w.mat[i];
          if (old === m) {if(cmd.tint!==undefined)w.setTint(i,cmd.tint);return;}
          if (!cmd.replace && old !== M.AIR) return;
          if (old === M.PLANT && m !== M.AIR) w.flags[i] &= ~8;
          const amt = def.food ? def.foodUnits : IS_WATER[m] ? WATER_UNITS : def.nutrient;
          this.setCell(i, m, amt, 'player');
          if(cmd.tint!==undefined)w.setTint(i,cmd.tint);
          w.flags[i] |= FLAG_PLAYER;
          if (m !== M.AIR) w.owner[i] = 0;
          void cx; void cy;
        });
        break;
      }
      case 'dig':
      case 'erase': {
        circle(cmd.x, cmd.y, cmd.r, (i) => {
          const old = w.mat[i];
          if (old === M.AIR) return;
          if (cmd.t === 'dig' && (FOOD_OF[old] || IS_LIQUID[old])) return;
          // erased moisture is removed by the player (ledgered)
          if (w.moist[i]) { w.ledger.sink('water', 'player', w.moist[i]); w.moist[i] = 0; }
          this.setCell(i, M.AIR, 0, 'player');
          w.flags[i] = (w.flags[i] | FLAG_PLAYER) & ~(FLAG_PLUG | 8);
        });
        break;
      }
      case 'heat': {
        const tr = Math.max(1, Math.round(cmd.r / TS));
        const tx0 = Math.floor(cmd.x / TS), ty0 = Math.floor(cmd.y / TS);
        for (let dy = -tr; dy <= tr; dy++)
          for (let dx = -tr; dx <= tr; dx++) {
            const tx = tx0 + dx, ty = ty0 + dy;
            if (tx < 0 || ty < 0 || tx >= w.TW || ty >= w.TH) continue;
            const c = ty * w.TW + tx;
            w.temp[c] = Math.max(-273, Math.min(2000, w.temp[c] + cmd.amount));
            w.heat[c] = Math.max(-25, Math.min(25, w.heat[c] + cmd.amount));
            w.touch(Math.min(w.W - 1, tx * TS + 2), Math.min(w.H - 1, ty * TS + 2));
          }
        break;
      }
      case 'humidity': {
        circle(cmd.x, cmd.y, cmd.r, (i, cx, cy) => {
          const cap = MOIST_CAP[w.mat[i]];
          const tc = w.tIdx(cx, cy);
          w.humBias[tc] = Math.max(-0.6, Math.min(0.6, w.humBias[tc] + cmd.amount * 0.02));
          if (!cap || w.mat[i] === M.WATER) return;
          const delta = Math.round(cmd.amount * 6);
          const nv = Math.max(0, Math.min(cap, w.moist[i] + delta));
          const d = nv - w.moist[i];
          if (d > 0) w.ledger.source('water', 'player humidity tool', d);
          else if (d < 0) w.ledger.sink('water', 'player humidity tool', -d);
          w.moist[i] = nv;
          w.touch(cx, cy);
        });
        break;
      }
      case 'toxin': {
        circle(cmd.x, cmd.y, cmd.r, (i, cx, cy) => { w.toxin[i] = 255; w.touch(cx, cy); });
        break;
      }
      case 'charge':{circle(cmd.x,cmd.y,cmd.r,(i,cx,cy)=>{w.charge[i]=Math.max(0,Math.min(255,Math.round(cmd.amount??255)));w.touch(cx,cy);});break;}
      case 'rain': {
        this.phys.rainLocal.push({ x: cmd.x, w: Math.max(3, cmd.r), ticks: 600 });
        break;
      }
      case 'queen': {
        const sp = this.speciesById(cmd.species);
        const g = founderGenome(this.rng);
        const g2 = founderGenome(this.rng);
        const mates = this.sampleMates(sp, [], 0);
        this.foundColony(sp, cmd.x, cmd.y, g, g2, mates, 0, 0, null);
        break;
      }
      case 'colony': {
        const sp = this.speciesById(cmd.species);
        this.establishedColony(sp, cmd.x, cmd.y, cmd.workers);
        break;
      }
      case 'critter': {
        const c=this.critters.spawn(this, cmd.kind, cmd.x, cmd.y);if(!c)this.event('wildlife',`${cmd.kind}: introduction failed. Check habitat, free space and population limits.`);
        break;
      }
      case 'editGenome': {
        // SANDBOX OVERRIDE: edits the queen's germline. Only offspring conceived later are affected.
        const c = this.colonies.find((k) => k && k.id === cmd.colonyId);
        if (!c || !c.queens.length) break;
        const qi = this.a.findById(c.queens[0].antId);
        if (qi < 0) break;
        const v = Math.max(0, Math.min(1, cmd.value));
        this.a.ga[qi * NL + cmd.locus] = v;
        this.a.gb[qi * NL + cmd.locus] = v;
        c.queens[0].playerEdited = true;
        c.playerEdited = true;
        const rec = this.lineage.find((r) => r.id === c.id);
        if (rec) rec.playerEdited = true;
        this.event('override', `Sandbox override: ${c.name} queen germline ${LOCI[cmd.locus].name} set to ${v.toFixed(2)} (future offspring only).`, c);
        break;
      }
      case 'setting': {
        (this.cfg.settings as any)[cmd.key] = cmd.value;
        break;
      }
      case 'climate': {
        (this.cfg.climate as any)[cmd.key] = cmd.value;
        break;
      }
    }
  }

  // ------------------------------------------------------------ colonies

  private allocSlot(): number {
    for (let s = 0; s < 255; s++) if (!this.colonies[s] || !this.colonies[s]!.alive && !this.colonyHasMembers(this.colonies[s]!)) return s;
    return -1;
  }
  private colonyHasMembers(c: Colony) {
    const a = this.a;
    for (let i = 0; i < a.n; i++) if (a.alive[i] && a.colony[i] === c.slot) return true;
    return false;
  }

  aliveColonies() {
    return this.colonies.filter((c): c is Colony => !!c && c.alive);
  }

  /** Create a colony around a newly landed (mated) queen. */
  foundColony(sp: SpeciesDef, x: number, y: number, ga: Float32Array, gb: Float32Array, sperm: Sperm[], generation: number,
    motherColony: number, natal: Colony | null, fromBroodId = 0): Colony | null {
    const slot = this.allocSlot();
    if (slot < 0) return null;
    const w = this.w;
    x = Math.max(1, Math.min(w.W - 2, x));
    // land on the surface at column x
    let yy = Math.min(w.H - 2, Math.max(1, y));
    if (IS_SOLID[w.get(x, yy)]) { while (yy > 0 && IS_SOLID[w.get(x, yy)]) yy--; }
    else { while (yy < w.H - 1 && !IS_SOLID[w.get(x, yy + 1)] && w.get(x, yy + 1) !== M.WATER) yy++; }
    const fields = makeColonyFields(w, sp.communication.trailRetention);
    const id = this.nextColonyId++;
    const c: Colony = {
      id, slot, speciesId: sp.id, name: `${sp.commonName.split(' ').pop()} #${id}`,
      marking: COLONY_MARKINGS[(id - 1) % COLONY_MARKINGS.length], alive: true, stage: 'founding',
      foundedTick: this.tick, diedTick: -1, generation, motherColony,
      fatherColonies: [...new Set(sperm.map((s) => s.colonyId))],
      queens: [], entrance: { x, y: yy }, chamber: { x: -1, y: -1 }, sealed: false,
      store: { sugar: 0, protein: 0, seed: 0, mineral: 0 }, brood: [], stats: newStats(),
      stim: { forage: 0, nurse: 0, dig: 0, waste: 0, exit: 0 }, workers: 0, adults: 0, nestVolume: 0, nestDepth: 0,
      hasExit: true, corpsesInside: 0, reproductive: false, exposure: [], ...fields,
      acc: { temp: 0, moist: 0, n: 0, flooded: 0, starving: 0 }, playerEdited: false,
    };
    this.colonies[slot] = c;
    const qi = this.spawnAdult(c, CASTE.QUEEN, x, yy, ga, gb, { nutrition: 1, meanTemp: 22, mineral: 1 }, 0, 0, generation);
    this.a.task[qi] = TASK.FOUND_SEARCH;
    this.a.nav[qi] = NAV.WANDER;
    const q: QueenData = { antId: this.a.id[qi], reserves: sp.founding.reserves, sperm, mated: sperm.length > 0, eggsLaid: 0, natalColony: natal ? natal.id : 0, playerEdited: false };
    c.queens.push(q);
    const founder: number[] = [];
    for (let l = 0; l < NL; l++) founder.push((ga[l] + gb[l]) / 2);
    this.lineage.push({
      id, speciesId: sp.id, name: c.name, generation, motherColony, fatherColonies: c.fatherColonies, foundedTick: this.tick,
      diedTick: -1, founderGenotype: founder, peakWorkers: 0, gynesFlown: 0, malesFlown: 0, daughterColonies: 0, playerEdited: false, causeOfEnd: '',
    });
    if (fromBroodId) for (const m of this.mutations) if (m.offspringId === fromBroodId) (m as any).fate = `founded ${c.name}`;
    this.event('founding', `A ${sp.name} queen landed and began searching for a nest site (${c.name}, generation ${generation}).`, c);
    return c;
  }

  /** Sandbox: an established colony with a dug nest and some workers (labelled as introduced). */
  establishedColony(sp: SpeciesDef, x: number, y: number, workers: number) {
    const g = founderGenome(this.rng), g2 = founderGenome(this.rng);
    const c = this.foundColony(sp, x, y, g, g2, this.sampleMates(sp, [], 0), 0, 0, null);
    if (!c) return null;
    const w = this.w;
    const ex = c.entrance.x, ey = c.entrance.y;
    // dig a simple shaft and chamber (player-introduced structure)
    const depth = sp.founding.chamberDepth + 6;
    for (let d = 0; d <= depth; d++) for (let dx = 0; dx <= 1; dx++) this.digAsColony(ex + dx, ey + d, c);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -5; dx <= 6; dx++) this.digAsColony(ex + dx, ey + depth + dy, c);
    c.chamber = { x: ex, y: ey + depth };
    const qi = this.a.findById(c.queens[0].antId);
    moveTo(this, qi, ex, ey + depth + 1);
    this.a.task[qi] = TASK.QUEEN_LAY; this.a.nav[qi] = NAV.STAY;
    for (let k = 0; k < workers; k++) {
      const eggA = makeEgg(this.rng, this.a.ga.subarray(qi * NL, qi * NL + NL), this.a.gb.subarray(qi * NL, qi * NL + NL), this.mode);
      const sperm = this.pickSperm(c.queens[0]);
      const wi = this.spawnAdult(c, CASTE.WORKER, ex + (k % 10) - 4, ey + depth + 1, eggA, sperm ? sperm.genome.slice() : eggA.slice(),
        { nutrition: 1, meanTemp: 24, mineral: 1 }, c.queens[0].antId, sperm?.maleId ?? 0, 0);
      this.a.age[wi] = this.rng.range(0, sp.workers.lifespanDays * 0.5);
    }
    c.store.sugar = 20; c.store.protein = 20;
    w.ledger.source('sugar', 'introduced colony stores', 20);
    w.ledger.source('protein', 'introduced colony stores', 20);
    c.stage = 'growing';
    c.queens[0].reserves = sp.founding.reserves * 0.5;
    this.event('introduced', `Player introduced an established ${sp.name} colony (${c.name}) with ${workers} workers.`, c);
    this.scanNest(c);
    return c;
  }

  private digAsColony(x: number, y: number, c: Colony) {
    const w = this.w;
    if (!w.inb(x, y)) return;
    const k = y * w.W + x;
    if (w.mat[k] === M.AIR) { w.owner[k] = c.slot + 1; return; }
    if (MATERIALS[w.mat[k]].digResist === 0 && w.mat[k] !== M.ROOT) return;
    this.excavate(k, c);
  }

  spawnAdult(c: Colony, caste: number, x: number, y: number, ga: Float32Array, gb: Float32Array | null,
    dev: { nutrition: number; meanTemp: number; mineral: number }, mother: number, father: number, generation: number): number {
    const a = this.a;
    const i = a.spawn();
    a.colony[i] = c.slot;
    a.caste[i] = caste;
    const w = this.w;
    let sx = Math.max(0, Math.min(w.W - 1, x)), sy = Math.max(0, Math.min(w.H - 1, y));
    if (!canStand(this, sx, sy, false)) {
      outer: for (let r = 1; r <= 6; r++)
        for (let dy = -r; dy <= r; dy++)
          for (let dx = -r; dx <= r; dx++)
            if (canStand(this, sx + dx, sy + dy, false)) { sx += dx; sy += dy; break outer; }
    }
    a.x[i] = sx; a.y[i] = sy; a.px[i] = sx; a.py[i] = sy;
    this.occ[sy * w.W + sx]++;
    a.ga.set(ga, i * NL);
    if (gb) a.gb.set(gb, i * NL); else a.gb.set(ga, i * NL);
    phenotype(this.speciesOf(c), this.mode, ga, gb, dev, a.pheno, i * NP);
    a.mother[i] = mother; a.father[i] = father;
    a.generation[i] = generation;
    a.born[i] = this.tick;
    a.energy[i] = 0.8;
    a.tx[i] = c.entrance.x; a.ty[i] = c.entrance.y;
    if (caste === CASTE.WORKER) c.workers++;
    c.adults++;
    if (caste === CASTE.MALE || caste === CASTE.GYNE) { a.task[i] = TASK.ALATE; }
    return i;
  }

  killAnt(i: number, cause: string) {
    const a = this.a, w = this.w;
    if (!a.alive[i]) return;
    const c = this.colonies[a.colony[i]];
    const x = a.x[i], y = a.y[i];
    const k = y * w.W + x;
    // carried items are dropped (food conserved where possible)
    const carried = a.carry[i];
    if (carried) {
      const f = FOOD_OF[carried];
      if (f) this.carriedFood[f - 1]--;
      if (w.mat[k] === M.AIR) this.setCell(k, carried, f ? 1 : 0, 'dropped');
      else if (f) w.ledger.sink(foodKey(f), 'lost with dead carrier', 1);
      a.carry[i] = 0;
    }
    if (a.carryBrood[i] >= 0 && c) {
      const b = this.broodById(c.slot, a.carryBrood[i]);
      if (b) b.carried = false;
    }
    if (this.occ[k] > 0) this.occ[k]--;
    // corpse remains (unless in water or occupied by something)
    if (w.mat[k] === M.AIR && cause !== 'flew' && cause !== 'buried') {
      this.setCell(k, M.CORPSE, 0, 'death');
      if (c && w.owner[k] === c.slot + 1) c.corpsesInside++;
    }
    const tc = w.tIdx(x, y);
    this.mortality[tc] += 1;
    a.kill(i);
    if (!c) return;
    if (a.caste[i] === CASTE.WORKER) c.workers--;
    c.adults--;
    if (cause !== 'flew') c.stats.adultDeaths[cause] = (c.stats.adultDeaths[cause] ?? 0) + 1;
    if (a.caste[i] === CASTE.QUEEN) {
      const qid = a.id[i];
      c.queens = c.queens.filter((q) => q.antId !== qid);
      this.event('death', `${c.name}: queen died (${cause}).`, c);
      if (!c.queens.length) {
        c.stage = 'queenless';
        // brood that can still develop continues; no new fertilised eggs
      }
    }
  }

  queenData(c: Colony, antId: number): QueenData | undefined {
    return c.queens.find((q) => q.antId === antId);
  }

  broodById(slot: number, id: number): Brood | undefined {
    const c = this.colonies[slot];
    if (!c) return undefined;
    for (const b of c.brood) if (b.id === id) return b;
    return undefined;
  }

  pickSperm(q: QueenData): Sperm | null {
    if (!q.sperm.length) return null;
    let tot = 0;
    for (const s of q.sperm) tot += s.share;
    let r = this.rng.next() * tot;
    for (const s of q.sperm) { r -= s.share; if (r <= 0) return s; }
    return q.sperm[q.sperm.length - 1];
  }

  /** Sample mates for a gyne: from the flight swarm, plus an off-map background population. */
  sampleMates(sp: SpeciesDef, males: { a: Float32Array; colonyId: number; antId: number }[], natalColony: number): Sperm[] {
    const rng = this.rng;
    let r = rng.next();
    let k = 1;
    for (let j = 0; j < sp.queen.matings.length; j++) { r -= sp.queen.matings[j]; if (r <= 0) { k = j + 1; break; } }
    const out: Sperm[] = [];
    for (let m = 0; m < k; m++) {
      const useBackground = males.length === 0 || rng.chance(this.settings.immigration);
      if (useBackground) {
        if (this.settings.immigration <= 0 && males.length === 0) break;
        out.push({ maleId: 0, colonyId: 0, genome: founderGenome(rng), share: rng.range(0.5, 1.5) });
      } else {
        // mild avoidance of nestmate brothers
        let pick = males[rng.int(males.length)];
        if (pick.colonyId === natalColony && natalColony) pick = males[rng.int(males.length)];
        out.push({ maleId: pick.antId, colonyId: pick.colonyId, genome: pick.a.slice(), share: rng.range(0.5, 1.5) });
      }
    }
    // sperm precedence is skewed: first male tends to dominate paternity (simplification)
    if (out.length > 1) out[0].share *= 2;
    return out;
  }

  siteScore(sp: SpeciesDef, x: number, y: number): number {
    const w = this.w;
    if (!w.inb(x, y)) return 0;
    const k = y * w.W + x;
    const m = w.mat[k];
    const def = MATERIALS[m];
    if (!def.digResist) return 0;
    let s = def.chamberSuitability;
    const cap = def.moistureCap;
    const sat = cap ? w.moist[k] / cap : 0;
    const [lo, hi] = sp.founding.moisture;
    s *= sat < lo ? 0.5 + 0.5 * sat / Math.max(0.01, lo) : sat > hi ? Math.max(0.1, 1 - (sat - hi) * 3) : 1;
    // avoid low-lying wet ground near standing water
    for (let dx = -4; dx <= 4; dx++) if (w.get(x + dx, y - 1) === M.WATER || w.get(x + dx, y) === M.WATER) { s *= 0.3; break; }
    // avoid digging right next to other nests
    for (const c of this.colonies) if (c && c.alive && c.chamber.x >= 0 && Math.abs(c.entrance.x - x) < 12) s *= 0.4;
    return s;
  }

  findFoundingNear(self: Colony, x: number, y: number, r: number): Colony | null {
    for (const c of this.colonies) {
      if (!c || !c.alive || c === self || c.speciesId !== self.speciesId) continue;
      if (c.stage !== 'founding' || c.workers > 0 || c.queens.length >= 4) continue;
      if (Math.abs(c.entrance.x - x) <= r && Math.abs(c.entrance.y - y) <= r + 4) return c;
    }
    return null;
  }

  /** A founding queen joins another queen's founding chamber (pleometrosis). */
  joinColony(i: number, own: Colony, host: Colony) {
    const a = this.a;
    const q = own.queens[0];
    if (!q) return;
    this.occ[a.y[i] * this.w.W + a.x[i]]--;
    a.colony[i] = host.slot;
    this.occ[a.y[i] * this.w.W + a.x[i]]++;
    own.adults--;
    host.adults++;
    host.queens.push(q);
    own.queens = [];
    own.alive = false; own.stage = 'dead'; own.diedTick = this.tick;
    const rec = this.lineage.find((r) => r.id === own.id);
    if (rec) { rec.diedTick = this.tick; rec.causeOfEnd = `queen joined ${host.name} (pleometrosis)`; }
    a.task[i] = host.chamber.x >= 0 ? TASK.QUEEN_LAY : TASK.FOUND_SEARCH;
    a.nav[i] = NAV.GOAL; a.tx[i] = host.entrance.x; a.ty[i] = host.entrance.y;
    this.event('pleometrosis', `A founding queen joined ${host.name}: ${host.queens.length} queens now share the founding.`, host);
    this.journalUnlock('pleometrosis');
  }

  sealShaft(c: Colony) {
    const w = this.w;
    // plug the shaft just below the surface with soil (claustral founding)
    for (let d = 1; d <= 2; d++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = c.entrance.x + dx, y = c.entrance.y + d;
        if (!w.inb(x, y)) continue;
        const k = y * w.W + x;
        if (w.mat[k] === M.AIR && w.owner[k] === c.slot + 1 && this.occ[k] === 0) {
          this.setCell(k, M.SOIL, 0, 'moved');
          w.flags[k] |= FLAG_PLUG;
          w.owner[k] = c.slot + 1;
        }
      }
    }
    c.sealed = true;
    c.hasExit = false;
  }

  /** Daily-scale colony update every 30 ticks: stimuli, brood development, egg laying. */
  updateColony(c: Colony) {
    const sp = this.speciesOf(c);
    const w = this.w, rng = this.rng;
    const dt = 30 / DAY_TICKS;
    const a = this.a;
    // ---- stimuli (colony aggregates standing in for averaged local cues) ----
    let larvae = 0, hungry = 0, eggs = 0;
    for (const b of c.brood) {
      if (b.stage === STAGE.LARVA) { larvae++; if (b.fed < b.need && b.hunger > 0.1) hungry++; }
      else if (b.stage === STAGE.EGG) eggs++;
    }
    const energyStore = c.store.sugar + c.store.seed * sp.nutrition.seed + c.store.protein * 0.5;
    const target = 4 + 0.6 * c.adults + 1.5 * larvae;
    const hunger = Math.max(0, Math.min(1, (target - energyStore) / target));
    const proteinNeed = larvae > 0 ? Math.max(0, Math.min(1, (larvae * 1.2 - c.store.protein - c.store.seed * sp.nutrition.seed) / (larvae * 1.2))) : 0;
    c.stim.forage = c.workers > 0 ? Math.min(1, 0.12 + 0.75 * hunger + 0.4 * proteinNeed) : 0;
    c.stim.nurse = larvae ? Math.min(1, hungry / Math.max(1, larvae) + 0.1) : eggs ? 0.05 : 0;
    const crowd = (c.adults + 0.3 * c.brood.length) / Math.max(1, c.nestVolume / 4);
    c.stim.dig = c.workers > 0 ? Math.max(0, Math.min(1, 0.8 * (crowd / sp.nest.crowdingTarget - 1))) + (c.nestVolume < 40 ? 0.3 : 0) : 0;
    c.stim.waste = c.corpsesInside > 0 ? 0.9 : 0;
    // a colony that plugged its entrance against attackers keeps it closed until the siege passes
    c.stim.exit = c.workers > 0 && !c.hasExit && !underSiege(this, c) ? 1 : 0;
    // ---- life stage & reproductive allocation ----
    const season = seasonName(this.tick);
    c.reproductive = c.workers >= sp.reproduction.matureWorkers && (season === 'spring' || season === 'summer') && c.queens.length > 0;
    if (c.stage === 'founding' && c.workers > 0) c.stage = 'growing';
    if (c.stage === 'growing' && c.workers >= sp.reproduction.matureWorkers) { c.stage = 'mature'; this.event('mature', `${c.name} is mature (${c.workers} workers) and can rear reproductives.`, c); }
    // ---- queens ----
    for (const q of c.queens) {
      const qi = a.findById(q.antId);
      if (qi < 0) continue;
      if (a.task[qi] !== TASK.QUEEN_LAY) continue;
      const T = w.tempAt(a.x[qi], a.y[qi]);
      const th = thermalRate(sp, T);
      let rate = sp.queen.eggsPerDay * th * dt;
      const claustralLimit = c.workers === 0 ? 12 : Infinity;
      if (q.eggsLaid >= claustralLimit && c.workers === 0) rate = 0;
      const broodCap = 10 + 1.6 * c.workers;
      if (c.brood.length >= broodCap) rate = 0;
      if (q.reserves < 8 && c.store.protein + c.store.seed < 1) rate = 0;
      if (rng.next() < rate) this.layEgg(c, q, qi, sp);
      // queen fed by workers (trophallaxis abstraction) when stores allow
      if (c.workers > 0 && q.reserves < sp.founding.reserves * 0.8) {
        if (c.store.sugar > 0 && rng.chance(0.3)) { c.store.sugar--; w.ledger.sink('sugar', 'eaten by queen', 1); q.reserves += 3; }
        else if (c.store.protein > 0 && rng.chance(0.2)) { c.store.protein--; w.ledger.sink('protein', 'eaten by queen', 1); q.reserves += 3; }
      }
    }
    // queenless workers may produce males from unfertilised eggs (where supported)
    if (!c.queens.length && c.workers > 0 && sp.reproduction.workerMaleProduction && c.brood.length < 20 && rng.chance(dt * c.workers / 25)) {
      for (let i = 0; i < a.n; i++) {
        if (a.alive[i] && a.colony[i] === c.slot && a.caste[i] === CASTE.WORKER && inOwnNest(this, i)) {
          const egg = makeEgg(rng, a.ga.subarray(i * NL, i * NL + NL), a.gb.subarray(i * NL, i * NL + NL), this.mode, 1);
          this.addBrood(c, egg, null, a.id[i], 0, a.x[i], a.y[i], DESTINY.MALE, false);
          this.journalUnlock('worker-males');
          break;
        }
      }
    }
    // pleometrotic associations: queen number reduces after workers appear (species-dependent)
    if (sp.founding.association === 'pleometrosis-reduction' && c.workers > 0 && c.queens.length > 1 && rng.chance(0.05)) {
      const weakest = c.queens.reduce((m, q) => (q.reserves < m.reserves ? q : m), c.queens[0]);
      const qi = a.findById(weakest.antId);
      if (qi >= 0) { this.killAnt(qi, 'queen conflict'); this.event('queen', `${c.name}: queens fought after the first workers emerged; one was killed.`, c); }
    }
    // ---- brood development ----
    this.developBrood(c, sp, dt);
    // ---- exposure accumulators ----
    const ch = c.chamber.x >= 0 ? c.chamber : c.entrance;
    c.acc.temp += w.tempAt(ch.x, ch.y);
    const k = Math.min(w.N - 1, (ch.y + 1) * w.W + ch.x);
    const cap = MOIST_CAP[w.mat[k]];
    c.acc.moist += cap ? w.moist[k] / cap : 0;
    c.acc.n++;
    c.stats.peakWorkers = Math.max(c.stats.peakWorkers, c.workers);
    // ---- death ----
    if (c.adults <= 0 && c.brood.length === 0) this.colonyDied(c, c.queens.length ? 'unknown' : 'no surviving members');
    else if (c.adults <= 0 && !c.queens.length && c.brood.every((b) => b.stage === STAGE.EGG)) this.colonyDied(c, 'no adults to rear brood');
  }

  private layEgg(c: Colony, q: QueenData, qi: number, sp: SpeciesDef) {
    const a = this.a, rng = this.rng, w = this.w;
    const ga = a.ga.subarray(qi * NL, qi * NL + NL), gb = a.gb.subarray(qi * NL, qi * NL + NL);
    // egg provisioning: from stores if possible, otherwise from queen reserves (claustral)
    if (c.store.protein > 0 && rng.chance(0.5)) { c.store.protein--; w.ledger.sink('protein', 'egg production', 1); }
    else if (c.store.seed > 0 && sp.nutrition.seed > 0.5 && rng.chance(0.5)) { c.store.seed--; w.ledger.sink('seed', 'egg production', 1); }
    else q.reserves -= 1.5;
    const male = (c.reproductive && rng.chance(sp.reproduction.maleEggFraction)) || !q.mated || !q.sperm.length;
    const id = this.broodNextId;
    const egg = makeEgg(rng, ga, gb, this.mode, 1, (locus, from, to) => this.logMutation(locus, from, to, male ? 'male egg' : 'female egg', c, id));
    let pb: Float32Array | null = null;
    let father = 0;
    if (!male) {
      const s = this.pickSperm(q)!;
      pb = s.genome.slice();
      father = s.maleId;
    }
    this.addBrood(c, egg, pb, q.antId, father, a.x[qi], a.y[qi], male ? DESTINY.MALE : DESTINY.UNDECIDED, c.workers === 0);
    q.eggsLaid++;
    c.stats.eggsLaid++;
  }

  addBrood(c: Colony, ga: Float32Array, gb: Float32Array | null, mother: number, father: number, x: number, y: number, destiny: number, queenFed: boolean) {
    const b: Brood = {
      id: this.broodNextId++, stage: STAGE.EGG, prog: 0, destiny, a: ga, b: gb, mother, father, x, y,
      fed: 0, need: 1, hunger: 0, drown: 0, dry: 0, infection: 0, tempSum: 0, tempN: 0, queenFed, carried: false, warmBoost: 0,
    };
    c.brood.push(b);
  }

  logMutation(locus: number, from: number, to: number, carrier: string, c: Colony, offspringId: number) {
    this.mutationCount++;
    this.mutations.push({ tick: this.tick, locus, from, to, carrier, colony: c.id, offspringId });
    if (this.mutations.length > 3000) this.mutations.splice(0, this.mutations.length - 3000);
  }

  private developBrood(c: Colony, sp: SpeciesDef, dt: number) {
    const w = this.w, rng = this.rng, a = this.a;
    const d = sp.development;
    const queenNear = c.queens.length > 0;
    const q = c.queens[0];
    const qi = q ? a.findById(q.antId) : -1;
    for (let k = c.brood.length - 1; k >= 0; k--) {
      const b = c.brood[k];
      const bi = b.y * w.W + b.x;
      const T = w.tempAt(b.x, b.y) + b.warmBoost;
      b.warmBoost *= 0.5;
      b.tempSum += T; b.tempN++;
      let died = '';
      // flooding
      if (IS_LIQUID[w.mat[bi]]) {
        b.drown += 30;
        if (b.drown > (b.stage === STAGE.EGG ? 2400 : 1500)) died = 'drowned';
      } else if (b.drown > 0) b.drown = Math.max(0, b.drown - 10);
      // buried by collapse
      if (IS_SOLID[w.mat[bi]] && !b.carried) {
        let moved = false;
        for (let r = 1; r <= 2 && !moved; r++)
          for (let dy = -r; dy <= r && !moved; dy++)
            for (let dx = -r; dx <= r && !moved; dx++)
              if (w.inb(b.x + dx, b.y + dy) && !IS_SOLID[w.get(b.x + dx, b.y + dy)] && w.get(b.x + dx, b.y + dy) !== M.WATER) { b.x += dx; b.y += dy; moved = true; }
        if (!moved) died = 'buried';
      }
      if (T > d.tMax + 2 && rng.chance(0.08)) died = 'heat';
      // humidity: pupae (especially naked pupae) and eggs can desiccate
      const hum = w.humAt(b.x, b.y);
      if (hum < d.minHumidity * (d.cocoon && b.stage === STAGE.PUPA ? 0.6 : 1)) { b.dry += dt; if (b.dry > 1.2) died = 'desiccated'; }
      else b.dry = Math.max(0, b.dry - dt);
      // infection pressure from corpses left inside the nest (abstraction)
      if (c.corpsesInside > 0) b.infection += dt * 0.15 * Math.min(5, c.corpsesInside);
      else b.infection = Math.max(0, b.infection - dt * 0.2);
      if (b.infection > 0.3 && rng.chance(b.infection * dt * 0.8)) died = 'infection';
      if (!died) {
        const rate = thermalRate(sp, T) * (1 + (gval(b.a, b.b, 14) - 0.5) * 2 * sp.traits.devrateSpread * MODES[this.mode].spread);
        if (b.stage === STAGE.EGG) {
          b.prog += rate * dt / d.eggDays;
          if (b.prog >= 1) {
            b.stage = STAGE.LARVA; b.prog = 0;
            if (b.destiny === DESTINY.UNDECIDED) {
              // caste: environmentally (nutritionally/colony-state) determined in this model
              b.destiny = c.reproductive && rng.chance(sp.reproduction.gyneFraction) ? DESTINY.GYNE : DESTINY.WORKER;
            }
            b.need = broodCost(sp, this.mode, b.a, b.b, b.destiny === DESTINY.GYNE ? 1 : b.destiny === DESTINY.MALE ? 2 : 0);
          }
        } else if (b.stage === STAGE.LARVA) {
          b.hunger += dt;
          // founding queens feed the first larvae from body reserves (claustral) - nanitic workers result
          if (c.workers === 0 && queenNear && qi >= 0 && q.reserves > 4 && Math.abs(a.x[qi] - b.x) + Math.abs(a.y[qi] - b.y) < 12) {
            // the queen tends the brood; she provisions each larva only to ~62% of a full ration
            b.hunger = 0; b.queenFed = true;
            if (b.fed < b.need * 0.62) { const amt = 0.06 * b.need; b.fed += amt; q.reserves -= amt * 3; }
          }
          // growth is limited by food received: a larva can complete development on >=55% of a full
          // ration (becoming a smaller adult), so growth progress may not outrun fed/(0.55*need)
          const allowed = b.fed / (0.55 * b.need);
          const inc = rate * dt / d.larvaDays;
          if (b.prog < allowed) b.prog += inc;
          if (b.hunger > 2.5) died = 'starved';
          if (b.prog >= 1 && b.fed >= b.need * 0.55) { b.stage = STAGE.PUPA; b.prog = 0; }
        } else {
          b.prog += rate * dt / d.pupaDays;
          if (b.prog >= 1) {
            c.brood.splice(k, 1);
            this.eclose(c, b, sp);
            continue;
          }
        }
      }
      if (died) {
        c.brood.splice(k, 1);
        c.stats.broodDeaths[died] = (c.stats.broodDeaths[died] ?? 0) + 1;
        if (died === 'drowned') c.acc.flooded++;
        if (died === 'starved') c.acc.starving++;
        this.mortality[w.tIdx(b.x, b.y)] += 0.5;
        // carriers drop it
        for (let i = 0; i < a.n; i++) if (a.alive[i] && a.carryBrood[i] === b.id && a.colony[i] === c.slot) a.carryBrood[i] = -1;
      }
    }
  }

  private eclose(c: Colony, b: Brood, sp: SpeciesDef) {
    const caste = b.destiny === DESTINY.GYNE ? CASTE.GYNE : b.destiny === DESTINY.MALE ? CASTE.MALE : CASTE.WORKER;
    const dev = { nutrition: b.need > 0 ? b.fed / b.need : 1, meanTemp: b.tempN ? b.tempSum / b.tempN : 22, mineral: Math.min(1, c.store.mineral / 3) };
    if (dev.mineral > 0 && this.mode === 'fantasy') c.store.mineral = Math.max(0, c.store.mineral - 0.5);
    const i = this.spawnAdult(c, caste, b.x, b.y, b.a, b.b, dev, b.mother, b.father, c.generation);
    if (caste === CASTE.WORKER) {
      c.stats.workersEclosed++;
      if (c.stats.workersEclosed === 1) {
        this.event('first-worker', `${c.name}: first worker emerged (${b.queenFed ? 'nanitic, reared from queen reserves' : 'reared by workers'}).`, c);
        this.journalUnlock('first-worker');
      }
    } else {
      if (caste === CASTE.GYNE) c.stats.gynesEclosed++; else c.stats.malesEclosed++;
      this.reproBrood.set(this.a.id[i], b.id);
      if (c.stats.gynesEclosed + c.stats.malesEclosed === 1) this.event('alates', `${c.name}: first winged reproductives emerged.`, c);
    }
    void sp;
  }

  /** Nurse feeds a larva from colony stores. Returns false when stores are empty. */
  feedLarva(c: Colony, b: Brood, nurse: number): boolean {
    const sp = this.speciesOf(c), w = this.w;
    let gain = 0;
    if (c.store.protein > 0) { c.store.protein--; w.ledger.sink('protein', 'fed to larvae', 1); gain = sp.nutrition.protein; }
    else if (c.store.seed > 0 && sp.nutrition.seed > 0.3) { c.store.seed--; w.ledger.sink('seed', 'fed to larvae', 1); gain = 0.8 * sp.nutrition.seed; }
    // Sugar provides energy but cannot replace the protein required for larval growth.
    else if (c.store.sugar > 0) { c.store.sugar--; w.ledger.sink('sugar', 'larval maintenance', 1); b.hunger = Math.max(0, b.hunger - 0.1); return true; }
    else return false;
    b.fed += gain;
    b.hunger = 0;
    b.infection *= 0.7; // grooming while feeding
    const th = this.a.pheno[nurse * NP + P.THERMO];
    if (th > 0) {
      b.warmBoost = 4 * th;
      if (c.store.sugar > 0 && this.rng.chance(0.3 * th)) { c.store.sugar--; w.ledger.sink('sugar', 'thermogenesis (fictional)', 1); }
      this.a.energy[nurse] -= 0.01 * th;
      this.flags.biolumUsed = this.flags.biolumUsed || false;
    }
    return true;
  }

  /** Adult eats from colony stores (abstracts trophallaxis from replete workers). */
  feedAdult(c: Colony, i: number): boolean {
    const sp = this.speciesOf(c), w = this.w, a = this.a;
    if (c.store.sugar > 0) { c.store.sugar--; w.ledger.sink('sugar', 'eaten by adults', 1); a.energy[i] = Math.min(1, a.energy[i] + 0.45 * sp.nutrition.sugar); return true; }
    if (c.store.seed > 0 && sp.nutrition.seed > 0.3) { c.store.seed--; w.ledger.sink('seed', 'eaten by adults', 1); a.energy[i] = Math.min(1, a.energy[i] + 0.5 * sp.nutrition.seed); return true; }
    if (c.store.protein > 2) { c.store.protein--; w.ledger.sink('protein', 'eaten by adults', 1); a.energy[i] = Math.min(1, a.energy[i] + 0.25); return true; }
    return false;
  }

  queenEats(c: Colony, q: QueenData, i: number) {
    const a = this.a, sp = this.speciesOf(c);
    const f = FOOD_OF[a.carry[i]];
    if (!f) { a.carry[i] = 0; return; }
    this.carriedFood[f - 1]--;
    this.w.ledger.sink(foodKey(f), 'eaten by founding queen', 1);
    const eff = f === 1 ? sp.nutrition.sugar : f === 2 ? sp.nutrition.protein : sp.nutrition.seed;
    q.reserves += 12 * eff;
    a.carry[i] = 0;
    this.journalUnlock('semi-claustral');
  }

  queenPhysiology(c: Colony, i: number, dtDays: number, q10: number) {
    const q = this.queenData(c, this.a.id[i]);
    if (!q) return;
    const sp = this.speciesOf(c);
    const group = c.queens.length > 1 ? sp.founding.groupMetabolism : 1;
    q.reserves -= 1.0 * dtDays * Math.max(0.2, q10) * group;
    if (q.reserves > 0) this.a.energy[i] = Math.max(this.a.energy[i], 0.7);
    else { q.reserves = 0; this.a.energy[i] -= 0.02; }
  }

  thrUse(i: number, k: number) {
    this.a.thrL[i * 4 + k] = Math.max(0.5, this.a.thrL[i * 4 + k] * 0.97);
  }

  /** Nurses compare a handful of nearby nest locations and pick the best for brood. */
  betterBroodSpot(c: Colony, x: number, y: number): { x: number; y: number } {
    const w = this.w, sp = this.speciesOf(c), rng = this.rng;
    const cells = this.nestCells.get(c.slot);
    let best = { x, y }, bestS = -1e9;
    const score = (cx: number, cy: number) => {
      const k = cy * w.W + cx;
      if (IS_LIQUID[w.mat[k]]) return -100;
      let s = -Math.abs(w.tempAt(cx, cy) - sp.development.tOpt) * 0.5;
      s += Math.min(0.3, w.humAt(cx, cy) - sp.development.minHumidity) * 4;
      for (let dy = 0; dy <= 3; dy++) if (w.get(cx, cy + dy) === M.WATER || w.get(cx - 1, cy + dy) === M.WATER) s -= 8;
      s -= cy > c.entrance.y + sp.nest.targetDepth ? 1 : 0;
      s += Math.min(2, c.nestOdor.get(cx, cy)) * 0.5;
      return s;
    };
    bestS = score(x, y);
    if (!cells || !cells.length) return { x: x, y: Math.max(c.entrance.y + 1, y - 4) };
    for (let t = 0; t < 14; t++) {
      const k = cells[rng.int(cells.length)];
      const cx = k % w.W, cy = (k / w.W) | 0;
      if (Math.abs(cx - x) > 24 || Math.abs(cy - y) > 24) continue;
      const s = score(cx, cy);
      if (s > bestS + 0.5) { bestS = s; best = { x: cx, y: cy }; }
    }
    return best;
  }

  nestCells = new Map<number, Int32Array>();
  nestDist!: Uint16Array;
  navDirty = false;

  /** Bounded BFS over the colony's excavated cells: volume, depth, exit status, flood status. */
  scanNest(c: Colony) {
    const w = this.w;
    const own = c.slot + 1;
    const start: number[] = [];
    const a = this.a;
    for (const q of c.queens) { const qi = a.findById(q.antId); if (qi >= 0) start.push(a.y[qi] * w.W + a.x[qi]); }
    if (c.chamber.x >= 0) start.push(c.chamber.y * w.W + c.chamber.x);
    if (!start.length) start.push(c.entrance.y * w.W + c.entrance.x);
    const seen = new Set<number>();
    const queue: number[] = [];
    for (const s of start) if (!seen.has(s)) { seen.add(s); queue.push(s); }
    let vol = 0, maxY = c.entrance.y, exit = false, flooded = 0;
    let bestExit = -1, bestExitD = 1e9;
    const out: number[] = [];
    const exits: number[] = [];
    for (let h = 0; h < queue.length && vol < 6000; h++) {
      const k = queue[h];
      const x = k % w.W, y = (k / w.W) | 0;
      const m = w.mat[k];
      if (IS_LIQUID[m]) flooded++;
      vol++;
      if (out.length < 4096) out.push(k);
      if (y > maxY) maxY = y;
      // an exit is an excavated cell bordering open, unexcavated, sky-exposed air (the surface)
      let isExit = false;
      for (const nk of [k - w.W, k - 1, k + 1]) {
        if (nk < 0 || Math.abs((nk % w.W) - x) > 1) continue;
        const nm = w.mat[nk];
        if ((nm === M.AIR || nm === M.PLANT) && w.owner[nk] !== own && w.skyExposed(nk % w.W, (nk / w.W) | 0)) { isExit = true; break; }
      }
      if (isExit) {
        exit = true;
        exits.push(k);
        const dd = Math.abs(x - c.entrance.x) + Math.abs(y - c.entrance.y);
        if (dd < bestExitD) { bestExitD = dd; bestExit = k; }
      }
      for (const nk of [k - 1, k + 1, k - w.W, k + w.W]) {
        if (nk < 0 || nk >= w.N || seen.has(nk)) continue;
        if (Math.abs((nk % w.W) - x) > 1) continue;
        const nm = w.mat[nk];
        if (!IS_SOLID[nm] && (w.owner[nk] === own)) { seen.add(nk); queue.push(nk); }
      }
    }
    c.nestVolume = vol;
    c.nestDepth = maxY - c.entrance.y;
    const wasExit = c.hasExit;
    c.hasExit = exit && !c.sealed ? true : exit;
    if (exit && c.sealed) c.sealed = false;
    if (exit && bestExit >= 0 && bestExitD > 2) c.entrance = { x: bestExit % w.W, y: (bestExit / w.W) | 0 };
    if (!wasExit && exit && c.workers > 0) this.event('nest', `${c.name}: workers opened the nest to the surface.`, c);
    if (flooded > 4) {
      if (!c.acc.flooded) c.stats.floodEvents++;
      c.acc.flooded += 1;
      this.event('flood', `${c.name}: water is entering the nest (${flooded} flooded cells).`, c);
      this.journalUnlock('flooded-nest');
    }
    // navigation helper: distance (in cells) to the nearest exit through the colony's own excavations.
    // Represents workers' familiarity with their own nest; recomputed periodically and after terrain edits.
    const prev = this.nestCells.get(c.slot);
    if (prev) for (const k of prev) this.nestDist[k] = 0;
    for (const k of out) this.nestDist[k] = 0;
    const q2: number[] = [];
    for (const k of exits) { this.nestDist[k] = 1; q2.push(k); }
    for (let h = 0; h < q2.length; h++) {
      const k = q2[h];
      const d = this.nestDist[k];
      const x = k % w.W;
      for (const nk of [k - 1, k + 1, k - w.W, k + w.W]) {
        if (nk < 0 || nk >= w.N || this.nestDist[nk] || !seen.has(nk)) continue;
        if (Math.abs((nk % w.W) - x) > 1) continue;
        this.nestDist[nk] = Math.min(65535, d + 1);
        q2.push(nk);
      }
    }
    this.nestCells.set(c.slot, Int32Array.from(out));
    // nest odour: emitted by queen and brood (volatile, spreads through open passages only)
    for (const q of c.queens) { const qi = a.findById(q.antId); if (qi >= 0) c.nestOdor.add(a.x[qi], a.y[qi], 3); }
    for (const b of c.brood) c.nestOdor.add(b.x, b.y, 0.5);
  }

  private colonyDied(c: Colony, cause: string) {
    c.alive = false; c.stage = 'dead'; c.diedTick = this.tick;
    const w = this.w;
    // stores rot in place (ledgered sink)
    if (c.store.sugar) w.ledger.sink('sugar', 'colony died', c.store.sugar);
    if (c.store.protein) w.ledger.sink('protein', 'colony died', c.store.protein);
    if (c.store.seed) w.ledger.sink('seed', 'colony died', c.store.seed);
    c.store.sugar = c.store.protein = c.store.seed = 0;
    const rec = this.lineage.find((r) => r.id === c.id);
    if (rec) { rec.diedTick = this.tick; rec.causeOfEnd = cause; rec.peakWorkers = c.stats.peakWorkers; }
    this.event('colony-death', `${c.name} died out (${cause}).`, c);
    // free nest ownership so cells can be reused
    for (let k = 0; k < w.N; k++) if (w.owner[k] === c.slot + 1) w.owner[k] = 0;
    this.nestCells.delete(c.slot);
  }

  // ------------------------------------------------------------ reproduction: nuptial flights

  private flightSchedule(tick: number) {
    const day = Math.floor(tick / DAY_TICKS);
    const dayOfYear = Math.floor(yearFrac(tick) * SEASON_DAYS + 1e-6);
    if (tick % DAY_TICKS === 0 && dayOfYear === Math.round(SEASON_DAYS * 0.3)) {
      // flight days fall in summer
      for (const sp of this.species) {
        const days: number[] = [];
        for (let k = 0; k < 3; k++) days.push(day + 1 + this.rng.int(10));
        this.flightDays[sp.id] = days.sort((x, y) => x - y);
      }
    }
    if (tick % DAY_TICKS === Math.round(DAY_TICKS * 0.55)) {
      for (const sp of this.species) {
        const days = this.flightDays[sp.id];
        if (!days || !days.includes(day)) continue;
        if (this.airT < 18 || this.phys.raining > 0) { this.event('flight', `${sp.name}: flight day skipped (weather).`); continue; }
        let alates = 0;
        const a = this.a;
        for (let i = 0; i < a.n; i++) {
          if (!a.alive[i] || (a.caste[i] !== CASTE.GYNE && a.caste[i] !== CASTE.MALE) || a.age[i] < 0.5) continue;
          const c = this.colonies[a.colony[i]];
          if (!c || c.speciesId !== sp.id) continue;
          a.task[i] = TASK.FLIGHT; alates++;
        }
        if (alates) {
          this.flightEnd[sp.id] = tick + Math.floor(DAY_TICKS * 0.18);
          this.counters.flights++;
          this.event('flight', `${sp.name}: nuptial flight - ${alates} winged reproductives are leaving their nests.`);
        }
      }
    }
    for (const id in this.flightEnd) {
      if (tick === this.flightEnd[id]) { this.resolveMating(id); delete this.flightEnd[id]; }
    }
  }

  takeOff(i: number) {
    const a = this.a;
    const c = this.colonies[a.colony[i]];
    if (!c) return;
    const sex: 'F' | 'M' = a.caste[i] === CASTE.GYNE ? 'F' : 'M';
    this.swarm.push({
      species: c.speciesId, sex, a: a.ga.slice(i * NL, i * NL + NL), b: sex === 'F' ? a.gb.slice(i * NL, i * NL + NL) : null,
      colonyId: c.id, antId: a.id[i], generation: c.generation,
    });
    if (sex === 'F') c.stats.gynesFlown++; else c.stats.malesFlown++;
    const rec = this.lineage.find((r) => r.id === c.id);
    if (rec) { if (sex === 'F') rec.gynesFlown++; else rec.malesFlown++; }
    this.killAnt(i, 'flew');
  }

  private resolveMating(speciesId: string) {
    const sp = this.speciesById(speciesId);
    const all = this.swarm.filter((s) => s.species === speciesId);
    this.swarm = this.swarm.filter((s) => s.species !== speciesId);
    const males = all.filter((s) => s.sex === 'M').map((s) => ({ a: s.a, colonyId: s.colonyId, antId: s.antId }));
    const gynes = all.filter((s) => s.sex === 'F');
    // deterministic shuffle
    for (let k = gynes.length - 1; k > 0; k--) { const j = this.rng.int(k + 1); [gynes[k], gynes[j]] = [gynes[j], gynes[k]]; }
    let capacity = Math.min(this.settings.maxLandings, this.settings.maxColonies - this.aliveColonies().length);
    let landed = 0;
    for (const g of gynes) {
      const sperm = this.sampleMates(sp, males, g.colonyId);
      if (!sperm.length) { this.counters.unmatedQueens++; continue; }
      if (!this.rng.chance(0.55)) { this.counters.dispersedQueens++; continue; } // predation/dispersal losses during flight
      if (capacity <= 0) { this.counters.dispersedQueens++; continue; } // flew beyond the simulated area
      const x = 4 + this.rng.int(this.w.W - 8);
      const y = this.w.surface[x] - 1;
      if (y < 1 || this.w.get(x, y + 1) === M.WATER || this.w.get(x, y) === M.WATER) { this.counters.dispersedQueens++; continue; }
      const mother = this.colonies.find((c) => c && c.id === g.colonyId) ?? null;
      const broodId = this.reproBrood.get(g.antId) ?? 0;
      const nc = this.foundColony(sp, x, y, g.a, g.b!, sperm, g.generation + 1, g.colonyId, mother, broodId);
      if (!nc) break;
      capacity--; landed++;
      this.counters.landedQueens++;
      const rec = this.lineage.find((r) => r.id === g.colonyId);
      if (rec) rec.daughterColonies++;
      if (mother) mother.stats.daughterColonies++;
    }
    this.reproBrood.clear();
    this.event('mating', `${sp.name}: mating flight resolved - ${gynes.length} gynes, ${males.length} males; ${landed} mated queens landed in the area.`);
    if (landed) this.journalUnlock('daughter-colony');
  }

  // ------------------------------------------------------------ daily stats & history

  private daily() {
    const day = Math.floor(this.tick / DAY_TICKS);
    for (const c of this.colonies) {
      if (!c || !c.alive) continue;
      const n = Math.max(1, c.acc.n);
      c.exposure.push({ day, temp: c.acc.temp / n, moisture: c.acc.moist / n, workers: c.workers, brood: c.brood.length, flooded: c.acc.flooded, starving: c.acc.starving });
      if (c.exposure.length > 200) c.exposure.shift();
      c.acc = { temp: 0, moist: 0, n: 0, flooded: 0, starving: 0 };
      const rec = this.lineage.find((r) => r.id === c.id);
      if (rec) rec.peakWorkers = c.stats.peakWorkers;
    }
    const a = this.a;
    for (const sp of this.species) {
      const cols = this.aliveColonies().filter((c) => c.speciesId === sp.id && c.queens.length);
      if (!cols.length) continue;
      const vals: number[][] = [];
      for (const c of cols) {
        const qi = a.findById(c.queens[0].antId);
        if (qi < 0) continue;
        const v: number[] = [];
        for (let l = 0; l < NL; l++) v.push((a.ga[qi * NL + l] + a.gb[qi * NL + l]) / 2);
        vals.push(v);
      }
      const wm = new Array(NP).fill(0);
      let wn = 0;
      for (let i = 0; i < a.n; i++) {
        if (!a.alive[i] || a.caste[i] !== CASTE.WORKER) continue;
        const c = this.colonies[a.colony[i]];
        if (!c || c.speciesId !== sp.id) continue;
        for (let p = 0; p < NP; p++) wm[p] += a.pheno[i * NP + p];
        wn++;
      }
      const mean = new Array(NL).fill(0), sd = new Array(NL).fill(0);
      for (const v of vals) for (let l = 0; l < NL; l++) mean[l] += v[l] / vals.length;
      for (const v of vals) for (let l = 0; l < NL; l++) sd[l] += (v[l] - mean[l]) ** 2 / Math.max(1, vals.length - 1);
      this.traitHistory.push({ day, species: sp.id, n: vals.length, mean, sd: sd.map(Math.sqrt), workerMean: wm.map((x) => (wn ? x / wn : 0)) });
    }
    if (this.traitHistory.length > 3000) this.traitHistory.splice(0, this.traitHistory.length - 3000);
  }

  private sampleActivity() {
    const a = this.a, w = this.w;
    for (let k = 0; k < this.activity.length; k++) { this.activity[k] *= 0.998; this.mortality[k] *= 0.9995; }
    for (let i = 0; i < a.n; i++) {
      if (!a.alive[i]) continue;
      const t = w.tIdx(a.x[i], a.y[i]);
      const own = this.activityOwner[t];
      if (own === a.colony[i] + 1) this.activity[t] += 1;
      else { this.activity[t] -= 1; if (this.activity[t] <= 0) { this.activity[t] = 1; this.activityOwner[t] = a.colony[i] + 1; } }
    }
  }

  private computeTrailNeighbours() {
    this.trailNeighbours = [];
    const cols = this.aliveColonies();
    for (const c of cols) {
      this.trailNeighbours[c.slot] = cols.filter((o) => o !== c && o.speciesId === c.speciesId && Math.abs(o.entrance.x - c.entrance.x) < 220).map((o) => o.slot).slice(0, 6);
    }
  }

  // ------------------------------------------------------------ journal hooks

  journalUnlock(key: string) {
    if (this.journal.some((j) => j.key === key)) return;
    const def = JOURNAL_DEFS.find((d) => d.key === key);
    if (!def) return;
    this.journal.push({ key, tick: this.tick, title: def.title, text: def.text, kind: def.kind });
    if (def.unlocks) for (const u of def.unlocks) this.unlocked.add(u);
    this.event('journal', `Journal: ${def.title}`);
  }
  journalFoodFound(c: Colony, x: number, y: number) {
    void c; void x; void y;
    this.flags.foodFoundTicks.push(this.tick);
    if (this.flags.foodFoundTicks.length > 50) this.flags.foodFoundTicks.shift();
  }
  journalRescue(c: Colony) {
    this.flags.rescues++;
    void c;
    this.journalUnlock('brood-rescue');
  }
  noteMemoryFailure(c: Colony) {
    this.flags.memoryFailures++;
    void c;
    if (this.flags.memoryFailures >= 3) this.journalUnlock('memory-failure');
  }
  noteRouteBlocked(c: Colony) {
    this.flags.routeBlocks++;
    void c;
  }
  recordDelivery(c: Colony, q: number) {
    this.counters.deliveries++;
    void c; void q;
  }
  noteFight(c: Colony, fc: Colony | null | undefined) {
    if (fc && fc !== c) this.journalUnlock(c.speciesId === fc.speciesId ? 'territorial-fight' : 'interspecific-fight');
  }

  // ------------------------------------------------------------ inspection helpers

  /** Food currently held in stores across living colonies. */
  storeFood(): [number, number, number] {
    let s = 0, p = 0, d = 0;
    for (const c of this.colonies) if (c) { s += c.store.sugar; p += c.store.protein; d += c.store.seed; }
    return [s, p, d];
  }

  /** Conservation audit: inventory vs. initial + sources - sinks. */
  audit() {
    const [cs, cp, cd] = this.w.cellFood();
    const [ss, sp, sd] = this.storeFood();
    const inv = { sugar: cs + ss + this.carriedFood[0], protein: cp + sp + this.carriedFood[1], seed: cd + sd + this.carriedFood[2], water: this.w.totalWater() };
    const exp = { sugar: this.w.ledger.expected('sugar'), protein: this.w.ledger.expected('protein'), seed: this.w.ledger.expected('seed'), water: this.w.ledger.expected('water') };
    return { inv, exp };
  }

  /** FNV-1a hash of the core state for determinism tests. */
  hash(): string {
    let h = 0x811c9dc5;
    const mix = (arr: ArrayLike<number>, n = arr.length) => {
      for (let i = 0; i < n; i++) { h ^= arr[i] & 0xff; h = Math.imul(h, 16777619); h ^= (arr[i] >>> 8) & 0xff; h = Math.imul(h, 16777619); }
    };
    mix(this.w.mat); mix(this.w.amt); mix(this.w.moist);
    const a = this.a;
    mix(a.x, a.n); mix(a.y, a.n); mix(a.alive, a.n);
    mix(new Uint16Array(new Float32Array(a.energy.subarray(0, a.n)).buffer));
    mix(this.rng.s);
    for (const c of this.colonies) if (c) mix([c.store.sugar, c.store.protein, c.store.seed, c.brood.length, c.workers]);
    return (h >>> 0).toString(16);
  }

  timeString() {
    const day = Math.floor(this.tick / DAY_TICKS);
    const ph = (this.tick % DAY_TICKS) / DAY_TICKS;
    const hh = Math.floor(ph * 24), mm = Math.floor((ph * 24 - hh) * 60);
    return { day: day + 1, clock: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, season: seasonName(this.tick) };
  }
}

export function foodKey(f: number) {
  return f === 1 ? 'sugar' : f === 2 ? 'protein' : 'seed';
}

/** Linear thermal reaction norm for development (degree-day style; Kipyatkov & Lopatina). */
export function thermalRate(sp: SpeciesDef, T: number) {
  const d = sp.development;
  if (T <= d.tMin) return 0;
  if (T <= d.tOpt) return (T - d.tMin) / (d.tOpt - d.tMin);
  if (T >= d.tMax) return 0;
  return 1 - 0.9 * (T - d.tOpt) / (d.tMax - d.tOpt);
}

function now() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export { DEFAULT_CLIMATE, CS };
