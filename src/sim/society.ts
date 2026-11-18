// WorldBox-style social layer on top of the biology.
// Individuals: every ant has a name, two personality traits (which bias its task choices and courage),
// a mood derived from its needs, a clan (its patriline: workers sharing a father) and, for notable ants,
// a short life story. Colonies: each is a kingdom with a ruler (the reigning queen), a culture, a
// chronicle of notable events, a morale level, and diplomacy (peace treaties and alliances) with rivals.
// Names, personalities and clans are derived deterministically from ids, so they cost no storage.
// All effects are authored game rules, not claims about real ant psychology.
import { CASTE } from './ants.ts';
import type { Colony } from './colony.ts';
import { DAY_TICKS } from './physics.ts';
import type { Sim } from './sim.ts';
import { relation } from './warfare.ts';

// ------------------------------------------------------------------ names

const SYL_A = ['ka', 'ri', 'mo', 'ta', 'ze', 'lu', 'ny', 'so', 'vi', 'dra', 'kel', 'ash', 'mir', 'tor', 'bel', 'qua', 'fen', 'ix', 'or', 'sa'];
const SYL_B = ['na', 'ra', 'lo', 'mi', 'th', 'ka', 'ri', 'sh', 'ne', 'vo', 'ia', 'el', 'un', 'ys', 'ar', 'ex', 'il', 'om', 'ue', 'ak'];
const hash = (n: number) => { let h = (n * 2654435761) >>> 0; h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 12; return h >>> 0; };

export function antName(id: number): string {
  if (!id) return 'Nobody';
  const h = hash(id);
  const n = SYL_A[h % 20] + SYL_B[(h >>> 5) % 20] + ((h >>> 10) % 3 === 0 ? SYL_B[(h >>> 13) % 20] : '');
  return n[0].toUpperCase() + n.slice(1);
}
export const clanName = (fatherId: number) => fatherId ? `House ${antName(fatherId + 7919)}` : 'the wild lineage';

const KINGDOM_A = ['Amber', 'Thorn', 'Moss', 'Ash', 'Clover', 'Bramble', 'Fern', 'Flint', 'Willow', 'Dusk', 'Hollow', 'Sorrel', 'Iron', 'Honey', 'Copper', 'Night'];
const KINGDOM_B = ['hold', 'deep', 'mound', 'reach', 'vale', 'burrow', 'crown', 'warren', 'spire', 'root'];
const kingdomName = (seed: number) => { const h = hash(seed + 31); return KINGDOM_A[h % KINGDOM_A.length] + KINGDOM_B[(h >>> 6) % KINGDOM_B.length]; };

// ------------------------------------------------------------------ personalities

export interface Personality { key: string; name: string; forage: number; nurse: number; dig: number; brave: number; explore: number; text: string }
export const PERSONALITIES: Personality[] = [
  { key: 'diligent', name: 'Diligent', forage: 1.25, nurse: 1.25, dig: 1.25, brave: 1, explore: 1, text: 'takes up work readily' },
  { key: 'lazy', name: 'Lazy', forage: 0.75, nurse: 0.75, dig: 0.7, brave: 1, explore: 0.9, text: 'rests whenever it can' },
  { key: 'brave', name: 'Brave', forage: 1, nurse: 1, dig: 1, brave: 1.5, explore: 1.1, text: 'answers alarms quickly and rarely retreats' },
  { key: 'timid', name: 'Timid', forage: 0.9, nurse: 1.15, dig: 1, brave: 0.6, explore: 0.85, text: 'avoids fights and danger' },
  { key: 'curious', name: 'Curious', forage: 1.15, nurse: 0.9, dig: 1, brave: 1, explore: 1.35, text: 'wanders far when scouting' },
  { key: 'homebody', name: 'Homebody', forage: 0.7, nurse: 1.3, dig: 1.15, brave: 1, explore: 0.75, text: 'prefers work inside the nest' },
  { key: 'nurturing', name: 'Nurturing', forage: 0.95, nurse: 1.45, dig: 0.9, brave: 1.1, explore: 1, text: 'drawn to caring for brood' },
  { key: 'restless', name: 'Restless', forage: 1.3, nurse: 0.8, dig: 1.1, brave: 1.1, explore: 1.2, text: 'always looking for something to do outside' },
  { key: 'stalwart', name: 'Stalwart', forage: 1, nurse: 1, dig: 1.3, brave: 1.25, explore: 0.9, text: 'a steady digger and defender' },
  { key: 'greedy', name: 'Greedy', forage: 1.2, nurse: 0.85, dig: 0.9, brave: 0.9, explore: 1.05, text: 'forages hard, shares grudgingly' },
];
const NP_ = PERSONALITIES.length;
/** The two personality traits of an ant (indices into PERSONALITIES). */
export function personalityOf(id: number): [number, number] {
  const h = hash(id ^ 0x5a5a);
  const p1 = h % NP_; let p2 = (h >>> 8) % NP_;
  if (p2 === p1) p2 = (p2 + 1) % NP_;
  return [p1, p2];
}
/** Combined multiplier of an ant's two personality traits for one trait axis. */
export function persona(id: number, axis: 'forage' | 'nurse' | 'dig' | 'brave' | 'explore'): number {
  const [p1, p2] = personalityOf(id);
  return Math.sqrt(PERSONALITIES[p1][axis] * PERSONALITIES[p2][axis]);
}

// ------------------------------------------------------------------ kingdoms

export type Culture = 'warlike' | 'peaceful' | 'industrious' | 'expansionist' | 'cautious';
export const CULTURES: Record<Culture, string> = {
  warlike: 'Warlike: quick to take offence and slow to forgive; rarely makes peace.',
  peaceful: 'Peaceful: grudges fade fast; seeks treaties with its neighbours.',
  industrious: 'Industrious: workers take up tasks readily; trades war for growth.',
  expansionist: 'Expansionist: forages widely and contests new ground.',
  cautious: 'Cautious: keeps workers close; allies readily against strong rivals.',
};
const CULTURE_KEYS = Object.keys(CULTURES) as Culture[];

export interface Treaty { kind: 'peace' | 'alliance'; since: number; until: number }
export interface Society {
  kingdom: string;
  culture: Culture;
  ruler: number;
  rulerName: string;
  reign: number;
  morale: number;
  chronicle: { tick: number; text: string }[];
  /** short life stories for notable living ants (ant id -> events) */
  bios: Record<number, string[]>;
  /** combat kills per living ant (heroes) */
  kills: Record<number, number>;
  /** treaties with rival colonies, by rival colony id */
  treaties: Record<number, Treaty>;
  /** recent adult deaths (decays daily), for morale and grief */
  grief: number;
}

export function society(sim: Sim, c: Colony): Society {
  if (c.society) return c.society;
  const s: Society = {
    kingdom: `Kingdom of ${kingdomName(c.id * 977 + sim.cfg.seed)}`,
    culture: CULTURE_KEYS[hash(c.id * 131 + sim.cfg.seed) % CULTURE_KEYS.length],
    ruler: 0, rulerName: '', reign: 0, morale: 0.7, chronicle: [], bios: {}, kills: {}, treaties: {}, grief: 0,
  };
  c.society = s;
  chronicle(sim, c, `${s.kingdom} was founded (${s.culture}).`);
  crown(sim, c);
  return s;
}

export function chronicle(sim: Sim, c: Colony, text: string, toEvents = false) {
  const s = c.society;
  if (!s) return;
  s.chronicle.push({ tick: sim.tick, text });
  if (s.chronicle.length > 40) s.chronicle.shift();
  if (toEvents) sim.event('kingdom', `${s.kingdom}: ${text}`, c);
}

/** Add a life event to an ant's story (kept for at most 300 ants per colony, 6 events each). */
export function bio(sim: Sim, c: Colony, antId: number, text: string) {
  const s = society(sim, c);
  let b = s.bios[antId];
  if (!b) {
    const keys = Object.keys(s.bios);
    if (keys.length >= 300) delete s.bios[Number(keys[0])];
    b = s.bios[antId] = [];
  }
  b.push(`Day ${Math.floor(sim.tick / DAY_TICKS) + 1}: ${text}`);
  if (b.length > 6) b.splice(1, 1); // keep the first entry (birth) and the most recent ones
}

function crown(sim: Sim, c: Colony) {
  const s = c.society!;
  const q = c.queens[0];
  if (!q) { if (s.ruler) { chronicle(sim, c, `Queen ${s.rulerName} is gone; the kingdom has no ruler.`, true); s.ruler = 0; s.rulerName = ''; } return; }
  if (q.antId === s.ruler) return;
  s.ruler = q.antId; s.rulerName = antName(q.antId); s.reign++;
  chronicle(sim, c, s.reign === 1 ? `Queen ${s.rulerName} rules.` : `Queen ${s.rulerName} took the throne (ruler #${s.reign}).`, s.reign > 1);
  bio(sim, c, q.antId, `Became ruler of ${s.kingdom}.`);
}

// ------------------------------------------------------------------ hooks from the simulation

export function onBorn(sim: Sim, c: Colony, i: number) {
  const a = sim.a;
  if (a.caste[i] === CASTE.QUEEN || a.caste[i] === CASTE.GYNE || a.major[i]) {
    const s = society(sim, c);
    bio(sim, c, a.id[i], `${a.caste[i] === CASTE.WORKER ? 'A soldier' : a.caste[i] === CASTE.GYNE ? 'A princess' : 'A queen'} was born in ${s.kingdom}, of ${clanName(a.father[i])}.`);
  }
}

export function onKill(sim: Sim, killerColony: Colony, killer: number, victimColony: Colony) {
  const s = society(sim, killerColony), id = sim.a.id[killer];
  const k = s.kills[id] = (s.kills[id] ?? 0) + 1;
  if (k === 1 || k === 3 || k === 10 || k % 25 === 0) bio(sim, killerColony, id, `Slew ${k === 1 ? 'its first' : `its ${k}th`} foe, a worker of ${society(sim, victimColony).kingdom}.`);
  if (k === 10) chronicle(sim, killerColony, `${antName(id)} of ${clanName(sim.a.father[killer])} became a war hero (10 foes slain).`, true);
}

export function onDeath(sim: Sim, c: Colony, i: number, cause: string) {
  const s = c.society;
  if (!s) return;
  const id = sim.a.id[i];
  const kills = s.kills[id] ?? 0;
  if (kills >= 10) chronicle(sim, c, `The hero ${antName(id)} died (${cause}) after slaying ${kills} foes.`);
  delete s.kills[id]; delete s.bios[id];
  if (sim.a.caste[i] === CASTE.WORKER) s.grief += 1;
}

export function onFoodFound(sim: Sim, c: Colony, i: number, what: string) {
  if (sim.rng.chance(0.02)) bio(sim, c, sim.a.id[i], `Found ${what} and led nestmates to it.`);
}

// ------------------------------------------------------------------ queries used by behaviour

const peaceCache = { tick: -1, pairs: new Set<number>() };
/** True when two colony slots are bound by a peace treaty or alliance (their workers do not start fights). */
export function atPeace(sim: Sim, slotA: number, slotB: number): boolean {
  if (peaceCache.tick !== sim.tick) {
    peaceCache.tick = sim.tick; peaceCache.pairs.clear();
    for (const c of sim.colonies) {
      if (!c || !c.alive || !c.society) continue;
      for (const [id, t] of Object.entries(c.society.treaties)) {
        if (t.until <= sim.tick) continue;
        const o = sim.colonies.find((x) => x && x.alive && x.id === Number(id));
        if (o) { peaceCache.pairs.add(c.slot * 256 + o.slot); peaceCache.pairs.add(o.slot * 256 + c.slot); }
      }
    }
  }
  return peaceCache.pairs.has(slotA * 256 + slotB);
}

export function cultureAggression(c: Colony) {
  const k = c.society?.culture;
  return k === 'warlike' ? 1.3 : k === 'peaceful' ? 0.75 : k === 'cautious' ? 0.9 : 1;
}

export function moodOf(sim: Sim, i: number): string {
  const a = sim.a, c = sim.colonies[a.colony[i]];
  if (a.health[i] < 0.4) return 'hurting';
  if (a.energy[i] < 0.2) return 'starving';
  if (a.hydration[i] < 0.25) return 'parched';
  if (c?.society && c.society.grief > Math.max(4, c.workers * 0.15)) return 'grieving';
  if (a.energy[i] < 0.4) return 'hungry';
  if (a.fightTarget[i] >= 0) return 'furious';
  const m = c?.society?.morale ?? 0.6;
  return m > 0.75 ? 'joyful' : m > 0.5 ? 'content' : 'uneasy';
}

// ------------------------------------------------------------------ daily kingdom update

const byId = (sim: Sim, id: number) => sim.colonies.find((o) => o && o.alive && o.id === id) ?? null;

/** Called once per model day: succession, morale, culture-driven grudges and diplomacy. */
export function societyDaily(sim: Sim) {
  const tick = sim.tick, cols = sim.aliveColonies();
  for (const c of cols) {
    const s = society(sim, c);
    crown(sim, c);
    for (const id of Object.keys(s.treaties)) if (s.treaties[Number(id)].until <= tick || !byId(sim, Number(id))) {
      const o = byId(sim, Number(id));
      if (o && s.treaties[Number(id)].until <= tick) chronicle(sim, c, `The ${s.treaties[Number(id)].kind} with ${society(sim, o).kingdom} ended.`);
      delete s.treaties[Number(id)];
    }
    // morale: food security, growth and losses
    const food = Math.min(1, (c.store.sugar + c.store.protein + c.store.seed * 0.5) / Math.max(5, c.adults * 2));
    const target = Math.max(0, Math.min(1, 0.35 + 0.45 * food + (c.queens.length ? 0.15 : -0.3) - Math.min(0.4, s.grief / Math.max(5, c.workers))));
    s.morale += 0.3 * (target - s.morale);
    s.grief *= 0.6;
    // culture shapes grudges
    for (const r of c.war?.relations ?? []) {
      if (s.culture === 'peaceful') r.hostility *= 0.85;
      else if (s.culture === 'warlike') r.hostility = Math.min(20, r.hostility * 1.05);
      if (s.treaties[r.id]) r.hostility = Math.min(r.hostility, 0.3);
    }
  }
  // diplomacy between pairs that know each other
  for (const c of cols) for (const r of c.war?.relations ?? []) {
    const o = byId(sim, r.id);
    if (!o || o.id < c.id) continue; // each pair once
    const sc = society(sim, c), so = society(sim, o);
    if (sc.treaties[o.id]) {
      // a warlike kingdom may break a peace it finds inconvenient
      if (sc.treaties[o.id].kind === 'peace' && (sc.culture === 'warlike' || so.culture === 'warlike') && sim.rng.chance(0.08)) {
        const breaker = sc.culture === 'warlike' ? c : o, victim = breaker === c ? o : c;
        delete sc.treaties[o.id]; delete so.treaties[c.id];
        relation(victim, breaker.id).hostility = Math.max(relation(victim, breaker.id).hostility, 2);
        chronicle(sim, breaker, `Queen ${society(sim, breaker).rulerName || '(none)'} broke the peace with ${society(sim, victim).kingdom}.`, true);
        chronicle(sim, victim, `Betrayed: ${society(sim, breaker).kingdom} broke the peace.`);
      }
      continue;
    }
    const back = relation(o, c.id);
    const hostile = Math.max(r.hostility, back.hostility);
    const losses = r.totalLosses + back.totalLosses;
    const weary = losses >= 12 && (sc.morale < 0.55 || so.morale < 0.55);
    const wantsPeace = (k: Society) => k.culture === 'peaceful' ? 1 : k.culture === 'warlike' ? 0.15 : 0.5;
    if (hostile > 0.8 && weary && sim.rng.chance(0.5 * wantsPeace(sc) * wantsPeace(so) + 0.05)) {
      sign(sim, c, o, 'peace', 8 + sim.rng.int(8));
      continue;
    }
    // alliance against a common enemy both are fighting
    if (hostile < 0.4 && r.encounters > 0.5) {
      const common = (c.war?.relations ?? []).find((e) => e.id !== o.id && e.hostility > 1.5 && byId(sim, e.id) && (o.war?.relations ?? []).some((f) => f.id === e.id && f.hostility > 1.5));
      const willing = sc.culture !== 'warlike' || so.culture !== 'warlike';
      if (common && willing && sim.rng.chance(0.3)) sign(sim, c, o, 'alliance', 12 + sim.rng.int(10), byId(sim, common.id));
    }
  }
}

function sign(sim: Sim, c: Colony, o: Colony, kind: 'peace' | 'alliance', days: number, against?: Colony | null) {
  const sc = society(sim, c), so = society(sim, o);
  const t: Treaty = { kind, since: sim.tick, until: sim.tick + days * DAY_TICKS };
  sc.treaties[o.id] = { ...t }; so.treaties[c.id] = { ...t };
  relation(c, o.id).hostility = Math.min(relation(c, o.id).hostility, 0.3);
  relation(o, c.id).hostility = Math.min(relation(o, c.id).hostility, 0.3);
  const text = kind === 'peace'
    ? `Queen ${sc.rulerName || '(none)'} of ${sc.kingdom} and Queen ${so.rulerName || '(none)'} of ${so.kingdom} made peace for ${days} days.`
    : `${sc.kingdom} and ${so.kingdom} allied for ${days} days${against ? ` against ${society(sim, against).kingdom}` : ''}.`;
  chronicle(sim, c, text); chronicle(sim, o, text);
  sim.event('diplomacy', text, c);
}

/** The colony's society with its ruler brought up to date (founding queens are crowned once registered). */
export function ensureRuler(sim: Sim, c: Colony) {
  const s = society(sim, c);
  if (s.ruler !== (c.queens[0]?.antId ?? 0)) crown(sim, c);
  return s;
}

/** Summary for the UI. */
export function societySummary(sim: Sim, c: Colony) {
  const s = ensureRuler(sim, c);
  const a = sim.a;
  const clans = new Map<number, number>();
  const heroes: { name: string; kills: number }[] = [];
  for (let i = 0; i < a.n; i++) {
    if (!a.alive[i] || a.colony[i] !== c.slot || a.caste[i] !== CASTE.WORKER) continue;
    clans.set(a.father[i], (clans.get(a.father[i]) ?? 0) + 1);
  }
  for (const [id, k] of Object.entries(s.kills)) if (k >= 3) heroes.push({ name: antName(Number(id)), kills: k });
  heroes.sort((p, q) => q.kills - p.kills);
  const relations = (c.war?.relations ?? []).map((r) => {
    const o = byId(sim, r.id);
    if (!o) return null;
    const t = s.treaties[r.id];
    const status = t && t.until > sim.tick ? t.kind : r.hostility > 1.2 ? 'war' : r.hostility > 0.4 ? 'tension' : 'neutral';
    return { id: o.id, kingdom: society(sim, o).kingdom, colony: o.name, status, hostility: Math.round(r.hostility * 10) / 10, days: t ? Math.max(0, Math.round((t.until - sim.tick) / DAY_TICKS)) : 0 };
  }).filter(Boolean);
  return {
    kingdom: s.kingdom, culture: s.culture, cultureText: CULTURES[s.culture], ruler: s.rulerName, reign: s.reign, morale: Math.round(s.morale * 100),
    clans: [...clans.entries()].sort((p, q) => q[1] - p[1]).slice(0, 6).map(([f, n]) => ({ name: clanName(f), members: n })),
    heroes: heroes.slice(0, 5), relations, chronicle: s.chronicle.slice(-12).reverse().map((e) => `Day ${Math.floor(e.tick / DAY_TICKS) + 1}: ${e.text}`),
  };
}
