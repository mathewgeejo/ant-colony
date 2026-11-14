// Terrain cellular automata (water, granular materials, slumping) and the
// local numerical fields (soil moisture, coarse temperature, air humidity).
// See docs/ARCHITECTURE.md "Environment" for the rules and their limits.
import { IS_GRANULAR, IS_SOLID, M, MOIST_CAP, PERMEABILITY, THERMAL, WATER_UNITS, MATERIALS } from './materials.ts';
import type { Rng } from './rng.ts';
import { CS, TS, World } from './world.ts';
import { SandboxPhysics } from './sandbox-physics.ts';
import { IS_GAS, IS_LIQUID, DENSITY } from './materials.ts';

export interface Climate {
  meanTemp: number; // annual mean surface air temperature (degC)
  dayAmp: number; // day/night half amplitude
  seasonAmp: number; // seasonal half amplitude
  deepTemp: number; // temperature at the bottom boundary
  baseHumidity: number; // surface air humidity when not raining
  rainChancePerDay: number; // probability a given day has a rain event
  rainIntensity: number; // water cells spawned per tick across the map while raining
  evaporation: number; // multiplier on evaporation rates
}

export const DEFAULT_CLIMATE: Climate = {
  meanTemp: 19,
  dayAmp: 6,
  seasonAmp: 6,
  deepTemp: 15,
  baseHumidity: 0.55,
  rainChancePerDay: 0.25,
  rainIntensity: 1.2,
  evaporation: 1,
};

export const DAY_TICKS = 3600;
export const SEASON_DAYS = 40;

/** Runs start in mid-spring. */
export const START_DAY_OFFSET = 5;
/** 0..1 position in the (compressed) year: 0 = start of spring, 0.25 summer, 0.5 autumn, 0.75 winter. */
export function yearFrac(tick: number) {
  return (((tick / DAY_TICKS + START_DAY_OFFSET) % SEASON_DAYS) + SEASON_DAYS) % SEASON_DAYS / SEASON_DAYS;
}
export function airTemperature(c: Climate, tick: number): number {
  const day = tick / DAY_TICKS;
  const phase = day - Math.floor(day);
  const season = Math.cos(2 * Math.PI * (yearFrac(tick) - 0.375)); // warmest mid-summer
  return c.meanTemp + c.seasonAmp * season + c.dayAmp * Math.sin(2 * Math.PI * (phase - 0.3));
}
export function isDaytime(tick: number) {
  const phase = (tick / DAY_TICKS) % 1;
  return phase > 0.25 && phase < 0.8;
}
export function seasonName(tick: number) {
  const d = yearFrac(tick);
  return d < 0.25 ? 'spring' : d < 0.5 ? 'summer' : d < 0.75 ? 'autumn' : 'winter';
}

/** Can water occupy / flow into this cell? */
function waterOpen(m: number) {
  return m === M.AIR || IS_GAS[m]===1;
}

export class Physics {
  w: World;
  rng: Rng;
  stamp = 1;
  moistureCursor = 0; // rolling row cursor for moisture/evaporation
  raining = 0; // ticks of rain remaining
  rainLocal: { x: number; w: number; ticks: number }[] = [];
  stats = { waterMoves: 0, activeChunks: 0, infiltrated: 0, seeped: 0 };

  constructor(w: World, rng: Rng) {
    this.w = w;
    this.rng = rng;
    this.activeSnapshot = new Uint8Array(w.chunkActive.length);
    this.sandbox=new SandboxPhysics(w,rng);
  }
  sandbox:SandboxPhysics;
  private activeSnapshot: Uint8Array;

  /** One fixed-step update of the terrain CA over active chunks only. */
  stepCA(tick: number) {
    const w = this.w;
    const { W, H, CW, CH, mat, moved, chunkActive } = w;
    this.stamp = (this.stamp + 1) >>> 0;
    const st = this.stamp;
    const rng = this.rng;
    const leftFirst = (tick & 1) === 0;
    let active = 0;
    // snapshot activity so newly touched chunks are processed next tick (stable order)
    const act = this.activeSnapshot;
    act.set(chunkActive);
    this.sandbox.begin(tick,act);
    for (let c = 0; c < act.length; c++) if (act[c]) { active++; chunkActive[c]--; }
    this.stats.activeChunks = active;
    let moves = 0;
    for (let cy = CH - 1; cy >= 0; cy--) {
      const y0 = cy * CS;
      const y1 = Math.min(H, y0 + CS) - 1;
      for (let y = y1; y >= y0; y--) {
        for (let k = 0; k < CW; k++) {
          const cx = leftFirst ? k : CW - 1 - k;
          if (!act[cy * CW + cx]) continue;
          const x0 = cx * CS;
          const x1 = Math.min(W, x0 + CS) - 1;
          for (let kx = 0; kx <= x1 - x0; kx++) {
            const x = leftFirst ? x0 + kx : x1 - kx;
            const i = y * W + x;
            if (moved[i] === st) continue;
            const m = mat[i];
            if (m === M.AIR) continue;
            if(this.sandbox.step(x,y,i,st,tick))continue;
            if (m === M.WATER) {
              if (this.stepWater(x, y, i, st, rng, tick)) moves++;
            } else if (IS_GRANULAR[m]) {
              if (this.stepGranular(x, y, i, m, st, rng)) moves++;
            } else if (m<M.GRASS&&MOIST_CAP[m] > 0 && w.moist[i] >= MOIST_CAP[m] - 2 && y + 1 < H && mat[i + W] === M.AIR) {
              this.maybeSlump(x, y, i, m, rng);
            }
          }
        }
      }
    }
    this.stats.waterMoves = moves;
  }

  private stepWater(x: number, y: number, i: number, st: number, rng: Rng, tick: number): boolean {
    const w = this.w;
    const { W, H, mat, amt, moved, moist } = w;
    if (y + 1 < H) {
      const b = i + W;
      const mb = mat[b];
      if(IS_LIQUID[mb]&&DENSITY[mb]<DENSITY[M.WATER]){w.swap(i,b);moved[b]=st;return true;}
      if (waterOpen(mb)) {
        w.swap(i, b);
        moved[b] = st;
        return true;
      }
      if (mb === M.WATER && amt[b] < WATER_UNITS) {
        const t = Math.min(amt[i], WATER_UNITS - amt[b]);
        amt[b] += t;
        amt[i] -= t;
        if (amt[i] === 0) w.setRaw(i, M.AIR);
        else w.touch(x, y);
        w.touch(x, y + 1);
        return true;
      }
      // infiltration into permeable material below (or beside, slower)
      if (this.tryInfiltrate(i, b, mb, 1, rng)) return true;
      const side = rng.chance(0.5) ? -1 : 1;
      if (x + side >= 0 && x + side < W && this.tryInfiltrate(i, i + side, mat[i + side], 0.35, rng)) return true;
      // diagonal fall
      const d1 = rng.chance(0.5) ? -1 : 1;
      for (const d of [d1, -d1]) {
        const nx = x + d;
        if (nx < 0 || nx >= W) continue;
        if (waterOpen(mat[b + d]) && waterOpen(mat[i + d])) {
          w.swap(i, b + d);
          moved[b + d] = st;
          return true;
        }
      }
    }
    // lateral spread: only under pressure (water above) or toward a drop, so thin films settle
    const pressured = y > 0 && mat[i - W] === M.WATER;
    const d1 = ((tick + x + y) & 1) === 0 ? -1 : 1;
    for (const d of [d1, -d1]) {
      const nx = x + d;
      if (nx < 0 || nx >= W) continue;
      const j = i + d;
      if (!waterOpen(mat[j])) continue;
      const drop = y + 1 < H && (mat[j + W] === M.AIR || (mat[j + W] === M.WATER && amt[j + W] < WATER_UNITS));
      if (pressured || drop) {
        w.swap(i, j);
        moved[j] = st;
        return true;
      }
    }
    void moist;
    return false;
  }

  private tryInfiltrate(i: number, j: number, mj: number, factor: number, rng: Rng): boolean {
    const w = this.w;
    const cap = MOIST_CAP[mj];
    if (cap === 0 || mj === M.WATER) return false;
    const perm = PERMEABILITY[mj];
    if (perm <= 0 || !rng.chance(perm * factor)) return false;
    const room = cap - w.moist[j];
    if (room <= 0) return false;
    const t = Math.min(w.amt[i], room, 16);
    w.moist[j] += t;
    w.amt[i] -= t;
    this.stats.infiltrated += t;
    if (w.amt[i] === 0) w.setRaw(i, M.AIR);
    else w.touch(i % w.W, (i / w.W) | 0);
    w.touch(j % w.W, (j / w.W) | 0);
    return true;
  }

  private stepGranular(x: number, y: number, i: number, m: number, st: number, rng: Rng): boolean {
    const w = this.w;
    const { W, H, mat, moved, moist } = w;
    if (y + 1 >= H) return false;
    const cap = MOIST_CAP[m];
    const wet = cap > 0 ? moist[i] / cap : 0;
    // damp granular material is cohesive enough to arch (simplified capillary cohesion)
    const cohesion = MATERIALS[m].cohesion + (m === M.SAND || m === M.LOOSE ? Math.min(0.75, wet * 2.5) : 0);
    const b = i + W;
    const mb = mat[b];
    if (IS_GAS[mb] || (IS_LIQUID[mb]&&DENSITY[m]>DENSITY[mb])) {
      // unsupported: falls unless cohesive (damp) and keyed into a solid neighbour (arching)
      const held = cohesion > 0.6 && ((x > 0 && IS_SOLID[mat[i - 1]]) || (x < W - 1 && IS_SOLID[mat[i + 1]]));
      if (held && !rng.chance(0.00002)) return false;
      if (!held || rng.chance(0.5)) {
        w.swap(i, b);
        moved[b] = st;
        return true;
      }
      return false;
    }
    // slide diagonally (angle of repose)
    if (cohesion > 0.6 || !rng.chance(0.6 - cohesion * 0.5)) return false;
    const d1 = rng.chance(0.5) ? -1 : 1;
    for (const d of [d1, -d1]) {
      const nx = x + d;
      if (nx < 0 || nx >= W) continue;
      const md = mat[b + d];
      // grains do not slide sideways into excavated passages (workers keep tunnel mouths clear);
      // unsupported material above a passage can still fall straight in
      if (w.owner[b + d] || w.owner[i + d]) continue;
      if ((IS_GAS[md] || (IS_LIQUID[md]&&DENSITY[m]>DENSITY[md])) && (IS_GAS[mat[i+d]] || IS_LIQUID[mat[i+d]])) {
        w.swap(i, b + d);
        moved[b + d] = st;
        return true;
      }
    }
    return false;
  }

  /** Saturated, unsupported cohesive soil may slump into loose material. Roots stabilise. */
  private maybeSlump(x: number, y: number, i: number, m: number, rng: Rng) {
    const w = this.w;
    const coh = MATERIALS[m].cohesion;
    if (!rng.chance(0.0008 * (1 - coh) + 0.00005)) return;
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) if (w.get(x + dx, y + dy) === M.ROOT) return;
    const a = w.amt[i];
    w.mat[i] = M.LOOSE;
    w.amt[i] = a;
    if (w.moist[i] > MOIST_CAP[M.LOOSE]) {
      // excess pore water is released as a water cell below if possible, otherwise ledgered
      const excess = w.moist[i] - MOIST_CAP[M.LOOSE];
      w.moist[i] = MOIST_CAP[M.LOOSE];
      w.ledger.sink('water', 'slump drainage', excess);
    }
    w.touch(x, y);
    this.slumps++;
  }
  slumps = 0;

  /**
   * Rolling soil-moisture update: vertical/lateral exchange between absorbent cells,
   * seepage of saturated soil into open passages, and evaporation at exposed surfaces.
   * Processes H/8 rows per call so the whole map is covered every 8 ticks.
   */
  stepMoisture(tick: number, climate: Climate) {
    const w = this.w;
    const { W, H, mat, moist, amt } = w;
    const rows = Math.ceil(H / 8);
    const y0 = this.moistureCursor;
    const y1 = Math.min(H, y0 + rows);
    this.moistureCursor = y1 >= H ? 0 : y1;
    const rng = this.rng;
    const airT = airTemperature(climate, tick);
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const m = mat[i];
        if(m===M.PERMAFROST)continue;
        if (m === M.WATER) {
          // evaporation of exposed water surfaces
          if (y > 0 && mat[i - W] === M.AIR && w.skyExposed(x, y - 1)) {
            const h = w.humAt(x, y);
            const p = 0.02 * climate.evaporation * Math.max(0, (airT + w.heat[w.tIdx(x, y)]) / 25) * (1 - h);
            if (rng.chance(p)) {
              amt[i] -= 1;
              w.ledger.sink('water', 'evaporation', 1);
              if (amt[i] === 0) w.setRaw(i, M.AIR);
              else w.touch(x, y);
            }
          }
          continue;
        }
        const cap = MOIST_CAP[m];
        if (cap === 0) continue;
        let mi = moist[i];
        // vertical exchange with gravity bias
        if (y + 1 < H) {
          const b = i + W;
          const cb = MOIST_CAP[mat[b]];
          if (cb > 0 && mat[b] !== M.WATER && mat[b] !== M.PERMAFROST) {
            const k = 0.35 * Math.sqrt(Math.max(0.01, Math.min(PERMEABILITY[m], PERMEABILITY[mat[b]])));
            const diff = mi / cap - moist[b] / cb + 0.03;
            let f = Math.trunc(diff * k * Math.min(cap, cb));
            if (f > 0) f = Math.min(f, mi, cb - moist[b]);
            else f = -Math.min(-f, moist[b], cap - mi);
            if (f !== 0) {
              moist[i] = mi - f;
              moist[b] += f;
              mi = moist[i];
            }
          } else if (mat[b] === M.AIR && mi >= cap - 4 && mi >= 24 && rng.chance(0.15 * PERMEABILITY[m] + 0.01)) {
            // seepage: saturated ceiling drips into the passage below
            const t = Math.min(mi, 24);
            moist[i] = mi - t;
            mi = moist[i];
            w.setRaw(b, M.WATER, t);
            this.stats.seeped += t;
          }
        }
        // lateral exchange (to the right neighbour; symmetric over the sweep)
        if (x + 1 < W) {
          const r = i + 1;
          const cr = MOIST_CAP[mat[r]];
          if (cr > 0 && mat[r] !== M.WATER && mat[r] !== M.PERMAFROST) {
            const k = 0.25 * Math.sqrt(Math.max(0.01, Math.min(PERMEABILITY[m], PERMEABILITY[mat[r]])));
            const diff = mi / cap - moist[r] / cr;
            let f = Math.trunc(diff * k * Math.min(cap, cr));
            if (f > 0) f = Math.min(f, mi, cr - moist[r]);
            else f = -Math.min(-f, moist[r], cap - mi);
            if (f !== 0) {
              moist[i] = mi - f;
              moist[r] += f;
              mi = moist[i];
            }
          }
        }
        // evaporation from soil exposed to open sky air
        if (mi > 0 && y > 0 && mat[i - W] === M.AIR && w.skyExposed(x, y - 1)) {
          const h = w.humAt(x, y);
          const t = airT + w.heat[w.tIdx(x, y)];
          const p = 0.05 * climate.evaporation * Math.max(0, t / 25) * (1 - h) * (mi / cap + 0.1);
          if (rng.chance(p)) {
            moist[i] = mi - 1;
            w.ledger.sink('water', 'evaporation', 1);
          }
        }
        if (moist[i] !== mi || ((tick + x) & 63) === 0) w.chunkDirty[w.chunkOf(x, y)] = 1;
      }
    }
  }

  /** Rain spawns water cells in the top row (a ledgered source). */
  stepWeather(tick: number, climate: Climate) {
    const w = this.w;
    if (tick % DAY_TICKS === 0) {
      if (this.rng.chance(climate.rainChancePerDay)) this.raining = Math.floor(this.rng.range(0.05, 0.2) * DAY_TICKS);
    }
    const spawn = (x0: number, x1: number, rate: number) => {
      let n = rate;
      while (n > 0) {
        if (n < 1 && !this.rng.chance(n)) break;
        n -= 1;
        const x = x0 + this.rng.int(Math.max(1, x1 - x0));
        const i = x;
        if (w.mat[i] === M.AIR) {
          w.setRaw(i, M.WATER, WATER_UNITS);
          w.ledger.source('water', 'rain', WATER_UNITS);
        }
      }
    };
    if (this.raining > 0) {
      this.raining--;
      spawn(0, w.W, climate.rainIntensity);
    }
    for (let k = this.rainLocal.length - 1; k >= 0; k--) {
      const r = this.rainLocal[k];
      spawn(Math.max(0, r.x - r.w), Math.min(w.W, r.x + r.w), 0.5);
      if (--r.ticks <= 0) this.rainLocal.splice(k, 1);
    }
  }

  /** Coarse temperature diffusion with sky and deep boundaries plus player heat sources. */
  stepTemperature(tick: number, climate: Climate) {
    const w = this.w;
    const { TW, TH, temp, heat, mat, W } = w;
    const airT = airTemperature(climate, tick);
    const next = this.tmpBuf ?? (this.tmpBuf = new Float32Array(temp.length));
    for (let ty = 0; ty < TH; ty++) {
      for (let tx = 0; tx < TW; tx++) {
        const c = ty * TW + tx;
        const cx = tx * TS + 2, cy = ty * TS + 2;
        const ci = Math.min(w.H - 1, cy) * W + Math.min(W - 1, cx);
        let th = THERMAL[mat[ci]];
        const T = temp[c];
        let lap = 0;
        let n = 0;
        if (tx > 0) { lap += temp[c - 1]; n++; }
        if (tx < TW - 1) { lap += temp[c + 1]; n++; }
        if (ty > 0) { lap += temp[c - TW]; n++; }
        if (ty < TH - 1) { lap += temp[c + TW]; n++; }
        lap -= n * T;
        let v = T + 0.2 * th * lap;
        if (IS_GAS[mat[ci]] && w.skyExposed(Math.min(W - 1, cx), Math.min(w.H - 1, cy))) v += 0.25 * (airT - v);
        else if (ty === 0) v += 0.1 * (airT - v);
        if (ty === TH - 1) v += 0.05 * (climate.deepTemp - v);
        v += 0.06 * heat[c];
        heat[c] *= 0.9985;
        if (Math.abs(heat[c]) < 0.01) heat[c] = 0;
        th = 0;
        next[c] = Math.max(-100, Math.min(2000, v));
        if(Math.abs(next[c]-T)>.1){const ch=w.chunkOf(Math.min(W-1,cx),Math.min(w.H-1,cy));if(w.chunkReactive[ch])w.chunkActive[ch]=8;}
      }
    }
    temp.set(next);
  }
  private tmpBuf: Float32Array | null = null;

  /** Coarse air humidity from nearby water/moisture, enclosure and player bias. */
  stepHumidity(climate: Climate) {
    const w = this.w;
    const { TW, TH, hum, humBias, W, H, mat, moist } = w;
    const rainBoost = this.raining > 0 ? 0.35 : 0;
    for (let ty = 0; ty < TH; ty++) {
      for (let tx = 0; tx < TW; tx++) {
        const c = ty * TW + tx;
        let wet = 0, cnt = 0, water = 0, air = 0;
        for (let dy = -2; dy < TS + 2; dy += 2) {
          for (let dx = -2; dx < TS + 2; dx += 2) {
            const x = tx * TS + dx, y = ty * TS + dy;
            if (x < 0 || y < 0 || x >= W || y >= H) continue;
            const i = y * W + x;
            const m = mat[i];
            if (m === M.WATER) water++;
            else if (m === M.AIR) air++;
            const cap = MOIST_CAP[m];
            if (cap > 0) { wet += moist[i] / cap; cnt++; }
          }
        }
        const cx = Math.min(W - 1, tx * TS + 2), cy = Math.min(H - 1, ty * TS + 2);
        const sky = mat[cy * W + cx] === M.AIR && w.skyExposed(cx, cy);
        const soilSat = cnt ? wet / cnt : 0;
        let target: number;
        if (sky) target = climate.baseHumidity + rainBoost + 0.2 * soilSat + (water > 0 ? 0.1 : 0);
        else target = 0.55 + 0.4 * soilSat + (water > 0 ? 0.15 : 0) - (air > 30 ? 0.05 : 0);
        target += humBias[c];
        humBias[c] *= 0.995;
        hum[c] += 0.2 * (Math.max(0.02, Math.min(1, target)) - hum[c]);
      }
    }
  }
}
