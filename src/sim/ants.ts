// Structure-of-arrays storage for all individually represented ants.
import { NL, NP } from './genetics.ts';

export const CASTE = { WORKER: 0, QUEEN: 1, MALE: 2, GYNE: 3 } as const;
export const CASTE_NAMES = ['worker', 'queen', 'male', 'gyne (winged queen)'];

export const TASK = {
  IDLE: 0, FORAGE: 1, RETURN: 2, DIG: 3, HAUL: 4, NURSE: 5, CARRY_BROOD: 6, DEFEND: 7, WASTE: 8,
  FLEE: 9, FOUND_SEARCH: 10, FOUND_DIG: 11, QUEEN_LAY: 12, QUEEN_FORAGE: 13, ALATE: 14, FLIGHT: 15, DRINK: 16, ESCAPE: 17,
  GUARD: 18, WAR: 19, RAID: 20,
} as const;
export const TASK_NAMES = [
  'resting', 'foraging', 'returning', 'excavating', 'hauling spoil', 'nursing brood', 'carrying brood', 'defending', 'removing waste',
  'retreating', 'seeking a nest site', 'digging founding chamber', 'laying eggs', 'foraging (founding queen)', 'waiting to fly', 'nuptial flight', 'drinking', 'escaping water',
  'guarding the entrance', 'fighting at the front', 'raiding',
];

/** Reasons recorded at each decision so the inspector can explain behaviour. */
export const WHY = {
  NONE: 0, TRAIL_OUT: 1, MEMORY_OUT: 2, SCOUT: 3, RETURN_FOOD_TRAIL: 4, RETURN_EMPTY: 5, RETURN_HUNGRY: 6, DIG_CROWD: 7,
  DIG_EXIT: 8, HAUL: 9, NURSE_HUNGRY: 10, RESCUE_FLOOD: 11, MOVE_BROOD_TEMP: 12, DEFEND_ALARM: 13, DEFEND_CONTACT: 14,
  FLEE_OUTNUMBERED: 15, WASTE: 16, IDLE_LOW_STIM: 17, THIRST: 18, SUBMERGED: 19, FOUND_SEARCH: 20, FOUND_DIG: 21, LAY: 22,
  QUEEN_FORAGE: 23, ALATE_WAIT: 24, FLIGHT: 25, MEMORY_FAILED: 26, ROUTE_BLOCKED: 27, CONTACT_RECRUITED: 28, TOO_HOT: 29, TOO_COLD: 30,
  NIGHT: 31, LIGHT_RECRUIT: 32, ENERGY: 33,
  GUARD: 34, WAR_MARCH: 35, WAR_FRONT: 36, RAID_MARCH: 37, RAID_DELVE: 38, RAID_LOOT_BROOD: 39, RAID_LOOT_FOOD: 40, RAID_HOME: 41,
  ABSORBED: 42, MOUND: 43, MIDDEN: 44, PLAN_DIG: 45, CLEAR_DISC: 46,
} as const;
export const WHY_TEXT: string[] = [
  '',
  'Heading out along a reinforced trail (social information).',
  'Heading to a food source it remembers (private route memory).',
  'Scouting: no trail or memory to follow, searching independently.',
  'Returning with food, laying trail pheromone on the way.',
  'Returning without food; not reinforcing any trail.',
  'Returning to the nest to feed (low energy).',
  'Excavating: the nest is crowded for the number of occupants.',
  'Excavating toward the surface: the nest has no open entrance.',
  'Carrying excavated soil out of the nest.',
  'Feeding hungry larvae from colony stores.',
  'Rescuing brood from water.',
  'Moving brood toward better temperature/humidity.',
  'Responding to alarm pheromone.',
  'Fighting a non-nestmate it contacted.',
  'Retreating: outnumbered or injured.',
  'Carrying a corpse or refuse out of the nest.',
  'Resting: no task stimulus exceeds its response thresholds.',
  'Looking for water (dehydrated).',
  'Submerged; trying to reach air.',
  'Searching the surface for a suitable founding site.',
  'Digging a founding chamber.',
  'Laying eggs in the royal chamber.',
  'Founding queen foraging (semi-claustral strategy: reserves too low).',
  'Winged reproductive waiting in the nest for a flight day.',
  'Leaving on the nuptial flight.',
  'Its remembered food source was gone; memory discarded, will search again.',
  'Its remembered route was blocked; route memory discarded.',
  'Recruited by contact with a returning successful forager.',
  'Too hot on the surface; staying underground.',
  'Too cold to forage.',
  'Night: this diurnal species does not forage.',
  'Following light pulses from a nestmate (FICTIONAL bioluminescence).',
  'Low energy: feeding from colony stores.',
  'Guarding the nest entrance: the colony has detected rivals nearby.',
  'Recruited to the war front, where nestmates last met the enemy.',
  'Holding the front against a rival colony.',
  'Marching on a rival nest the colony has located.',
  'Inside the rival nest, pushing deeper toward its brood chambers.',
  'Carrying a stolen pupa or larva home; it will be reared as a nestmate.',
  'Carrying food looted from the rival colony\'s stores.',
  'Returning from the raid.',
  'Adopted: its colony was defeated and absorbed; it now carries the victors\' nest odour.',
  'Adding excavated soil to the nest mound.',
  'Carrying refuse to the colony\'s midden.',
  'Excavating a planned chamber or shaft.',
  'Cutting vegetation to keep the nest disc clear.',
];

export const MEM = 32; // route-memory waypoints per ant

/** Navigation modes used by the movement step. */
export const NAV = {
  WANDER: 0, GOAL: 1, TRAIL_OUT: 2, HOME: 3, ROUTE_OUT: 4, RETRACE: 5, NEST_CUE: 6, EXIT: 7, UP: 8, STAY: 9, EXPLORE: 10, NEST_WANDER: 11,
  ALARM: 12, DIG_WANDER: 13, DELVE: 14,
} as const;

export class AntStore {
  cap = 0;
  n = 0; // high-water mark of used slots
  count = 0; // live ants
  free: number[] = [];
  nextId = 1;
  alive!: Uint8Array;
  id!: Uint32Array;
  colony!: Uint8Array; // colony slot
  caste!: Uint8Array;
  x!: Int16Array; y!: Int16Array; px!: Int16Array; py!: Int16Array;
  hx!: Int8Array; // heading x (-1,0,1)
  hy!: Int8Array;
  age!: Float32Array; // days
  health!: Float32Array; energy!: Float32Array; hydration!: Float32Array;
  task!: Uint8Array; why!: Uint8Array; timer!: Uint16Array; stuck!: Uint8Array; fails!: Uint8Array;
  carry!: Uint16Array; // material id carried (food or spoil), 0 none
  carryQ!: Float32Array; // perceived source quality when food was picked up
  carryBrood!: Int32Array; // brood id carried, -1 none
  moveAcc!: Float32Array;
  tx!: Int16Array; ty!: Int16Array; // current local goal
  submerged!: Uint16Array;
  contacts!: Float32Array; // decaying count of contacts with returning successful foragers
  thrL!: Float32Array; // learned threshold multipliers, 4 per ant (forage, nurse, dig, defend) - behavioural, not heritable
  memX!: Int16Array; memY!: Int16Array; memLen!: Uint8Array; // current-trip route memory
  frX!: Int16Array; frY!: Int16Array; frLen!: Uint8Array; // remembered route to food (private information)
  frTrips!: Uint8Array; // successful trips on remembered route
  stepCount!: Uint16Array; // steps since leaving nest
  fightTarget!: Int32Array;
  nav!: Uint8Array; // navigation mode (NAV)
  frIdx!: Uint8Array; // progress along remembered food route
  bestQ!: Float32Array; // founding queens: best site score seen
  ga!: Float32Array; gb!: Float32Array; // genome alleles (gb unused for haploid males)
  pheno!: Float32Array;
  mother!: Uint32Array; father!: Uint32Array;
  generation!: Uint16Array;
  born!: Float32Array; // tick born (as float to fit large ticks)
  anim!: Uint8Array;

  constructor(cap = 1024) {
    this.grow(cap);
  }

  private grow(newCap: number) {
    const old = this.cap;
    const re = <T extends { length: number; set(a: ArrayLike<number>): void }>(prev: T | undefined, C: new (n: number) => T, per = 1): T => {
      const a = new C(newCap * per);
      if (prev && old) a.set(prev as unknown as ArrayLike<number>);
      return a;
    };
    this.alive = re(this.alive, Uint8Array);
    this.id = re(this.id, Uint32Array);
    this.colony = re(this.colony, Uint8Array);
    this.caste = re(this.caste, Uint8Array);
    this.x = re(this.x, Int16Array); this.y = re(this.y, Int16Array);
    this.px = re(this.px, Int16Array); this.py = re(this.py, Int16Array);
    this.hx = re(this.hx, Int8Array); this.hy = re(this.hy, Int8Array);
    this.age = re(this.age, Float32Array);
    this.health = re(this.health, Float32Array); this.energy = re(this.energy, Float32Array); this.hydration = re(this.hydration, Float32Array);
    this.task = re(this.task, Uint8Array); this.why = re(this.why, Uint8Array); this.timer = re(this.timer, Uint16Array);
    this.stuck = re(this.stuck, Uint8Array); this.fails = re(this.fails, Uint8Array);
    this.carry = re(this.carry, Uint16Array); this.carryQ = re(this.carryQ, Float32Array);
    this.carryBrood = re(this.carryBrood, Int32Array);
    this.moveAcc = re(this.moveAcc, Float32Array);
    this.tx = re(this.tx, Int16Array); this.ty = re(this.ty, Int16Array);
    this.submerged = re(this.submerged, Uint16Array);
    this.contacts = re(this.contacts, Float32Array);
    this.thrL = re(this.thrL, Float32Array, 4);
    this.memX = re(this.memX, Int16Array, MEM); this.memY = re(this.memY, Int16Array, MEM); this.memLen = re(this.memLen, Uint8Array);
    this.frX = re(this.frX, Int16Array, MEM); this.frY = re(this.frY, Int16Array, MEM); this.frLen = re(this.frLen, Uint8Array);
    this.frTrips = re(this.frTrips, Uint8Array);
    this.stepCount = re(this.stepCount, Uint16Array);
    this.fightTarget = re(this.fightTarget, Int32Array);
    this.nav = re(this.nav, Uint8Array);
    this.frIdx = re(this.frIdx, Uint8Array);
    this.bestQ = re(this.bestQ, Float32Array);
    this.ga = re(this.ga, Float32Array, NL); this.gb = re(this.gb, Float32Array, NL);
    this.pheno = re(this.pheno, Float32Array, NP);
    this.mother = re(this.mother, Uint32Array); this.father = re(this.father, Uint32Array);
    this.generation = re(this.generation, Uint16Array);
    this.born = re(this.born, Float32Array);
    this.anim = re(this.anim, Uint8Array);
    this.cap = newCap;
  }

  /** Allocate a slot. Reuses freed slots in ascending order for deterministic layout. */
  spawn(): number {
    let i: number;
    if (this.free.length) {
      i = this.free.pop()!;
    } else {
      if (this.n >= this.cap) this.grow(this.cap * 2);
      i = this.n++;
    }
    this.alive[i] = 1;
    this.id[i] = this.nextId++;
    this.health[i] = 1; this.energy[i] = 0.9; this.hydration[i] = 0.9;
    this.task[i] = 0; this.why[i] = 0; this.timer[i] = 0; this.stuck[i] = 0; this.fails[i] = 0;
    this.carry[i] = 0; this.carryQ[i] = 0; this.carryBrood[i] = -1; this.moveAcc[i] = 0;
    this.submerged[i] = 0; this.contacts[i] = 0; this.memLen[i] = 0; this.frLen[i] = 0; this.frTrips[i] = 0;
    this.stepCount[i] = 0; this.fightTarget[i] = -1; this.age[i] = 0; this.anim[i] = 0;
    this.nav[i] = 0; this.frIdx[i] = 0; this.bestQ[i] = 0;
    this.hx[i] = 1; this.hy[i] = 0;
    for (let k = 0; k < 4; k++) this.thrL[i * 4 + k] = 1;
    this.count++;
    return i;
  }

  kill(i: number) {
    if (!this.alive[i]) return;
    this.alive[i] = 0;
    this.count--;
    // keep the free list sorted descending so pop() returns the lowest index
    let lo = 0, hi = this.free.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (this.free[m] > i) lo = m + 1; else hi = m; }
    this.free.splice(lo, 0, i);
  }

  findById(id: number): number {
    for (let i = 0; i < this.n; i++) if (this.alive[i] && this.id[i] === id) return i;
    return -1;
  }

  pushMem(i: number, x: number, y: number) {
    const o = i * MEM;
    let len = this.memLen[i];
    // loop removal: if we are back near an earlier waypoint, cut the loop out
    for (let k = 0; k < len; k++) {
      const dx = this.memX[o + k] - x, dy = this.memY[o + k] - y;
      if (dx * dx + dy * dy <= 4) { this.memLen[i] = k + 1; return; }
    }
    if (len >= MEM) {
      // decimate: keep every other waypoint (coarser but complete route)
      let w = 0;
      for (let k = 0; k < len; k += 2) { this.memX[o + w] = this.memX[o + k]; this.memY[o + w] = this.memY[o + k]; w++; }
      len = w;
    }
    this.memX[o + len] = x; this.memY[o + len] = y;
    this.memLen[i] = len + 1;
  }

  /** Store the current trip memory as the remembered route to food. */
  saveFoodRoute(i: number) {
    const o = i * MEM;
    const len = this.memLen[i];
    for (let k = 0; k < len; k++) { this.frX[o + k] = this.memX[o + k]; this.frY[o + k] = this.memY[o + k]; }
    this.frLen[i] = len;
  }

  serialize() {
    const out: Record<string, unknown> = { cap: this.cap, n: this.n, count: this.count, free: this.free.slice(), nextId: this.nextId };
    for (const k of SOA_KEYS) out[k] = (this as any)[k].slice(0, this.n * (PER[k] ?? 1));
    return out;
  }
  static restore(s: any): AntStore {
    const a = new AntStore(Math.max(16, s.cap));
    a.n = s.n; a.count = s.count; a.free = s.free.slice(); a.nextId = s.nextId;
    for (const k of SOA_KEYS) (a as any)[k].set(s[k]);
    return a;
  }
}

const PER: Record<string, number> = { thrL: 4, memX: MEM, memY: MEM, frX: MEM, frY: MEM, ga: NL, gb: NL, pheno: NP };
export const SOA_KEYS = [
  'alive', 'id', 'colony', 'caste', 'x', 'y', 'px', 'py', 'hx', 'hy', 'age', 'health', 'energy', 'hydration', 'task', 'why', 'timer',
  'stuck', 'fails', 'carry', 'carryQ', 'carryBrood', 'moveAcc', 'tx', 'ty', 'submerged', 'contacts', 'thrL', 'memX', 'memY', 'memLen',
  'frX', 'frY', 'frLen', 'frTrips', 'stepCount', 'fightTarget', 'nav', 'frIdx', 'bestQ', 'ga', 'gb', 'pheno', 'mother', 'father', 'generation', 'born', 'anim',
];

/** Uniform grid of cell buckets for neighbour queries (rebuilt each tick, O(n)). */
export class SpatialIndex {
  bs = 4;
  bw: number; bh: number;
  head: Int32Array;
  owner:Uint16Array;
  next: Int32Array = new Int32Array(0);
  constructor(W: number, H: number) {
    this.bw = Math.ceil(W / this.bs);
    this.bh = Math.ceil(H / this.bs);
    this.head = new Int32Array(this.bw * this.bh);
    this.owner=new Uint16Array(this.bw*this.bh);
    this.head.fill(-1);
    this.owner.fill(0);
  }
  rebuild(a: AntStore) {
    this.head.fill(-1);
    this.owner.fill(0);
    if (this.next.length < a.cap) this.next = new Int32Array(a.cap);
    for (let i = a.n - 1; i >= 0; i--) {
      if (!a.alive[i]) continue;
      const b = ((a.y[i] >> 2) * this.bw + (a.x[i] >> 2)) | 0;
      const col=a.colony[i]+1;this.owner[b]=this.owner[b]===0||this.owner[b]===col?col:65535;
      this.next[i] = this.head[b];
      this.head[b] = i;
    }
  }
  /** Calls fn for every ant within Chebyshev radius r cells (bucket-coarse, then exact). */
  hasForeign(x:number,y:number,r:number,colony:number){
    const x0=Math.max(0,(x-r)>>2),x1=Math.min(this.bw-1,(x+r)>>2),y0=Math.max(0,(y-r)>>2),y1=Math.min(this.bh-1,(y+r)>>2);
    for(let yy=y0;yy<=y1;yy++)for(let xx=x0;xx<=x1;xx++){const c=this.owner[yy*this.bw+xx];if(c&&c!==colony+1)return true;}return false;
  }
  /** Calls fn for every ant within Chebyshev radius r cells (bucket-coarse, then exact). */
  query(a: AntStore, x: number, y: number, r: number, fn: (j: number) => void) {
    const b0x = Math.max(0, (x - r) >> 2), b1x = Math.min(this.bw - 1, (x + r) >> 2);
    const b0y = Math.max(0, (y - r) >> 2), b1y = Math.min(this.bh - 1, (y + r) >> 2);
    for (let by = b0y; by <= b1y; by++)
      for (let bx = b0x; bx <= b1x; bx++) {
        for (let j = this.head[by * this.bw + bx]; j !== -1; j = this.next[j]) {
          if (Math.abs(a.x[j] - x) <= r && Math.abs(a.y[j] - y) <= r) fn(j);
        }
      }
  }
}
