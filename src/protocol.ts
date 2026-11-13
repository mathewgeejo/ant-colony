// Messages between the UI thread and the simulation worker.
import type { Mode } from './sim/genetics.ts';
import type { Command, Settings } from './sim/sim.ts';
import type { Climate } from './sim/physics.ts';

export interface NewWorldOptions {
  scenario: string;
  seed: number;
  mode?: Mode;
  size?: [number, number];
  settings?: Partial<Settings>;
  climate?: Partial<Climate>;
}

export type OverlayKind = 'none' | 'moisture' | 'temperature' | 'humidity' | 'trail' | 'alarm' | 'nest' | 'food' | 'territory' | 'mortality' | 'toxin' | 'trait';

export type ToWorker =
  | { type: 'new'; opts: NewWorldOptions }
  | { type: 'cmd'; cmd: Command }
  | { type: 'run'; running: boolean }
  | { type: 'speed'; speed: number }
  | { type: 'step'; ticks: number }
  | { type: 'inspectCell'; x: number; y: number }
  | { type: 'selectAnt'; x: number; y: number; radius: number }
  | { type: 'selectAntId'; id: number }
  | { type: 'clearSelection' }
  | { type: 'overlay'; kind: OverlayKind; colony: number; trait: number }
  | { type: 'save'; slot: string; name: string }
  | { type: 'load'; slot: string }
  | { type: 'listSaves' }
  | { type: 'deleteSave'; slot: string }
  | { type: 'export' }
  | { type: 'import'; data: ArrayBuffer }
  | { type: 'importSpecies'; json: string }
  | { type: 'scenarioAction'; index: number }
  | { type: 'requestDetail'; what: 'evolution' | 'lineage' | 'colony'; colony?: number }
  | { type: 'benchmark'; minutes: number }
  | { type: 'fullTerrain' };

export interface FrameMsg {
  type: 'frame';
  tick: number;
  W: number;
  H: number;
  /** dirty chunks: [chunkIndex(u16), 512 bytes of cell data]... packed */
  chunks: ArrayBuffer | null;
  chunkCount: number;
  surface: Int16Array | null;
  ants: Int16Array; // 7 shorts per ant
  antCount: number;
  brood: Int16Array; // 4 shorts per brood
  broodCount: number;
  critters: Int16Array; // 5 shorts per critter
  critterCount: number;
  selected: number; // index in ants buffer of the selected ant, or -1
  temp: Float32Array | null; // coarse temperature (sent periodically for renderer tint)
  overlay: Uint8Array | null;
  overlayKind: OverlayKind;
  dayPhase: number;
  raining: boolean;
}

export const ANT_STRIDE = 7;
export const BROOD_STRIDE = 4;
export const CRIT_STRIDE = 5;
// ant info bits
export const A_CARRY_SHIFT = 0; // 3 bits carry kind
export const CARRY_KIND = { NONE: 0, SUGAR: 1, PROTEIN: 2, SEED: 3, SPOIL: 4, CORPSE: 5, BROOD: 6 } as const;

export interface CellInfo {
  x: number; y: number;
  material: string;
  description: string;
  lines: string[];
}

export interface AntInfo {
  id: number;
  colony: string;
  colonyId: number;
  species: string;
  caste: string;
  task: string;
  why: string;
  lines: string[];
  traits: { name: string; value: string; kind: 'inherited' | 'developmental' | 'behavioural' | 'fictional' }[];
}
