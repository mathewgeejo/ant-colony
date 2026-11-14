// Sparse, chunk-allocated scalar fields for chemical signals.
// Memory is bounded by the number of chunks where a signal is present; chunks
// are freed when their contents decay below EPS.
//
// Two transport kinds:
//  - 'surface': deposited on the substrate (trail pheromone). No diffusion; decays
//    at a rate scaled by the substrate material's signalPersistence.
//  - 'air': volatile (alarm, nest/brood odour). Diffuses only between open air
//    cells; solids and water block it. Decays quickly.
import { IS_SOLID, IS_LIQUID, SIGNAL_PERSIST } from './materials.ts';
import { CS, CSHIFT, World } from './world.ts';

const EPS = 0.004;
const AREA = CS * CS;
const openGas=(m:number)=>!IS_SOLID[m]&&!IS_LIQUID[m];

export type Transport = 'surface' | 'air';

export class SparseField {
  w: World;
  kind: Transport;
  decay: number; // per-update multiplicative retention (before substrate scaling)
  diffusion: number;
  max: number;
  chunks: (Float32Array | null)[];
  live: number[] = []; // indices of allocated chunks (kept sorted for stable order)
  private scratch = new Float32Array(AREA);

  constructor(w: World, kind: Transport, decay: number, diffusion = 0, max = 10) {
    this.w = w;
    this.kind = kind;
    this.decay = decay;
    this.diffusion = diffusion;
    this.max = max;
    this.chunks = new Array(w.CW * w.CH).fill(null);
  }

  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w.W || y >= this.w.H) return 0;
    const c = this.chunks[(y >> CSHIFT) * this.w.CW + (x >> CSHIFT)];
    return c ? c[((y & (CS - 1)) << CSHIFT) | (x & (CS - 1))] : 0;
  }

  private alloc(ci: number): Float32Array {
    let c = this.chunks[ci];
    if (!c) {
      c = new Float32Array(AREA);
      this.chunks[ci] = c;
      // insert keeping sorted order (deterministic iteration)
      let lo = 0, hi = this.live.length;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (this.live[mid] < ci) lo = mid + 1; else hi = mid; }
      this.live.splice(lo, 0, ci);
    }
    return c;
  }

  add(x: number, y: number, v: number) {
    if (x < 0 || y < 0 || x >= this.w.W || y >= this.w.H) return;
    const c = this.alloc((y >> CSHIFT) * this.w.CW + (x >> CSHIFT));
    const k = ((y & (CS - 1)) << CSHIFT) | (x & (CS - 1));
    c[k] = Math.min(this.max, c[k] + v);
  }

  set(x: number, y: number, v: number) {
    const c = this.alloc((y >> CSHIFT) * this.w.CW + (x >> CSHIFT));
    c[((y & (CS - 1)) << CSHIFT) | (x & (CS - 1))] = v;
  }

  clearArea(x0: number, y0: number, x1: number, y1: number) {
    for (let y = Math.max(0, y0); y <= Math.min(this.w.H - 1, y1); y++)
      for (let x = Math.max(0, x0); x <= Math.min(this.w.W - 1, x1); x++) {
        const c = this.chunks[(y >> CSHIFT) * this.w.CW + (x >> CSHIFT)];
        if (c) c[((y & (CS - 1)) << CSHIFT) | (x & (CS - 1))] = 0;
      }
  }

  /** Decay (and for 'air', diffuse) every allocated chunk. Cost is O(live chunks). */
  step() {
    const w = this.w;
    const { W, H, CW, mat } = w;
    const toFree: number[] = [];
    const grow: number[] = [];
    const list = this.live.slice();
    for (const ci of list) {
      const c = this.chunks[ci]!;
      const cx0 = (ci % CW) * CS;
      const cy0 = Math.floor(ci / CW) * CS;
      let mx = 0;
      if (this.kind === 'surface') {
        for (let k = 0; k < AREA; k++) {
          const v = c[k];
          if (v === 0) continue;
          const x = cx0 + (k & (CS - 1)), y = cy0 + (k >> CSHIFT);
          const i = y * W + x;
          if (x >= W || y >= H) { c[k] = 0; continue; }
          const here = mat[i];
          if (IS_SOLID[here] || IS_LIQUID[here]) { c[k] = 0; continue; } // washed away / buried
          // substrate: most persistent adjacent solid
          let p = 0.6;
          if (y + 1 < H && IS_SOLID[mat[i + W]]) p = SIGNAL_PERSIST[mat[i + W]];
          else if (x > 0 && IS_SOLID[mat[i - 1]]) p = SIGNAL_PERSIST[mat[i - 1]];
          else if (x + 1 < W && IS_SOLID[mat[i + 1]]) p = SIGNAL_PERSIST[mat[i + 1]];
          else if (y > 0 && IS_SOLID[mat[i - W]]) p = SIGNAL_PERSIST[mat[i - W]];
          const loss = (1 - this.decay) / p;
          let nv = v * (1 - loss);
          if (nv < EPS) nv = 0;
          c[k] = nv;
          if (nv > mx) mx = nv;
        }
      } else {
        const s = this.scratch;
        const d = this.diffusion;
        for (let k = 0; k < AREA; k++) {
          const x = cx0 + (k & (CS - 1)), y = cy0 + (k >> CSHIFT);
          if (x >= W || y >= H) { s[k] = 0; continue; }
          const i = y * W + x;
          if (!openGas(mat[i])) { s[k] = 0; continue; }
          const v = c[k];
          let acc = 0, n = 0;
          // exchange only with open neighbours: walls and water block volatiles
          if (x > 0 && openGas(mat[i - 1])) { acc += this.get(x - 1, y); n++; }
          if (x + 1 < W && openGas(mat[i + 1])) { acc += this.get(x + 1, y); n++; }
          if (y > 0 && openGas(mat[i - W])) { acc += this.get(x, y - 1); n++; }
          if (y + 1 < H && openGas(mat[i + W])) { acc += this.get(x, y + 1); n++; }
          let nv = (v + d * (acc - n * v)) * this.decay;
          if (nv < EPS) nv = 0;
          s[k] = nv;
          if (nv > mx) mx = nv;
        }
        // edge growth: allocate neighbour chunks the signal is spreading into
        for (let k = 0; k < CS; k++) {
          if (s[k] > EPS * 4 && cy0 > 0) grow.push(ci - CW);
          if (s[AREA - CS + k] > EPS * 4 && cy0 + CS < H) grow.push(ci + CW);
          if (s[k * CS] > EPS * 4 && cx0 > 0) grow.push(ci - 1);
          if (s[k * CS + CS - 1] > EPS * 4 && cx0 + CS < W) grow.push(ci + 1);
        }
        c.set(s);
      }
      if (mx === 0) toFree.push(ci);
    }
    for (const ci of toFree) {
      this.chunks[ci] = null;
      const p = this.live.indexOf(ci);
      if (p >= 0) this.live.splice(p, 1);
    }
    for (const ci of grow) if (!this.chunks[ci]) this.alloc(ci);
  }

  liveChunks() {
    return this.live.length;
  }

  serialize() {
    return { live: this.live.slice(), data: this.live.map((ci) => this.chunks[ci]!.slice()) };
  }
  restore(s: { live: number[]; data: Float32Array[] }) {
    this.chunks.fill(null);
    this.live = [];
    s.live.forEach((ci, k) => {
      this.alloc(ci).set(s.data[k]);
    });
  }
}
