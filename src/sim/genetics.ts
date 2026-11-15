// Heritable trait model.
//
// Genome: one normalised allele value (0..1) per locus; females are diploid
// (two alleles), males haploid (haplodiploidy: males develop from unfertilised eggs).
// Loci are unlinked (free recombination) and additive: a female's genotypic value
// is the mean of her two alleles. 0.5 = the species profile mean.
//
// Mutation happens only when gametes are produced (eggs and sperm are already
// produced; males transmit their genome clonally, so mutation is applied at egg
// formation for both sexes' offspring). Existing adults never change genotype.
import type { Rng } from './rng.ts';

export type Mode = 'naturalistic' | 'speculative' | 'fantasy';

export interface LocusDef {
  key: string;
  name: string;
  /** what it does and what it costs, shown in the UI */
  effect: string;
  cost: string;
  fantasy?: boolean;
  /** fantasy loci: expressed only if these other loci (genotypic value) exceed thresholds */
  prereq?: { locus: string; min: number }[];
}

export const LOCI: LocusDef[] = [
  { key: 'size', name: 'Body size', effect: 'Larger workers fight and dig more strongly and lose water more slowly.', cost: 'More larval food; higher metabolism; large workers need wider tunnels. Each worker carries one food unit regardless of size.' },
  { key: 'cuticle', name: 'Cuticle investment', effect: 'Thicker cuticle: better armour and desiccation resistance.', cost: 'Raises larval food cost and development time; slightly slower.' },
  { key: 'mandible', name: 'Mandible specialisation', effect: 'High = gripping/combat mandibles; low = digging/seed-handling mandibles.', cost: 'Each end of the axis trades against the other.' },
  { key: 'sensory', name: 'Sensory sensitivity', effect: 'Detects weaker trails and food at greater distance.', cost: 'Small metabolic and developmental cost.' },
  { key: 'signal', name: 'Trail signal production', effect: 'Lays stronger trails: faster recruitment.', cost: 'Energy per deposit; stronger trails are easier for rivals and predators to detect.' },
  { key: 'fidelity', name: 'Trail fidelity', effect: 'Probability of following trails rather than searching independently.', cost: 'High fidelity slows discovery of new sources and adaptation to change.' },
  { key: 'waterbal', name: 'Water balance', effect: 'Lower water loss in dry air.', cost: 'Metabolic cost (abstraction of cuticular lipid investment).' },
  { key: 'topt', name: 'Thermal optimum', effect: 'Shifts the temperature of peak performance and brood development.', cost: 'Performance falls away from the optimum.' },
  { key: 'tbreadth', name: 'Thermal breadth', effect: 'Wider tolerance range.', cost: 'Lower peak performance ("jack of all temperatures", Huey & Hertz 1984).' },
  { key: 'metab', name: 'Metabolic rate', effect: 'Faster movement, digging and brood development.', cost: 'Higher food consumption and water loss.' },
  { key: 'explore', name: 'Exploration tendency', effect: 'More scouting, wider search, faster discovery.', cost: 'More time exposed to predators, heat and desiccation.' },
  { key: 'thrForage', name: 'Foraging threshold', effect: 'Inherited response threshold for foraging stimuli (lower = responds sooner).', cost: 'Too low drains workers from the nest; too high starves the colony.' },
  { key: 'thrNurse', name: 'Nursing threshold', effect: 'Inherited response threshold for brood-care stimuli.', cost: 'Trade-off with foraging and digging labour.' },
  { key: 'thrDig', name: 'Digging threshold', effect: 'Inherited response threshold for crowding (excavation) stimuli.', cost: 'Excavation costs energy and time.' },
  { key: 'devrate', name: 'Developmental timing', effect: 'Faster brood development.', cost: 'Faster-developing larvae accumulate less mass: smaller adults.' },
  { key: 'chem', name: 'Defensive chemistry', effect: 'Species-appropriate chemical defence (formic acid spray or sting venom).', cost: 'Metabolic and larval cost.' },
  { key: 'floodtol', name: 'Submersion tolerance', effect: 'Survives longer under water (metabolic depression).', cost: 'Slightly slower and costlier to rear (abstraction).' },
  // --- Fantasy loci: start absent (allele value 0). Only mutate in Fantasy mode. ---
  { key: 'biolum', name: 'Bioluminescent signalling (FICTIONAL)', effect: 'Light pulses recruit nestmates in line of sight where trails cannot be laid (water, darkness).', cost: '+25% metabolism while signalling; light attracts predators and rivals.', fantasy: true, prereq: [{ locus: 'signal', min: 0.5 }] },
  { key: 'armor', name: 'Mineral-reinforced armour (FICTIONAL)', effect: 'Large damage reduction.', cost: 'Needs clay minerals in larval diet; +50% larval cost; much slower; sinks and drowns faster.', fantasy: true, prereq: [{ locus: 'cuticle', min: 0.55 }] },
  { key: 'plastron', name: 'Air-film respiration (FICTIONAL)', effect: 'Breathes under water for long periods.', cost: '1.6x water loss in dry air; +15% larval cost.', fantasy: true, prereq: [{ locus: 'waterbal', min: 0.45 }] },
  { key: 'thermo', name: 'Brood thermogenesis (FICTIONAL)', effect: 'Nurses warm nearby brood by up to 4 C.', cost: 'Burns colony sugar stores; nurses tire faster.', fantasy: true, prereq: [{ locus: 'metab', min: 0.5 }] },
];

export const NL = LOCI.length;
export const L: Record<string, number> = Object.fromEntries(LOCI.map((l, i) => [l.key, i]));
export const FANTASY_LOCI = LOCI.map((l, i) => (l.fantasy ? i : -1)).filter((i) => i >= 0);

export interface ModeRules {
  label: string;
  /** multiplier on each trait's naturalistic variation range */
  spread: number;
  /** per-locus mutation probability per gamete */
  mu: number;
  /** mutation step SD on the 0..1 allele scale */
  sigma: number;
  fantasy: boolean;
  description: string;
}

export const MODES: Record<Mode, ModeRules> = {
  naturalistic: {
    label: 'Naturalistic', spread: 1, mu: 0.02, sigma: 0.05, fantasy: false,
    description: 'Species-profile founding, development and communication. Trait variation is bounded to a plausible range around the researched profile. Time and colony size are compressed (see clock).',
  },
  speculative: {
    label: 'Speculative evolution', spread: 2.5, mu: 0.04, sigma: 0.08, fantasy: false,
    description: 'Wider trait ranges and unusual combinations. Energetic and physical costs still apply. Values outside naturalistic bounds are extrapolations, not observed biology.',
  },
  fantasy: {
    label: 'Fantasy', spread: 2.5, mu: 0.04, sigma: 0.08, fantasy: true,
    description: 'Adds explicitly fictional heritable adaptations with inheritance rules, costs and counterplay. Nothing here is real ant biology.',
  },
};

/** Genotypic value of locus l (mean of alleles for diploids). */
export function gval(a: Float32Array, b: Float32Array | null, l: number) {
  return b ? (a[l] + b[l]) * 0.5 : a[l];
}

export function founderGenome(rng: Rng, variation = 0.08): Float32Array {
  const g = new Float32Array(NL);
  for (let l = 0; l < NL; l++) g[l] = LOCI[l].fantasy ? 0 : clamp01(0.5 + rng.normal() * variation);
  return g;
}

export interface MutationRecord {
  tick: number;
  locus: number;
  from: number;
  to: number;
  carrier: string; // e.g. 'gyne egg', 'male egg'
  colony: number;
  offspringId: number;
}

/** Produce a haploid egg genome from a diploid mother (free recombination + mutation). */
export function makeEgg(
  rng: Rng, a: Float32Array, b: Float32Array | null, mode: Mode,
  muScale = 1, log?: (locus: number, from: number, to: number) => void,
): Float32Array {
  const r = MODES[mode];
  const g = new Float32Array(NL);
  for (let l = 0; l < NL; l++) {
    let v = b && rng.next() < 0.5 ? b[l] : a[l];
    const fantasyLocked = LOCI[l].fantasy && !r.fantasy;
    if (!fantasyLocked && rng.next() < r.mu * muScale) {
      const nv = clamp01(v + rng.normal() * r.sigma);
      if (log) log(l, v, nv);
      v = nv;
    }
    if (fantasyLocked) v = 0;
    g[l] = v;
  }
  return g;
}

export function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

// ---------------- Phenotype ----------------
// Phenotype indices (per-ant Float32 array). Derived performance values follow.
export const P = {
  SIZE: 0, CUTICLE: 1, MANDIBLE: 2, SENSORY: 3, SIGNAL: 4, FIDELITY: 5, WATERBAL: 6, TOPT: 7, TBREADTH: 8,
  METAB: 9, EXPLORE: 10, THR_FORAGE: 11, THR_NURSE: 12, THR_DIG: 13, DEVRATE: 14, CHEM: 15, FLOODTOL: 16,
  BIOLUM: 17, ARMOR: 18, PLASTRON: 19, THERMO: 20,
  // derived
  SPEED: 21, METCOST: 22, DESICC: 23, DIGRATE: 24, ATTACK: 25, DEFENSE: 26, DROWN: 27, CARRY: 28,
} as const;
export const NP = 29;
export const PHENO_NAMES = [
  'Body size', 'Cuticle', 'Mandible (combat)', 'Sensory', 'Signal output', 'Trail fidelity', 'Water balance', 'Thermal optimum', 'Thermal breadth',
  'Metabolic rate', 'Exploration', 'Forage threshold', 'Nurse threshold', 'Dig threshold', 'Dev. rate', 'Chem. defence', 'Submersion tol.',
  'Bioluminescence', 'Mineral armour', 'Air-film respiration', 'Brood thermogenesis',
  'Speed', 'Metabolic cost', 'Water loss', 'Dig rate', 'Attack', 'Defence', 'Submersion time', 'Carry',
];

export interface DevConditions {
  nutrition: number; // 0..1+ fraction of required protein received
  meanTemp: number;
  mineral: number; // 0..1 availability of clay minerals in larval diet (fantasy armour)
  /** major-worker (soldier) development: body size factor relative to a minor; absent/0 for minors */
  major?: number;
}

import type { SpeciesDef } from './species.ts';

/** Map a genome (+ developmental conditions) to phenotype. Fixed for life at eclosion. */
export function phenotype(sp: SpeciesDef, mode: Mode, a: Float32Array, b: Float32Array | null, dev: DevConditions, out: Float32Array, o = 0) {
  const s = MODES[mode].spread;
  const t = sp.traits;
  const g = (k: string) => gval(a, b, L[k]);
  const dv = (k: string) => (g(k) - 0.5) * 2; // -1..1
  const nut = Math.max(0, Math.min(1.1, dev.nutrition));
  // ---- developmental plasticity (documented) ----
  // size: genotype sets potential; larval nutrition sets realised size (nanitic workers are small);
  // faster development (devrate) leaves less time to accrue mass; warmer rearing -> slightly smaller (temperature-size rule).
  const devrate = 1 + dv('devrate') * t.devrateSpread * s;
  let size = t.size * (1 + dv('size') * t.sizeSpread * s);
  size *= 0.72 + 0.28 * Math.min(1, nut);
  size *= 1 - 0.25 * (devrate - 1);
  size *= 1 - 0.008 * Math.max(0, dev.meanTemp - 22);
  // majors: a discrete developmental switch to a larger body with a disproportionately large head and mandibles
  const major = dev.major && dev.major > 1 ? dev.major : 0;
  if (major) size *= major;
  size = Math.max(0.4, size);
  const cuticle = clamp01((0.5 + dv('cuticle') * 0.25 * s) * (0.8 + 0.2 * Math.min(1, nut)) + (major ? 0.15 : 0));
  const mandible = clamp01(t.mandible + dv('mandible') * 0.2 * s + (major ? 0.35 : 0));
  const sensory = Math.max(0.3, 1 + dv('sensory') * 0.2 * s);
  const signal = Math.max(0, t.signal * (1 + dv('signal') * 0.3 * s));
  const fidelity = clamp01(t.fidelity + dv('fidelity') * 0.15 * s);
  const waterbal = clamp01(t.waterbal + dv('waterbal') * 0.2 * s);
  const topt = t.topt + dv('topt') * 3 * s;
  const tbreadth = Math.max(3, t.tbreadth * (1 + dv('tbreadth') * 0.25 * s));
  const metab = Math.max(0.4, 1 + dv('metab') * 0.2 * s);
  const explore = clamp01(t.explore + dv('explore') * 0.2 * s);
  // majors have much higher thresholds for routine work (Wilson 1984; Detrain & Pasteels 1992)
  const thrF = Math.max(0.05, t.thrForage * (1 + dv('thrForage') * 0.4 * s)) * (major ? 5 : 1);
  const thrN = Math.max(0.05, t.thrNurse * (1 + dv('thrNurse') * 0.4 * s)) * (major ? 5 : 1);
  const thrD = Math.max(0.05, t.thrDig * (1 + dv('thrDig') * 0.4 * s)) * (major ? 4 : 1);
  const chem = Math.max(0, t.chem * (1 + dv('chem') * 0.3 * s));
  const floodtol = Math.max(0.2, 1 + dv('floodtol') * 0.3 * s);
  // ---- fantasy loci: expressed only above 0.25 and when prerequisites are met ----
  const fx = (k: string) => {
    if (!MODES[mode].fantasy) return 0;
    const v = g(k);
    if (v < 0.25) return 0;
    for (const p of LOCI[L[k]].prereq ?? []) if (g(p.locus) < p.min) return 0;
    return Math.min(1, (v - 0.25) / 0.5);
  };
  const biolum = fx('biolum');
  const armor = fx('armor') * Math.min(1, dev.mineral);
  const plastron = fx('plastron');
  const thermo = fx('thermo');
  out[o + P.SIZE] = size; out[o + P.CUTICLE] = cuticle; out[o + P.MANDIBLE] = mandible; out[o + P.SENSORY] = sensory;
  out[o + P.SIGNAL] = signal; out[o + P.FIDELITY] = fidelity; out[o + P.WATERBAL] = waterbal; out[o + P.TOPT] = topt;
  out[o + P.TBREADTH] = tbreadth; out[o + P.METAB] = metab; out[o + P.EXPLORE] = explore; out[o + P.THR_FORAGE] = thrF;
  out[o + P.THR_NURSE] = thrN; out[o + P.THR_DIG] = thrD; out[o + P.DEVRATE] = devrate; out[o + P.CHEM] = chem;
  out[o + P.FLOODTOL] = floodtol; out[o + P.BIOLUM] = biolum; out[o + P.ARMOR] = armor; out[o + P.PLASTRON] = plastron; out[o + P.THERMO] = thermo;
  // ---- derived performance (trade-offs live here) ----
  const relSize = size / t.size;
  out[o + P.SPEED] = 0.42 * Math.sqrt(metab) * Math.pow(relSize, 0.3) / (1 + 0.25 * cuticle) / (1 + 0.6 * armor) / (1 + 0.1 * (floodtol - 1)) * (major ? 0.8 : 1);
  out[o + P.METCOST] = Math.pow(relSize, 0.75) * metab * (1 + 0.08 * (sensory - 1)) * (1 + 0.12 * waterbal) * (1 + 0.1 * chem / Math.max(0.01, t.chem || 1)) * (1 + 0.15 * thermo);
  out[o + P.DESICC] = (1 / Math.cbrt(relSize)) * (1.3 - 0.8 * waterbal) * (1 - 0.25 * cuticle) * metab * (1 + 0.6 * plastron);
  out[o + P.DIGRATE] = (1.4 - 0.8 * mandible) * Math.sqrt(relSize) * Math.sqrt(metab);
  out[o + P.ATTACK] = relSize * (0.4 + mandible) * (1 + 0.1 * (metab - 1));
  out[o + P.DEFENSE] = 0.3 * cuticle + 0.6 * armor + (major ? 0.15 : 0);
  out[o + P.DROWN] = floodtol * (1 - 0.5 * armor) * (1 + 12 * plastron);
  out[o + P.CARRY] = relSize;
}

/** Larval protein needed to rear one adult of this genotype (cost of trait investment). */
export function broodCost(sp: SpeciesDef, mode: Mode, a: Float32Array, b: Float32Array | null, caste: number): number {
  const s = MODES[mode].spread;
  const t = sp.traits;
  const dv = (k: string) => (gval(a, b, L[k]) - 0.5) * 2;
  const size = 1 + dv('size') * t.sizeSpread * s;
  const cut = 0.5 + dv('cuticle') * 0.25 * s;
  let c = sp.development.larvalProtein * Math.pow(Math.max(0.4, size), 1.5) * (1 + 0.4 * (cut - 0.5));
  c *= 1 + 0.05 * dv('sensory') * s + 0.06 * dv('chem') * s + 0.05 * dv('floodtol') * s;
  if (MODES[mode].fantasy) {
    const fx = (k: string) => Math.max(0, (gval(a, b, L[k]) - 0.25) / 0.5);
    c *= 1 + 0.5 * Math.min(1, fx('armor')) + 0.15 * Math.min(1, fx('plastron'));
  }
  if (caste === 1) c *= sp.reproduction.gyneCostFactor;
  if (caste === 2) c *= sp.reproduction.maleCostFactor;
  if (caste === 3) c *= Math.pow(sp.workers.soldiers?.sizeFactor ?? 1.5, 1.5); // major worker
  return Math.max(1, c);
}

/** Thermal performance curve: Gaussian around optimum; broader curves have lower peaks. */
export function thermalPerf(T: number, topt: number, tbreadth: number, refBreadth: number) {
  const z = (T - topt) / tbreadth;
  const peak = Math.pow(refBreadth / tbreadth, 0.35);
  return Math.min(1.25, peak) * Math.exp(-z * z);
}
