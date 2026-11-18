// Inter-colony conflict: what a colony "knows" about its rivals, the strategy it adopts, and the
// war tasks (entrance guards, front-line fighters, raiders) that carry that strategy out.
//
// Biological grounding, deliberately applied to every species in this sandbox (player choice):
// - Colonies assess rivals through encounter rates and fight outcomes rather than global knowledge
//   (Adams 1990; Gordon's interaction-rate work). Here a colony only knows what its own workers met.
// - Many-on-one fights favour the larger force (Lanchester-type dynamics in ants: Franks & Partridge
//   1993; Plowes & Adams 2005). Several workers pin a rival while others bite, sting or spray.
// - Older workers take on risky outside work first ("precarious life"; Moroń et al. 2008).
// - Brood raiding between colonies, with captured pupae reared as workers, and fusion of defeated,
//   queenless colonies are documented in several genera (e.g. Messor pergandei and Solenopsis invicta
//   incipient colonies, Tschinkel 1992). Applying them to Lasius and Pogonomyrmex is a game extrapolation.
// - Entrance plugging under threat is known from many ground-nesting species.
// Numeric thresholds, quotas and decay rates are authored game rules.
import { CASTE, NAV, TASK, WHY } from './ants.ts';
import type { Colony, Relation, WarState } from './colony.ts';
import { STAGE } from './colony.ts';
import { IS_SOLID, M } from './materials.ts';
import type { Sim } from './sim.ts';

export const STRATEGY_EVERY = 150;

export function warState(c: Colony): WarState {
  return c.war ??= {
    strategy: 'grow', target: 0, since: 0, siegeUntil: 0, relations: [], raids: 0, raidsWon: 0, absorbed: 0, broodStolen: 0,
    raid: { active: false, target: 0, start: 0, brood: 0, food: 0, lossesAtStart: 0, party: 0 }, reports: [], reason: 'Building up the colony.',
  };
}

export function relation(c: Colony, id: number): Relation {
  const w = warState(c);
  let r = w.relations.find((r) => r.id === id);
  if (!r) {
    r = { id, encounters: 0, kills: 0, losses: 0, totalKills: 0, totalLosses: 0, reportKills: 0, reportLosses: 0, hostility: 0, ratio: 1,
      lastSeen: 0, nearNest: -1e9, frontX: -1, frontY: -1, nestKnown: false, nestX: 0, nestY: 0, broodStolen: 0, broodLost: 0 };
    w.relations.push(r);
  }
  return r;
}

const byId = (sim: Sim, id: number) => sim.colonies.find((o) => o && o.id === id && o.alive) ?? null;
const d2 = (x0: number, y0: number, x1: number, y1: number) => (x1 - x0) ** 2 + (y1 - y0) ** 2;
const WAR_TASKS = new Set<number>([TASK.GUARD, TASK.WAR, TASK.RAID]);
export const isWarTask = (t: number) => WAR_TASKS.has(t);

// ------------------------------------------------------------------ contact hooks

/** A worker of `c` met a worker of `fc` at (x,y); friends/foes are the ants it could sense around it. */
export function noteEncounter(sim: Sim, c: Colony, fc: Colony, x: number, y: number, friends: number, foes: number) {
  const r = relation(c, fc.id);
  r.encounters++;
  r.ratio += 0.03 * (foes / (friends + 1) - r.ratio);
  r.lastSeen = sim.tick;
  r.hostility = Math.min(20, r.hostility + 0.004);
  if (r.frontX < 0) { r.frontX = x; r.frontY = y; } else { r.frontX += 0.08 * (x - r.frontX); r.frontY += 0.08 * (y - r.frontY); }
  if (d2(x, y, c.entrance.x, c.entrance.y) < 900) r.nearNest = sim.tick;
  // contact with a rival standing on its own nest cells reveals where that nest is
  if (!r.nestKnown && sim.w.owner[y * sim.w.W + x] === fc.slot + 1) { r.nestKnown = true; r.nestX = fc.entrance.x; r.nestY = fc.entrance.y; }
}

export function noteKill(sim: Sim, killer: Colony, victim: Colony) {
  const k = relation(killer, victim.id), v = relation(victim, killer.id);
  k.kills++; k.totalKills++; k.reportKills++; k.hostility = Math.min(20, k.hostility + 0.08);
  v.losses++; v.totalLosses++; v.reportLosses++; v.hostility = Math.min(20, v.hostility + 0.14);
  if (killer.stats.fights > 0 && k.totalKills === 1) sim.journalUnlock('colony-war');
}

/** Behavioural modifiers read by individual decisions. */
export function aggressionFactor(c: Colony, task: number) {
  const s = c.war?.strategy;
  if (isWarTask(task)) return 2.5;
  return s === 'grow' ? 0.6 : s === 'war' || s === 'raid' ? 1.3 : 1;
}
export function forageFactor(c: Colony) {
  const s = c.war?.strategy;
  return s === 'fortify' ? 0.15 : s === 'defend' ? 0.6 : s === 'war' ? 0.8 : 1;
}
export function underSiege(sim: Sim, c: Colony) { return !!c.war && c.war.siegeUntil > sim.tick; }

/** Perceived competition 0..1 from the colony's own encounter memory. */
function competition(sim: Sim, c: Colony) {
  let t = 0;
  for (const r of c.war?.relations ?? []) if (byId(sim, r.id)) t = Math.max(t, Math.min(1, r.hostility / 2 + (sim.tick - r.lastSeen < 3600 ? 0.3 : 0)));
  return t;
}

/** Share of new workers a dimorphic colony aims to rear as majors: rises after meeting rivals (Passera et al. 1996). */
export function majorTarget(sim: Sim, c: Colony) {
  const sol = sim.speciesOf(c).workers.soldiers;
  return sol ? sol.baseFraction + (sol.maxFraction - sol.baseFraction) * competition(sim, c) : 0;
}

/** Probability that a hatching worker larva is put on the major pathway (steers the live major share toward the target). */
export function majorChance(sim: Sim, c: Colony) {
  const target = majorTarget(sim, c);
  const share = (c.war?.majors ?? 0) / Math.max(1, c.workers);
  return Math.min(0.9, target * (share < target ? 1.6 : 0.4));
}

/** Nestmates on the same war task close by: a squad sets out together rather than in a trickle. */
function squadNear(sim: Sim, i: number) {
  const a = sim.a;
  let n = 0;
  sim.idx.query(a, a.x[i], a.y[i], 5, (j) => { if (j !== i && a.colony[j] === a.colony[i] && a.task[j] === a.task[i]) n++; });
  return n;
}
const MUSTER_SQUAD = 3;

// ------------------------------------------------------------------ colony strategy

function report(sim: Sim, cs: Colony[], text: string, kind = 'battle') {
  for (const c of cs) { const w = warState(c); w.reports.push({ tick: sim.tick, text }); if (w.reports.length > 12) w.reports.shift(); }
  sim.event(kind, text, cs[0]);
}

/** Every STRATEGY_EVERY ticks: decay memory, learn rival nest sites, pick a strategy and staff it. */
export function updateStrategy(sim: Sim, c: Colony) {
  const w = warState(c), a = sim.a, tick = sim.tick;
  // ---- memory decay and pruning ----
  for (const r of w.relations) { r.kills *= 0.9; r.losses *= 0.9; r.encounters *= 0.9; r.hostility *= 0.985; }
  w.relations = w.relations.filter((r) => byId(sim, r.id) || r.hostility > 0.05 && tick - r.lastSeen < 6000);
  // ---- battle reports (one per pair, written by the colony with the lower id) ----
  for (const r of w.relations) {
    const o = byId(sim, r.id);
    if (!o || r.reportKills + r.reportLosses < 3 || c.id > o.id) continue;
    const x = Math.round(r.frontX);
    report(sim, [c, o], `Battle near x=${x}: ${c.name} lost ${r.reportLosses}, ${o.name} lost ${r.reportKills}.`);
    r.reportKills = r.reportLosses = 0;
    const back = relation(o, c.id); back.reportKills = back.reportLosses = 0;
  }
  // ---- one pass over our ants: war-task counts, recruits, nest discovery ----
  const counts = [0, 0, 0];
  const recruits: number[] = [];
  const hunting = w.relations.filter((r) => !r.nestKnown && r.hostility > 0.2);
  const inTarget: Record<number, number> = {};
  let majors = 0;
  for (let i = 0; i < a.n; i++) {
    if (!a.alive[i] || a.colony[i] !== c.slot || a.caste[i] !== CASTE.WORKER) continue;
    if (a.major[i]) majors++;
    const t = a.task[i];
    if (t === TASK.GUARD) counts[0]++; else if (t === TASK.WAR) counts[1]++; else if (t === TASK.RAID) counts[2]++;
    const own = sim.w.owner[a.y[i] * sim.w.W + a.x[i]];
    if (t === TASK.RAID && own && own !== c.slot + 1) inTarget[own - 1] = (inTarget[own - 1] ?? 0) + 1;
    if (hunting.length && own !== c.slot + 1) for (const r of hunting) {
      const o = byId(sim, r.id);
      if (o && d2(a.x[i], a.y[i], o.entrance.x, o.entrance.y) < 100) { r.nestKnown = true; r.nestX = o.entrance.x; r.nestY = o.entrance.y; }
    }
    const free = (t === TASK.IDLE || t === TASK.FORAGE || t === TASK.DIG || t === TASK.WASTE || t === TASK.DEFEND) && !a.carry[i] && a.carryBrood[i] < 0;
    if (free && a.health[i] > 0.6 && a.age[i] >= 2) recruits.push(i);
  }
  w.majors = majors;
  if (sim.speciesOf(c).workers.soldiers) w.majorTarget = majorTarget(sim, c);
  // rival nests move when entrances are re-dug; keep known positions current
  for (const r of w.relations) { const o = byId(sim, r.id); if (o && r.nestKnown) { r.nestX = o.entrance.x; r.nestY = o.entrance.y; } }
  // ---- call off a raid that is bleeding raiders without taking anything ----
  if (w.raid.active && counts[2] > 0) {
    const lost = Math.max(0, relation(c, w.raid.target).totalLosses - w.raid.lossesAtStart);
    if (lost > Math.max(3, w.raid.party * 0.5) && w.raid.brood + w.raid.food === 0) {
      for (let i = 0; i < a.n; i++) if (a.alive[i] && a.colony[i] === c.slot && a.task[i] === TASK.RAID && a.carryBrood[i] < 0) goHome(sim, i, c, WHY.RAID_HOME);
      counts[2] = 0;
      report(sim, [c], `${c.name} called off its raid after losing ${lost} raiders.`, 'raid');
    }
  }
  // ---- close out a finished raid ----
  if (w.raid.active && counts[2] === 0 && tick - w.raid.start > 120) {
    const o = sim.colonies.find((x) => x && x.id === w.raid.target);
    const r = relation(c, w.raid.target);
    const lost = Math.max(0, r.totalLosses - w.raid.lossesAtStart);
    const won = w.raid.brood + w.raid.food > 0;
    if (won) w.raidsWon++;
    report(sim, [c], `${c.name} raid on ${o?.name ?? 'a rival'} ${won ? `returned with ${w.raid.brood} brood and ${w.raid.food} food` : 'failed to take anything'}; ${lost} raider${lost === 1 ? '' : 's'} lost of ${w.raid.party}.`, 'raid');
    w.raid.active = false;
  }
  // ---- choose a strategy ----
  const prev = w.strategy;
  const alive = w.relations.filter((r) => byId(sim, r.id));
  const threat = alive.filter((r) => tick - r.nearNest < 900).sort((p, q) => q.hostility - p.hostility)[0];
  const enemy = alive.slice().sort((p, q) => q.hostility - p.hostility)[0];
  const winRate = (r: Relation) => (r.totalKills + 1) / (r.totalKills + r.totalLosses + 2);
  let s = w.strategy, target = 0, reason = '';
  if (c.stage === 'founding' || c.workers < 10) { s = 'grow'; reason = 'Too few workers to risk fights; avoiding rivals and rearing brood.'; }
  else if (threat) {
    target = threat.id;
    if (threat.losses > Math.max(3, threat.kills * 1.8)) { s = 'fortify'; reason = 'Losing fights near the nest: plugging the entrance and keeping workers inside.'; }
    else { s = 'defend'; reason = 'Rival workers are close to the nest: posting guards and holding the entrance.'; }
  } else if (enemy && enemy.hostility > 1.2) {
    target = enemy.id;
    const o = byId(sim, enemy.id)!;
    const strong = c.workers >= 24 && enemy.ratio < 1.1 && winRate(enemy) >= 0.5;
    if (w.strategy === 'raid' && w.raid.active) { s = 'raid'; reason = `Raid under way against ${o.name}.`; }
    else if (enemy.losses > Math.max(4, enemy.kills * 2)) { s = 'forage'; reason = `Losing the recent battles against ${o.name}: pulling back from the front.`; }
    else if (strong && enemy.nestKnown && (c.workers > o.workers * 0.8 || !o.queens.length)) { s = 'raid'; reason = `Stronger than ${o.name} in recent fights and knows where its nest is: raiding for brood and food.`; }
    else if (winRate(enemy) >= 0.4) { s = 'war'; reason = `Contesting the foraging ground against ${o.name}.`; }
    else { s = 'forage'; reason = `Avoiding ${o.name}, which has won most fights.`; }
  } else { s = c.stim.forage > 0.6 ? 'forage' : 'grow'; reason = s === 'forage' ? 'No active rivals; colony is hungry and foraging widely.' : 'No active rivals; growing the colony.'; }
  if (s !== prev) {
    w.since = tick;
    const o = target ? byId(sim, target) : null;
    if (s === 'war' || s === 'raid' || s === 'fortify') sim.event('strategy', `${c.name} ${s === 'war' ? `went to war with ${o?.name}` : s === 'raid' ? `is preparing to raid ${o?.name}` : `is under pressure from ${o?.name} and fortified its nest`}.`, c);
  }
  w.strategy = s; w.target = target; w.reason = reason;
  // ---- staff the strategy: majors (soldiers) first, then the oldest healthy minors ----
  recruits.sort((p, q) => a.major[q] - a.major[p] || a.age[q] - a.age[p]);
  const W = c.workers;
  const quota = [
    s === 'defend' || s === 'fortify' ? 2 + Math.round(W * 0.08) : s === 'war' || s === 'raid' ? 1 + Math.round(W * 0.04) : W > 40 ? 1 : 0,
    s === 'war' ? Math.round(W * 0.3) : s === 'defend' ? Math.round(W * 0.12) : 0,
    0,
  ];
  // a colony that has met rivals keeps some of its majors posted at the entrance even in peacetime
  if (majors && alive.length) quota[0] = Math.max(quota[0], Math.min(majors, 1 + Math.round(majors * 0.3)));
  const tr = target ? relation(c, target) : null;
  // raids are discrete expeditions with a rest period between them
  if (s === 'raid' && tr && !w.raid.active && (w.raids === 0 || tick - w.raid.start > 1500)) {
    quota[2] = Math.max(5, Math.min(60, Math.round(W * 0.35)));
    // an open breach between the two tunnel networks lets the raid go underground (infiltration)
    const o = byId(sim, target);
    const ct = o ? c.plan?.contacts?.find((k) => k.colony === target && k.breached && breachOpen(sim, c, o, k.x, k.y, k.dir)) : undefined;
    w.raid = { active: true, target, start: tick, brood: 0, food: 0, lossesAtStart: tr.totalLosses, party: 0, ...(ct ? { tunnel: { x: ct.x, y: ct.y, dir: ct.dir } } : {}) };
    w.raids++;
  }
  // at war with a breached neighbour: send a few infiltrators through the tunnels even without a raid
  if (s === 'war' && tr && !w.raid.active && tick - w.raid.start > 2400) {
    const o = byId(sim, target);
    const ct = o ? c.plan?.contacts?.find((k) => k.colony === target && k.breached && breachOpen(sim, c, o, k.x, k.y, k.dir)) : undefined;
    if (ct) {
      quota[2] = Math.max(4, Math.round(W * 0.12));
      w.raid = { active: true, target, start: tick, brood: 0, food: 0, lossesAtStart: tr.totalLosses, party: 0, tunnel: { x: ct.x, y: ct.y, dir: ct.dir } };
      w.raids++;
    }
  }
  let ri = 0;
  for (const kind of [0, 1, 2]) {
    let need = quota[kind] - counts[kind];
    while (need > 0 && ri < recruits.length) {
      const i = recruits[ri++];
      if (kind === 0) { a.task[i] = TASK.GUARD; a.why[i] = WHY.GUARD; a.nav[i] = NAV.GOAL; a.tx[i] = c.entrance.x; a.ty[i] = c.entrance.y; a.timer[i] = 0; }
      else if (kind === 1) {
        if (!tr || tr.frontX < 0) break;
        a.task[i] = TASK.WAR; a.why[i] = WHY.MUSTER; a.nav[i] = NAV.EXIT; a.tx[i] = Math.round(tr.frontX); a.ty[i] = Math.round(tr.frontY); a.timer[i] = 260;
      } else {
        const tun = w.raid.tunnel;
        if (tun) { a.task[i] = TASK.RAID; a.why[i] = WHY.INFILTRATE; a.nav[i] = NAV.TUNNEL; a.tx[i] = tun.x; a.ty[i] = tun.y; a.timer[i] = 2400; }
        else { a.task[i] = TASK.RAID; a.why[i] = WHY.MUSTER; a.nav[i] = NAV.EXIT; a.tx[i] = tr!.nestX; a.ty[i] = tr!.nestY; a.timer[i] = 700; }
        w.raid.party++;
      }
      a.fightTarget[i] = -1; a.memLen[i] = 0; a.stuck[i] = 0; a.fails[i] = 0;
      need--;
    }
  }
  if (w.raid.party && w.raid.start === tick) {
    const o = byId(sim, target);
    report(sim, [c], w.raid.tunnel ? `${c.name} sent ${w.raid.party} infiltrators through the tunnels into ${o?.name}'s territory.` : `${c.name} sent ${w.raid.party} raiders against ${o?.name}.`, 'raid');
  }
  // release surplus guards/fighters when the strategy no longer calls for them
  for (const kind of [0, 1]) {
    let extra = counts[kind] - quota[kind];
    if (extra <= 0) continue;
    const t = kind === 0 ? TASK.GUARD : TASK.WAR;
    for (let i = 0; i < a.n && extra > 0; i++) if (a.alive[i] && a.colony[i] === c.slot && a.task[i] === t) { a.task[i] = TASK.IDLE; a.nav[i] = NAV.HOME; a.tx[i] = c.entrance.x; a.ty[i] = c.entrance.y; extra--; }
  }
  // ---- fortify: plug the entrance while rivals are at the door ----
  if (s === 'fortify' && c.hasExit && sim.idx.hasForeign(c.entrance.x, c.entrance.y, 10, c.slot)) {
    sim.sealShaft(c);
    w.siegeUntil = tick + 900;
    report(sim, [c], `${c.name} plugged its entrance with soil against attackers.`, 'siege');
    sim.journalUnlock('entrance-plugged');
  }
  // ---- absorption of a beaten, queenless rival ----
  for (const r of alive) {
    const o = byId(sim, r.id)!;
    if (o.queens.length || r.hostility < 0.8) continue;
    const occupied = (inTarget[o.slot] ?? 0) >= 2;
    if ((occupied && o.workers <= c.workers * 0.6) || (o.workers <= 4 && r.nestKnown)) { absorb(sim, o, c); break; }
  }
}

/** True when colony c's tunnels touch target o's open tunnels near a border contact. */
export function breachOpen(sim: Sim, c: Colony, o: Colony, x: number, y: number, dir: number) {
  const w = sim.w, own = c.slot + 1, their = o.slot + 1;
  for (let s = -2; s <= 18; s++) for (let dy = -3; dy <= 2; dy++) {
    const xx = x + dir * s, yy = y + dy;
    if (!w.inb(xx, yy) || !w.inb(xx + 1, yy + 1)) continue;
    const k = yy * w.W + xx;
    if (w.owner[k] !== own || IS_SOLID[w.mat[k]]) continue;
    for (const j of [k - 1, k + 1, k - w.W, k + w.W]) if (w.owner[j] === their && !IS_SOLID[w.mat[j]]) return true;
  }
  return false;
}

// ------------------------------------------------------------------ absorption

/** A defeated queenless colony's adults, brood, stores and nest are adopted by the victor. */
export function absorb(sim: Sim, lo: Colony, wi: Colony) {
  const a = sim.a, w = sim.w;
  let adults = 0;
  for (let i = 0; i < a.n; i++) {
    if (!a.alive[i] || a.colony[i] !== lo.slot) continue;
    a.colony[i] = wi.slot; adults++; wi.adults++;
    if (a.caste[i] === CASTE.WORKER) { wi.workers++; a.task[i] = TASK.IDLE; a.why[i] = WHY.ABSORBED; a.nav[i] = NAV.NEST_WANDER; a.fightTarget[i] = -1; }
  }
  const brood = lo.brood.length;
  wi.brood.push(...lo.brood); lo.brood = [];
  wi.store.sugar += lo.store.sugar; wi.store.protein += lo.store.protein; wi.store.seed += lo.store.seed; wi.store.mineral += lo.store.mineral;
  lo.store = { sugar: 0, protein: 0, seed: 0, mineral: 0 };
  wi.corpsesInside += lo.corpsesInside;
  for (let k = 0; k < w.N; k++) if (w.owner[k] === lo.slot + 1) w.owner[k] = wi.slot + 1;
  lo.workers = 0; lo.adults = 0; lo.alive = false; lo.stage = 'dead'; lo.diedTick = sim.tick;
  sim.nestCells.delete(lo.slot);
  const rec = sim.lineage.find((r) => r.id === lo.id);
  if (rec) { rec.diedTick = sim.tick; rec.causeOfEnd = `absorbed by ${wi.name}`; rec.peakWorkers = lo.stats.peakWorkers; }
  const ws = warState(wi);
  ws.absorbed++;
  ws.relations = ws.relations.filter((r) => r.id !== lo.id);
  if (ws.target === lo.id) { ws.target = 0; ws.strategy = 'grow'; }
  report(sim, [wi], `${wi.name} absorbed the beaten, queenless ${lo.name}: ${adults} adults and ${brood} brood adopted, its nest annexed as a satellite.`, 'absorption');
  sim.journalUnlock('colony-absorbed');
  sim.scanNest(wi);
}

// ------------------------------------------------------------------ war tasks (individual decisions)

export function decideWarTask(sim: Sim, i: number, c: Colony, own: boolean) {
  const a = sim.a;
  if (a.task[i] === TASK.GUARD) return decideGuard(sim, i, c);
  if (a.health[i] < 0.3 && a.carryBrood[i] < 0) { a.task[i] = TASK.FLEE; a.why[i] = WHY.FLEE_OUTNUMBERED; a.nav[i] = NAV.HOME; a.tx[i] = c.entrance.x; a.ty[i] = c.entrance.y; a.timer[i] = 60; return; }
  if (a.task[i] === TASK.WAR) return decideFront(sim, i, c, own);
  return decideRaid(sim, i, c, own);
}

function goHome(sim: Sim, i: number, c: Colony, why: number) {
  const a = sim.a;
  a.task[i] = TASK.IDLE; a.why[i] = why; a.nav[i] = NAV.HOME; a.tx[i] = c.entrance.x; a.ty[i] = c.entrance.y; a.stuck[i] = 0;
}

/** Recruits gather just outside the entrance until a small squad has formed (or they tire of waiting). */
function muster(sim: Sim, i: number, own: boolean): boolean {
  const a = sim.a;
  if (a.why[i] !== WHY.MUSTER) return false;
  const ready = !own && squadNear(sim, i) + 1 >= MUSTER_SQUAD;
  if (ready || ++a.fails[i] > (own ? 60 : 30)) {
    a.fails[i] = 0; a.stuck[i] = 0;
    a.why[i] = a.task[i] === TASK.WAR ? WHY.WAR_MARCH : WHY.RAID_MARCH;
    return false;
  }
  a.nav[i] = own ? NAV.EXIT : NAV.NEST_WANDER;
  return true;
}

function decideGuard(sim: Sim, i: number, c: Colony) {
  const a = sim.a;
  // guards hold the top of the entrance shaft; contact phase handles any fighting
  if (d2(a.x[i], a.y[i], c.entrance.x, c.entrance.y + 1) <= 4) { a.nav[i] = NAV.STAY; a.timer[i] = 0; }
  else { a.nav[i] = NAV.GOAL; a.tx[i] = c.entrance.x; a.ty[i] = c.entrance.y + 1; if (a.stuck[i] > 60) { a.nav[i] = NAV.EXIT; a.stuck[i] = 0; } }
}

function decideFront(sim: Sim, i: number, c: Colony, own: boolean) {
  const a = sim.a, w = c.war;
  const r = w && w.target ? w.relations.find((r) => r.id === w.target) : null;
  if (!r || r.frontX < 0) return goHome(sim, i, c, WHY.RETURN_EMPTY);
  if (muster(sim, i, own)) return;
  if (--a.timer[i] <= 0) return goHome(sim, i, c, WHY.RETURN_EMPTY);
  const fx = Math.round(r.frontX), fy = Math.round(r.frontY);
  if (own) { a.nav[i] = NAV.EXIT; return; }
  if (d2(a.x[i], a.y[i], fx, fy) > 100) { a.nav[i] = NAV.GOAL; a.tx[i] = fx; a.ty[i] = fy; a.why[i] = WHY.WAR_MARCH; if (a.stuck[i] > 50) { a.nav[i] = NAV.WANDER; a.stuck[i] = 0; } }
  else { a.why[i] = WHY.WAR_FRONT; a.nav[i] = c.alarm.get(a.x[i], a.y[i]) > 0.05 ? NAV.ALARM : NAV.WANDER; }
}

const LOOT_FOOD: [keyof Colony['store'], number, number][] = [['sugar', M.SUGAR, 1], ['protein', M.PROTEIN, 2], ['seed', M.SEED, 3]];

function decideRaid(sim: Sim, i: number, c: Colony, own: boolean) {
  const a = sim.a, w = sim.w, ws = warState(c);
  const x = a.x[i], y = a.y[i];
  const o = byId(sim, ws.raid.target);
  // carrying stolen brood: bring it home and set it down among our own brood
  if (a.carryBrood[i] >= 0) {
    if (own && y > c.entrance.y + 1) {
      const b = sim.broodById(c.slot, a.carryBrood[i]);
      if (b) { b.carried = false; b.x = x; b.y = y; }
      a.carryBrood[i] = -1; a.task[i] = TASK.IDLE; a.nav[i] = NAV.NEST_CUE; a.why[i] = WHY.RAID_HOME;
      return;
    }
    a.why[i] = WHY.RAID_LOOT_BROOD;
    // infiltrators carry their loot back the way they came, through the tunnels
    if (ws.raid.tunnel && !own && w.owner[y * w.W + x]) { a.nav[i] = NAV.TUNNEL; a.tx[i] = c.chamber.x >= 0 ? c.chamber.x : c.entrance.x; a.ty[i] = c.chamber.x >= 0 ? c.chamber.y : c.entrance.y; return; }
    const inForeign = w.owner[y * w.W + x] && !own;
    a.nav[i] = own ? NAV.NEST_CUE : inForeign ? NAV.EXIT : NAV.HOME; a.tx[i] = c.entrance.x; a.ty[i] = c.entrance.y;
    if (inForeign && a.stuck[i] > 40) { a.nav[i] = NAV.UP; a.stuck[i] = 0; }
    return;
  }
  if (!o) return goHome(sim, i, c, WHY.RAID_HOME);
  const tun = ws.raid.tunnel;
  if (!tun && muster(sim, i, own)) return;
  if (--a.timer[i] <= 0) return goHome(sim, i, c, WHY.RAID_HOME);
  const here = w.owner[y * w.W + x];
  if (here === o.slot + 1) {
    if (tun && !ws.raid.entered) {
      ws.raid.entered = true;
      report(sim, [c, o], `Infiltrators of ${c.name} broke into ${o.name}'s tunnels at x=${x}.`, 'raid');
    }
    a.why[i] = WHY.RAID_DELVE; a.nav[i] = NAV.DELVE;
    // seize the nearest unguarded brood item; pupae first, they are closest to becoming workers
    let pick = -1, best = -1;
    for (let k = 0; k < o.brood.length; k++) {
      const b = o.brood[k];
      if (b.carried || Math.abs(b.x - x) > 2 || Math.abs(b.y - y) > 2) continue;
      const s = b.stage === STAGE.PUPA ? 3 : b.stage === STAGE.LARVA ? 2 : 1;
      if (s > best) { best = s; pick = k; }
    }
    if (pick >= 0) {
      const b = o.brood.splice(pick, 1)[0];
      b.carried = true; b.x = x; b.y = y;
      c.brood.push(b);
      a.carryBrood[i] = b.id;
      for (let j = 0; j < a.n; j++) if (a.alive[j] && a.colony[j] === o.slot && (a.carryBrood[j] === b.id || a.carryBrood[j] === -1 - b.id)) a.carryBrood[j] = -1;
      relation(c, o.id).broodStolen++; relation(o, c.id).broodLost++;
      relation(o, c.id).hostility = Math.min(20, relation(o, c.id).hostility + 0.3);
      ws.raid.brood++; ws.broodStolen++;
      a.why[i] = WHY.RAID_LOOT_BROOD; a.nav[i] = NAV.EXIT; a.stuck[i] = 0;
      if (ws.raid.brood === 1) sim.event('raid', `${c.name} raiders seized brood inside ${o.name}'s nest.`, c);
      sim.journalUnlock('brood-raid');
      return;
    }
    // no brood within reach: occasionally take food from the rival's stores instead
    if (sim.rng.chance(0.06)) for (const [key, mat, f] of LOOT_FOOD) {
      if (o.store[key] < 1) continue;
      o.store[key]--; sim.carriedFood[f - 1]++;
      a.carry[i] = mat; a.carryQ[i] = 0.6;
      a.task[i] = TASK.RETURN; a.why[i] = WHY.RAID_LOOT_FOOD; a.nav[i] = NAV.HOME; a.tx[i] = c.entrance.x; a.ty[i] = c.entrance.y; a.stuck[i] = 0;
      ws.raid.food++;
      return;
    }
    if (a.stuck[i] > 80) { a.nav[i] = NAV.WANDER; a.stuck[i] = 0; }
    return;
  }
  // infiltrating: through our own tunnels to the breach, then push into theirs toward the rival nest
  if (tun) {
    a.why[i] = WHY.INFILTRATE;
    if (d2(x, y, tun.x, tun.y) <= 16 || !own) { a.nav[i] = NAV.DELVE; a.tx[i] = o.entrance.x; a.ty[i] = Math.max(o.entrance.y, tun.y); }
    else { a.nav[i] = NAV.TUNNEL; a.tx[i] = tun.x; a.ty[i] = tun.y; }
    if (a.stuck[i] > 80) { a.nav[i] = NAV.NEST_WANDER; a.stuck[i] = 0; }
    return;
  }
  // marching on the rival nest
  if (own) { a.nav[i] = NAV.EXIT; a.why[i] = WHY.RAID_MARCH; return; }
  a.why[i] = WHY.RAID_MARCH;
  a.tx[i] = o.entrance.x; a.ty[i] = o.entrance.y;
  a.nav[i] = d2(x, y, o.entrance.x, o.entrance.y) <= 16 ? NAV.DELVE : NAV.GOAL;
  if (a.stuck[i] > 60) { a.nav[i] = NAV.WANDER; a.stuck[i] = 0; }
}
