// Colony-level state: stores, brood, queens' sperm storage, statistics and lineage.
import { SparseField } from './signals.ts';
import type { World } from './world.ts';
import type { Society } from './society.ts';

export const STAGE = { EGG: 0, LARVA: 1, PUPA: 2 } as const;
export const STAGE_NAMES = ['egg', 'larva', 'pupa'];
export const DESTINY = { WORKER: 0, GYNE: 1, MALE: 2, UNDECIDED: 3 } as const;
export const DESTINY_NAMES = ['worker', 'gyne', 'male', 'female (undetermined)'];

export interface Brood {
  id: number;
  stage: number;
  prog: number; // 0..1 within stage
  destiny: number;
  a: Float32Array; // maternal allele set
  b: Float32Array | null; // paternal allele set (null = haploid male)
  mother: number; // queen/worker ant id
  father: number; // male ant id (0 for males)
  x: number; y: number;
  fed: number; // protein units received (larva)
  need: number; // protein units required
  hunger: number; // days since last fed (larva)
  drown: number; // ticks under water
  dry: number; // days in too-dry air
  infection: number;
  tempSum: number; tempN: number;
  queenFed: boolean;
  carried: boolean;
  warmBoost: number; // fictional thermogenesis contribution (degC) this update
  /** worker larva on the major (soldier) developmental pathway; absent in older saves */
  major?: boolean;
  /** named traits inherited at conception (see traits.ts); absent in older saves */
  tr?: number[];
}

export interface Sperm {
  maleId: number;
  colonyId: number; // natal colony of the male (0 = background population)
  genome: Float32Array; // haploid
  share: number; // paternity share weight
  /** the father's named traits (absent in older saves) */
  tr?: number[];
}

export interface QueenData {
  antId: number;
  reserves: number;
  sperm: Sperm[];
  mated: boolean;
  eggsLaid: number;
  natalColony: number;
  playerEdited: boolean;
}

export interface ColonyStats {
  eggsLaid: number;
  workersEclosed: number;
  /** major workers (soldiers) reared; absent in older saves */
  majorsEclosed?: number;
  gynesEclosed: number;
  malesEclosed: number;
  broodDeaths: Record<string, number>;
  adultDeaths: Record<string, number>;
  foodIn: [number, number, number]; // sugar, protein, seed delivered
  gynesFlown: number;
  malesFlown: number;
  daughterColonies: number;
  peakWorkers: number;
  fights: number;
  floodEvents: number;
}

export interface ExposureDay {
  day: number;
  temp: number;
  moisture: number;
  workers: number;
  brood: number;
  flooded: number;
  starving: number;
}

export interface Colony {
  id: number; // unique, never reused
  slot: number; // index used by ants.colony
  speciesId: string;
  name: string;
  marking: [number, number, number];
  alive: boolean;
  stage: 'founding' | 'growing' | 'mature' | 'queenless' | 'dead';
  foundedTick: number;
  diedTick: number;
  generation: number;
  motherColony: number;
  fatherColonies: number[];
  queens: QueenData[];
  entrance: { x: number; y: number };
  chamber: { x: number; y: number };
  sealed: boolean;
  store: { sugar: number; protein: number; seed: number; mineral: number };
  brood: Brood[];
  stats: ColonyStats;
  // colony-level stimuli (documented approximations of averaged local cues)
  stim: { forage: number; nurse: number; dig: number; waste: number; exit: number };
  workers: number;
  adults: number;
  nestVolume: number;
  nestDepth: number;
  hasExit: boolean;
  corpsesInside: number;
  reproductive: boolean;
  exposure: ExposureDay[];
  // per-colony signal fields (sparse)
  trail: SparseField;
  nestOdor: SparseField;
  alarm: SparseField;
  digCue: SparseField;
  // running accumulators for daily exposure
  acc: { temp: number; moist: number; n: number; flooded: number; starving: number };
  playerEdited: boolean;
  /** colony-level conflict memory and strategy (created lazily; absent in older saves) */
  war?: WarState;
  /** nest architecture template that guides excavation (created lazily) */
  plan?: NestPlan;
  /** last tick a returning scout's find was announced in the event log */
  lastReport?: number;
  /** kingdom layer: ruler, culture, chronicle, diplomacy (created lazily; absent in older saves) */
  society?: Society;
}

export type Strategy = 'grow' | 'forage' | 'defend' | 'fortify' | 'war' | 'raid';
export interface Relation {
  /** rival colony id */
  id: number;
  encounters: number;
  /** recent kills inflicted on / losses suffered from this rival (decaying) */
  kills: number; losses: number;
  /** running totals for battle reports */
  totalKills: number; totalLosses: number; reportKills: number; reportLosses: number;
  hostility: number;
  /** encounter-rate estimate of local force ratio (rival ants per own ant met at contacts) */
  ratio: number;
  lastSeen: number;
  /** last tick rival workers were met close to this colony's own entrance */
  nearNest: number;
  frontX: number; frontY: number;
  nestKnown: boolean; nestX: number; nestY: number;
  broodStolen: number; broodLost: number;
}
export interface WarState {
  strategy: Strategy;
  target: number; // rival colony id, 0 none
  since: number;
  siegeUntil: number;
  relations: Relation[];
  raids: number; raidsWon: number; absorbed: number; broodStolen: number;
  raid: { active: boolean; target: number; start: number; brood: number; food: number; lossesAtStart: number; party: number };
  reports: { tick: number; text: string }[];
  /** short explanation of the current strategy for the observatory */
  reason: string;
  /** live major workers, counted at each strategy update (dimorphic species) */
  majors?: number;
  /** share of new workers the colony is currently aiming to rear as majors */
  majorTarget?: number;
  /** brood taken back from raiders */
  recaptured?: number;
}
export interface PlanChamber { x: number; y: number; rx: number; ry: number; kind: 'brood' | 'royal' | 'granary' | 'mound' | 'store' }
export interface NestPlan {
  baseY: number; ex: number;
  /** shaft path parameters: x(y) = ex + round(amp * sin(y * freq + phase)) */
  amp: number; freq: number; phase: number;
  depth: number;
  chambers: PlanChamber[];
  /** secondary shafts from a chamber up to the surface (extra entrances) */
  shafts: { x: number; y0: number; y1: number }[];
  /** lateral galleries and cross-links between chambers (absent in older saves) */
  tunnels?: { x0: number; y0: number; x1: number; y1: number }[];
  mound: { kind: 'dome' | 'crater' | 'none'; r: number; h: number };
  midden: { x: number };
  todo: number; frontier: number[];
  version: number;
  /** original ground surface for columns ex-30 .. ex+30; heap height is measured above it */
  ground: number[];
}

export function newStats(): ColonyStats {
  return {
    eggsLaid: 0, workersEclosed: 0, gynesEclosed: 0, malesEclosed: 0, broodDeaths: {}, adultDeaths: {},
    foodIn: [0, 0, 0], gynesFlown: 0, malesFlown: 0, daughterColonies: 0, peakWorkers: 0, fights: 0, floodEvents: 0,
  };
}

export const COLONY_MARKINGS: [number, number, number][] = [
  [240, 196, 64], [96, 196, 230], [236, 112, 160], [150, 220, 110], [250, 150, 70], [180, 140, 240],
  [250, 250, 250], [90, 220, 200], [230, 90, 80], [200, 200, 90], [130, 170, 250], [240, 170, 200],
];

export function makeColonyFields(w: World, trailRetention: number) {
  return {
    trail: new SparseField(w, 'surface', trailRetention, 0, 12),
    nestOdor: new SparseField(w, 'air', 0.97, 0.18, 6),
    alarm: new SparseField(w, 'air', 0.86, 0.22, 6),
    digCue: new SparseField(w, 'surface', 0.97, 0, 4),
  };
}

/** Lineage record kept after colony death, for trees and selection statistics. */
export interface LineageRecord {
  id: number;
  speciesId: string;
  name: string;
  generation: number;
  motherColony: number;
  fatherColonies: number[];
  foundedTick: number;
  diedTick: number;
  founderGenotype: number[]; // genotypic values (mean of alleles) of the founding queen
  peakWorkers: number;
  gynesFlown: number;
  malesFlown: number;
  daughterColonies: number;
  playerEdited: boolean;
  causeOfEnd: string;
}
