// Nest architecture. Excavation is still done cell by cell by individual workers using local cues;
// the plan below stands in for the stigmergic and template rules that make real nests converge on a
// species-typical shape. It follows the broad pattern of plaster/metal casts of ant nests
// (Tschinkel 2004, 2015; Tschinkel 1987 for Pogonomyrmex badius; Mikheyev & Tschinkel 2004):
// - one or a few roughly vertical (sometimes helical) shafts connect flat, pancake-shaped chambers;
// - chambers are larger and more crowded near the top and become smaller and sparser with depth;
// - total nest size grows with colony size, and large colonies add extra shafts and entrances;
// - spoil is heaped into a mound (Lasius niger builds soil domes whose galleries warm in the sun and
//   hold brood by day) or a low crater ring around a vegetation-free disc (Pogonomyrmex);
// - refuse goes to a midden away from the entrance; harvester ants keep seeds in shallow granaries.
// Sizes are scaled to the game's ~100x smaller colonies; spacing, radius and growth rates are authored.
import { CASTE, WHY } from './ants.ts';
import type { Colony, NestPlan } from './colony.ts';
import { DIG_RESIST, IS_SOLID, M } from './materials.ts';
import type { Sim } from './sim.ts';

const DEFAULT_ARCH = { mound: 'dome' as const, shaftAmp: 1, chamberSpacing: 5, clearsDisc: false, granaries: false };
export const archOf = (sim: Sim, c: Colony) => sim.speciesOf(c).nest.architecture ?? DEFAULT_ARCH;

/** planned cell kinds: 1 = chamber floor space, 2 = shaft */
const cellCache = new WeakMap<NestPlan, { v: number; cells: Map<number, number> }>();

export function shaftX(p: NestPlan, y: number) { return p.ex + Math.round(p.amp * Math.sin(y * p.freq + p.phase)); }

export function ensurePlan(sim: Sim, c: Colony): NestPlan | null {
  if (c.plan) return c.plan;
  if (c.chamber.x < 0 || c.workers < 1) return null;
  const sp = sim.speciesOf(c), A = archOf(sim, c), rng = sim.rng, w = sim.w;
  const ex = c.entrance.x, baseY = c.entrance.y;
  // the midden lies on the side away from the nearest neighbouring colony
  let side = rng.chance(0.5) ? 1 : -1, nearest = 1e9;
  for (const o of sim.colonies) if (o && o.alive && o !== c && Math.abs(o.entrance.x - ex) < nearest) { nearest = Math.abs(o.entrance.x - ex); side = o.entrance.x > ex ? -1 : 1; }
  c.plan = {
    baseY, ex, amp: A.shaftAmp, freq: 0.16 + rng.next() * 0.1, phase: rng.next() * Math.PI * 2,
    depth: Math.min(sp.nest.targetDepth, w.H - baseY - 6),
    chambers: [{ x: c.chamber.x, y: c.chamber.y, rx: 4, ry: 1, kind: 'royal' }],
    shafts: [], mound: { kind: A.mound, r: 0, h: 0 }, midden: { x: Math.max(3, Math.min(w.W - 4, ex + side * 22)) },
    todo: 0, frontier: [], version: 1,
    ground: Array.from({ length: 61 }, (_, k) => w.surface[Math.max(0, Math.min(w.W - 1, ex - 30 + k))]),
  };
  return c.plan;
}

export function planCells(p: NestPlan, W: number, H: number): Map<number, number> {
  const hit = cellCache.get(p);
  if (hit && hit.v === p.version) return hit.cells;
  const cells = new Map<number, number>();
  const put = (x: number, y: number, k: number) => { if (x > 0 && y > 0 && x < W - 1 && y < H - 1) { const i = y * W + x; if (!cells.has(i) || k === 1) cells.set(i, k); } };
  let deepest = p.baseY + 4;
  for (const ch of p.chambers) if (ch.kind !== 'mound') deepest = Math.max(deepest, ch.y);
  // main shaft, two cells wide, bridging any sideways step of the helix
  let px = shaftX(p, p.baseY + 1);
  for (let y = p.baseY + 1; y <= deepest + 1; y++) {
    const sx = shaftX(p, y);
    for (let x = Math.min(px, sx); x <= Math.max(px, sx); x++) { put(x, y, 2); put(x + 1, y, 2); }
    px = sx;
  }
  for (const s of p.shafts) for (let y = s.y0; y <= s.y1; y++) { put(s.x, y, 2); put(s.x + 1, y, 2); }
  // galleries and cross-links: two cells thick so large-bodied workers can pass
  for (const t of p.tunnels ?? []) {
    const n = Math.max(Math.abs(t.x1 - t.x0), Math.abs(t.y1 - t.y0), 1), flat = Math.abs(t.x1 - t.x0) >= Math.abs(t.y1 - t.y0);
    for (let s = 0; s <= n; s++) {
      const x = Math.round(t.x0 + ((t.x1 - t.x0) * s) / n), y = Math.round(t.y0 + ((t.y1 - t.y0) * s) / n);
      put(x, y, 2); if (flat) put(x, y - 1, 2); else put(x + 1, y, 2);
    }
  }
  // pancake chambers: flat ellipses
  for (const ch of p.chambers) for (let dy = -ch.ry; dy <= ch.ry; dy++) for (let dx = -ch.rx; dx <= ch.rx; dx++) {
    if ((dx / (ch.rx + 0.5)) ** 2 + (dy / (ch.ry + 0.6)) ** 2 <= 1) put(ch.x + dx, ch.y + dy, 1);
  }
  cellCache.set(p, { v: p.version, cells });
  return cells;
}

export function planKind(sim: Sim, c: Colony, k: number): number {
  const p = c.plan;
  return p ? planCells(p, sim.w.W, sim.w.H).get(k) ?? 0 : 0;
}

/** Height of the heap above the original ground at column x. */
const heapHeight = (sim: Sim, p: NestPlan, x: number) => Math.max(0, (p.ground[x - p.ex + 30] ?? p.baseY + 1) - sim.w.surface[x]);

/** Extend the template as the colony grows (called every few hundred ticks). */
function growPlan(sim: Sim, c: Colony, p: NestPlan) {
  const A = archOf(sim, c), rng = sim.rng, W = sim.w.W;
  let changed = false;
  const want = Math.max(1, Math.min(16, 1 + Math.floor((c.adults + c.brood.length * 0.5) / 9)));
  let k = p.chambers.filter((ch) => ch.kind === 'brood' || ch.kind === 'granary').length;
  while (k + 1 < want) {
    k++;
    const y = p.baseY + 4 + Math.round(A.chamberSpacing * k ** 1.18);
    if (y > p.baseY + p.depth) break;
    // chambers shrink with depth
    const rx = Math.max(2, Math.round(6.5 - k * 0.35 + rng.next() * 2));
    const side = (k & 1) ? 1 : -1;
    const sx = shaftX(p, y);
    const x = Math.max(rx + 2, Math.min(W - rx - 3, side > 0 ? sx + rx : sx + 1 - rx));
    p.chambers.push({ x, y, rx, ry: 1, kind: A.granaries && k <= 2 ? 'granary' : 'brood' });
    changed = true;
  }
  // large colonies open extra shafts from shallow chambers to the surface
  if (c.workers >= 45 * (p.shafts.length + 1) && p.shafts.length < 3) {
    const shallow = p.chambers.filter((ch) => ch.kind === 'brood' || ch.kind === 'granary').slice(0, 3);
    const ch = shallow[p.shafts.length % Math.max(1, shallow.length)];
    if (ch) {
      const x = ch.x + (ch.x >= p.ex ? ch.rx - 1 : -ch.rx);
      if (x > 2 && x < W - 3) { p.shafts.push({ x, y0: sim.w.surface[x], y1: ch.y }); changed = true; }
    }
  }
  // lateral galleries: as the colony grows, chambers sprout side galleries ending in satellite chambers,
  // and galleries on the same side are cross-linked, turning the single shaft into a branching network.
  // (Real nests are mostly tree-like; the cross-links are a game abstraction.) Galleries stop short of
  // halfway to a neighbouring colony so nests do not tunnel into each other.
  const tunnels = (p.tunnels ??= []);
  let reach = 40;
  for (const o of sim.colonies) if (o && o.alive && o !== c) reach = Math.min(reach, Math.floor(Math.abs(o.entrance.x - p.ex) / 2) - 4);
  const main = p.chambers.filter((ch) => ch.kind === 'brood' || ch.kind === 'granary');
  const ends = p.chambers.filter((ch) => ch.kind === 'store');
  const wantGal = Math.min(main.length, Math.floor(c.workers / 22));
  if (reach >= 10 && ends.length < wantGal) {
    const ch = main[ends.length], dir = ch.x >= shaftX(p, ch.y) ? 1 : -1;
    const x1 = Math.max(5, Math.min(W - 6, ch.x + dir * (ch.rx + Math.min(reach - ch.rx - Math.abs(ch.x - p.ex), 8 + rng.int(10)))));
    const y1 = Math.min(p.baseY + p.depth, ch.y + rng.int(3) - 1);
    if (Math.abs(x1 - ch.x) > ch.rx + 3) {
      tunnels.push({ x0: ch.x + dir * ch.rx, y0: ch.y, x1, y1 });
      p.chambers.push({ x: Math.max(4, Math.min(W - 5, x1 + dir * 2)), y: y1, rx: 3, ry: 1, kind: 'store' });
      // cross-link to the previous satellite chamber on the same side
      const prev = ends.filter((e) => Math.sign(e.x - p.ex) === dir).pop();
      if (prev) tunnels.push({ x0: prev.x, y0: prev.y + 1, x1: x1 + dir * 2, y1: y1 - 1 });
      changed = true;
    }
  }
  // the mound grows with the excavated volume
  if (p.mound.kind !== 'none') {
    const r = Math.min(24, Math.round(3 + Math.sqrt(Math.max(0, c.nestVolume)) * 0.55));
    const h = p.mound.kind === 'dome' ? Math.round(r * 0.42) : 2;
    if (r !== p.mound.r || h !== p.mound.h) { p.mound.r = r; p.mound.h = h; }
    if (heapHeight(sim, p, p.ex + 4) >= 3 || heapHeight(sim, p, p.ex - 3) >= 3) sim.journalUnlock('nest-mound');
    // Lasius domes are hollowed into galleries once they are tall enough
    const mounds = p.chambers.filter((ch) => ch.kind === 'mound').length;
    if (p.mound.kind === 'dome' && mounds < 2) {
      const side = mounds ? -1 : 1, mx = p.ex + (side > 0 ? 6 : -5);
      if (mx > 3 && mx < W - 4 && heapHeight(sim, p, mx) >= 6) { p.chambers.push({ x: mx, y: p.baseY - 2, rx: 3, ry: 1, kind: 'mound' }); changed = true; }
    }
  }
  if (changed) p.version++;
}

/** Count unexcavated planned cells and collect the frontier (planned solid cells touching the nest). */
function scanFrontier(sim: Sim, c: Colony, p: NestPlan) {
  const w = sim.w, own = c.slot + 1, cells = planCells(p, w.W, w.H);
  let todo = 0;
  const front: number[] = [];
  for (const [k, kind] of cells) {
    const m = w.mat[k];
    if (m === M.AIR || !DIG_RESIST[m] || m === M.WATER) continue;
    const y = (k / w.W) | 0;
    if (kind === 1 && y < w.surface[k % w.W] + 2) continue; // keep a roof over chambers
    todo++;
    if (w.owner[k - 1] === own || w.owner[k + 1] === own || w.owner[k - w.W] === own || w.owner[k + w.W] === own) front.push(k);
  }
  p.todo = todo;
  p.frontier = [];
  for (let n = 0; n < Math.min(24, front.length); n++) p.frontier.push(front[sim.rng.int(front.length)]);
}

/** Pogonomyrmex workers cut seedlings and grass around the entrance. */
function clearDisc(sim: Sim, c: Colony, p: NestPlan) {
  const a = sim.a, w = sim.w, R = Math.max(6, Math.round(p.mound.r * 1.4));
  for (let i = 0; i < a.n; i++) {
    if (!a.alive[i] || a.colony[i] !== c.slot || a.caste[i] !== CASTE.WORKER || a.carry[i] || !sim.rng.chance(0.2)) continue;
    const x = a.x[i], y = a.y[i];
    if (Math.abs(x - p.ex) > R || !w.skyExposed(x, y)) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, -1], [0, 1], [1, -1], [-1, -1]]) {
      const k = (y + dy) * w.W + x + dx;
      if (w.mat[k] !== M.PLANT) continue;
      sim.setCell(k, M.AIR, 0, 'removed waste');
      a.why[i] = WHY.CLEAR_DISC;
      break;
    }
  }
}

export function architectureStep(sim: Sim, c: Colony) {
  const p = ensurePlan(sim, c);
  if (!p) return;
  if (sim.tick % 600 < 60) growPlan(sim, c, p);
  scanFrontier(sim, c, p);
  if (archOf(sim, c).clearsDisc && c.workers > 8) clearDisc(sim, c, p);
}

/** Extra excavation drive while the template is unfinished. */
export function planDigStimulus(c: Colony) {
  const p = c.plan;
  return p && p.frontier.length ? Math.min(0.55, p.todo / 160) : 0;
}

/** A frontier cell for a digger that has nothing useful next to it. */
export function frontierTarget(sim: Sim, c: Colony): { x: number; y: number } | null {
  const p = c.plan;
  if (!p || !p.frontier.length) return null;
  const k = p.frontier[sim.rng.int(p.frontier.length)], w = sim.w, own = c.slot + 1;
  for (const j of [k - w.W, k - 1, k + 1, k + w.W]) if (w.owner[j] === own && !IS_SOLID[w.mat[j]]) return { x: j % w.W, y: (j / w.W) | 0 };
  return null;
}

/** Where a spoil carrier should drop its pellet to build the mound or crater (null: no heap wanted). */
export function moundSpot(sim: Sim, c: Colony): { x: number; y: number } | null {
  const p = c.plan, w = sim.w, rng = sim.rng;
  if (!p || p.mound.kind === 'none' || p.mound.r < 3) return null;
  const own = c.slot + 1, r = p.mound.r;
  let best: { x: number; y: number } | null = null, bestDef = 0.4;
  for (let t = 0; t < 10; t++) {
    const d = p.mound.kind === 'dome' ? 2 + rng.int(r - 1) : 3 + rng.int(Math.max(1, Math.round(r * 0.45)));
    const x = rng.chance(0.5) ? p.ex + 1 + d : p.ex - d;
    if (x < 2 || x >= w.W - 2) continue;
    const top = w.surface[x];
    if (top < 3) continue;
    // never bury an opening: skip columns where nest cells reach the surface
    let opening = false;
    for (let dx = -1; dx <= 1 && !opening; dx++) for (let dy = 0; dy <= 2; dy++) { const o = w.owner[(top + dy) * w.W + x + dx]; if (o && (o === own || w.mat[(top + dy) * w.W + x + dx] === M.AIR)) { opening = true; break; } }
    if (opening) continue;
    const target = p.mound.kind === 'dome' ? p.mound.h * (1 - (d / (r + 1)) ** 2) : d >= 3 ? p.mound.h : 0;
    const def = target - heapHeight(sim, p, x);
    if (def > bestDef) { bestDef = def; best = { x, y: top - 1 }; }
  }
  return best;
}

/** Add one pellet of spoil to the heap at column x. */
export function depositHeap(sim: Sim, x: number): boolean {
  const w = sim.w, y = w.surface[x] - 1;
  if (y < 1) return false;
  const k = y * w.W + x;
  if (w.mat[k] !== M.AIR || w.owner[k] || sim.occ[k] > 0) return false;
  // angle of repose: a pellet never stands more than one cell above both neighbouring columns (no spires)
  if (x > 0 && x < w.W - 1 && y < Math.min(w.surface[x - 1], w.surface[x + 1]) - 1) return false;
  sim.setCell(k, M.SOIL, 0, 'moved');
  return true;
}

