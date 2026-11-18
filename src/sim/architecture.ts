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
    // game scale: the nest may use the whole soil column (real nests are a few metres at most; this is the
    // underground kingdom the game is about). Species depth only sets how fast it heads down.
    depth: Math.max(Math.min(sp.nest.targetDepth, w.H - baseY - 8), w.H - baseY - 8),
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
  // chambers hang off the main shaft all the way down; the nest deepens as the colony grows
  // (one chamber per ~5 members; every chamber touches the shaft so the network stays connected)
  const spacing = A.chamberSpacing + 2;
  const want = Math.max(1, Math.min(40, 1 + Math.floor((c.adults + c.brood.length * 0.5) / 5)));
  let k = p.chambers.filter((ch) => ch.kind === 'brood' || ch.kind === 'granary').length;
  while (k + 1 < want) {
    k++;
    const y = p.baseY + 6 + spacing * k;
    if (y > p.baseY + p.depth) break;
    // chambers shrink slowly with depth
    const rx = Math.max(3, Math.round(7 - k * 0.15 + rng.next() * 2));
    const side = (k & 1) ? 1 : -1;
    const sx = shaftX(p, y);
    const x = Math.max(rx + 2, Math.min(W - rx - 3, side > 0 ? sx + rx : sx + 1 - rx));
    p.chambers.push({ x, y, rx, ry: k % 3 === 1 ? 2 : 1, kind: A.granaries && k % 4 === 2 ? 'granary' : 'brood' });
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
  const wantGal = Math.min(main.length, Math.floor(c.workers / 8));
  for (let g = 0; g < 2 && reach >= 10 && ends.length < wantGal; g++) {
    const ch = main[ends.length], dir = ch.x >= shaftX(p, ch.y) ? 1 : -1;
    // galleries wander a little: they drop or climb a few cells on their way out
    const x1 = Math.max(5, Math.min(W - 6, ch.x + dir * (ch.rx + Math.min(reach - ch.rx - Math.abs(ch.x - p.ex), 10 + rng.int(14)))));
    const y1 = Math.min(p.baseY + p.depth, ch.y + rng.int(7) - 2);
    if (Math.abs(x1 - ch.x) > ch.rx + 3) {
      tunnels.push({ x0: ch.x + dir * ch.rx, y0: ch.y, x1, y1 });
      p.chambers.push({ x: Math.max(4, Math.min(W - 5, x1 + dir * 3)), y: y1, rx: 3 + rng.int(2), ry: 1, kind: 'store' });
      // satellites on the same side are joined by a sloping side shaft, so the nest becomes a branching network
      const prev = ends.filter((e) => Math.sign(e.x - p.ex) === dir).pop();
      if (prev) tunnels.push({ x0: prev.x, y0: prev.y + 1, x1: x1 + dir * 3, y1: y1 - 1 });
      ends.push(p.chambers[p.chambers.length - 1]);
      changed = true;
    } else break;
  }
  // the royal court moves down: once a deeper brood chamber is dug out, the queen relocates there (eggs, nurses
  // and brood follow her), so the colony's heart is deep underground
  const w = sim.w, own = c.slot + 1;
  const open = (x: number, y: number) => w.inb(x, y) && w.owner[y * W + x] === own && !IS_SOLID[w.mat[y * W + x]];
  let court: { x: number; y: number } | null = null;
  for (const ch of p.chambers) {
    if (ch.kind !== 'brood' || ch.y <= c.chamber.y + 8 || ch.y > p.baseY + p.depth * 0.6) continue;
    const hx = ch.rx >> 1;
    if (open(ch.x, ch.y + ch.ry) && open(ch.x - hx, ch.y + ch.ry) && open(ch.x + hx, ch.y + ch.ry) && (!court || ch.y > court.y)) court = { x: ch.x, y: ch.y + ch.ry };
  }
  if (court && c.chamber.x >= 0) {
    c.chamber = court;
    sim.event('nest', `${c.name}: the queen moved her court down to a new royal chamber ${court.y - p.baseY} cells below ground.`, c);
  }
  if (growRoads(sim, c, p)) changed = true;
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

/** Underground kingdom (game abstraction, far beyond real nest sizes): once a colony has a workforce it
 *  drives long horizontal highways at one to three depths out from the main shaft, a segment at a time
 *  whenever the current digging backlog is small. Highways sprout outpost chambers and, on the shallowest
 *  level, shafts to the surface (distant entrances for foragers). A highway stops at the map edge or where
 *  it meets another colony's claimed tunnels; that border is recorded as a contact and raises tension.
 *  At war, a colony digs through the border (a breach) so its raiders can infiltrate underground. */
/** highway levels as fractions of the soil column below the entrance (shallow to deep) */
const ROAD_DEPTHS = [0.12, 0.35, 0.6, 0.85];
function growRoads(sim: Sim, c: Colony, p: NestPlan): boolean {
  const w = sim.w, W = w.W, H = w.H, rng = sim.rng, own = c.slot + 1;
  if (c.workers < 10) return false;
  const roads = (p.roads ??= []), contacts = (p.contacts ??= []), tunnels = (p.tunnels ??= []);
  let changed = false;
  const levels = c.workers >= 70 ? 4 : c.workers >= 45 ? 3 : c.workers >= 24 ? 2 : 1;
  for (let l = 0; l < levels; l++) for (const dir of [-1, 1]) {
    if (roads.some((r) => r.level === l && r.dir === dir)) continue;
    const y = Math.min(p.baseY + Math.max(8, Math.round(ROAD_DEPTHS[l] * p.depth)), H - 8);
    if (y <= p.baseY + 4) continue;
    const sx = shaftX(p, y);
    tunnels.push({ x0: sx, y0: p.baseY + 2, x1: sx, y1: y }); // the main shaft continues down to this level
    roads.push({ level: l, dir, y, x: sx + (dir > 0 ? 2 : -1), len: 0, outposts: 0 });
    changed = true;
  }
  // at war: break through the border toward the enemy's tunnels
  const ws = c.war;
  if (ws && (ws.strategy === 'war' || ws.strategy === 'raid') && ws.target) {
    const ct = contacts.find((k) => k.colony === ws.target && !k.breached);
    const o = sim.colonies.find((x) => x && x.alive && x.id === ws.target);
    if (ct && o) {
      let bx = ct.x;
      for (let s = 0; s < 12; s++) { bx += ct.dir; if (w.owner[ct.y * W + bx] === o.slot + 1 || w.owner[(ct.y - 1) * W + bx] === o.slot + 1) break; }
      tunnels.push({ x0: ct.x, y0: ct.y, x1: bx + ct.dir, y1: ct.y });
      ct.breached = true; changed = true;
      sim.event('tunnel', `${c.name} is tunnelling through the border into ${o.name}'s underground territory.`, c);
    }
  }
  // a border reopens when the neighbour is gone
  for (const r of roads) if (r.stop === 'border' && !sim.colonies.some((x) => x && x.alive && x.id === r.blockedBy)) { r.stop = undefined; r.blockedBy = 0; }
  for (let k = contacts.length - 1; k >= 0; k--) if (!sim.colonies.some((x) => x && x.alive && x.id === contacts[k].colony)) contacts.splice(k, 1);
  if (p.todo > 80 + c.workers * 1.5 && p.frontier.length > 4) return changed; // finish the current excavation first
  // a straight run is passable when it crosses no rock and no water
  const blocked = (xa: number, xb: number, y: number) => {
    for (let x = Math.min(xa, xb); x <= Math.max(xa, xb); x++) for (let dy = -2; dy <= 1; dy++) {
      const m = w.get(x, y + dy);
      if (m === M.WATER || (dy >= -1 && dy <= 0 && IS_SOLID[m] && !DIG_RESIST[m])) return true;
    }
    return false;
  };
  const open = roads.filter((r) => !r.stop);
  for (let n = 0; n < (c.workers >= 60 ? 2 : 1) && open.length; n++) {
    const r = open.reduce((m, q) => (q.len < m.len ? q : m));
    open.splice(open.indexOf(r), 1);
    let x1 = r.x + r.dir * (14 + rng.int(10));
    if (x1 < 4 || x1 > W - 5) { x1 = Math.max(4, Math.min(W - 5, x1)); r.stop = 'edge'; }
    const want = Math.max(p.baseY + 5, Math.min(H - 6, r.y + rng.int(3) - 1));
    const y1 = [0, -2, 2, -4, 4, -6, 6].map((d) => want + d).find((y) => y > p.baseY + 4 && y < H - 6 && !blocked(r.x, x1, y));
    if (y1 === undefined) { r.stop = 'edge'; continue; }
    // claimed ground: stop short of any other colony's excavations
    outer: for (let x = r.x; x !== x1 + r.dir; x += r.dir) for (let dy = -3; dy <= 3; dy++) {
      const yy = Math.max(0, Math.min(H - 1, (dy < 0 ? Math.min(r.y, y1) : Math.max(r.y, y1)) + dy));
      const ow = w.owner[yy * W + x];
      if (!ow || ow === own) continue;
      const o = sim.colonies[ow - 1];
      x1 = x - r.dir * 3; r.stop = 'border'; r.blockedBy = o?.id ?? 0;
      if (o && o.alive && !contacts.some((k) => k.colony === o.id && k.dir === r.dir)) {
        contacts.push({ x: x1, y: y1, dir: r.dir, colony: o.id, breached: false, since: sim.tick });
        const rel = (c.war?.relations ?? []).find((q) => q.id === o.id);
        if (rel) rel.hostility = Math.min(20, rel.hostility + 0.6);
        sim.event('tunnel', `${c.name}'s tunnels reached the underground border of ${o.name}.`, c);
      }
      break outer;
    }
    if ((x1 - r.x) * r.dir < 3) continue;
    // a level change becomes a short ramp at the start of the segment
    if (y1 !== r.y) tunnels.push({ x0: r.x, y0: r.y, x1: r.x, y1 });
    tunnels.push({ x0: r.x, y0: y1, x1, y1 });
    r.len += Math.abs(x1 - r.x); r.x = x1; r.y = y1; changed = true;
    if (r.len >= (r.outposts + 1) * 42) {
      r.outposts++;
      p.chambers.push({ x: Math.max(4, Math.min(W - 5, x1)), y: y1, rx: 3, ry: 1, kind: 'outpost' });
      if (r.level === 0 && r.outposts % 2 === 1 && x1 > 3 && x1 < W - 4 && w.surface[x1] < y1 - 3) p.shafts.push({ x: x1, y0: w.surface[x1], y1 });
    }
  }
  return changed;
}

/** Summary of a colony's underground kingdom for the UI. */
export function territorySummary(sim: Sim, c: Colony) {
  const p = c.plan, names = ['Upper', 'Middle', 'Deep'];
  if (!p) return { roads: [], contacts: [], outposts: 0, shafts: 0, cells: c.nestVolume, todo: 0, span: 0 };
  let minX = p.ex, maxX = p.ex;
  for (const r of p.roads ?? []) { minX = Math.min(minX, r.x); maxX = Math.max(maxX, r.x); }
  return {
    roads: (p.roads ?? []).map((r) => {
      const o = r.blockedBy ? sim.colonies.find((x) => x && x.id === r.blockedBy) : null;
      return { name: `${names[r.level] ?? 'Lower'} ${r.dir < 0 ? 'west' : 'east'} highway`, len: r.len, outposts: r.outposts, status: r.stop === 'edge' ? 'reached the world edge' : r.stop === 'border' ? `border with ${o?.name ?? 'a lost colony'}` : 'expanding' };
    }),
    contacts: (p.contacts ?? []).map((k) => ({ colony: sim.colonies.find((x) => x && x.id === k.colony)?.name ?? 'a lost colony', breached: k.breached, x: k.x })),
    outposts: p.chambers.filter((ch) => ch.kind === 'outpost').length, shafts: p.shafts.length + 1, cells: c.nestVolume, todo: p.todo,
    span: Math.round(((maxX - minX) / sim.w.W) * 100),
  };
}

/** Every frontier cell of a plan (not saved; refreshed by scanFrontier). */
const allFront = new WeakMap<NestPlan, number[]>();
export const frontierCells = (p: NestPlan) => allFront.get(p) ?? p.frontier;

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
  allFront.set(p, front);
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
  return p && p.frontier.length ? Math.min(p.roads?.length ? 0.7 : 0.55, p.todo / 160) : 0;
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

