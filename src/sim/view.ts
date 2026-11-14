// Packing simulation state into compact buffers for the renderer.
import { CASTE, TASK } from './ants.ts';
import { CRITTER } from './critters.ts';
import { NP, P } from './genetics.ts';
import { FOOD_OF, M, MATERIALS, MOIST_CAP,CONDUCTIVITY } from './materials.ts';
import type { OverlayKind } from '../protocol.ts';
import { CARRY_KIND } from '../protocol.ts';
import type { Sim } from './sim.ts';
import { CS, FLAG_APHID, FLAG_PLUG, TS } from './world.ts';

/** Packed detail byte: q(4 bits) | aphid<<4 | toxin<<5 | nest<<6 | plug<<7. */
export function cellByte1(sim: Sim, k: number): number {
  const w = sim.w;
  const m = w.mat[k];
  let q = 0;
  const cap = MOIST_CAP[m];
  if (m === M.WATER) q = Math.min(15, w.amt[k] >> 2);
  else if(CONDUCTIVITY[m])q=Math.min(15,w.charge[k]>>4);
  else if (FOOD_OF[m]) q = Math.min(15, Math.round((w.amt[k] / Math.max(1, MATERIALS[m].foodUnits)) * 15));
  else if (m === M.PLANT) q = Math.min(15, w.amt[k]);
  else if (cap) q = Math.min(15, Math.round((w.moist[k] / cap) * 15));
  const f = w.flags[k];
  return q | ((f & FLAG_APHID) ? 16 : 0) | (w.toxin[k] ? 32 : 0) | (w.owner[k] ? 64 : 0) | ((f & FLAG_PLUG) ? 128 : 0);
}

export function packChunks(sim: Sim, all: boolean, maxChunks = 4096): { buf: ArrayBuffer | null; count: number } {
  const w = sim.w;
  const list: number[] = [];
  for (let c = 0; c < w.chunkDirty.length; c++) if (all || w.chunkDirty[c]) { list.push(c); if (list.length >= maxChunks) break; }
  if (!list.length) return { buf: null, count: 0 };
  const per = 2 + CS * CS * 3;
  const buf = new ArrayBuffer(list.length * per);
  const u8 = new Uint8Array(buf);
  let o = 0;
  for (const c of list) {
    w.chunkDirty[c] = 0;
    u8[o] = c & 255; u8[o + 1] = c >> 8; o += 2;
    const cx = (c % w.CW) * CS, cy = Math.floor(c / w.CW) * CS;
    for (let ly = 0; ly < CS; ly++)
      for (let lx = 0; lx < CS; lx++) {
        const x = cx + lx, y = cy + ly;
        if (x >= w.W || y >= w.H) { u8[o++] = 0; u8[o++] = 0; u8[o++] = 0; continue; }
        const k = y * w.W + x;
        u8[o++] = w.mat[k]&255;u8[o++] = w.mat[k]>>>8;
        u8[o++] = cellByte1(sim, k);
      }
  }
  return { buf, count: list.length };
}

export function packAnts(sim: Sim, out: Uint16Array | null): { buf: Uint16Array; count: number } {
  const a = sim.a, w = sim.w;
  const need = a.count * 7;
  const buf = out && out.length >= need ? out : new Uint16Array(Math.max(64, need * 2));
  let n = 0;
  for (let i = 0; i < a.n; i++) {
    if (!a.alive[i]) continue;
    const o = n * 7;
    buf[o] = a.x[i]; buf[o + 1] = a.y[i]; buf[o + 2] = a.px[i]; buf[o + 3] = a.py[i];
    const cm = a.carry[i];
    let ck: number = CARRY_KIND.NONE;
    if (a.carryBrood[i] >= 0) ck = CARRY_KIND.BROOD;
    else if (cm) ck = FOOD_OF[cm] === 1 ? CARRY_KIND.SUGAR : FOOD_OF[cm] === 2 ? CARRY_KIND.PROTEIN : FOOD_OF[cm] === 3 ? CARRY_KIND.SEED : cm === M.CORPSE || cm === M.WASTE ? CARRY_KIND.CORPSE : CARRY_KIND.SPOIL;
    const fight = a.fightTarget[i] >= 0 ? 1 : 0;
    const dig = (a.task[i] === TASK.DIG || a.task[i] === TASK.FOUND_DIG) && a.timer[i] > 0 ? 1 : 0;
    const wet = w.mat[a.y[i] * w.W + a.x[i]] === M.WATER ? 1 : 0;
    buf[o + 4] = a.colony[i] | (a.caste[i] << 8) | (ck << 10) | (fight << 13) | (dig << 14) | (wet << 15);
    const p = i * NP;
    const c = sim.colonies[a.colony[i]];
    const big = c && a.pheno[p + P.SIZE] > sim.speciesOf(c).traits.size * 1.12 ? 1 : 0;
    const small = c && a.pheno[p + P.SIZE] < sim.speciesOf(c).traits.size * 0.9 ? 1 : 0;
    buf[o + 5] = (a.anim[i] & 255) | ((a.pheno[p + P.BIOLUM] > 0 ? 1 : 0) << 8) | ((a.pheno[p + P.ARMOR] > 0 ? 1 : 0) << 9)
      | ((a.pheno[p + P.PLASTRON] > 0 ? 1 : 0) << 10) | ((a.pheno[p + P.THERMO] > 0 ? 1 : 0) << 11) | (big << 12) | (small << 13);
    buf[o + 6] = a.task[i] | ((a.hx[i] + 1) << 8) | ((a.hy[i] + 1) << 10);
    n++;
  }
  return { buf, count: n };
}

export function packTints(sim:Sim,all:boolean):Uint32Array|null{
 const w=sim.w,cells=all?w.tintedCells:w.tintDirty;if(!cells.size)return null;
 const buf=new Uint32Array(cells.size*2);let at=0;for(const k of cells){buf[at++]=k;buf[at++]=w.tint[k];}w.tintDirty.clear();return buf;
}

export function packBrood(sim: Sim): { buf: Int16Array; count: number } {
  let n = 0;
  for (const c of sim.colonies) if (c && c.alive) n += c.brood.length;
  const buf = new Int16Array(Math.max(4, n * 4));
  let k = 0;
  for (const c of sim.colonies) {
    if (!c || !c.alive) continue;
    const cocoon = sim.speciesOf(c).development.cocoon ? 1 : 0;
    for (const b of c.brood) {
      buf[k++] = b.x; buf[k++] = b.y;
      buf[k++] = b.stage | (b.destiny << 2) | (cocoon << 4) | ((b.carried ? 1 : 0) << 5);
      buf[k++] = c.slot;
    }
  }
  return { buf, count: n };
}

export function packCritters(sim: Sim): { buf: Int16Array; count: number } {
  const l = sim.critters.list;
  const buf = new Int16Array(Math.max(5, l.length * 5));
  l.forEach((c, k) => { buf[k * 5] = c.x; buf[k * 5 + 1] = c.y; buf[k * 5 + 2] = c.px; buf[k * 5 + 3] = c.py; buf[k * 5 + 4] = c.kind | ((c.hp < 0.4 ? 1 : 0) << 8) | (c.stage<<9) | (((sim.tick>>3)&1)<<11) | ((c.dir<0?1:0)<<12) | ((c.infection>0?1:0)<<13); });
  void CRITTER;
  return { buf, count: l.length };
}

/** Rasterise an overlay field to bytes (0 = nothing). Categorical overlays store slot+1. */
export function rasterOverlay(sim: Sim, kind: OverlayKind, colonySlot: number, trait: number): Uint8Array | null {
  const w = sim.w;
  const { W, H } = w;
  if (kind === 'none') return null;
  const out = new Uint8Array(W * H);
  const cols = sim.colonies.filter((c) => c && c.alive && (colonySlot < 0 || c.slot === colonySlot));
  switch (kind) {
    case 'dose':for(const k of w.doseCells)out[k]=w.dose[k];break;
    case 'charge':for(let k=0;k<w.N;k++)out[k]=w.charge[k];break;
    case 'moisture':
      for (let k = 0; k < w.N; k++) {
        const cap = MOIST_CAP[w.mat[k]];
        if (w.mat[k] === M.WATER) out[k] = 255;
        else if (cap) out[k] = 1 + Math.round((w.moist[k] / cap) * 250);
      }
      break;
    case 'temperature':
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const T = w.tempAt(x, y);
        out[y * W + x] = 1 + Math.max(0, Math.min(254, Math.round(((T + 5) / 50) * 254)));
      }
      break;
    case 'humidity':
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) out[y * W + x] = 1 + Math.round(w.humAt(x, y) * 254);
      break;
    case 'trail': case 'alarm': case 'nest': {
      const scale = kind === 'trail' ? 60 : 120;
      for (const c of cols) {
        const f = kind === 'trail' ? c!.trail : kind === 'alarm' ? c!.alarm : c!.nestOdor;
        for (const ci of f.live) {
          const ch = f.chunks[ci]!;
          const x0 = (ci % w.CW) * CS, y0 = Math.floor(ci / w.CW) * CS;
          for (let k = 0; k < CS * CS; k++) {
            const v = ch[k];
            if (v <= 0.01) continue;
            const x = x0 + (k & 15), y = y0 + (k >> 4);
            if (x >= W || y >= H) continue;
            const idx = y * W + x;
            out[idx] = Math.max(out[idx], Math.min(255, 1 + Math.round(Math.sqrt(v) * scale)));
          }
        }
      }
      break;
    }
    case 'food':
      for (let k = 0; k < w.N; k++) { const f = FOOD_OF[w.mat[k]]; if (f) out[k] = f * 60 + Math.min(40, w.amt[k] * 5); }
      break;
    case 'toxin':
      for (let k = 0; k < w.N; k++) if (w.toxin[k]) out[k] = Math.max(1, w.toxin[k]);
      break;
    case 'territory': case 'mortality': case 'trait': {
      let lo = Infinity, hi = -Infinity;
      const means = new Map<number, number>();
      if (kind === 'trait') {
        const a = sim.a;
        const sum = new Map<number, [number, number]>();
        for (let i = 0; i < a.n; i++) {
          if (!a.alive[i] || a.caste[i] !== CASTE.WORKER) continue;
          const s = sum.get(a.colony[i]) ?? [0, 0];
          s[0] += a.pheno[i * NP + trait]; s[1]++;
          sum.set(a.colony[i], s);
        }
        for (const [slot, [t, n]] of sum) { const m = t / n; means.set(slot, m); lo = Math.min(lo, m); hi = Math.max(hi, m); }
      }
      for (let ty = 0; ty < w.TH; ty++) for (let tx = 0; tx < w.TW; tx++) {
        const t = ty * w.TW + tx;
        let v = 0;
        if (kind === 'territory') { if (sim.activity[t] > 2 && sim.activityOwner[t]) v = sim.activityOwner[t]; }
        else if (kind === 'mortality') { if (sim.mortality[t] > 0.05) v = 1 + Math.min(254, Math.round(sim.mortality[t] * 40)); }
        else {
          const own = sim.activityOwner[t];
          if (own && sim.activity[t] > 2 && means.has(own - 1)) v = 1 + Math.round(((means.get(own - 1)! - lo) / Math.max(1e-6, hi - lo)) * 254);
        }
        if (!v) continue;
        for (let dy = 0; dy < TS; dy++) for (let dx = 0; dx < TS; dx++) {
          const x = tx * TS + dx, y = ty * TS + dy;
          if (x < W && y < H) out[y * W + x] = v;
        }
      }
      break;
    }
  }
  return out;
}
