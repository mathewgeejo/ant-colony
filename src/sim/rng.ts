// sfc32: small, fast, seedable PRNG with a 128-bit serializable state.
// All simulation randomness must go through an Rng instance so that runs are
// reproducible from (seed, command log) within one JS engine/version.
export class Rng {
  s: Uint32Array;
  constructor(seed: number | Uint32Array) {
    if (typeof seed === 'number') {
      this.s = new Uint32Array(4);
      // splitmix32 to spread the seed
      let z = seed >>> 0;
      for (let i = 0; i < 4; i++) {
        z = (z + 0x9e3779b9) >>> 0;
        let t = z;
        t = Math.imul(t ^ (t >>> 16), 0x85ebca6b);
        t = Math.imul(t ^ (t >>> 13), 0xc2b2ae35);
        this.s[i] = (t ^ (t >>> 16)) >>> 0;
      }
      for (let i = 0; i < 12; i++) this.u32();
    } else {
      this.s = new Uint32Array(seed);
    }
  }
  u32(): number {
    const s = this.s;
    const t = (((s[0] + s[1]) >>> 0) + s[3]) >>> 0;
    s[3] = (s[3] + 1) >>> 0;
    s[0] = s[1] ^ (s[1] >>> 9);
    s[1] = (s[2] + (s[2] << 3)) >>> 0;
    s[2] = (s[2] << 21) | (s[2] >>> 11);
    s[2] = (s[2] + t) >>> 0;
    return t;
  }
  /** [0,1) */
  next(): number {
    return this.u32() / 4294967296;
  }
  int(n: number): number {
    return Math.floor(this.next() * n);
  }
  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  normal(): number {
    let u = this.next();
    if (u < 1e-12) u = 1e-12;
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * this.next());
  }
  pick<T>(arr: readonly T[]): T {
    return arr[this.int(arr.length)];
  }
  state(): number[] {
    return Array.from(this.s);
  }
}

/** Stable per-cell hash used for texture noise (render only, never for sim decisions). */
export function hash2(x: number, y: number, salt = 0): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(salt, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
