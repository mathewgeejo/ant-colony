import { IS_SOLID, IS_GAS, IS_WATER, FOOD_OF, M, MOIST_CAP, WATER_UNITS, MATERIALS } from './materials.ts';

export const CS = 16; // chunk size (cells)
export const CSHIFT = 4;
export const TS = 4; // coarse climate cell size (cells)

export const FLAG_NEST = 1; // excavated by a colony (owner array says which)
export const FLAG_PLUG = 2; // soil plug placed by a founding queen
export const FLAG_PLAYER = 4; // placed or dug by the player
export const FLAG_APHID = 8; // plant cell carrying an aphid group

/** Conserved-resource ledger. Every creation or destruction of water or food is recorded here. */
export class Ledger {
  sources: Record<string, Record<string, number>> = { water: {}, sugar: {}, protein: {}, seed: {} };
  sinks: Record<string, Record<string, number>> = { water: {}, sugar: {}, protein: {}, seed: {} };
  initial: Record<string, number> = { water: 0, sugar: 0, protein: 0, seed: 0 };
  source(res: string, cat: string, n: number) {
    const r = this.sources[res];
    r[cat] = (r[cat] ?? 0) + n;
  }
  sink(res: string, cat: string, n: number) {
    const r = this.sinks[res];
    r[cat] = (r[cat] ?? 0) + n;
  }
  expected(res: string): number {
    let v = this.initial[res];
    for (const k in this.sources[res]) v += this.sources[res][k];
    for (const k in this.sinks[res]) v -= this.sinks[res][k];
    return v;
  }
}

export class World {
  W: number;
  H: number;
  N: number;
  CW: number;
  CH: number;
  TW: number;
  TH: number;
  mat: Uint8Array;
  /** food units for food cells; water units for water cells; fertility for soils; growth for plants; decay timer for corpses */
  amt: Uint8Array;
  moist: Uint8Array;
  flags: Uint8Array;
  owner: Uint8Array;
  toxin: Uint8Array;
  charge:Uint8Array;
  temp: Float32Array; // coarse, degC
  heat: Float32Array; // coarse, player-applied heat source offset (degC), decays
  hum: Float32Array; // coarse, relative air humidity 0..1
  humBias: Float32Array; // coarse, player humidity bias (-1..1), decays
  chunkDirty: Uint8Array;
  chunkActive: Uint8Array;
  chunkVer: Uint32Array;
  chunkReactive:Uint32Array;
  moved: Uint32Array;
  surface: Int16Array; // first non-air row per column (sky exposure)
  ledger = new Ledger();
  dirtyColumns = new Set<number>();
  lifeCells = new Set<number>();

  constructor(W: number, H: number) {
    this.W = W;
    this.H = H;
    this.N = W * H;
    this.CW = Math.ceil(W / CS);
    this.CH = Math.ceil(H / CS);
    this.TW = Math.ceil(W / TS);
    this.TH = Math.ceil(H / TS);
    this.mat = new Uint8Array(this.N);
    this.amt = new Uint8Array(this.N);
    this.moist = new Uint8Array(this.N);
    this.flags = new Uint8Array(this.N);
    this.owner = new Uint8Array(this.N);
    this.toxin = new Uint8Array(this.N);
    this.charge=new Uint8Array(this.N);
    const tn = this.TW * this.TH;
    this.temp = new Float32Array(tn).fill(20);
    this.heat = new Float32Array(tn);
    this.hum = new Float32Array(tn).fill(0.6);
    this.humBias = new Float32Array(tn);
    const cn = this.CW * this.CH;
    this.chunkDirty = new Uint8Array(cn).fill(1);
    this.chunkActive = new Uint8Array(cn).fill(8);
    this.chunkVer = new Uint32Array(cn);
    this.chunkReactive=new Uint32Array(cn);
    this.moved = new Uint32Array(this.N);
    this.surface = new Int16Array(W);
  }

  idx(x: number, y: number) {
    return y * this.W + x;
  }
  inb(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.W && y < this.H;
  }
  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.W || y >= this.H) return M.STONE;
    return this.mat[y * this.W + x];
  }
  solidAt(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.W || y >= this.H) return true;
    return IS_SOLID[this.mat[y * this.W + x]] === 1;
  }
  chunkOf(x: number, y: number) {
    return (y >> CSHIFT) * this.CW + (x >> CSHIFT);
  }
  tIdx(x: number, y: number) {
    return Math.min(this.TH - 1, (y / TS) | 0) * this.TW + Math.min(this.TW - 1, (x / TS) | 0);
  }
  tempAt(x: number, y: number) {
    return this.temp[this.tIdx(x, y)];
  }
  humAt(x: number, y: number) {
    return this.hum[this.tIdx(x, y)];
  }

  /** Mark a cell changed: render-dirty, physics-active (with neighbours), bump nav version. */
  touch(x: number, y: number) {
    const cx = x >> CSHIFT;
    const cy = y >> CSHIFT;
    const c = cy * this.CW + cx;
    this.chunkDirty[c] = 1;
    this.chunkActive[c] = 8;
    const lx = x & (CS - 1);
    const ly = y & (CS - 1);
    if (lx === 0 && cx > 0) this.chunkActive[c - 1] = 8;
    if (lx === CS - 1 && cx < this.CW - 1) this.chunkActive[c + 1] = 8;
    if (ly === 0 && cy > 0) this.chunkActive[c - this.CW] = 8;
    if (ly === CS - 1 && cy < this.CH - 1) this.chunkActive[c + this.CW] = 8;
    this.dirtyColumns.add(x);
  }

  /**
   * Change material. Returns moisture units that no longer fit in the new material;
   * callers are responsible for recording them in the ledger (see Sim.setCell).
   */
  setRaw(i: number, m: number, a = 0): number {
    const c=this.chunkOf(i%this.W,(i/this.W)|0),old=this.mat[i];
    const delta=(m>=19||m===M.SAND||m===M.CLAY?1:0)-(old>=19||old===M.SAND||old===M.CLAY?1:0);
    if(delta)this.chunkReactive[c]=Math.max(0,this.chunkReactive[c]+delta);
    this.mat[i] = m;
    this.lifeCells.delete(i);if(m>=M.GRASS&&m<=M.MUSHROOM)this.lifeCells.add(i);
    this.amt[i] = a;
    let lost = 0;
    const cap = MOIST_CAP[m];
    if (this.moist[i] > cap) {
      lost = this.moist[i] - cap;
      this.moist[i] = cap;
    }
    this.touch(i % this.W, (i / this.W) | 0);
    return lost;
  }

  /** Swap two cells' material/amt/moisture (used by CA moves; conserves everything). */
  swap(i: number, j: number) {
    const m = this.mat[i], a = this.amt[i], w = this.moist[i], f = this.flags[i];
    const ci=this.chunkOf(i%this.W,(i/this.W)|0),cj=this.chunkOf(j%this.W,(j/this.W)|0);
    if(ci!==cj){const d=(this.mat[j]>=19||this.mat[j]===M.SAND||this.mat[j]===M.CLAY?1:0)-(m>=19||m===M.SAND||m===M.CLAY?1:0);this.chunkReactive[ci]=Math.max(0,this.chunkReactive[ci]+d);this.chunkReactive[cj]=Math.max(0,this.chunkReactive[cj]-d);}
    this.mat[i] = this.mat[j]; this.amt[i] = this.amt[j]; this.moist[i] = this.moist[j];
    this.mat[j] = m; this.amt[j] = a; this.moist[j] = w;
    this.lifeCells.delete(i);this.lifeCells.delete(j);if(this.mat[i]>=M.GRASS&&this.mat[i]<=M.MUSHROOM)this.lifeCells.add(i);if(this.mat[j]>=M.GRASS&&this.mat[j]<=M.MUSHROOM)this.lifeCells.add(j);
    // nest ownership stays with the location; plug/aphid flags travel with the material
    const MOV = FLAG_PLUG | FLAG_APHID;
    const fi = this.flags[i] & ~MOV, fj = this.flags[j] & ~MOV;
    this.flags[i] = fi | (this.flags[j] & MOV);
    this.flags[j] = fj | (f & MOV);
    this.touch(i % this.W, (i / this.W) | 0);
    this.touch(j % this.W, (j / this.W) | 0);
  }

  recomputeSurface(x: number) {
    let y = 0;
    while (y < this.H) {
      const m = this.mat[y * this.W + x];
      if (!IS_GAS[m] && m !== M.PLANT) break;
      y++;
    }
    this.surface[x] = y;
  }
  recomputeAllSurface() {
    for (let x = 0; x < this.W; x++) this.recomputeSurface(x);
    this.dirtyColumns.clear();
  }
  rebuildReactive(){this.chunkReactive.fill(0);this.lifeCells.clear();for(let k=0;k<this.N;k++){if(this.mat[k]>=19||this.mat[k]===M.SAND||this.mat[k]===M.CLAY)this.chunkReactive[this.chunkOf(k%this.W,(k/this.W)|0)]++;if(this.mat[k]>=M.GRASS&&this.mat[k]<=M.MUSHROOM)this.lifeCells.add(k);}}
  flushSurface() {
    for (const x of this.dirtyColumns) this.recomputeSurface(x);
    this.dirtyColumns.clear();
  }
  /** True when the cell is open to the sky (no solid above it). */
  skyExposed(x: number, y: number) {
    return y < this.surface[x] || (y === this.surface[x] && !this.solidAt(x, y));
  }

  /** Total water in the world: water-cell units + soil moisture. */
  totalWater(): number {
    let t = 0;
    const { mat, amt, moist, N } = this;
    for (let i = 0; i < N; i++) {
      t += moist[i];
      if (IS_WATER[mat[i]]) t += amt[i];
    }
    return t;
  }
  /** Food units lying in cells by type. */
  cellFood(): [number, number, number] {
    let s = 0, p = 0, d = 0;
    const { mat, amt, N } = this;
    for (let i = 0; i < N; i++) {
      const f=FOOD_OF[mat[i]];
      if (f===1) s += amt[i];
      else if (f===2) p += amt[i];
      else if (f===3) d += amt[i];
    }
    return [s, p, d];
  }
}

export function fullWater(): number {
  return WATER_UNITS;
}

export function materialName(m: number) {
  return MATERIALS[m]?.name ?? 'unknown';
}
