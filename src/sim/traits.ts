// Named traits: a WorldBox-style layer of discrete, inheritable characteristics on top of the quantitative
// genome (genetics.ts). Every ant carries a small set of named traits (a 64-bit mask). Offspring inherit
// each parent's traits with a per-trait chance, rarely gain new ones at birth, and opposite traits are
// mutually exclusive. Effects are applied to the phenotype at emergence and to a few behaviours at run time.
//
// This is a GAME ABSTRACTION, not ant biology: there are no real "lucky" or "brave" genes. The numbers are
// authored for play. Traits marked fantasy only appear (and are only inherited) in Fantasy mode.
import { P } from './genetics.ts';
import type { Mode } from './genetics.ts';
import { MODES } from './genetics.ts';
import type { Rng } from './rng.ts';

export type TraitGroup = 'body' | 'mind' | 'combat' | 'survival' | 'work' | 'fantasy';
export type TraitTone = 'good' | 'bad' | 'mixed';

export interface TraitDef {
  key: string;
  name: string;
  group: TraitGroup;
  tone: TraitTone;
  description: string;
  /** key of the mutually exclusive opposite trait */
  opposite?: string;
  /** chance that a parent carrying the trait passes it on (WorldBox-like inheritance) */
  inherit: number;
  /** chance an offspring gains the trait spontaneously at birth */
  birth: number;
  fantasy?: boolean;
  /** multiplicative phenotype effects (applied at emergence; divided out if the trait is removed) */
  mul?: Partial<Record<keyof typeof P, number>>;
  /** additive phenotype effects */
  add?: Partial<Record<keyof typeof P, number>>;
}

const T = (key: string, name: string, group: TraitGroup, tone: TraitTone, description: string, o: Partial<TraitDef> = {}): TraitDef =>
  ({ key, name, group, tone, description, inherit: 0.45, birth: 0.012, ...o });

export const TRAITS: TraitDef[] = [
  // ---- body ----
  T('strong', 'Strong', 'body', 'good', 'Powerful mandibles: +30% attack.', { opposite: 'weak', mul: { ATTACK: 1.3 } }),
  T('weak', 'Weak', 'body', 'bad', 'Feeble bite: -30% attack.', { opposite: 'strong', mul: { ATTACK: 0.7 } }),
  T('fast', 'Fast', 'body', 'good', 'Quick legs: +20% speed.', { opposite: 'slow', mul: { SPEED: 1.2 } }),
  T('slow', 'Slow', 'body', 'bad', 'Sluggish: -20% speed.', { opposite: 'fast', mul: { SPEED: 0.8 } }),
  T('tough', 'Tough', 'body', 'good', 'Hard cuticle: blocks more damage.', { opposite: 'fragile', add: { DEFENSE: 0.15 } }),
  T('fragile', 'Fragile', 'body', 'bad', 'Thin cuticle: takes more damage.', { opposite: 'tough', add: { DEFENSE: -0.15 } }),
  T('giant', 'Giant', 'body', 'mixed', 'Oversized: +20% size and attack, but eats 15% more.', { opposite: 'tiny', inherit: 0.4, birth: 0.008, mul: { SIZE: 1.2, ATTACK: 1.2, CARRY: 1.2, METCOST: 1.15 } }),
  T('tiny', 'Tiny', 'body', 'mixed', 'Small: -15% size and attack, but eats 10% less.', { opposite: 'giant', inherit: 0.4, birth: 0.008, mul: { SIZE: 0.85, ATTACK: 0.85, CARRY: 0.85, METCOST: 0.9 } }),
  T('long_life', 'Long life', 'body', 'good', 'Lives 50% longer.', { opposite: 'short_life' }),
  T('short_life', 'Short life', 'body', 'bad', 'Lives 40% shorter.', { opposite: 'long_life' }),
  T('agile', 'Agile', 'combat', 'good', 'Dodges 15% of attacks.', { opposite: 'clumsy' }),
  T('clumsy', 'Clumsy', 'combat', 'bad', 'Misses 15% of its own attacks.', { opposite: 'agile' }),
  T('eagle_eyed', 'Keen senses', 'body', 'good', '+30% sensing: weaker trails and food further away.', { opposite: 'short_sighted', mul: { SENSORY: 1.3 } }),
  T('short_sighted', 'Dull senses', 'body', 'bad', '-25% sensing.', { opposite: 'eagle_eyed', mul: { SENSORY: 0.75 } }),
  // ---- survival ----
  T('regeneration', 'Regeneration', 'survival', 'good', 'Heals wounds four times faster.', { inherit: 0.35, birth: 0.006 }),
  T('immune', 'Immune', 'survival', 'good', 'Unharmed by toxins.', { inherit: 0.35, birth: 0.006 }),
  T('heat_resistant', 'Heat resistant', 'survival', 'good', 'Tolerates 5 C more heat.', { opposite: 'cold_resistant' }),
  T('cold_resistant', 'Cold resistant', 'survival', 'good', 'Tolerates 5 C more cold.', { opposite: 'heat_resistant' }),
  T('swimmer', 'Swimmer', 'survival', 'good', 'Survives twice as long under water.', { mul: { DROWN: 2 } }),
  T('water_saver', 'Water saver', 'survival', 'good', 'Loses 30% less water in dry air.', { mul: { DESICC: 0.7 } }),
  T('energized', 'Energized', 'survival', 'good', 'Efficient metabolism: uses 25% less energy.', { opposite: 'glutton', mul: { METCOST: 0.75 } }),
  T('glutton', 'Glutton', 'survival', 'bad', 'Burns 30% more energy.', { opposite: 'energized', mul: { METCOST: 1.3 } }),
  // ---- mind ----
  T('wise', 'Wise', 'mind', 'good', 'Learns tasks twice as fast and follows trails more reliably.', { opposite: 'stupid', add: { FIDELITY: 0.1 } }),
  T('stupid', 'Stupid', 'mind', 'bad', 'Learns slowly and loses trails.', { opposite: 'wise', add: { FIDELITY: -0.15 } }),
  T('explorer', 'Explorer', 'mind', 'mixed', 'Scouts further and wider.', { opposite: 'homebody', add: { EXPLORE: 0.25 } }),
  T('homebody', 'Homebody', 'mind', 'mixed', 'Stays close to the nest.', { opposite: 'explorer', add: { EXPLORE: -0.25 } }),
  T('lucky', 'Lucky', 'mind', 'good', 'A quarter of lethal blows only wound it.', { opposite: 'unlucky' }),
  T('unlucky', 'Unlucky', 'mind', 'bad', 'Takes 20% extra damage.', { opposite: 'lucky' }),
  // ---- combat temperament ----
  T('bloodlust', 'Bloodlust', 'combat', 'mixed', 'Picks fights eagerly: +50% aggression.', { opposite: 'peaceful' }),
  T('peaceful', 'Peaceful', 'combat', 'mixed', 'Avoids fights: -60% aggression.', { opposite: 'bloodlust' }),
  T('brave', 'Brave', 'combat', 'good', 'Holds its ground when outnumbered or hurt.', { opposite: 'coward' }),
  T('coward', 'Coward', 'combat', 'bad', 'Flees early from any fight.', { opposite: 'brave' }),
  T('venomous', 'Venomous', 'combat', 'good', 'Potent venom: +30% damage.', { inherit: 0.4, birth: 0.008 }),
  // ---- work ----
  T('diligent', 'Diligent', 'work', 'good', 'Takes up work sooner (lower task thresholds).', { opposite: 'lazy', mul: { THR_FORAGE: 0.7, THR_NURSE: 0.7, THR_DIG: 0.7 } }),
  T('lazy', 'Lazy', 'work', 'bad', 'Rests a lot (higher task thresholds).', { opposite: 'diligent', mul: { THR_FORAGE: 1.5, THR_NURSE: 1.5, THR_DIG: 1.5 } }),
  T('caring', 'Caring', 'work', 'good', 'Natural nurse: much keener to tend brood.', { mul: { THR_NURSE: 0.6 } }),
  T('excavator', 'Excavator', 'work', 'good', 'Digs 40% faster.', { mul: { DIGRATE: 1.4 } }),
  T('trailblazer', 'Trailblazer', 'work', 'good', 'Lays 40% stronger trails.', { mul: { SIGNAL: 1.4 } }),
  T('fertile', 'Fertile', 'body', 'good', 'As a queen, lays 40% more eggs.', { opposite: 'infertile' }),
  T('infertile', 'Infertile', 'body', 'bad', 'As a queen, lays 40% fewer eggs.', { opposite: 'fertile' }),
  // ---- fantasy (Fantasy mode only) ----
  T('blessed', 'Blessed', 'fantasy', 'good', 'FICTIONAL. +10% to speed, attack and defence.', { opposite: 'cursed', fantasy: true, birth: 0.004, mul: { SPEED: 1.1, ATTACK: 1.1 }, add: { DEFENSE: 0.05 } }),
  T('cursed', 'Cursed', 'fantasy', 'bad', 'FICTIONAL. -10% speed and attack; shorter life.', { opposite: 'blessed', fantasy: true, birth: 0.004, mul: { SPEED: 0.9, ATTACK: 0.9 } }),
  T('fire_proof', 'Fire proof', 'fantasy', 'good', 'FICTIONAL. Ignores heat damage.', { fantasy: true, birth: 0.004 }),
  T('acid_blood', 'Acid blood', 'fantasy', 'mixed', 'FICTIONAL. Its killer is splashed with acid.', { fantasy: true, birth: 0.004 }),
  T('thorns', 'Thorns', 'fantasy', 'good', 'FICTIONAL. Spines hurt every attacker.', { fantasy: true, birth: 0.004 }),
];

export const NT = TRAITS.length;
export const TR: Record<string, number> = Object.fromEntries(TRAITS.map((t, i) => [t.key, i]));
const OPP = TRAITS.map((t) => (t.opposite ? TR[t.opposite] : -1));
/** a newborn never carries more than this many named traits */
export const MAX_TRAITS = 7;

/** Two 32-bit words per ant. */
export type TraitMask = [number, number];
export const has = (m: ArrayLike<number>, o: number, t: number) => ((m[o + (t >> 5)] >>> (t & 31)) & 1) === 1;
function set(m: TraitMask, t: number, on: boolean) {
  const w = t >> 5, b = 1 << (t & 31);
  m[w] = on ? (m[w] | b) >>> 0 : (m[w] & ~b) >>> 0;
}
export function maskList(m: ArrayLike<number>, o = 0): number[] {
  const out: number[] = [];
  for (let t = 0; t < NT; t++) if (has(m, o, t)) out.push(t);
  return out;
}

function allowed(t: number, mode: Mode) { return !TRAITS[t].fantasy || MODES[mode].fantasy; }

/** Resolve opposites and the trait cap: keep a random member of each clashing pair. */
function tidy(rng: Rng, m: TraitMask) {
  for (let t = 0; t < NT; t++) {
    const o = OPP[t];
    if (o > t && has(m, 0, t) && has(m, 0, o)) set(m, rng.chance(0.5) ? t : o, false);
  }
  let list = maskList(m);
  while (list.length > MAX_TRAITS) { set(m, list[rng.int(list.length)], false); list = maskList(m); }
}

/** Traits of an introduced founder (no known parents): a few drawn at random. */
export function founderTraits(rng: Rng, mode: Mode): TraitMask {
  const m: TraitMask = [0, 0];
  const n = rng.int(4); // 0..3
  for (let k = 0; k < n; k++) { const t = rng.int(NT); if (allowed(t, mode)) set(m, t, true); }
  tidy(rng, m);
  return m;
}

/**
 * Offspring traits from a mother and (for females) a father. A trait carried by both parents is passed on
 * with chance 1-(1-p)^2, by one parent with chance p; a missing trait appears spontaneously with the birth chance.
 */
export function inheritTraits(rng: Rng, mode: Mode, mother: ArrayLike<number>, mo: number, father: ArrayLike<number> | null, fo = 0): TraitMask {
  const m: TraitMask = [0, 0];
  const r = MODES[mode];
  const birthScale = r.fantasy ? 1.5 : r.spread > 1 ? 1.25 : 1;
  for (let t = 0; t < NT; t++) {
    if (!allowed(t, mode)) continue;
    const def = TRAITS[t];
    const n = (has(mother, mo, t) ? 1 : 0) + (father && has(father, fo, t) ? 1 : 0);
    const p = n === 2 ? 1 - (1 - def.inherit) ** 2 : n === 1 ? def.inherit : def.birth * birthScale;
    if (rng.next() < p) set(m, t, true);
  }
  tidy(rng, m);
  return m;
}

/** Apply (sign 1) or remove (sign -1) a trait's phenotype effects. */
export function applyTraitPheno(t: number, pheno: Float32Array, o: number, sign: 1 | -1) {
  const d = TRAITS[t];
  for (const [k, v] of Object.entries(d.mul ?? {})) { const i = o + P[k as keyof typeof P]; pheno[i] = sign > 0 ? pheno[i] * v! : pheno[i] / v!; }
  for (const [k, v] of Object.entries(d.add ?? {})) { const i = o + P[k as keyof typeof P]; pheno[i] = Math.max(0, pheno[i] + sign * v!); }
}

/** Run-time modifiers read by behaviour and physiology. */
export const lifeFactor = (m: ArrayLike<number>, o: number) => (has(m, o, TR.long_life) ? 1.5 : 1) * (has(m, o, TR.short_life) ? 0.6 : 1) * (has(m, o, TR.cursed) ? 0.8 : 1);
export const aggressionTrait = (m: ArrayLike<number>, o: number) => (has(m, o, TR.bloodlust) ? 1.5 : 1) * (has(m, o, TR.peaceful) ? 0.4 : 1);
export const courage = (m: ArrayLike<number>, o: number) => (has(m, o, TR.brave) ? 3 : 0) - (has(m, o, TR.coward) ? 2 : 0);
export const learnRate = (m: ArrayLike<number>, o: number) => (has(m, o, TR.wise) ? 2 : 1) * (has(m, o, TR.stupid) ? 0.4 : 1);
export const fertility = (m: ArrayLike<number>, o: number) => (has(m, o, TR.fertile) ? 1.4 : 1) * (has(m, o, TR.infertile) ? 0.6 : 1);
export const heatBonus = (m: ArrayLike<number>, o: number) => (has(m, o, TR.heat_resistant) ? 5 : 0);
export const coldBonus = (m: ArrayLike<number>, o: number) => (has(m, o, TR.cold_resistant) ? 5 : 0);
