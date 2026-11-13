// Material registry. Every terrain cell holds one material id (Uint8).
// Properties here are the single source of truth for terrain behaviour; the
// renderer and inspector read the same table.

export const M = {
  AIR: 0,
  WATER: 1,
  TOPSOIL: 2,
  SOIL: 3,
  SAND: 4,
  CLAY: 5,
  STONE: 6,
  ORGANIC: 7,
  WOOD: 8,
  ROOT: 9,
  LOOSE: 10,
  SUGAR: 11,
  PROTEIN: 12,
  SEED: 13,
  BARRIER: 14,
  PLANT: 15,
  CORPSE: 16,
  WASTE: 17,
  GRAVEL: 18,
} as const;
export type MaterialId = (typeof M)[keyof typeof M];

export const FOOD = { NONE: 0, SUGAR: 1, PROTEIN: 2, SEED: 3 } as const;
export type FoodType = 1 | 2 | 3;
export const FOOD_NAMES = ['none', 'sugar', 'protein', 'seed'] as const;

export interface Material {
  id: number;
  key: string;
  name: string;
  description: string;
  /** blocks movement of ants and water */
  solid: boolean;
  /** falls into air below and slides diagonally (granular CA) */
  granular: boolean;
  /** 0..1 resistance to slumping when wet/unsupported (cohesive soils) */
  cohesion: number;
  /** ticks of work for an ant of digEfficiency 1 to loosen one cell; 0 = not diggable */
  digResist: number;
  /** 0..1 probability factor that water infiltrates per contact tick */
  permeability: number;
  /** max soil moisture units this cell can hold (1 water cell = WATER_UNITS) */
  moistureCap: number;
  /** relative thermal diffusivity used by the coarse temperature field */
  thermal: number;
  /** soil fertility units given when generated (stored in amt for soil cells) */
  nutrient: number;
  /** 0..1 suitability for nest chambers (affects queen site choice & digging preference) */
  chamberSuitability: number;
  /** multiplier on surface trail-signal persistence when this is the substrate */
  signalPersistence: number;
  /** food type held by cells of this material, with max units per cell */
  food: number;
  foodUnits: number;
  /** ants can climb on it although it is not solid ground (plants) */
  climbable: boolean;
  /** base palette (r,g,b) and texture variation amplitude */
  color: [number, number, number];
  vary: number;
  /** player palette category */
  category: 'terrain' | 'fluid' | 'food' | 'structure' | 'organic' | 'hidden';
}

const base: Omit<Material, 'id' | 'key' | 'name' | 'description' | 'color'> = {
  solid: true,
  granular: false,
  cohesion: 1,
  digResist: 0,
  permeability: 0,
  moistureCap: 0,
  thermal: 0.5,
  nutrient: 0,
  chamberSuitability: 0,
  signalPersistence: 1,
  food: 0,
  foodUnits: 0,
  climbable: false,
  vary: 0.08,
  category: 'terrain',
};

function mat(id: number, key: string, name: string, description: string, color: [number, number, number], p: Partial<Material>): Material {
  return { ...base, id, key, name, description, color, ...p };
}

export const MATERIALS: Material[] = [
  mat(M.AIR, 'air', 'Air', 'Open space. Ants walk along surfaces bordering it.', [0, 0, 0], {
    solid: false, cohesion: 0, thermal: 0.9, signalPersistence: 0.6, category: 'hidden', vary: 0,
  }),
  mat(M.WATER, 'water', 'Water', 'Discrete standing or flowing water. Falls, spreads, infiltrates permeable soil and evaporates at exposed surfaces.', [52, 104, 168], {
    solid: false, cohesion: 0, thermal: 1.0, category: 'fluid', vary: 0.04,
  }),
  mat(M.TOPSOIL, 'topsoil', 'Topsoil (loam)', 'Fertile, moderately permeable surface loam. Easy to dig, holds moisture well, good nest substrate.', [96, 66, 42], {
    digResist: 40, permeability: 0.25, moistureCap: 180, thermal: 0.35, nutrient: 40, chamberSuitability: 0.9, signalPersistence: 1.1, cohesion: 0.75,
  }),
  mat(M.SOIL, 'soil', 'Subsoil', 'Denser mineral soil below the topsoil. Diggable, retains moisture, structurally stable.', [122, 84, 52], {
    digResist: 60, permeability: 0.15, moistureCap: 160, thermal: 0.3, nutrient: 10, chamberSuitability: 0.8, signalPersistence: 1.0, cohesion: 0.85,
  }),
  mat(M.SAND, 'sand', 'Sand', 'Granular and highly permeable. Dry sand flows and collapses unsupported tunnels; damp sand holds its shape.', [204, 176, 112], {
    granular: true, digResist: 18, permeability: 0.8, moistureCap: 70, thermal: 0.45, nutrient: 2, chamberSuitability: 0.35, signalPersistence: 0.6, cohesion: 0.2,
  }),
  mat(M.CLAY, 'clay', 'Clay', 'Fine, nearly impermeable, very moisture-retentive. Hard to dig when dry, stable when excavated.', [158, 96, 72], {
    digResist: 120, permeability: 0.03, moistureCap: 220, thermal: 0.25, nutrient: 15, chamberSuitability: 0.7, signalPersistence: 1.5, cohesion: 0.95,
  }),
  mat(M.STONE, 'stone', 'Stone', 'Impassable bedrock or rock. Cannot be dug, does not absorb water.', [112, 112, 120], {
    digResist: 0, thermal: 0.7, signalPersistence: 0.8, vary: 0.12,
  }),
  mat(M.ORGANIC, 'organic', 'Leaf litter / detritus', 'Decomposing plant material. Light, diggable, moisture-retentive; slowly becomes topsoil and harbours springtails.', [74, 58, 30], {
    digResist: 12, permeability: 0.5, moistureCap: 200, thermal: 0.2, nutrient: 120, chamberSuitability: 0.4, signalPersistence: 1.0, cohesion: 0.5, category: 'organic',
  }),
  mat(M.WOOD, 'wood', 'Wood', 'Logs and trunks. Not diggable by these species. Climbable.', [110, 78, 44], {
    digResist: 0, thermal: 0.2, signalPersistence: 1.3, category: 'structure', vary: 0.1,
  }),
  mat(M.ROOT, 'root', 'Root', 'Plant root. Stabilises surrounding soil against slumping and draws moisture. Not diggable.', [150, 118, 74], {
    digResist: 0, permeability: 0.1, moistureCap: 60, thermal: 0.3, signalPersistence: 1.1, category: 'organic',
  }),
  mat(M.LOOSE, 'loose', 'Loose spoil', 'Excavated soil pellets dumped by workers. Granular; forms mounds and slopes.', [140, 102, 66], {
    granular: true, digResist: 10, permeability: 0.5, moistureCap: 120, thermal: 0.35, nutrient: 5, chamberSuitability: 0.2, cohesion: 0.3,
  }),
  mat(M.SUGAR, 'sugar', 'Sugar (honeydew/nectar)', 'Carbohydrate food. Fuels adult activity; workers recruit nestmates to rich sources.', [236, 200, 72], {
    solid: true, digResist: 0, food: 1, foodUnits: 8, category: 'food', thermal: 0.5, vary: 0.05,
  }),
  mat(M.PROTEIN, 'protein', 'Protein (insect remains)', 'Protein food required for larval growth and egg production.', [184, 70, 62], {
    solid: true, digResist: 0, food: 2, foodUnits: 6, category: 'food', vary: 0.1,
  }),
  mat(M.SEED, 'seed', 'Seeds', 'Durable carbohydrate+protein food. Only seed-harvesting species can process seeds efficiently.', [214, 162, 96], {
    solid: true, granular: true, digResist: 0, food: 3, foodUnits: 1, category: 'food', vary: 0.1, cohesion: 0.1,
  }),
  mat(M.BARRIER, 'barrier', 'Barrier', 'Player-placed impermeable, undiggable wall.', [70, 76, 92], {
    digResist: 0, thermal: 0.4, category: 'structure', vary: 0.03, signalPersistence: 0.5,
  }),
  mat(M.PLANT, 'plant', 'Plant', 'Living stem and leaf. Grows on moist fertile topsoil, transpires soil water, drops seeds; may host aphids that drip honeydew.', [92, 150, 64], {
    solid: false, climbable: true, cohesion: 0, thermal: 0.8, category: 'organic', vary: 0.12, signalPersistence: 0.9,
  }),
  mat(M.CORPSE, 'corpse', 'Dead ant', 'A corpse. Decays into detritus; inside nests it raises infection risk for brood until removed.', [60, 40, 36], {
    solid: true, digResist: 0, category: 'hidden', vary: 0.05,
  }),
  mat(M.WASTE, 'waste', 'Refuse', 'Colony refuse (midden). Decays into detritus.', [92, 80, 54], {
    solid: true, granular: true, digResist: 6, permeability: 0.4, moistureCap: 100, cohesion: 0.3, category: 'hidden',
  }),
  mat(M.GRAVEL, 'gravel', 'Gravel', 'Coarse stones. Very permeable, drains fast, too coarse for these ants to excavate.', [132, 126, 118], {
    granular: true, digResist: 0, permeability: 0.95, moistureCap: 20, thermal: 0.6, cohesion: 0.15, vary: 0.2, signalPersistence: 0.7,
  }),
];

export const NUM_MATERIALS = MATERIALS.length;
export const WATER_UNITS = 64; // moisture units in one full water cell

// Hot-path lookup tables
export const IS_SOLID = new Uint8Array(256);
export const IS_GRANULAR = new Uint8Array(256);
export const DIG_RESIST = new Uint16Array(256);
export const MOIST_CAP = new Uint8Array(256);
export const PERMEABILITY = new Float32Array(256);
export const FOOD_OF = new Uint8Array(256);
export const FOOD_UNITS = new Uint8Array(256);
export const SIGNAL_PERSIST = new Float32Array(256);
export const THERMAL = new Float32Array(256);
export const CLIMBABLE = new Uint8Array(256);
for (const m of MATERIALS) {
  IS_SOLID[m.id] = m.solid ? 1 : 0;
  IS_GRANULAR[m.id] = m.granular ? 1 : 0;
  DIG_RESIST[m.id] = m.digResist;
  MOIST_CAP[m.id] = m.moistureCap;
  PERMEABILITY[m.id] = m.permeability;
  FOOD_OF[m.id] = m.food;
  FOOD_UNITS[m.id] = m.foodUnits;
  SIGNAL_PERSIST[m.id] = m.signalPersistence;
  THERMAL[m.id] = m.thermal;
  CLIMBABLE[m.id] = m.climbable ? 1 : 0;
}

export const FOOD_MATERIAL: Record<FoodType, number> = { 1: M.SUGAR, 2: M.PROTEIN, 3: M.SEED };

export function materialByKey(key: string): Material | undefined {
  return MATERIALS.find((m) => m.key === key);
}
