// Individual ant behaviour. Ants act on locally available information only:
// the cells around them, chemical fields at their position, contacts with
// nearby ants, their own bounded route memory, and their own internal state.
// The few colony-level aggregates they read (task stimuli, store levels) are
// documented approximations of averaged local cues (see docs/ARCHITECTURE.md).
import { CASTE, MEM, NAV, TASK, WHY } from './ants.ts';
import type { Colony } from './colony.ts';
import { STAGE } from './colony.ts';
import { P, thermalPerf } from './genetics.ts';
import { DIG_RESIST, FOOD_OF, IS_GRANULAR, IS_SOLID, IS_LIQUID, CLIMBABLE, M, MOIST_CAP, MATERIALS } from './materials.ts';
import type { Sim } from './sim.ts';
import { FLAG_PLUG } from './world.ts';
import { aggressionFactor, decideWarTask, forageFactor, isWarTask, noteEncounter, noteKill, underSiege, warState } from './warfare.ts';
import { depositHeap, frontierTarget, moundSpot, planDigStimulus, planKind } from './architecture.ts';
import { TR, aggressionTrait, coldBonus, courage, has as hasTrait, heatBonus, lifeFactor } from './traits.ts';
import { atPeace, cultureAggression, onFoodFound, onKill, persona, workPriority } from './society.ts';
import { ACT, NA, NI, NO_ACT, S, actMask, prefers, reward as brainReward, think } from './brain.ts';

const DX = [1, 1, 0, -1, -1, -1, 0, 1];
const DY = [0, 1, 1, 1, 0, -1, -1, -1];
export const PHYS_EVERY = 10;
export const DECIDE_EVERY = 4;

function isOpen(m: number) {
  return !IS_SOLID[m]&&!IS_LIQUID[m];
}

/** A cell an ant can stand in: open, and touching something to hold on to. */
export function canStand(sim: Sim, x: number, y: number, big: boolean): boolean {
  const w = sim.w;
  if (x < 0 || y < 0 || x >= w.W || y >= w.H) return false;
  const i = y * w.W + x;
  const m = w.mat[i];
  if (!isOpen(m)) return false;
  if (!supported(sim, x, y)) return false;
  if (big) {
    // large-bodied ants need two open cells (simplified clearance rule)
    const up = y > 0 && isOpen(w.mat[i - w.W]);
    const dn = y + 1 < w.H && isOpen(w.mat[i + w.W]);
    const lf = x > 0 && isOpen(w.mat[i - 1]);
    const rt = x + 1 < w.W && isOpen(w.mat[i + 1]);
    if (!((up || dn) && (lf || rt))) return false;
  }
  return true;
}

export function supported(sim: Sim, x: number, y: number): boolean {
  const w = sim.w;
  if (y >= w.H - 1) return true;
  const i = y * w.W + x;
  if (CLIMBABLE[w.mat[i]]) return true;
  // ants walk on floors, walls and ceilings (also underground): an open cell with nothing solid touching it is
  // mid-air, so a worker there falls instead of floating across a chamber or cave
  for (let d = 0; d < 8; d++) {
    const nx = x + DX[d], ny = y + DY[d];
    // the world's side and top edges are not climbable walls
    if (nx < 0 || ny < 0 || nx >= w.W) continue;
    if (ny >= w.H) return true;
    const m = w.mat[ny * w.W + nx];
    if (IS_SOLID[m] || CLIMBABLE[m]) return true;
  }
  return false;
}

function dist2(x0: number, y0: number, x1: number, y1: number) {
  const dx = x1 - x0, dy = y1 - y0;
  return dx * dx + dy * dy;
}

/** Trail strength sensed at a cell: own colony, plus conspecific colonies' trails scaled by sharing. */
export function trailAt(sim: Sim, c: Colony, x: number, y: number): number {
  let t = c.trail.get(x, y);
  const share = sim.speciesOf(c).communication.trailSharing;
  if (share > 0) {
    for (const oc of sim.trailNeighbours[c.slot] ?? []) {
      const o = sim.colonies[oc];
      if (o && o.alive) t += share * o.trail.get(x, y);
    }
  }
  return t;
}

export function inOwnNest(sim: Sim, i: number): boolean {
  const a = sim.a;
  return sim.w.owner[a.y[i] * sim.w.W + a.x[i]] === a.colony[i] + 1;
}

function bigBody(sim: Sim, i: number, c: Colony) {
  return sim.a.pheno[i * 29 + P.SIZE] > sim.speciesOf(c).traits.size * 1.3;
}

// ---------------------------------------------------------------- movement

/** Choose and perform one step according to the ant's navigation mode. */
export function step(sim: Sim, i: number) {
  const a = sim.a, w = sim.w, rng = sim.rng;
  const x = a.x[i], y = a.y[i];
  const c = sim.colonies[a.colony[i]];
  const W = w.W;
  const here = w.mat[y * W + x];
  // falling: unsupported ants drop
  if (!IS_LIQUID[here] && !supported(sim, x, y)) {
    if (y + 1 < w.H && !IS_SOLID[w.mat[(y + 1) * W + x]]) { moveTo(sim, i, x, y + 1); return; }
  }
  const nav = a.nav[i];
  if (nav === NAV.STAY) return;
  const big = c ? bigBody(sim, i, c) : false;
  const inWater = !!IS_LIQUID[here];
  const hx = a.hx[i], hy = a.hy[i];
  const tx = a.tx[i], ty = a.ty[i];
  const d0 = dist2(x, y, tx, ty);
  const ex = c ? c.entrance.x : x, ey = c ? c.entrance.y : y;
  const de0 = dist2(x, y, ex, ey);
  const owner = c ? c.slot + 1 : -1;
  // underground travel: follow the walking-distance field through own (and a raid target's) tunnels
  let net: Uint16Array | null = null, netHere = 0;
  if (nav === NAV.TUNNEL && c) {
    const rt = c.war?.raid.active ? sim.colonies.find((o) => o && o.alive && o.id === c.war!.raid.target) : null;
    net = tx < 0 ? sim.frontierField(c) : sim.netDist(c, tx, ty, rt ? rt.slot + 1 : 0);
    netHere = net[y * W + x];
  }
  let total = 0;
  const wts = sim.scratchW;
  for (let d = 0; d < 8; d++) {
    const nx = x + DX[d], ny = y + DY[d];
    wts[d] = 0;
    if (nx < 0 || ny < 0 || nx >= W || ny >= w.H) continue;
    const ni = ny * W + nx;
    const nm = w.mat[ni];
    let wt: number;
    if (IS_LIQUID[nm]) {
      if (!inWater && nav !== NAV.UP) continue;
      wt = 0.3;
    } else if (!canStand(sim, nx, ny, big)) {
      continue;
    } else wt = 1;
    // diagonal moves may not squeeze between two solid corners
    if (DX[d] !== 0 && DY[d] !== 0 && IS_SOLID[w.mat[y * W + nx]] && IS_SOLID[w.mat[ny * W + x]]) continue;
    if (nx === a.px[i] && ny === a.py[i]) wt *= 0.08; // avoid immediate back-steps (oscillation)
    const dot = DX[d] * hx + DY[d] * hy;
    wt *= dot > 0 ? 2.2 : dot === 0 ? 1 : 0.4;
    const occ = sim.occ[ni];
    if (occ >= 2) wt *= 0.2; else if (occ === 1) wt *= 0.7;
    switch (nav) {
      case NAV.TUNNEL: {
        const dn = net![ni];
        if (netHere) { wt *= dn && dn < netHere ? 9 : dn === netHere ? 1 : 0.1; break; }
        const d1 = dist2(nx, ny, tx, ty);
        wt *= d1 < d0 ? 7 : d1 === d0 ? 1 : 0.12;
        break;
      }
      case NAV.GOAL: case NAV.HOME: case NAV.RETRACE: case NAV.ROUTE_OUT: {
        // heading home over familiar ground: follow the colony's walking-distance field when it covers this spot
        if (nav === NAV.HOME && c && tx === ex && ty === ey) {
          const dh = sim.homeDist(c.slot, x, y);
          if (dh > 0) {
            const dn = w.owner[ni] === owner ? 1 : sim.homeDist(c.slot, nx, ny);
            wt *= dn > 0 && dn < dh ? 8 : dn === dh ? 1 : 0.12;
            break;
          }
        }
        const d1 = dist2(nx, ny, tx, ty);
        wt *= d1 < d0 ? 7 : d1 === d0 ? 1 : 0.12;
        break;
      }
      case NAV.TRAIL_OUT: {
        const t = trailAt(sim, c!, nx, ny);
        const de1 = dist2(nx, ny, ex, ey);
        wt *= (0.15 + t) * (0.15 + t) * (de1 > de0 ? 2.5 : de1 === de0 ? 1 : 0.3);
        break;
      }
      case NAV.EXPLORE: {
        const de1 = dist2(nx, ny, ex, ey);
        wt *= de1 > de0 ? 1.6 : 1;
        if (w.owner[ni] === owner) wt *= 0.6;
        break;
      }
      case NAV.NEST_CUE: {
        const o = c!.nestOdor.get(nx, ny);
        const oh = c!.nestOdor.get(x, y);
        wt *= o > oh ? 4 : o === oh ? 1 : 0.3;
        if (w.owner[ni] !== owner) wt *= 0.2;
        break;
      }
      case NAV.ALARM: {
        const o = c!.alarm.get(nx, ny);
        const oh = c!.alarm.get(x, y);
        wt *= o > oh ? 5 : o === oh ? 1 : 0.25;
        break;
      }
      case NAV.EXIT: {
        // inside its own nest an ant knows the way out (nest familiarity: distance-to-exit field)
        const dh = sim.nestDist[y * W + x];
        if (dh > 0 && w.owner[y * W + x] === owner) {
          const dn = sim.nestDist[ni];
          if (dn > 0 && dn < dh) wt *= 8;
          else if (dn === 0 && dh <= 2 && w.owner[ni] !== owner) wt *= 8; // stepping out of the entrance
          else wt *= 0.15;
        } else {
          if (DY[d] < 0) wt *= 3.5; else if (DY[d] > 0) wt *= 0.3;
          const de1 = dist2(nx, ny, ex, ey);
          wt *= de1 < de0 ? 2 : 0.7;
        }
        break;
      }
      case NAV.UP: {
        if (DY[d] < 0) wt *= 5; else if (DY[d] > 0) wt *= 0.15;
        if (!IS_LIQUID[nm]) wt *= 3;
        break;
      }
      case NAV.NEST_WANDER: {
        if (w.owner[ni] !== owner) wt *= 0.05;
        break;
      }
      case NAV.DIG_WANDER: {
        if (w.owner[ni] !== owner) wt *= 0.05;
        if (c && c.nestDepth < sim.speciesOf(c).nest.targetDepth) { if (DY[d] > 0) wt *= 2; }
        break;
      }
      case NAV.DELVE: {
        // inside a foreign nest: push away from its exits (toward brood chambers); outside: head for the goal
        const ho = w.owner[y * W + x];
        if (ho && ho !== owner) {
          if (w.owner[ni] !== ho) wt *= 0.1;
          else { const dh = sim.nestDist[y * W + x], dn = sim.nestDist[ni]; wt *= dn > dh ? 6 : dn === dh ? 1.2 : 0.35; }
        } else {
          const d1 = dist2(nx, ny, tx, ty);
          wt *= d1 < d0 ? 7 : d1 === d0 ? 1 : 0.12;
          if (w.owner[ni] && w.owner[ni] !== owner) wt *= 3;
        }
        break;
      }
    }
    wts[d] = wt;
    total += wt;
  }
  if (total <= 0) {
    // boxed in: count as stuck; if standing in a solid cell this is handled by physiology
    a.stuck[i] = Math.min(255, a.stuck[i] + 1);
    return;
  }
  let r = rng.next() * total;
  let pick = 0;
  for (let d = 0; d < 8; d++) { r -= wts[d]; if (r <= 0) { pick = d; break; } pick = d; }
  const nx = x + DX[pick], ny = y + DY[pick];
  // progress tracking for goal-directed modes
  if (nav === NAV.GOAL || nav === NAV.HOME || nav === NAV.RETRACE || nav === NAV.ROUTE_OUT) {
    if (dist2(nx, ny, tx, ty) >= d0) a.stuck[i] = Math.min(255, a.stuck[i] + 1);
    else if (a.stuck[i] > 0) a.stuck[i]--;
  } else if (nav === NAV.TRAIL_OUT) {
    // outbound trail followers must keep moving away from the nest; at a trail's end they search locally
    if (dist2(nx, ny, ex, ey) <= de0) a.stuck[i] = Math.min(255, a.stuck[i] + 1);
    else if (a.stuck[i] > 0) a.stuck[i]--;
  } else if (nav === NAV.UP) {
    // climbing toward air: no height gained counts as being stuck (e.g. shut in a pocket under fallen soil)
    if (ny >= y) a.stuck[i] = Math.min(255, a.stuck[i] + 1);
    else if (a.stuck[i] > 0) a.stuck[i]--;
  }
  if (nx <= 1 || nx >= W - 2) a.hx[i] = (nx <= 1 ? 1 : -1) as any; // world edge: turn around
  moveTo(sim, i, nx, ny);
}

export function moveTo(sim: Sim, i: number, nx: number, ny: number) {
  const a = sim.a, w = sim.w;
  if (!w.inb(nx, ny) || IS_SOLID[w.get(nx, ny)]) return;
  const oi = a.y[i] * w.W + a.x[i];
  if (sim.occ[oi] > 0) sim.occ[oi]--;
  a.hx[i] = Math.sign(nx - a.x[i]);
  a.hy[i] = Math.sign(ny - a.y[i]);
  a.x[i] = nx; a.y[i] = ny;
  const ni = ny * w.W + nx;
  if (sim.occ[ni] < 255) sim.occ[ni]++;
  a.anim[i] = (a.anim[i] + 1) & 255;
  if (a.carryBrood[i] >= 0) {
    const b = sim.broodById(a.colony[i], a.carryBrood[i]);
    if (b) { b.x = nx; b.y = ny; }
  }
  const c = sim.colonies[a.colony[i]];
  if (!c || a.caste[i] !== CASTE.WORKER && a.caste[i] !== CASTE.QUEEN) return;
  const own = w.owner[ni] === c.slot + 1;
  if (!own) {
    a.stepCount[i] = Math.min(65535, a.stepCount[i] + 1);
    // foragers and spoil carriers remember their outbound path so they can retrace it home
    if ((a.stepCount[i] % 3) === 0 && (a.task[i] === TASK.FORAGE || a.task[i] === TASK.HAUL)) a.pushMem(i, nx, ny);
  }
  // returning successful foragers reinforce the trail (surface-deposited signal)
  if (a.task[i] === TASK.RETURN && a.carry[i] && FOOD_OF[a.carry[i]] && !own) {
    const sp = sim.speciesOf(c);
    const q = a.carryQ[i];
    const dep = sp.communication.trailDeposit * a.pheno[i * 29 + P.SIGNAL] * (0.15 + 0.85 * q);
    if (dep > 0 && !IS_LIQUID[w.mat[ni]]) {
      c.trail.add(nx, ny, dep);
      a.energy[i] -= 0.00025 * a.pheno[i * 29 + P.SIGNAL];
    }
  }
}

// ---------------------------------------------------------------- per-tick update

export function updateAnt(sim: Sim, i: number) {
  const a = sim.a;
  // Collapsing terrain can bury an ant between decisions; never walk out through solids.
  if (IS_SOLID[sim.w.get(a.x[i], a.y[i])]) {
    if (!escapeSolid(sim, i)) { sim.killAnt(i, 'buried'); return; }
  }
  a.px[i] = a.x[i]; a.py[i] = a.y[i];
  // gravity applies every tick to wingless ants, even mid-task (ground dug or washed away beneath them);
  // only reproductives on their nuptial flight may be airborne
  if (a.task[i] !== TASK.FLIGHT) {
    const w = sim.w, x = a.x[i], y = a.y[i];
    if (!IS_LIQUID[w.mat[y * w.W + x]] && !supported(sim, x, y) && y + 1 < w.H && !IS_SOLID[w.mat[(y + 1) * w.W + x]]) {
      if (a.nav[i] === NAV.STAY) { a.nav[i] = NAV.NEST_WANDER; a.timer[i] = 0; }
      moveTo(sim, i, x, y + 1);
      return;
    }
  }
  if (((sim.tick + i) % DECIDE_EVERY) === 0) decide(sim, i);
  if (!a.alive[i]) return;
  // timed work (digging, feeding) holds the ant in place
  if (a.timer[i] > 0 && a.nav[i] === NAV.STAY) {
    a.timer[i]--;
    if (a.timer[i] === 0) finishWork(sim, i);
    return;
  }
  const c = sim.colonies[a.colony[i]];
  const T = sim.w.tempAt(a.x[i], a.y[i]);
  let perf = 1;
  if (c) {
    const sp = sim.speciesOf(c);
    perf = thermalPerf(T, a.pheno[i * 29 + P.TOPT], a.pheno[i * 29 + P.TBREADTH], sp.traits.tbreadth);
    if (T < sp.tolerances.coldMin + 2) perf *= 0.1; // chill coma approach
  }
  let speed = a.pheno[i * 29 + P.SPEED] * (0.25 + 0.75 * Math.min(1, perf)) * (a.energy[i] < 0.1 ? 0.4 : 1);
  if(sim.w.adhesiveCells)speed*=1-.8*sim.w.localAdhesion(a.x[i],a.y[i]);
  if (a.caste[i] === CASTE.QUEEN) speed *= 0.6;
  if (IS_LIQUID[sim.w.mat[a.y[i] * sim.w.W + a.x[i]]]) speed *= 0.35;
  if (a.carry[i]) speed *= 0.85;
  a.moveAcc[i] += speed;
  while (a.moveAcc[i] >= 1) {
    a.moveAcc[i] -= 1;
    step(sim, i);
    afterStep(sim, i);
  }
  if (((sim.tick + i) % PHYS_EVERY) === 0) physiology(sim, i);
}

/** Checks that happen right after moving: arrivals at goals, food pickup, delivery. */
function afterStep(sim: Sim, i: number) {
  const a = sim.a;
  const x = a.x[i], y = a.y[i];
  const c = sim.colonies[a.colony[i]];
  if (!c) return;
  const nav = a.nav[i];
  if (nav === NAV.RETRACE) {
    if (dist2(x, y, a.tx[i], a.ty[i]) <= 2) nextRetraceWaypoint(sim, i);
  } else if (nav === NAV.ROUTE_OUT) {
    if (dist2(x, y, a.tx[i], a.ty[i]) <= 2) {
      const k = a.frIdx[i] + 1;
      if (k < a.frLen[i]) { a.frIdx[i] = k; a.tx[i] = a.frX[i * MEM + k]; a.ty[i] = a.frY[i * MEM + k]; a.stuck[i] = 0; }
      else { a.nav[i] = NAV.EXPLORE; a.timer[i] = 0; arrivedAtRememberedFood(sim, i); }
    }
  }
  const task = a.task[i];
  if ((task === TASK.FORAGE || task === TASK.QUEEN_FORAGE) && !a.carry[i]) tryPickFood(sim, i, c);
  else if (task === TASK.RETURN && inOwnNest(sim, i) && y >= c.entrance.y + 2) deliver(sim, i, c);
}

function nextRetraceWaypoint(sim: Sim, i: number) {
  const a = sim.a;
  const len = a.memLen[i];
  if (len > 0) {
    a.memLen[i] = len - 1;
    if (len - 1 > 0) { a.tx[i] = a.memX[i * MEM + len - 2]; a.ty[i] = a.memY[i * MEM + len - 2]; a.stuck[i] = 0; return; }
  }
  const c = sim.colonies[a.colony[i]]!;
  a.nav[i] = NAV.HOME;
  a.tx[i] = c.entrance.x; a.ty[i] = c.entrance.y;
  a.stuck[i] = 0;
}

function arrivedAtRememberedFood(sim: Sim, i: number) {
  const a = sim.a;
  const c = sim.colonies[a.colony[i]]!;
  if (findFoodNear(sim, i, c, 3) < 0) {
    a.fails[i]++;
    if (a.fails[i] >= 2) {
      a.frLen[i] = 0; a.frTrips[i] = 0; a.fails[i] = 0;
      a.why[i] = WHY.MEMORY_FAILED;
      sim.noteMemoryFailure(c);
    } else a.why[i] = WHY.SCOUT;
  }
}

// ---------------------------------------------------------------- food

function foodWanted(sim: Sim, c: Colony, m: number): number {
  const f = FOOD_OF[m];
  if (!f) {
    if (m === M.CORPSE) return sim.speciesOf(c).nutrition.preference.protein * 0.6;
    return 0;
  }
  const p = sim.speciesOf(c).nutrition.preference;
  const need = c.stim;
  const pref = f === 1 ? p.sugar : f === 2 ? p.protein : p.seed;
  // protein becomes more attractive when larvae are hungry or the protein store is empty;
  // sugar less so once the sugar store already covers the adults
  if (f === 2) return pref * (0.6 + need.nurse + (c.store.protein < 2 + c.brood.length * 0.5 ? 1.2 : 0));
  if (f === 1 && c.store.sugar > 6 + c.adults * 1.5) return pref * 0.4;
  return pref;
}

/** Search for food within radius r with line of sight through open cells. Returns cell index or -1. */
function findFoodNear(sim: Sim, i: number, c: Colony, r: number): number {
  const a = sim.a, w = sim.w;
  const x0 = a.x[i], y0 = a.y[i];
  let best = -1, bestS = 0;
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) {
      const x = x0 + dx, y = y0 + dy;
      if (x < 0 || y < 0 || x >= w.W || y >= w.H) continue;
      const k = y * w.W + x;
      const m = w.mat[k];
      const want = foodWanted(sim, c, m);
      if (want <= 0) continue;
      if (m === M.CORPSE && w.owner[k] === c.slot + 1) continue; // own dead are waste, not food
      if (w.toxin[k] > 40) continue;
      if (Math.max(Math.abs(dx), Math.abs(dy)) > 1 && !lineOpen(sim, x0, y0, x, y)) continue;
      const s = want / (1 + dx * dx + dy * dy);
      if (s > bestS) { bestS = s; best = k; }
    }
  return best;
}

function lineOpen(sim: Sim, x0: number, y0: number, x1: number, y1: number): boolean {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let s = 1; s < n; s++) {
    const x = Math.round(x0 + ((x1 - x0) * s) / n), y = Math.round(y0 + ((y1 - y0) * s) / n);
    if (IS_SOLID[sim.w.get(x, y)]) return false;
  }
  return true;
}

function tryPickFood(sim: Sim, i: number, c: Colony) {
  const a = sim.a, w = sim.w;
  const r = Math.max(1, Math.min(3, Math.round(a.pheno[i * 29 + P.SENSORY] * 1.6)));
  const k = findFoodNear(sim, i, c, r);
  if (k < 0) return;
  const fx = k % w.W, fy = (k / w.W) | 0;
  if (Math.max(Math.abs(fx - a.x[i]), Math.abs(fy - a.y[i])) > 1) {
    // food sensed nearby: steer toward it
    a.nav[i] = NAV.GOAL; a.tx[i] = fx; a.ty[i] = fy;
    return;
  }
  // a hungry forager feeds at the source before loading up (it drinks at the honeydew drop)
  if (a.energy[i] < 0.5 && a.task[i] !== TASK.QUEEN_FORAGE && feedOutside(sim, i, c) && !FOOD_OF[w.mat[k]] && w.mat[k] !== M.CORPSE) return;
  const m = w.mat[k];
  let carried: number = m;
  let q: number;
  if (m === M.CORPSE) {
    // scavenging a non-nestmate corpse: it becomes a protein load (ledgered source)
    w.ledger.source('protein', 'scavenged corpse', 1);
    sim.setCell(k, M.AIR, 0, 'scavenged');
    carried = M.PROTEIN;
    q = 0.4;
  } else {
    const units = w.amt[k];
    const cap = MATERIALS[m].foodUnits;
    // perceived quality: what remains at the source and in the surrounding patch
    let patch = 0;
    for (let d = 0; d < 8; d++) {
      const mm = w.get(fx + DX[d], fy + DY[d]);
      if (mm === m) patch++;
    }
    q = Math.min(1, ((units - 1) / cap) * 0.6 + patch / 8 * 0.6);
    if (units <= 1) sim.setCell(k, M.AIR, 0, 'picked');
    else { w.amt[k] = units - 1; w.touch(fx, fy); }
    if (w.toxin[k] > 0) a.health[i] -= 0.1;
  }
  a.carry[i] = carried;
  a.carryQ[i] = q;
  sim.carriedFood[FOOD_OF[carried] - 1]++;
  a.fails[i] = 0;
  if (a.task[i] === TASK.QUEEN_FORAGE) {
    a.nav[i] = NAV.HOME; a.tx[i] = c.entrance.x; a.ty[i] = c.entrance.y; a.stuck[i] = 0;
    return;
  }
  a.task[i] = TASK.RETURN;
  a.why[i] = WHY.RETURN_FOOD_TRAIL;
  brainReward(sim, i, (0.2 + 0.2 * q) * Math.min(1, 0.1 + 1.5 * c.stim.forage));
  a.pushMem(i, a.x[i], a.y[i]);
  a.saveFoodRoute(i);
  a.frTrips[i] = Math.min(255, a.frTrips[i] + 1);
  startRetrace(sim, i, c);
  sim.journalFoodFound(c, fx, fy);
  onFoodFound(sim, c, i, MATERIALS[carried].name.toLowerCase());
}

function startRetrace(sim: Sim, i: number, c: Colony) {
  const a = sim.a;
  const len = a.memLen[i];
  if (len > 0) {
    a.nav[i] = NAV.RETRACE;
    a.tx[i] = a.memX[i * MEM + len - 1]; a.ty[i] = a.memY[i * MEM + len - 1];
  } else {
    a.nav[i] = NAV.HOME; a.tx[i] = c.entrance.x; a.ty[i] = c.entrance.y;
  }
  a.stuck[i] = 0;
}

function deliver(sim: Sim, i: number, c: Colony) {
  const a = sim.a;
  if (a.carry[i] && FOOD_OF[a.carry[i]]) {
    const f = FOOD_OF[a.carry[i]];
    sim.carriedFood[f - 1]--;
    if (f === 1) c.store.sugar++; else if (f === 2) c.store.protein++; else c.store.seed++;
    c.stats.foodIn[f - 1]++;
    const food = MATERIALS[a.carry[i]].name.toLowerCase();
    a.carry[i] = 0;
    sim.recordDelivery(c, a.carryQ[i]);
    // food is worth what the colony needs: a full larder makes more foraging pointless, and the brain learns that
    brainReward(sim, i, (0.6 + 0.6 * a.carryQ[i]) * Math.min(1, 0.1 + 1.5 * c.stim.forage));
    // contact information: nearby nestmates register a returning successful forager
    sim.idx.query(a, a.x[i], a.y[i], 3, (j) => {
      if (j !== i && a.colony[j] === a.colony[i] && a.caste[j] === CASTE.WORKER) a.contacts[j] = Math.min(6, a.contacts[j] + 1);
    });
    reportFind(sim, i, c, food);
  }
  a.memLen[i] = 0;
  a.stepCount[i] = 0;
  a.task[i] = TASK.IDLE;
  a.nav[i] = NAV.NEST_WANDER;
  a.timer[i] = 0;
}

/**
 * A forager back from a good source "reports" it: resting nestmates it touches inside the nest may be
 * recruited and set out along its remembered route (an abstraction of group/tandem recruitment and of
 * recruits learning the way; mass recruiters additionally follow its trail). Only ants in contact are told.
 */
function reportFind(sim: Sim, i: number, c: Colony, food: string) {
  const a = sim.a, len = a.frLen[i];
  const sp = sim.speciesOf(c), act = sp.activity;
  if (len < 2 || a.carryQ[i] < 0.25 || !c.hasExit || c.stim.forage < 0.1) return;
  if (sim.airT > act.maxForageTemp || sim.airT < act.minForageTemp || (act.diurnal && !sim.daytime)) return;
  const share = sp.communication.recruitment === 'mass' ? 0.3 : 0.15;
  const max = 1 + Math.round(3 * a.carryQ[i] * Math.min(1, c.stim.forage * 2));
  let n = 0;
  sim.idx.query(a, a.x[i], a.y[i], 3, (j) => {
    if (n >= max || j === i || a.colony[j] !== a.colony[i] || a.caste[j] !== CASTE.WORKER || a.task[j] !== TASK.IDLE) return;
    if (a.major[j] || a.carry[j] || a.carryBrood[j] >= 0 || a.age[j] < 1 || !inOwnNest(sim, j) || !sim.rng.chance(share)) return;
    const o = j * MEM, s = i * MEM;
    for (let k = 0; k < len; k++) { a.frX[o + k] = a.frX[s + k]; a.frY[o + k] = a.frY[s + k]; }
    a.frLen[j] = len; a.frTrips[j] = 0; a.fails[j] = 0;
    startForage(sim, j, c);
    a.why[j] = WHY.CONTACT_RECRUITED;
    n++;
  });
  if (n && a.frTrips[i] <= 1 && sim.tick - (c.lastReport ?? -1e9) > 900) {
    c.lastReport = sim.tick;
    sim.event('recruit', `${c.name}: a scout reported ${food} at x=${a.frX[i * MEM + len - 1]} and led ${n} nestmate${n === 1 ? '' : 's'} out to it.`, c);
  }
}

// ---------------------------------------------------------------- decisions

function stimulus(s: number, theta: number) {
  const s2 = s * s;
  return s2 / (s2 + theta * theta + 1e-9);
}

function decide(sim: Sim, i: number) {
  const a = sim.a;
  // busy with timed work (digging, feeding): keep working unless submerged
  if (a.timer[i] > 0 && a.nav[i] === NAV.STAY && !IS_LIQUID[sim.w.mat[a.y[i] * sim.w.W + a.x[i]]]) return;
  const caste = a.caste[i];
  if (caste === CASTE.QUEEN) return decideQueen(sim, i);
  if (caste === CASTE.MALE || caste === CASTE.GYNE) return decideAlate(sim, i);
  const c = sim.colonies[a.colony[i]];
  if (!c) return;
  const w = sim.w;
  const sp = sim.speciesOf(c);
  const x = a.x[i], y = a.y[i];
  const ci = y * w.W + x;
  a.contacts[i] *= sp.communication.returnRateRegulation ? 0.93 : 0.97;
  // boredom drive: builds while idle, is relieved by doing something
  a.bored[i] = a.task[i] === TASK.IDLE ? Math.min(1, a.bored[i] + 0.0015) : Math.max(0, a.bored[i] - 0.008);
  // --- overrides: survival first (brainstem reflexes the brain cannot veto) ---
  if (IS_LIQUID[w.mat[ci]]) {
    a.task[i] = a.carryBrood[i] >= 0 ? TASK.CARRY_BROOD : TASK.ESCAPE;
    a.why[i] = WHY.SUBMERGED; a.nav[i] = NAV.UP; a.timer[i] = 0;
    return;
  }
  if (a.task[i] === TASK.ESCAPE) { a.task[i] = TASK.IDLE; a.nav[i] = NAV.NEST_WANDER; }
  const own = w.owner[ci] === c.slot + 1;
  // shut in a shallow pocket outside any nest (buried by spoil or a slump): climb, then dig toward the surface
  if (a.why[i] === WHY.DIG_OUT) {
    if (own || w.skyExposed(x, y)) {
      a.why[i] = WHY.NONE; a.stuck[i] = 0;
      if (a.task[i] === TASK.FORAGE) a.nav[i] = NAV.EXPLORE; else { a.nav[i] = NAV.HOME; a.tx[i] = c.entrance.x; a.ty[i] = c.entrance.y; }
    } else if (a.stuck[i] > 8 && startDigOut(sim, i)) return;
    else { a.nav[i] = NAV.UP; return; }
  } else if (!own && !w.owner[ci] && a.stuck[i] > 8 && y - w.surface[x] <= 12 && !w.skyExposed(x, y) && !isWarTask(a.task[i])) {
    a.why[i] = WHY.DIG_OUT; a.nav[i] = NAV.UP; a.stuck[i] = 0;
    return;
  }
  // blocked on the way home by loose spoil: shove through it toward the goal
  const nv = a.nav[i];
  if (!own && a.stuck[i] > 20 && (nv === NAV.HOME || nv === NAV.RETRACE || nv === NAV.GOAL) && startDigOut(sim, i, Math.sign(a.tx[i] - x))) return;
  // locked out: fallen soil plugs the entrance from outside; dig back in (not while the colony holds a siege plug)
  if (!own && a.stuck[i] > 30 && a.task[i] !== TASK.HAUL && !isWarTask(a.task[i]) && dist2(x, y, c.entrance.x, c.entrance.y) <= 25 && !underSiege(sim, c) && startDigIn(sim, i, c)) return;
  // starving away from the nest: eat the carried load or adjacent food rather than die with food in reach
  if (!own && a.energy[i] < 0.15 && feedOutside(sim, i, c) && a.task[i] !== TASK.HAUL) a.why[i] = WHY.ATE_OUTSIDE;
  // combat / alarm
  const alarm = c.alarm.get(x, y);
  if (a.fightTarget[i] >= 0) return; // engaged; contact phase resolves
  // minors answer weak alarm; majors ignore it but respond en masse to strong, sustained alarm
  // (quantitative differences in recruitment: Detrain & Pasteels 1992)
  const major = a.major[i] === 1;
  if (a.task[i] === TASK.DEFEND && alarm > (major ? 0.6 : 0.3)) a.timer[i] = Math.max(a.timer[i], major ? 80 : 40); // still under attack: keep defending
  else if (alarm > (major ? 0.6 : 0.3) && a.task[i] !== TASK.FLEE && a.task[i] !== TASK.DEFEND && a.task[i] !== TASK.CARRY_BROOD && !a.carry[i] && !isWarTask(a.task[i]) && sim.rng.chance(0.35)) {
    // the brain weighs answering the alarm against carrying on; species aggression, culture, personality
    // and caste add an innate bias to its learnt values
    const thr = 0.6 * a.thrL[i * 4 + 3] / (0.5 + sp.aggression * cultureAggression(c)) * (major ? 0.4 : 1) / persona(a.id[i], 'brave');
    const sx = senses(sim, i, c);
    const cur = a.brainA[i] !== NO_ACT && a.brainA[i] !== ACT.DEFEND ? a.brainA[i] : ACT.REST;
    if (prefers(sim, c, i, sx, ACT.DEFEND, cur, 4 * (stimulus(alarm, thr) - 0.5))) {
      think(sim, c, i, sx, ALL_ACTS, ACT.DEFEND);
      a.task[i] = TASK.DEFEND; a.why[i] = major ? WHY.MAJOR_RECRUITED : WHY.DEFEND_ALARM; a.nav[i] = NAV.ALARM; a.timer[i] = major ? 80 : 40;
      a.thrL[i * 4 + 3] = Math.max(0.5, a.thrL[i * 4 + 3] * 0.98);
      return;
    }
  }
  // hunger reflex: workers inside the nest feed from stores whatever they are doing once close to starving
  // (above this the brain decides when to eat)
  if (own && a.energy[i] < 0.22 && sim.feedAdult(c, i)) a.why[i] = WHY.ENERGY;
  // thirst
  if (a.hydration[i] < 0.3 && !a.carry[i] && a.task[i] !== TASK.DRINK && a.carryBrood[i] < 0) {
    a.task[i] = TASK.DRINK; a.why[i] = WHY.THIRST; a.nav[i] = own ? NAV.NEST_WANDER : NAV.EXPLORE; a.timer[i] = 300;
  }
  switch (a.task[i]) {
    case TASK.DRINK: {
      if (tryDrink(sim, i)) {
        if (a.hydration[i] > 0.8) { a.task[i] = TASK.IDLE; a.nav[i] = own ? NAV.NEST_WANDER : NAV.HOME; }
      } else if (--a.timer[i] <= 0) { a.task[i] = TASK.IDLE; }
      return;
    }
    case TASK.FORAGE: return decideForage(sim, i, c, own);
    case TASK.RETURN: {
      if (a.nav[i] === NAV.RETRACE && a.stuck[i] > 30) {
        // remembered route no longer works (terrain changed?): discard memory and home directly
        a.memLen[i] = 0; a.frLen[i] = 0; a.why[i] = WHY.ROUTE_BLOCKED;
        a.nav[i] = NAV.HOME; a.tx[i] = c.entrance.x; a.ty[i] = c.entrance.y; a.stuck[i] = 0;
        sim.noteRouteBlocked(c);
      } else if (a.nav[i] === NAV.HOME && own) {
        a.nav[i] = NAV.NEST_CUE;
      } else if (a.nav[i] === NAV.HOME && a.stuck[i] > 60) {
        a.nav[i] = NAV.WANDER; a.stuck[i] = 0;
      } else if ((a.nav[i] === NAV.EXPLORE || a.nav[i] === NAV.WANDER) && sim.rng.chance(0.1)) {
        a.nav[i] = NAV.HOME; a.tx[i] = c.entrance.x; a.ty[i] = c.entrance.y;
      } else if (a.nav[i] === NAV.NEST_CUE && !own) {
        a.nav[i] = NAV.HOME; a.tx[i] = c.entrance.x; a.ty[i] = c.entrance.y;
      }
      if (own && !a.carry[i]) deliver(sim, i, c);
      return;
    }
    case TASK.DIG: return decideDig(sim, i, c, own);
    case TASK.HAUL: return decideHaul(sim, i, c, own);
    case TASK.NURSE: return decideNurse(sim, i, c, own);
    case TASK.CARRY_BROOD: return decideCarryBrood(sim, i, c);
    case TASK.WASTE: return decideWaste(sim, i, c, own);
    case TASK.GUARD: case TASK.WAR: case TASK.RAID: return decideWarTask(sim, i, c, own);
    case TASK.DEFEND: {
      if (--a.timer[i] <= 0 || alarm < 0.05) { a.task[i] = TASK.IDLE; a.nav[i] = own ? NAV.NEST_WANDER : NAV.HOME; a.tx[i] = c.entrance.x; a.ty[i] = c.entrance.y; }
      return;
    }
    case TASK.FLEE: {
      if (own || --a.timer[i] <= 0) { a.task[i] = TASK.IDLE; a.nav[i] = NAV.NEST_WANDER; }
      return;
    }
  }
  // --- IDLE: choose a task by response thresholds ---
  if (!own) {
    // idle outside the nest: go home, detouring for a while when the direct line is blocked
    // (the detour is an undirected wander: exploring would push it further from the nest)
    if (a.nav[i] === NAV.RETRACE && a.stuck[i] <= 30) return; // following its own outbound path back
    if (a.nav[i] === NAV.HOME && a.stuck[i] > 40) { a.nav[i] = NAV.WANDER; a.stuck[i] = 0; }
    else if (a.nav[i] !== NAV.WANDER || sim.rng.chance(0.15)) { a.nav[i] = NAV.HOME; a.tx[i] = c.entrance.x; a.ty[i] = c.entrance.y; }
    if (a.carry[i] && !FOOD_OF[a.carry[i]]) { a.task[i] = TASK.HAUL; }
    return;
  }
  if (a.energy[i] < 0.3) {
    if (sim.feedAdult(c, i)) { a.why[i] = WHY.ENERGY; return; }
  }
  if (a.hydration[i] < 0.45) tryDrink(sim, i);
  // resting workers sample task stimuli only occasionally (roughly every 2 game-minutes)
  if (a.task[i] === TASK.IDLE && a.why[i] !== WHY.NONE && !sim.rng.chance(0.12)) return;
  chooseTask(sim, i, c);
}

/**
 * Task cues as perceived by this worker: colony stimuli seen through its inherited response thresholds,
 * personality, age and recent contacts. Written into the brain's sensory neurons. Returns the reason
 * foraging is impossible right now (WHY code) or 0.
 */
function taskCues(sim: Sim, i: number, c: Colony, out: Float32Array): number {
  const a = sim.a;
  const sp = sim.speciesOf(c);
  const o = i * 29;
  const ageFrac = a.age[i] / sp.workers.lifespanDays;
  // age polyethism: young (callow) workers bias to in-nest work, older to foraging;
  // strong colony hunger overrides the bias
  const young = a.age[i] < 3 && c.stim.forage < 0.6 ? 1 : 0;
  const thr = (k: number, base: number) => base * a.thrL[i * 4 + k];
  const s = c.stim;
  let forageS = s.forage * (young ? 0.35 : 1 + Math.min(0.8, ageFrac));
  if (sp.communication.returnRateRegulation) forageS *= 0.25 + 0.5 * a.contacts[i] + a.pheno[o + P.EXPLORE] * 0.5;
  else forageS *= 1 + 0.3 * a.contacts[i];
  const surfT = sim.airT;
  let blocked: number = 0;
  if (surfT > sp.activity.maxForageTemp) blocked = WHY.TOO_HOT;
  else if (surfT < sp.activity.minForageTemp) blocked = WHY.TOO_COLD;
  else if (sp.activity.diurnal && !sim.daytime) blocked = WHY.NIGHT;
  if (blocked) forageS = 0;
  if (!c.hasExit) forageS = 0;
  const priority = c.society?.priority ?? workPriority(c);
  if (priority === 'forage') forageS *= 1.3;
  forageS *= forageFactor(c) * persona(a.id[i], 'forage');
  const nurseS = (priority === 'nurse' ? 1.3 : 1) * s.nurse * (young ? 2 : 1) * persona(a.id[i], 'nurse');
  const digS = (priority === 'dig' ? 1.3 : 1) * Math.max(s.dig, s.exit * 2, planDigStimulus(c)) * persona(a.id[i], 'dig');
  out[S.FORAGE_CUE] = stimulus(forageS, thr(0, a.pheno[o + P.THR_FORAGE]));
  out[S.NURSE_CUE] = stimulus(nurseS, thr(1, a.pheno[o + P.THR_NURSE]));
  out[S.DIG_CUE] = stimulus(digS, thr(2, a.pheno[o + P.THR_DIG]));
  out[S.WASTE_CUE] = stimulus(s.waste, 0.4);
  return blocked;
}

const SENSE = new Float32Array(NI);
let sensedBlocked = 0;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** Fill the brain's sensory neurons for worker i (drives first, then local cues). */
export function senses(sim: Sim, i: number, c: Colony, out: Float32Array = SENSE): Float32Array {
  const a = sim.a, w = sim.w, x = a.x[i], y = a.y[i];
  sensedBlocked = taskCues(sim, i, c, out);
  out[S.HUNGER] = 1 - clamp01(a.energy[i]);
  out[S.THIRST] = 1 - clamp01(a.hydration[i]);
  out[S.PAIN] = 1 - clamp01(a.health[i]);
  out[S.FEAR] = Math.min(1, c.alarm.get(x, y) * 1.5);
  out[S.BOREDOM] = a.bored[i];
  out[S.STORES] = Math.min(1, (c.store.sugar + c.store.protein + c.store.seed) / (2 + c.adults * 1.5));
  out[S.RIVALS] = sim.idx.hasForeign(x, y, 4, a.colony[i]) ? 1 : 0;
  out[S.CONTACTS] = Math.min(1, a.contacts[i] / 3);
  out[S.DAYLIGHT] = sim.daytime ? 1 : 0;
  out[S.YOUNG] = a.age[i] < 3 ? 1 : 0;
  out[S.ROUTE] = a.frLen[i] > 1 ? 1 : 0;
  out[S.IN_NEST] = w.owner[y * w.W + x] === c.slot + 1 ? 1 : 0;
  out[S.CARRYING] = a.carry[i] || a.carryBrood[i] >= 0 ? 1 : 0;
  return out;
}
const ALL_ACTS = (1 << NA) - 1;

/** An idle worker in the nest asks its brain what to do next; the chosen verb runs an existing motor program. */
function chooseTask(sim: Sim, i: number, c: Colony) {
  const a = sim.a, rng = sim.rng;
  const s = c.stim;
  const x = senses(sim, i, c);
  const blocked = sensedBlocked;
  let mask = actMask(ACT.REST, ACT.NURSE, ACT.DIG, ACT.CLEAN, ACT.DRINK);
  if (!blocked && c.hasExit) mask |= 1 << ACT.FORAGE;
  // eating is offered only when hungry enough to benefit (no grazing on the stores out of boredom)
  if (c.store.sugar + c.store.protein + c.store.seed > 0 && a.energy[i] < 0.65) mask |= 1 << ACT.EAT;
  if (x[S.FEAR] > 0.05) mask |= 1 << ACT.DEFEND;
  const chosen = think(sim, c, i, x, mask);
  // response-threshold reinforcement still tunes how strongly each cue is felt (Theraulaz et al. 1998)
  const k0 = chosen === ACT.FORAGE ? 0 : chosen === ACT.NURSE ? 1 : chosen === ACT.DIG ? 2 : -1;
  for (let k = 0; k < 3; k++) {
    const idx = i * 4 + k;
    a.thrL[idx] = k === k0 ? Math.max(0.5, a.thrL[idx] * 0.97) : Math.min(2, a.thrL[idx] * 1.002);
  }
  switch (chosen) {
    case ACT.FORAGE: startForage(sim, i, c); break;
    case ACT.NURSE: a.task[i] = TASK.NURSE; a.why[i] = WHY.NURSE_HUNGRY; a.timer[i] = 0; a.fightTarget[i] = -1; a.nav[i] = NAV.NEST_CUE; break;
    case ACT.DIG:
      a.task[i] = TASK.DIG; a.why[i] = s.exit > 0 ? WHY.DIG_EXIT : WHY.DIG_CROWD; a.nav[i] = s.exit > 0 ? NAV.EXIT : NAV.DIG_WANDER; a.timer[i] = 0;
      a.tx[i] = 0; break;
    case ACT.CLEAN: a.task[i] = TASK.WASTE; a.why[i] = WHY.WASTE; a.nav[i] = NAV.NEST_WANDER; a.timer[i] = 400; break;
    case ACT.EAT:
      a.task[i] = TASK.IDLE; a.nav[i] = NAV.NEST_WANDER;
      a.why[i] = sim.feedAdult(c, i) ? WHY.BRAIN_EAT : WHY.IDLE_LOW_STIM;
      break;
    case ACT.DRINK: a.task[i] = TASK.DRINK; a.why[i] = WHY.THIRST; a.nav[i] = NAV.NEST_WANDER; a.timer[i] = 300; break;
    case ACT.DEFEND: a.task[i] = TASK.DEFEND; a.why[i] = WHY.DEFEND_ALARM; a.nav[i] = NAV.ALARM; a.timer[i] = 40; break;
    default:
      a.task[i] = TASK.IDLE; a.why[i] = blocked && s.forage > 0.3 ? blocked : WHY.BRAIN_REST;
      a.nav[i] = rng.chance(0.3) ? NAV.NEST_CUE : NAV.NEST_WANDER;
      // majors wait near the brood and queen: an in-nest reserve that is cheap to keep idle
      if (a.major[i]) { a.why[i] = WHY.MAJOR_STANDBY; a.nav[i] = rng.chance(0.7) ? NAV.NEST_CUE : NAV.STAY; a.timer[i] = 0; }
  }
}

function startForage(sim: Sim, i: number, c: Colony) {
  const a = sim.a;
  a.task[i] = TASK.FORAGE;
  a.memLen[i] = 0;
  a.stepCount[i] = 0;
  a.timer[i] = 0;
  a.nav[i] = NAV.EXIT;
  a.tx[i] = c.entrance.x; a.ty[i] = c.entrance.y;
  a.why[i] = a.contacts[i] > 0.8 ? WHY.CONTACT_RECRUITED : WHY.SCOUT;
}

function decideForage(sim: Sim, i: number, c: Colony, own: boolean) {
  const a = sim.a, rng = sim.rng;
  const o = i * 29;
  if (a.energy[i] < 0.2) { returnHome(sim, i, c, WHY.RETURN_HUNGRY); return; }
  if (own && (a.nav[i] === NAV.EXIT || a.stepCount[i] === 0)) {
    // still inside and has not left yet: head for the exit
    if (a.nav[i] !== NAV.EXIT) { a.nav[i] = NAV.EXIT; a.tx[i] = c.entrance.x; a.ty[i] = c.entrance.y; }
    if (a.stuck[i] > 80) { a.task[i] = TASK.IDLE; a.stuck[i] = 0; }
    return;
  }
  // first decision outside: choose information source
  const maxSteps = (500 + 2200 * a.pheno[o + P.EXPLORE]) * persona(a.id[i], 'explore');
  if (a.stepCount[i] > maxSteps) { returnHome(sim, i, c, WHY.RETURN_EMPTY); return; }
  const nav = a.nav[i];
  if (nav === NAV.EXIT || nav === NAV.GOAL && a.stepCount[i] < 2) {
    a.pushMem(i, a.x[i], a.y[i]);
    // when the brood lacks protein, some foragers leave their (usually sugar) route and scout for prey instead
    const proteinShort = c.store.protein < 2 + c.brood.length * 0.5 && c.brood.length > 0;
    if (a.frLen[i] > 1 && !(proteinShort && rng.chance(0.4))) {
      // private route memory dominates over trail information (Grueter et al. 2011)
      a.nav[i] = NAV.ROUTE_OUT; a.frIdx[i] = 0; a.tx[i] = a.frX[i * MEM]; a.ty[i] = a.frY[i * MEM]; a.why[i] = WHY.MEMORY_OUT; a.stuck[i] = 0;
      return;
    }
    a.nav[i] = NAV.EXPLORE; a.why[i] = WHY.SCOUT;
  }
  if (a.nav[i] === NAV.ROUTE_OUT && a.stuck[i] > 30) {
    a.frLen[i] = 0; a.nav[i] = NAV.EXPLORE; a.why[i] = WHY.ROUTE_BLOCKED; a.stuck[i] = 0;
    sim.noteRouteBlocked(c);
  }
  if (a.nav[i] === NAV.GOAL && a.stuck[i] > 15) { a.nav[i] = NAV.EXPLORE; a.stuck[i] = 0; }
  if (a.nav[i] === NAV.TRAIL_OUT && a.stuck[i] > 12) {
    // end of the trail (or it leads nowhere further): search locally from here
    a.nav[i] = NAV.EXPLORE; a.why[i] = WHY.SCOUT; a.stuck[i] = 0; a.timer[i] = 60;
    if (rng.chance(0.5)) a.hx[i] = -a.hx[i] as any;
    return;
  }
  if (a.nav[i] === NAV.EXPLORE || a.nav[i] === NAV.TRAIL_OUT) {
    // trail following: probability depends on detected strength, sensitivity and fidelity
    const t = trailAt(sim, c, a.x[i], a.y[i]);
    const detect = 0.05 / a.pheno[o + P.SENSORY];
    if (a.nav[i] === NAV.EXPLORE && a.timer[i] > 0) { a.timer[i]--; return; } // local search after losing a trail
    if (t > detect) {
      const follow = a.pheno[o + P.FIDELITY] * (t / (t + 0.5));
      if (a.nav[i] === NAV.EXPLORE && rng.chance(follow)) { a.nav[i] = NAV.TRAIL_OUT; a.why[i] = WHY.TRAIL_OUT; }
    } else if (a.nav[i] === NAV.TRAIL_OUT) {
      // lost the trail (it faded, or this is its end): search locally; sometimes U-turn
      a.nav[i] = NAV.EXPLORE; a.why[i] = WHY.SCOUT;
      if (rng.chance(0.25)) { a.hx[i] = -a.hx[i] as any; }
    }
  }
}

function returnHome(sim: Sim, i: number, c: Colony, why: number) {
  const a = sim.a;
  a.task[i] = TASK.RETURN;
  a.why[i] = why;
  if (why === WHY.RETURN_EMPTY && a.frLen[i] > 0 && a.nav[i] === NAV.ROUTE_OUT) {
    a.fails[i]++;
    if (a.fails[i] >= 2) { a.frLen[i] = 0; a.fails[i] = 0; }
  }
  startRetrace(sim, i, c);
}

function tryDrink(sim: Sim, i: number): boolean {
  const a = sim.a, w = sim.w;
  const x = a.x[i], y = a.y[i];
  for (let d = 0; d < 8; d++) {
    const nx = x + DX[d], ny = y + DY[d];
    if (!w.inb(nx, ny)) continue;
    const k = ny * w.W + nx;
    const m = w.mat[k];
    if (m === M.WATER && w.amt[k] > 0) {
      w.amt[k]--;
      w.ledger.sink('water', 'drunk by ants', 1);
      if (w.amt[k] === 0) sim.setCell(k, M.AIR, 0, 'drunk');
      else w.touch(nx, ny);
      a.hydration[i] = Math.min(1, a.hydration[i] + 0.2);
      return true;
    }
    if (MOIST_CAP[m] > 0 && w.moist[k] > MOIST_CAP[m] * 0.1) {
      w.moist[k]--;
      w.ledger.sink('water', 'drunk by ants', 1);
      a.hydration[i] = Math.min(1, a.hydration[i] + 0.12);
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------- digging

function digScore(sim: Sim, c: Colony, x: number, y: number, dy: number, exitMode: boolean): number {
  const w = sim.w;
  if (!w.inb(x, y)) return 0;
  const k = y * w.W + x;
  const m = w.mat[k];
  if (!DIG_RESIST[m]) return 0;
  if (m === M.SUGAR || m === M.PROTEIN || m === M.SEED || m === M.CORPSE) return 0;
  const plug = (w.flags[k] & FLAG_PLUG) !== 0;
  // never dig into water: check neighbours
  for (let d = 0; d < 8; d++) if (w.get(x + DX[d], y + DY[d]) === M.WATER) return 0;
  const cap = MOIST_CAP[m];
  // saturated cohesive soil is avoided (unstable), but loose fill blocking a passage is always cleared
  if (cap > 0 && w.moist[k] >= cap - 2 && m !== M.LOOSE && m !== M.SAND && !exitMode) return 0.05;
  let air = 0;
  for (let d = 0; d < 8; d++) if (isOpen(w.get(x + DX[d], y + DY[d]))) air++;
  let s = MATERIALS[m].chamberSuitability + 0.2;
  const sp = sim.speciesOf(c);
  if (exitMode) {
    s *= dy < 0 ? 6 : dy === 0 ? 1 : 0.1;
    if (plug) s *= 10;
  } else {
    if (plug) return 0;
    const depthBelow = y - c.entrance.y;
    // the nest template: planned shafts may open the surface; planned chambers keep a two-cell roof
    const pk = planKind(sim, c, k);
    if (pk === 2 || (pk === 1 && y >= w.surface[x] + 2)) {
      s *= 8 * (1 + 3 * c.digCue.get(x, y - dy));
      return dy < 0 && pk === 1 ? s * 0.6 : s;
    }
    // with a template, workers only dig what it calls for: narrow tunnels and distinct chambers, not a cave
    if (c.plan) return 0;
    // keep the entrance shaft narrow: no widening in the top rows below the surface
    if (depthBelow < 5 || y <= w.surface[x] + 3) return 0;
    const deeper = c.nestDepth < sp.nest.targetDepth;
    if (dy > 0) s *= deeper ? 2.2 : 0.5;
    else if (dy < 0) s *= depthBelow < 6 ? 0.05 : 0.35;
    else s *= 1.4;
    if (air >= 2 && air <= 4) s *= 1.6;
    else if (air >= 6) s *= 0.15;
    s *= 1 + 3 * c.digCue.get(x, y - dy);
    if (y <= w.surface[x] + 1) s *= 0.05; // do not breach the surface from below
  }
  return s;
}

function decideDig(sim: Sim, i: number, c: Colony, own: boolean) {
  const a = sim.a, w = sim.w, rng = sim.rng;
  const exitMode = c.stim.exit > 0;
  if (!own && !exitMode) { a.nav[i] = NAV.HOME; a.tx[i] = c.entrance.x; a.ty[i] = c.entrance.y; if (a.stuck[i] > 80) { a.task[i] = TASK.IDLE; a.stuck[i] = 0; } return; }
  if (c.stim.dig < 0.05 && !exitMode && rng.chance(0.2)) { a.task[i] = TASK.IDLE; return; }
  const x = a.x[i], y = a.y[i];
  let best = -1, bestS = 0;
  for (let d = 0; d < 8; d++) {
    if ((d & 1) === 1 && rng.chance(0.5)) continue; // prefer orthogonal digging
    const s = digScore(sim, c, x + DX[d], y + DY[d], DY[d], exitMode) * (0.6 + 0.8 * rng.next());
    if (s > bestS) { bestS = s; best = d; }
  }
  if (best >= 0 && bestS > 0.15) {
    const tx = x + DX[best], ty = y + DY[best];
    const m = w.get(tx, ty);
    const k = ty * w.W + tx;
    const cap = MOIST_CAP[m];
    const wet = cap ? w.moist[k] / cap : 0;
    // damp soil is easiest; dry clay is hard; very wet soil is sticky
    const wetF = m === M.CLAY ? 2.2 - 1.6 * Math.min(1, wet * 1.5) : 1.3 - 0.6 * Math.min(1, wet * 2) + (wet > 0.85 ? 0.5 : 0);
    const work = Math.max(4, Math.round(DIG_RESIST[m] * wetF / a.pheno[i * 29 + P.DIGRATE] / 2));
    a.tx[i] = tx; a.ty[i] = ty; a.timer[i] = work; a.nav[i] = NAV.STAY;
    return;
  }
  if (!exitMode && a.nav[i] === NAV.TUNNEL && a.why[i] === WHY.PLAN_DIG && a.stuck[i] < 40 && sim.frontierField(c)[y * w.W + x] > 1) return;
  a.nav[i] = exitMode ? NAV.EXIT : NAV.DIG_WANDER;
  // nothing worth digging here: walk through the tunnels to the nearest unfinished part of the template
  if (!exitMode && (a.fails[i] & 3) === 0 && c.plan?.frontier.length) {
    if (sim.frontierField(c)[y * w.W + x] > 1) { a.nav[i] = NAV.TUNNEL; a.tx[i] = -1; a.ty[i] = -1; a.why[i] = WHY.PLAN_DIG; }
    else { const f = frontierTarget(sim, c); if (f) { a.nav[i] = NAV.GOAL; a.tx[i] = f.x; a.ty[i] = f.y; a.why[i] = WHY.PLAN_DIG; } }
  }
  if (++a.fails[i] > 40) { a.fails[i] = 0; a.task[i] = TASK.IDLE; }
}

/** Start digging one cell up/sideways out of a pocket; the loosened soil is pushed aside, not carried. */
function startDigOut(sim: Sim, i: number, toward = 0): boolean {
  const a = sim.a, w = sim.w, x = a.x[i], y = a.y[i];
  // toward != 0: only shove sideways/up through loose grains in that direction (homing through spoil)
  const dirs = toward ? [[toward, 0], [toward, -1], [0, -1]] : [[0, -1], [-1, -1], [1, -1], [-1, 0], [1, 0]];
  for (const [dx, dy] of dirs) {
    const tx = x + dx, ty = y + dy;
    if (!w.inb(tx, ty)) continue;
    const m = w.get(tx, ty);
    if (!DIG_RESIST[m] || FOOD_OF[m] || m === M.CORPSE || (toward && !IS_GRANULAR[m])) continue;
    let wet = false;
    for (let d = 0; d < 8 && !wet; d++) wet = w.get(tx + DX[d], ty + DY[d]) === M.WATER;
    if (wet) continue;
    a.tx[i] = tx; a.ty[i] = ty; a.why[i] = WHY.DIG_OUT; a.nav[i] = NAV.STAY; a.stuck[i] = 0;
    a.timer[i] = Math.max(4, Math.round(DIG_RESIST[m] / a.pheno[i * 29 + P.DIGRATE] / 2));
    return true;
  }
  return false;
}

/** Dig into a plugged cell of the colony's own nest from outside (shaft cells keep their nest ownership when filled). */
function startDigIn(sim: Sim, i: number, c: Colony): boolean {
  const a = sim.a, w = sim.w, x = a.x[i], y = a.y[i], own = c.slot + 1;
  for (const [dx, dy] of [[0, 1], [-1, 1], [1, 1], [-1, 0], [1, 0], [0, -1]]) {
    const tx = x + dx, ty = y + dy;
    if (!w.inb(tx, ty)) continue;
    const k = ty * w.W + tx, m = w.mat[k];
    if (w.owner[k] !== own || !DIG_RESIST[m] || FOOD_OF[m] || m === M.CORPSE) continue;
    a.tx[i] = tx; a.ty[i] = ty; a.why[i] = WHY.DIG_IN; a.nav[i] = NAV.STAY; a.stuck[i] = 0;
    a.timer[i] = Math.max(4, Math.round(DIG_RESIST[m] / a.pheno[i * 29 + P.DIGRATE] / 2));
    return true;
  }
  return false;
}

const FOOD_KEYS = ['sugar', 'protein', 'seed'] as const;
function feedOutside(sim: Sim, i: number, c: Colony): boolean {
  const a = sim.a, w = sim.w, nut = sim.speciesOf(c).nutrition;
  const gain = (f: number) => f === 1 ? 0.45 * nut.sugar : f === 2 ? 0.25 : 0.5 * nut.seed;
  const f0 = FOOD_OF[a.carry[i]];
  if (f0 && gain(f0) > 0.1) {
    sim.carriedFood[f0 - 1]--;
    w.ledger.sink(FOOD_KEYS[f0 - 1], 'eaten by carrier', 1);
    a.carry[i] = 0; a.energy[i] = Math.min(1, a.energy[i] + gain(f0));
    return true;
  }
  for (let d = -1; d < 8; d++) {
    const nx = a.x[i] + (d < 0 ? 0 : DX[d]), ny = a.y[i] + (d < 0 ? 0 : DY[d]);
    if (!w.inb(nx, ny)) continue;
    const k = ny * w.W + nx, f = FOOD_OF[w.mat[k]];
    if (!f || gain(f) <= 0.1 || w.toxin[k] > 40) continue;
    if (w.amt[k] <= 1) sim.setCell(k, M.AIR, 0, 'eaten by ants outside');
    else { w.amt[k]--; w.touch(nx, ny); w.ledger.sink(FOOD_KEYS[f - 1], 'eaten by ants outside', 1); }
    a.energy[i] = Math.min(1, a.energy[i] + gain(f));
    return true;
  }
  return false;
}

function finishWork(sim: Sim, i: number) {
  const a = sim.a, w = sim.w;
  const c = sim.colonies[a.colony[i]];
  if (!c) return;
  const task = a.task[i];
  if (a.why[i] === WHY.DIG_OUT || a.why[i] === WHY.DIG_IN) {
    const k = a.ty[i] * w.W + a.tx[i], m = w.mat[k];
    if (DIG_RESIST[m] && !FOOD_OF[m] && m !== M.CORPSE) {
      const from = a.y[i] * w.W + a.x[i];
      if (a.why[i] === WHY.DIG_IN) sim.excavate(k, c);
      else if (IS_GRANULAR[m] && a.ty[i] <= a.y[i] && !IS_SOLID[w.mat[from]] && !IS_LIQUID[w.mat[from]]) {
        // pushing up through loose grains: they settle into the space the ant leaves instead of refilling the hole
        const amt = w.amt[k];
        sim.setCell(k, M.AIR, 0, 'moved');
        moveTo(sim, i, a.tx[i], a.ty[i]);
        sim.setCell(from, m, amt, 'moved');
      } else sim.setCell(k, M.AIR, 0, 'excavated');
      a.energy[i] -= 0.002;
    }
    if (a.why[i] === WHY.DIG_IN) { a.why[i] = WHY.NONE; a.nav[i] = NAV.HOME; a.tx[i] = c.entrance.x; a.ty[i] = c.entrance.y; }
    else a.nav[i] = NAV.UP;
    a.stuck[i] = 0;
    return;
  }
  if (task === TASK.DIG || task === TASK.FOUND_DIG) {
    const tx = a.tx[i], ty = a.ty[i];
    if (!w.inb(tx, ty)) { a.nav[i] = NAV.DIG_WANDER; return; }
    const k = ty * w.W + tx;
    const m = w.mat[k];
    if (!DIG_RESIST[m]) { a.nav[i] = NAV.DIG_WANDER; return; }
    sim.excavate(k, c);
    c.digCue.add(tx, ty, 0.6);
    a.energy[i] -= 0.002;
    a.fails[i] = 0;
    brainReward(sim, i, 0.12);
    if (task === TASK.FOUND_DIG) { a.nav[i] = NAV.STAY; return; }
    if (m === M.CLAY) c.store.mineral += 0.5;
    // far from any exit (deep highways), spoil is packed into the tunnel walls instead of carried out
    // (game abstraction: the volume of the map-spanning tunnel network is not conserved as surface soil)
    if (sim.nestDist[a.y[i] * w.W + a.x[i]] > 16) { a.nav[i] = NAV.DIG_WANDER; a.timer[i] = 0; sim.thrUse(i, 2); return; }
    a.carry[i] = M.LOOSE;
    a.task[i] = TASK.HAUL; a.why[i] = WHY.HAUL; a.nav[i] = NAV.EXIT; a.timer[i] = 0;
    a.tx[i] = c.entrance.x; a.ty[i] = c.entrance.y; a.stepCount[i] = 0; a.memLen[i] = 0;
    sim.thrUse(i, 2);
  } else if (task === TASK.NURSE) {
    a.nav[i] = NAV.NEST_CUE;
  }
}

function decideHaul(sim: Sim, i: number, c: Colony, own: boolean) {
  const a = sim.a, w = sim.w;
  const x = a.x[i], y = a.y[i];
  a.stepCount[i] = Math.min(65535, a.stepCount[i] + DECIDE_EVERY);
  const outside = !own && w.skyExposed(x, y);
  const refuse = a.carry[i] === M.CORPSE || a.carry[i] === M.WASTE;
  const farEnough = dist2(x, y, c.entrance.x, c.entrance.y) >= (refuse ? 144 : 64);
  if (outside && c.plan) {
    if (refuse) {
      // refuse and corpses go to one midden, away from the entrance
      const mx = c.plan.midden.x;
      if (Math.abs(x - mx) > 2) { if (a.stuck[i] < 80) { a.why[i] = WHY.MIDDEN; a.nav[i] = NAV.GOAL; a.tx[i] = mx; a.ty[i] = w.surface[mx] - 1; return; } }
      else if (dropCarried(sim, i, false)) return;
    } else if ((a.carry[i] === M.LOOSE || a.carry[i] === M.SAND) && a.stepCount[i] < 360) {
      // spoil builds the mound (dome) or crater ring around the entrance
      if (a.why[i] !== WHY.MOUND) { const s = moundSpot(sim, c); if (s) { a.why[i] = WHY.MOUND; a.tx[i] = s.x; a.ty[i] = s.y; a.stuck[i] = 0; } }
      if (a.why[i] === WHY.MOUND) {
        const tx = a.tx[i];
        if (Math.abs(x - tx) <= 1 && Math.abs(y - (w.surface[tx] - 1)) <= 2) {
          if (depositHeap(sim, tx)) { brainReward(sim, i, 0.1); a.carry[i] = 0; a.task[i] = TASK.IDLE; startRetrace(sim, i, c); a.stepCount[i] = 0; return; }
          a.why[i] = WHY.HAUL;
        } else if (a.stuck[i] < 60) { a.nav[i] = NAV.GOAL; a.ty[i] = w.surface[tx] - 1; return; }
        else a.why[i] = WHY.HAUL;
      }
    }
  }
  if (outside) {
    // spread the load over the ground away from the door instead of piling it at the nearest legal spot:
    // heaps beside the entrance slide back into the shaft and bury passing ants
    if (a.stepCount[i] > 1400 && !refuse) { a.carry[i] = 0; a.task[i] = TASK.IDLE; a.nav[i] = NAV.HOME; a.tx[i] = c.entrance.x; a.ty[i] = c.entrance.y; a.stepCount[i] = 0; return; }
    if (a.why[i] !== WHY.SPOIL_DUMP || a.stuck[i] > 50) {
      // sample a few spots and take the lowest ground, so dumped spoil fills hollows instead of growing one heap
      const minR = refuse ? 12 : Math.max(9, (c.plan?.mound.r ?? 0) + 4);
      let tx = -1;
      for (let t = 0; t < 3; t++) {
        const cx = Math.max(2, Math.min(w.W - 3, c.entrance.x + (sim.rng.chance(0.5) ? 1 : -1) * (minR + sim.rng.int(20))));
        if (tx < 0 || w.surface[cx] > w.surface[tx]) tx = cx;
      }
      a.why[i] = WHY.SPOIL_DUMP; a.tx[i] = tx; a.stuck[i] = 0;
    }
    if (Math.abs(x - a.tx[i]) <= 2 && farEnough) {
      if (dropCarried(sim, i, false)) return;
      a.why[i] = WHY.HAUL; // nowhere to set it down here: pick another spot next time
    }
    a.nav[i] = NAV.GOAL; a.ty[i] = w.surface[a.tx[i]] - 1;
    return;
  }
  if (!own) a.nav[i] = NAV.UP;
  else a.nav[i] = NAV.EXIT;
  // no way out (sealed or blocked): stash the pellet in a dead-end inside the nest
  const giveUp = (!c.hasExit && a.stepCount[i] > 120) || a.stepCount[i] > 700 || a.stuck[i] > 120;
  if (giveUp && own) dropCarried(sim, i, true);
}

/** Place the carried pellet/corpse in a nearby open, supported cell. */
function dropCarried(sim: Sim, i: number, inside: boolean): boolean {
  const a = sim.a, w = sim.w;
  const x = a.x[i], y = a.y[i];
  const m = a.carry[i];
  if (inside && (m === M.LOOSE || m === M.SAND)) {
    // granular spoil dropped inside would pour down passages and plug them; instead the
    // pellet is pressed into the tunnel wall (abstraction - soil is not a tracked resource)
    a.carry[i] = 0; a.task[i] = TASK.IDLE; a.nav[i] = NAV.NEST_WANDER; a.stepCount[i] = 0;
    return true;
  }
  let best = -1, bestS = -1;
  for (let d = 0; d < 8; d++) {
    const nx = x + DX[d], ny = y + DY[d];
    if (!w.inb(nx, ny)) continue;
    const k = ny * w.W + nx;
    if (w.mat[k] !== M.AIR || sim.occ[k] > 0) continue;
    let solids = 0;
    for (let e = 0; e < 8; e++) if (IS_SOLID[w.get(nx + DX[e], ny + DY[e])]) solids++;
    // inside the nest only fill dead-end corners so passages stay open
    if (inside && solids < 6) continue;
    if (!inside) {
      if (!IS_SOLID[w.get(nx, ny + 1)]) continue;
      // angle of repose: never add to a local peak (it would only slide, or bury whoever passes below)
      if (nx > 2 && nx < w.W - 3 && ny + 1 < Math.min(w.surface[nx - 2], w.surface[nx + 2]) - 1) continue;
      // never dump spoil where it could slide into a passage: no excavated cells nearby
      let nearTunnel = false;
      for (let dy = -2; dy <= 4 && !nearTunnel; dy++)
        for (let dx = -5; dx <= 5; dx++) if (w.inb(nx + dx, ny + dy) && w.owner[(ny + dy) * w.W + nx + dx] && w.mat[(ny + dy) * w.W + nx + dx] === M.AIR) { nearTunnel = true; break; }
      if (nearTunnel) continue;
    }
    if (solids > bestS) { bestS = solids; best = k; }
  }
  if (best < 0) return false;
  if (FOOD_OF[m]) {
    sim.carriedFood[FOOD_OF[m] - 1]--;
    sim.setCell(best, m, 1, 'dropped');
  } else sim.setCell(best, m, m === M.CORPSE ? 0 : 0, 'dropped');
  if (m === M.CORPSE || m === M.WASTE) w.owner[best] = 0;
  if (!inside) brainReward(sim, i, m === M.CORPSE || m === M.WASTE ? 0.35 : FOOD_OF[m] ? 0 : 0.08);
  a.carry[i] = 0;
  a.task[i] = TASK.IDLE;
  startRetrace(sim, i, sim.colonies[a.colony[i]]!);
  a.stepCount[i] = 0;
  return true;
}

// ---------------------------------------------------------------- brood care

function decideNurse(sim: Sim, i: number, c: Colony, own: boolean) {
  const a = sim.a;
  if (!own) { a.nav[i] = NAV.HOME; a.tx[i] = c.entrance.x; a.ty[i] = c.entrance.y; return; }
  const sp = sim.speciesOf(c);
  const x = a.x[i], y = a.y[i];
  // brood in danger has priority (local check of brood near this nurse)
  let target: number = -1, tScore = 0, rescue = false;
  for (let k = 0; k < c.brood.length; k++) {
    const b = c.brood[k];
    if (b.carried) continue;
    const d2 = dist2(x, y, b.x, b.y);
    if (d2 > 400) continue; // ~20 cells: nurses respond to brood they can reach locally
    let s = 0;
    const wet = !!IS_LIQUID[sim.w.mat[b.y * sim.w.W + b.x]] || b.drown > 0;
    if (wet) { s = 10; }
    else if (b.stage === STAGE.LARVA && b.fed < b.need && b.hunger > 0.1) s = 1 + b.hunger;
    else continue;
    s /= 1 + d2 * 0.02;
    if (s > tScore) { tScore = s; target = k; rescue = wet; }
  }
  if (target < 0) {
    // check thermal comfort of brood: move brood away from strongly sub-optimal temperatures
    if (c.brood.length && sim.rng.chance(0.15)) {
      const b = c.brood[sim.rng.int(c.brood.length)];
      const T = sim.w.tempAt(b.x, b.y);
      if (!b.carried && Math.abs(T - sp.development.tOpt) > 5 && dist2(x, y, b.x, b.y) < 400) {
        a.task[i] = TASK.CARRY_BROOD; a.why[i] = WHY.MOVE_BROOD_TEMP; a.carryBrood[i] = -1 - b.id; // pending pickup
        a.nav[i] = NAV.GOAL; a.tx[i] = b.x; a.ty[i] = b.y; a.timer[i] = 300;
        return;
      }
    }
    if (c.stim.nurse < 0.05 || sim.rng.chance(0.1)) { a.task[i] = TASK.IDLE; a.nav[i] = NAV.NEST_WANDER; }
    else a.nav[i] = NAV.NEST_CUE;
    return;
  }
  const b = c.brood[target];
  if (rescue) {
    a.task[i] = TASK.CARRY_BROOD; a.why[i] = WHY.RESCUE_FLOOD; a.carryBrood[i] = -1 - b.id;
    a.nav[i] = NAV.GOAL; a.tx[i] = b.x; a.ty[i] = b.y; a.timer[i] = 300;
    return;
  }
  if (dist2(x, y, b.x, b.y) <= 4) {
    if (sim.feedLarva(c, b, i)) { a.nav[i] = NAV.STAY; a.timer[i] = 12; a.why[i] = WHY.NURSE_HUNGRY; sim.thrUse(i, 1); brainReward(sim, i, 0.35); }
    else { a.task[i] = TASK.IDLE; a.nav[i] = NAV.NEST_WANDER; } // stores empty
    return;
  }
  a.nav[i] = NAV.GOAL; a.tx[i] = b.x; a.ty[i] = b.y;
  if (a.stuck[i] > 40) { a.nav[i] = NAV.NEST_CUE; a.stuck[i] = 0; }
}

function decideCarryBrood(sim: Sim, i: number, c: Colony) {
  const a = sim.a, w = sim.w;
  const cb = a.carryBrood[i];
  const x = a.x[i], y = a.y[i];
  if (cb < -1) {
    // walking to pick it up (pending pickup is encoded as -1 - broodId; brood ids start at 1)
    const id = -1 - cb;
    const b = sim.broodById(c.slot, id);
    if (!b || b.carried) { a.carryBrood[i] = -1; a.task[i] = TASK.IDLE; return; }
    if (dist2(x, y, b.x, b.y) <= 2) {
      b.carried = true; a.carryBrood[i] = b.id;
      b.x = x; b.y = y;
      // choose a destination by sampling nearby nest locations (local comparison)
      const dest = sim.betterBroodSpot(c, x, y);
      a.tx[i] = dest.x; a.ty[i] = dest.y; a.nav[i] = NAV.GOAL; a.timer[i] = 400;
    } else {
      a.tx[i] = b.x; a.ty[i] = b.y; a.nav[i] = NAV.GOAL;
      if (--a.timer[i] <= 0 || a.stuck[i] > 50) { a.carryBrood[i] = -1; a.task[i] = TASK.IDLE; a.stuck[i] = 0; }
    }
    return;
  }
  if (cb < 0) { a.task[i] = TASK.IDLE; a.nav[i] = NAV.NEST_WANDER; return; }
  const inWater = !!IS_LIQUID[w.mat[y * w.W + x]];
  if (inWater) { a.nav[i] = NAV.UP; return; }
  if (a.nav[i] === NAV.UP) { a.nav[i] = NAV.GOAL; }
  const done = dist2(x, y, a.tx[i], a.ty[i]) <= 2 || --a.timer[i] <= 0 || a.stuck[i] > 60;
  if (done) {
    const b = sim.broodById(c.slot, cb);
    if (b) { b.carried = false; b.x = x; b.y = y; if (b.drown > 0) sim.journalRescue(c); brainReward(sim, i, b.drown > 0 ? 0.5 : 0.15); }
    a.carryBrood[i] = -1; a.task[i] = TASK.IDLE; a.nav[i] = NAV.NEST_WANDER; a.stuck[i] = 0;
  }
}

function decideWaste(sim: Sim, i: number, c: Colony, own: boolean) {
  const a = sim.a, w = sim.w;
  if (!own) { a.task[i] = TASK.IDLE; return; }
  const x = a.x[i], y = a.y[i];
  for (let d = 0; d < 8; d++) {
    const nx = x + DX[d], ny = y + DY[d];
    const m = w.get(nx, ny);
    if (m === M.CORPSE || m === M.WASTE) {
      const k = ny * w.W + nx;
      sim.setCell(k, M.AIR, 0, 'removed waste');
      w.owner[k] = c.slot + 1;
      a.carry[i] = m;
      a.task[i] = TASK.HAUL; a.why[i] = WHY.WASTE; a.nav[i] = NAV.EXIT; a.stepCount[i] = 0;
      c.corpsesInside = Math.max(0, c.corpsesInside - 1);
      brainReward(sim, i, 0.1);
      return;
    }
  }
  if (--a.timer[i] <= 0) { a.task[i] = TASK.IDLE; return; }
  a.nav[i] = NAV.NEST_WANDER;
}

// ---------------------------------------------------------------- queens and alates

function decideQueen(sim: Sim, i: number) {
  const a = sim.a, w = sim.w, rng = sim.rng;
  const c = sim.colonies[a.colony[i]];
  if (!c) return;
  const sp = sim.speciesOf(c);
  const q = sim.queenData(c, a.id[i]);
  if (!q) return;
  const x = a.x[i], y = a.y[i];
  const ci = y * w.W + x;
  if (IS_LIQUID[w.mat[ci]]) { a.nav[i] = NAV.UP; a.why[i] = WHY.SUBMERGED; return; }
  switch (a.task[i]) {
    case TASK.FOUND_SEARCH: {
      // evaluate the ground under the queen; remember the best site seen (bounded search)
      a.nav[i] = NAV.WANDER;
      a.why[i] = WHY.FOUND_SEARCH;
      a.stepCount[i] = Math.min(65535, a.stepCount[i] + 1);
      const below = w.get(x, y + 1);
      const score = sim.siteScore(sp, x, y + 1);
      if (score > a.bestQ[i]) { a.bestQ[i] = score; a.tx[i] = x; a.ty[i] = y; }
      // join a nearby founding association?
      if (sp.founding.association !== 'haplometrosis' && a.stepCount[i] === 3) {
        const host = sim.findFoundingNear(c, x, y, 18);
        if (host && rng.chance(sp.founding.associationChance)) { sim.joinColony(i, c, host); return; }
      }
      const settle = (score > 0.75 && a.stepCount[i] > 20) || a.stepCount[i] > 150;
      if (settle && DIG_RESIST[below]) {
        a.task[i] = TASK.FOUND_DIG; a.why[i] = WHY.FOUND_DIG;
        c.entrance = { x, y };
        a.timer[i] = 0;
        w.owner[ci] = c.slot + 1;
      } else if (a.stepCount[i] > 220) {
        // give up searching: dig at best remembered site
        a.nav[i] = NAV.GOAL;
        if (dist2(x, y, a.tx[i], a.ty[i]) <= 2 || a.stepCount[i] > 400) {
          if (DIG_RESIST[below]) { a.task[i] = TASK.FOUND_DIG; c.entrance = { x, y }; w.owner[ci] = c.slot + 1; }
        }
      }
      return;
    }
    case TASK.FOUND_DIG: {
      a.why[i] = WHY.FOUND_DIG;
      const depth = y - c.entrance.y;
      const want = sp.founding.chamberDepth;
      // dig a narrow shaft down, then a small chamber
      let tx = x, ty = y + 1;
      if (depth >= want) {
        const width = Math.abs(x - c.entrance.x);
        if (c.chamber.x < 0) c.chamber = { x, y };
        const opts: [number, number][] = [[x + 1, y], [x - 1, y], [x, y - 1], [x + 1, y - 1], [x - 1, y - 1], [x, y + 1]];
        const cand = opts.filter(([cx, cy]) => DIG_RESIST[w.get(cx, cy)] && Math.abs(cx - c.chamber.x) <= 3 && cy >= c.chamber.y - 1 && cy <= c.chamber.y + 1);
        if (!cand.length || width > 3) {
          // chamber complete
          a.task[i] = TASK.QUEEN_LAY;
          a.nav[i] = NAV.STAY;
          if (sp.founding.sealsChamber) sim.sealShaft(c);
          sim.event('founding', `${c.name}: founding chamber complete at depth ${depth}.`, c);
          return;
        }
        [tx, ty] = cand[rng.int(cand.length)];
      } else {
        // keep the shaft two cells wide so workers and the queen can pass
        if (!DIG_RESIST[w.get(x, y + 1)] && !isOpen(w.get(x, y + 1))) {
          // hit undiggable material: shift sideways
          tx = x + (rng.chance(0.5) ? 1 : -1); ty = y;
        } else if (isOpen(w.get(x, y + 1))) {
          if (DIG_RESIST[w.get(x + 1, y)] && rng.chance(0.5)) { tx = x + 1; ty = y; }
          else { a.nav[i] = NAV.GOAL; a.tx[i] = x; a.ty[i] = y + 1; moveDown(sim, i); return; }
        }
      }
      const m = w.get(tx, ty);
      if (!DIG_RESIST[m]) {
        if (a.fails[i]++ > 20) { a.task[i] = TASK.QUEEN_LAY; a.nav[i] = NAV.STAY; if (sp.founding.sealsChamber) sim.sealShaft(c); }
        return;
      }
      a.tx[i] = tx; a.ty[i] = ty;
      a.timer[i] = Math.max(6, Math.round(DIG_RESIST[m] / a.pheno[i * 29 + P.DIGRATE] / 2.5));
      a.nav[i] = NAV.STAY;
      return;
    }
    case TASK.QUEEN_LAY: {
      a.why[i] = WHY.LAY;
      // semi-claustral founding queens forage when reserves are low and no workers exist yet
      if (sp.founding.strategy === 'semi-claustral' && c.workers === 0 && q.reserves < sp.founding.forageBelowReserve && sim.daytime
        && sim.airT > sp.activity.minForageTemp && sim.airT < sp.activity.maxForageTemp && rng.chance(0.05)) {
        a.task[i] = TASK.QUEEN_FORAGE; a.why[i] = WHY.QUEEN_FORAGE; a.nav[i] = NAV.EXIT; a.stepCount[i] = 0;
        a.tx[i] = c.entrance.x; a.ty[i] = c.entrance.y;
        return;
      }
      // stay near the chamber; move away from water
      if (c.chamber.x >= 0 && dist2(x, y, c.chamber.x, c.chamber.y) > 9) { a.nav[i] = NAV.GOAL; a.tx[i] = c.chamber.x; a.ty[i] = c.chamber.y; }
      else a.nav[i] = rng.chance(0.2) ? NAV.NEST_WANDER : NAV.STAY;
      if (a.stuck[i] > 60) { c.chamber = { x, y }; a.stuck[i] = 0; }
      return;
    }
    case TASK.QUEEN_FORAGE: {
      a.why[i] = WHY.QUEEN_FORAGE;
      const own = w.owner[ci] === c.slot + 1;
      a.stepCount[i] = Math.min(65535, a.stepCount[i] + DECIDE_EVERY);
      if (a.carry[i]) {
        if (own && y >= c.entrance.y + 2) {
          sim.queenEats(c, q, i);
          a.task[i] = TASK.QUEEN_LAY; a.nav[i] = NAV.GOAL; a.tx[i] = c.chamber.x; a.ty[i] = c.chamber.y;
        } else if (own) a.nav[i] = NAV.GOAL, a.tx[i] = c.chamber.x, a.ty[i] = c.chamber.y;
        else { a.nav[i] = NAV.HOME; a.tx[i] = c.entrance.x; a.ty[i] = c.entrance.y; }
        return;
      }
      if (own) { a.nav[i] = NAV.EXIT; a.tx[i] = c.entrance.x; a.ty[i] = c.entrance.y; if (a.stepCount[i] > 600) a.task[i] = TASK.QUEEN_LAY; return; }
      if (a.stepCount[i] > 1200) { a.nav[i] = NAV.HOME; a.tx[i] = c.entrance.x; a.ty[i] = c.entrance.y; if (a.stepCount[i] > 3000) a.task[i] = TASK.QUEEN_LAY; return; }
      if (a.nav[i] !== NAV.GOAL) a.nav[i] = dist2(x, y, c.entrance.x, c.entrance.y) > 900 ? NAV.HOME : NAV.EXPLORE;
      if (a.nav[i] === NAV.HOME) { a.tx[i] = c.entrance.x; a.ty[i] = c.entrance.y; if (rng.chance(0.2)) a.nav[i] = NAV.EXPLORE; }
      return;
    }
  }
}

function moveDown(sim: Sim, i: number) {
  const a = sim.a;
  if (canStand(sim, a.x[i], a.y[i] + 1, false)) moveTo(sim, i, a.x[i], a.y[i] + 1);
}

function decideAlate(sim: Sim, i: number) {
  const a = sim.a, w = sim.w;
  const c = sim.colonies[a.colony[i]];
  if (a.task[i] === TASK.FLIGHT) {
    a.why[i] = WHY.FLIGHT;
    const x = a.x[i], y = a.y[i];
    if (w.skyExposed(x, y) && (!c || w.owner[y * w.W + x] !== c.slot + 1)) { sim.takeOff(i); return; }
    a.nav[i] = c && w.owner[y * w.W + x] === c.slot + 1 ? NAV.EXIT : NAV.UP;
    if (c) { a.tx[i] = c.entrance.x; a.ty[i] = c.entrance.y; }
    return;
  }
  a.task[i] = TASK.ALATE; a.why[i] = WHY.ALATE_WAIT;
  a.nav[i] = sim.rng.chance(0.5) ? NAV.NEST_WANDER : NAV.STAY;
  if (c && a.energy[i] < 0.5) sim.feedAdult(c, i);
}

// ---------------------------------------------------------------- physiology

export function physiology(sim: Sim, i: number) {
  const a = sim.a, w = sim.w;
  const c = sim.colonies[a.colony[i]];
  if (!c) { sim.killAnt(i, 'no colony'); return; }
  const sp = sim.speciesOf(c);
  const dtDays = PHYS_EVERY / 3600;
  const x = a.x[i], y = a.y[i];
  const k = y * w.W + x;
  const o = i * 29;
  const T = w.temp[w.tIdx(x, y)];
  const q10 = Math.pow(2, (T - 25) / 10);
  const active = a.nav[i] === NAV.STAY && a.timer[i] === 0 ? 0.5 : 1;
  // overwintering torpor: in a nest too cold for brood development adults are inactive, burn little energy
  // and age slowly (temperate ant workers survive the winter this way). Rates are authored.
  const torpid = T < sp.development.tMin && w.owner[k] === c.slot + 1;
  a.age[i] += dtDays * (torpid ? 0.35 : 1);
  const isQueen = a.caste[i] === CASTE.QUEEN;
  // energy
  const drain = (isQueen ? 0 : 0.15) * dtDays * a.pheno[o + P.METCOST] * Math.max(0.15, q10) * active * (torpid ? 0.3 : 1);
  a.energy[i] -= drain;
  if (a.pheno[o + P.BIOLUM] > 0 && a.anim[i] & 1) a.energy[i] -= drain * 0.25 * a.pheno[o + P.BIOLUM];
  // water balance: loss depends on air humidity, temperature and the water-balance phenotype
  const hum = w.hum[w.tIdx(x, y)];
  const loss = sp.tolerances.desiccation * a.pheno[o + P.DESICC] * (1 - hum) * Math.max(0.2, q10) * (isQueen ? 0.3 : 1);
  a.hydration[i] -= loss;
  if (a.hydration[i] < 0.5 && ((sim.tick / PHYS_EVERY) & 3) === 0) tryDrink(sim, i);
  // damage
  let dmg = 0;
  let cause = '';
  if (a.energy[i] <= 0) { a.energy[i] = 0; dmg += 0.006; cause = 'starvation'; }
  if (a.hydration[i] <= 0) { a.hydration[i] = 0; dmg += 0.03; cause = 'desiccation'; }
  const tr = a.traits, to = i * 2;
  const heatMax = sp.tolerances.heatMax + (a.pheno[o + P.TOPT] - sp.traits.topt) * 0.6 + heatBonus(tr, to);
  if (T > heatMax && !hasTrait(tr, to, TR.fire_proof)) { dmg += 0.01 * (T - heatMax); cause = 'heat'; }
  const coldMin = sp.tolerances.coldMin - coldBonus(tr, to);
  if (T < coldMin - 4) { dmg += 0.004 * (coldMin - 4 - T); cause = 'cold'; }
  if (w.toxin[k] > 0 && !hasTrait(tr, to, TR.immune)) { dmg += w.toxin[k] / 255 * 0.08; cause = 'toxin'; }
  if(w.dose[k]){dmg+=w.dose[k]/255*.06;cause='radiation exposure (game units)';}
  if(w.charge[k]>80){dmg+=w.charge[k]/255*.08;cause='electrical shock';}
  if (IS_LIQUID[w.mat[k]]) {
    a.submerged[i] = Math.min(65535, a.submerged[i] + PHYS_EVERY);
    if (a.submerged[i] > sp.tolerances.submersionTicks * a.pheno[o + P.DROWN]) { dmg += 0.05; cause = 'drowning'; }
  } else if (a.submerged[i] > 0) a.submerged[i] = Math.max(0, a.submerged[i] - PHYS_EVERY * 4);
  if (IS_SOLID[w.mat[k]]) {
    // buried by collapsing material: try to escape
    if (!escapeSolid(sim, i)) { dmg += 0.1; cause = 'buried'; }
  }
  if (dmg > 0) {
    a.health[i] -= dmg;
    if (a.health[i] <= 0) { sim.killAnt(i, cause); return; }
  } else if (a.energy[i] > 0.4 && a.hydration[i] > 0.4 && a.health[i] < 1) {
    a.health[i] = Math.min(1, a.health[i] + 0.002 * (hasTrait(tr, to, TR.regeneration) ? 4 : 1));
  }
  // senescence (Gompertz-like hazard beyond expected lifespan)
  const life = (isQueen ? sp.queen.lifespanDays : a.caste[i] === CASTE.WORKER ? sp.workers.lifespanDays : sp.workers.lifespanDays * 0.6) * lifeFactor(tr, to);
  const hazard = 0.02 * Math.exp(5 * (a.age[i] / life - 1)) * dtDays;
  if (sim.rng.next() < hazard) { sim.killAnt(i, 'old age'); return; }
  if (isQueen) sim.queenPhysiology(c, i, dtDays, q10);
}

function escapeSolid(sim: Sim, i: number): boolean {
  const a = sim.a;
  for (let r = 1; r <= 2; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (canStand(sim, a.x[i] + dx, a.y[i] + dy, false)) { moveTo(sim, i, a.x[i] + dx, a.y[i] + dy); return true; }
      }
  return false;
}

// ---------------------------------------------------------------- contacts & combat

/** Contact interactions between non-nestmates. Uses the spatial index; walls block contact. */
let holders = new Uint8Array(0);
export function contactPhase(sim: Sim) {
  const a = sim.a, w = sim.w, rng = sim.rng;
  // how many attackers are holding each ant this tick (several workers pin one rival while others bite)
  if (holders.length < a.cap) holders = new Uint8Array(a.cap); else holders.fill(0, 0, a.n);
  for (let i = 0; i < a.n; i++) {
    if (!a.alive[i] || ((sim.tick + i) & 1)) continue;
    const c = sim.colonies[a.colony[i]];
    if (!c) continue;
    if (a.caste[i] === CASTE.MALE || a.caste[i] === CASTE.GYNE) continue;
    const sp = sim.speciesOf(c);
    const x = a.x[i], y = a.y[i];
    const flashes=a.pheno[i*29+P.BIOLUM]>0&&a.task[i]===TASK.RETURN&&a.carry[i];
    if(!flashes&&!sim.idx.hasForeign(x,y,3,a.colony[i])){a.fightTarget[i]=-1;continue;}
    const reach = sp.defense.mode === 'formic-spray' ? 2 : 1;
    let foe = -1, foeD = 99, foeS = 1e9, friends = 0, foes = 0;
    sim.idx.query(a, x, y, 3, (j) => {
      if (j === i) return;
      if (a.colony[j] === a.colony[i]) { friends++; return; }
      // treaty partners pass each other peacefully, except intruders inside this colony's own nest
      if (atPeace(sim, a.colony[i], a.colony[j]) && w.owner[a.y[j] * w.W + a.x[j]] !== a.colony[i] + 1) return;
      foes++;
      const d = Math.max(Math.abs(a.x[j] - x), Math.abs(a.y[j] - y));
      if (d > reach || !contactOpen(sim, x, y, a.x[j], a.y[j])) return;
      // focus fire: prefer close rivals that are already held or wounded, and raiders carrying brood off
      const s = d + 0.8 * a.health[j] - 0.3 * Math.min(3, holders[j]) - (a.carryBrood[j] >= 0 ? 1.5 : 0);
      if (s < foeS) { foe = j; foeD = d; foeS = s; }
    });
    // fictional bioluminescence: returning foragers flash; nearby idle nestmates in line of sight are recruited
    if (a.pheno[i * 29 + P.BIOLUM] > 0 && a.task[i] === TASK.RETURN && a.carry[i] && (w.mat[y * w.W + x] === M.WATER || !w.skyExposed(x, y) || !sim.daytime)) {
      sim.idx.query(a, x, y, 6, (j) => {
        if (a.colony[j] === a.colony[i] && a.task[j] === TASK.IDLE && a.caste[j] === CASTE.WORKER && lineOpen(sim, x, y, a.x[j], a.y[j])) {
          a.contacts[j] = Math.min(6, a.contacts[j] + a.pheno[i * 29 + P.BIOLUM]);
          a.why[j] = WHY.LIGHT_RECRUIT;
        }
      });
      sim.flags.biolumUsed = true;
    }
    if (foe < 0) { if (a.fightTarget[i] >= 0) a.fightTarget[i] = -1; continue; }
    if (a.caste[i] === CASTE.QUEEN && friends > 0) continue; // queens avoid fights when workers are present
    const fc = sim.colonies[a.colony[foe]];
    if (fc && fc !== c && rng.chance(0.25)) noteEncounter(sim, c, fc, x, y, friends, foes);
    // nestmate recognition failed (different colony): fight or retreat
    const soldier = isWarTask(a.task[i]);
    const major = a.major[i] === 1;
    // committed fighters and big-headed majors hold their ground longer
    const bold = courage(a.traits, i * 2);
    const injured = a.health[i] < (soldier || major ? 0.25 : 0.35) - (major ? 0.05 : 0) - bold * 0.04;
    const outnumbered = foes > friends + (soldier ? 5 : 2) + (major ? 3 : 0) + bold;
    const pinned = holders[i] >= 2;
    // a raider carrying stolen brood keeps running rather than fighting
    if (a.carryBrood[i] >= 0 && a.task[i] === TASK.RAID) continue;
    // fight or flight: soldiers on colony orders follow the rule of thumb; other workers ask their brain
    // (with the rule of thumb as an innate bias). Near death, fleeing is a reflex.
    let flee = injured || outnumbered, brainFlee = false;
    const sx = SENSE;
    if (!pinned && !soldier && a.caste[i] === CASTE.WORKER && a.task[i] !== TASK.FLEE && a.health[i] >= 0.12 && rng.chance(a.fightTarget[i] < 0 ? 0.5 : 0.1)) {
      senses(sim, i, c, sx);
      sx[S.FEAR] = Math.min(1, foes / (friends + 1) / 3); sx[S.RIVALS] = 1;
      flee = prefers(sim, c, i, sx, ACT.FLEE, ACT.DEFEND, (flee ? 1.5 : -1.5) - bold * 0.3 - (major ? 1 : 0));
      if (flee) { think(sim, c, i, sx, ALL_ACTS, ACT.FLEE); brainFlee = true; }
    } else if (a.task[i] === TASK.FLEE) flee = true;
    else if (!pinned && !soldier && a.caste[i] === CASTE.WORKER && a.health[i] >= 0.12) {
      if (a.fightTarget[i] < 0) continue; // still sizing up the rival
      flee = false; // already decided to fight: keep at it
    }
    if (flee && !pinned && a.caste[i] === CASTE.WORKER) {
      if (a.task[i] !== TASK.FLEE) {
        a.task[i] = TASK.FLEE; a.why[i] = brainFlee ? WHY.BRAIN_FLEE : WHY.FLEE_OUTNUMBERED; a.nav[i] = NAV.HOME; a.tx[i] = c.entrance.x; a.ty[i] = c.entrance.y; a.timer[i] = 60;
        a.fightTarget[i] = -1;
        if (a.carry[i] && FOOD_OF[a.carry[i]]) dropCarried(sim, i, false);
        // a retreating worker calls for help: alarm marks the spot it fled from
        c.alarm.add(x, y, sp.communication.alarmStrength * 0.7);
      }
      continue;
    }
    const aggressive = rng.chance(Math.min(1, sp.aggression * (0.5 + 0.15 * friends) * (a.task[i] === TASK.DEFEND ? 2 : aggressionFactor(c, a.task[i])) * (major ? 1.5 : 1) * aggressionTrait(a.traits, i * 2)));
    if (!aggressive) continue;
    a.fightTarget[i] = foe;
    a.why[i] = WHY.DEFEND_CONTACT;
    if (a.task[i] !== TASK.DEFEND && !soldier && a.caste[i] === CASTE.WORKER) {
      if (a.carry[i]) dropCarried(sim, i, false);
      a.task[i] = TASK.DEFEND; a.timer[i] = 30; a.nav[i] = NAV.STAY;
      senses(sim, i, c, sx); sx[S.FEAR] = Math.min(1, foes / (friends + 1) / 3); sx[S.RIVALS] = 1;
      think(sim, c, i, sx, ALL_ACTS, ACT.DEFEND);
      a.why[i] = WHY.BRAIN_FIGHT;
    }
    c.alarm.add(x, y, sp.communication.alarmStrength);
    const o = i * 29, fo = foe * 29;
    let dmg = 0.06 * a.pheno[o + P.ATTACK];
    dmg += 0.05 * sp.defense.power * a.pheno[o + P.CHEM] / Math.max(0.1, sp.traits.chem);
    if (foeD > 1) dmg *= 0.5; // spray at range
    dmg *= 1 - Math.min(0.85, a.pheno[fo + P.DEFENSE]);
    if (a.caste[foe] === CASTE.QUEEN) dmg *= 0.5;
    // a rival already held by nestmates is easier to wound; two or more holders pin it in place
    if (foeD <= 1) {
      dmg *= 1 + 0.5 * Math.min(4, holders[foe]);
      if (holders[foe] < 255) holders[foe]++;
      if (holders[foe] >= 2) a.moveAcc[foe] = Math.min(a.moveAcc[foe], -0.5);
    }
    // named traits: misses, dodges, venom, bad luck and spines
    const tr = a.traits, ti = i * 2, tf = foe * 2;
    if ((hasTrait(tr, ti, TR.clumsy) && rng.chance(0.15)) || (hasTrait(tr, tf, TR.agile) && rng.chance(0.15))) dmg = 0;
    if (hasTrait(tr, ti, TR.venomous)) dmg *= 1.3;
    if (hasTrait(tr, tf, TR.unlucky)) dmg *= 1.2;
    if (dmg > 0 && hasTrait(tr, tf, TR.thorns)) a.health[i] -= 0.02;
    a.health[foe] -= dmg;
    // a lucky ant sometimes survives a blow that should have killed it
    if (a.health[foe] <= 0 && hasTrait(tr, tf, TR.lucky) && rng.chance(0.25)) a.health[foe] = 0.1;
    a.energy[i] -= 0.002;
    if (fc) { fc.alarm.add(a.x[foe], a.y[foe], sim.speciesOf(fc).communication.alarmStrength * 0.6); }
    c.stats.fights++;
    sim.noteFight(c, fc);
    if (a.health[foe] <= 0) {
      if (fc && fc !== c) { noteKill(sim, c, fc); onKill(sim, c, i, fc); if (a.carryBrood[foe] >= 0) recaptureBrood(sim, i, c, foe, fc); }
      if (hasTrait(tr, tf, TR.acid_blood)) a.health[i] -= 0.25;
      sim.killAnt(foe, 'combat'); a.fightTarget[i] = -1;
      brainReward(sim, i, 1);
    }
    if (a.health[i] <= 0) { if (fc && fc !== c) { noteKill(sim, fc, c); onKill(sim, fc, foe, c); } sim.killAnt(i, 'combat'); }
  }
}

/** The killer of a brood-carrying rival takes the brood; it now belongs to (and is reared by) the killer's colony. */
function recaptureBrood(sim: Sim, i: number, c: Colony, foe: number, fc: Colony) {
  const a = sim.a;
  const k = fc.brood.findIndex((b) => b.id === a.carryBrood[foe]);
  a.carryBrood[foe] = -1;
  if (k < 0) return;
  const b = fc.brood.splice(k, 1)[0];
  b.x = a.x[foe]; b.y = a.y[foe]; b.carried = false;
  c.brood.push(b);
  const ws = warState(c);
  ws.recaptured = (ws.recaptured ?? 0) + 1;
  sim.journalUnlock('brood-recaptured');
  if (a.carry[i] || a.carryBrood[i] >= 0 || a.caste[i] !== CASTE.WORKER) return;
  b.carried = true; a.carryBrood[i] = b.id;
  a.task[i] = TASK.CARRY_BROOD; a.why[i] = WHY.RECAPTURE; a.nav[i] = NAV.GOAL; a.timer[i] = 400; a.stuck[i] = 0;
  const dest = c.chamber.x >= 0 ? c.chamber : c.entrance;
  a.tx[i] = dest.x; a.ty[i] = dest.y;
}

function contactOpen(sim: Sim, x0: number, y0: number, x1: number, y1: number): boolean {
  if (Math.abs(x1 - x0) <= 1 && Math.abs(y1 - y0) <= 1) {
    if (x0 !== x1 && y0 !== y1) return !(IS_SOLID[sim.w.get(x1, y0)] && IS_SOLID[sim.w.get(x0, y1)]);
    return true;
  }
  return lineOpen(sim, x0, y0, x1, y1);
}
