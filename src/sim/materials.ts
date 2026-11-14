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
  ICE:19,SNOW:20,STEAM:21,FIRE:22,SMOKE:23,ASH:24,OIL:25,LAVA:26,GLASS:27,MOLTEN_GLASS:28,METAL:29,MOLTEN_METAL:30,WIRE:31,BATTERY:32,LAMP:33,ACID:34,SALT:35,SALTWATER:36,GUNPOWDER:37,EXPLOSIVE:38,SPARK:39,DUST:40,RUBBER:41,ALCOHOL:42,HONEY:43,FLOUR:44,DOUGH:45,BREAD:46,COAL:47,OXYGEN:48,HYDROGEN:49,CO2:50,FUSE:51,HEATER:52,COOLER:53,CLONER:54,
  CLAY_POWDER:55,SAWDUST:56,GLASS_SHARD:57,SUGAR_POWDER:58,
} as const;
export type MaterialId = (typeof M)[keyof typeof M];

export const FOOD = { NONE: 0, SUGAR: 1, PROTEIN: 2, SEED: 3 } as const;
export type FoodType = 1 | 2 | 3;
export const FOOD_NAMES = ['none', 'sugar', 'protein', 'seed'] as const;

export interface Material {
  state?:'solid'|'powder'|'liquid'|'gas';
  density?:number;
  flammability?:number;
  conductivity?:number;
  viscosity?:number;
  waterEquivalent?:boolean;
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
  return { ...base, id, key, name, description, color,state:p.granular?'powder':p.category==='fluid'?'liquid':p.solid===false?'gas':'solid',density:p.category==='fluid'?1:2,...p };
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
  mat(M.CLAY, 'clay', 'Compacted clay', 'Fine, nearly impermeable, very moisture-retentive. Hard to dig when dry, stable when excavated. Use Clay powder for loose falling grains.', [158, 96, 72], {
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
  mat(M.ICE,'ice','Ice','Frozen water. Melts above 0°C; water-equivalent quantity is conserved.',[163,211,232],{waterEquivalent:true,thermal:.8}),
  mat(M.SNOW,'snow','Snow','Frozen falling powder. Melts above 0°C into the same quantity of water.',[236,244,245],{granular:true,cohesion:.05,waterEquivalent:true}),
  mat(M.STEAM,'steam','Steam','Water vapour rises and condenses below 95°C. One gas cell stores water-equivalent units, not ideal-gas volume.',[193,211,221],{solid:false,state:'gas',density:.05,waterEquivalent:true}),
  mat(M.FIRE,'fire','Fire','Heats nearby cells, spreads to fuel and extinguishes against water. Oxygen availability is abstracted.',[249,133,48],{solid:false,state:'gas',density:.01,nutrient:150}),
  mat(M.SMOKE,'smoke','Smoke','Warm combustion gas rises and disperses. Harmful at high local contamination.',[106,111,117],{solid:false,state:'gas',density:.1,nutrient:150}),
  mat(M.ASH,'ash','Ash','Fine nonflammable combustion residue falls into heaps.',[125,119,112],{granular:true,cohesion:0,digResist:8}),
  mat(M.OIL,'oil','Oil','Flammable liquid floats above water. Ignites near fire or above 220°C.',[111,91,45],{solid:false,state:'liquid',category:'fluid',density:.8,flammability:.7,viscosity:.4}),
  mat(M.LAVA,'lava','Lava','Very hot liquid. Heats adjacent materials and solidifies below 700°C; water cools it to stone.',[239,83,31],{solid:false,state:'liquid',category:'fluid',density:2.8,viscosity:.75}),
  mat(M.GLASS,'glass','Glass','Transparent-looking impermeable solid. Softens to molten glass above 1000°C.',[141,185,175],{thermal:.6}),
  mat(M.MOLTEN_GLASS,'molten-glass','Molten glass','Dense viscous glass liquid; solidifies below 900°C.',[245,161,83],{solid:false,state:'liquid',category:'fluid',density:2.5,viscosity:.85}),
  mat(M.METAL,'metal','Metal','Conducts electricity and heat; melts above 650°C in this simplified material profile.',[158,166,177],{conductivity:.9,thermal:.95}),
  mat(M.MOLTEN_METAL,'molten-metal','Molten metal','Dense hot conductive liquid; solidifies below 600°C.',[246,164,108],{solid:false,state:'liquid',category:'fluid',density:7,conductivity:.8,viscosity:.2}),
  mat(M.WIRE,'wire','Wire','Conductive solid. Charge travels through touching wires with attenuation.',[195,112,66],{conductivity:1,thermal:.7}),
  mat(M.BATTERY,'battery','Battery','Sandbox electrical source. Continuously supplies charge to adjacent conductors until removed.',[192,207,79],{conductivity:1}),
  mat(M.LAMP,'lamp','Lamp','Lights up while it receives charge from a connected conductor.',[160,151,98],{conductivity:.9}),
  mat(M.ACID,'acid','Acid','Corrodes nearby ordinary solids. Barriers and glass resist it. Finite reagent is consumed.',[141,220,75],{solid:false,state:'liquid',category:'fluid',density:1.1,nutrient:64}),
  mat(M.SALT,'salt','Salt','Soluble falling powder. Dissolves in touching water to make saltwater.',[227,224,205],{granular:true,cohesion:0}),
  mat(M.SALTWATER,'saltwater','Saltwater','A conductive aqueous mixture. Water-equivalent units are tracked; dissolved salt is abstracted.',[87,137,182],{solid:false,state:'liquid',category:'fluid',density:1.03,waterEquivalent:true,conductivity:.5}),
  mat(M.GUNPOWDER,'gunpowder','Gunpowder','Combustible powder. Fire or electricity triggers an explosive pulse.',[88,89,94],{granular:true,cohesion:0,flammability:1}),
  mat(M.EXPLOSIVE,'explosive','Explosive','A larger fictional sandbox explosive. Heat, flame or electric charge triggers it; barriers stop destruction.',[192,65,58],{flammability:1,conductivity:.4}),
  mat(M.SPARK,'spark','Spark','Short-lived ignition and electric-charge source.',[255,231,105],{solid:false,state:'gas',density:0,nutrient:12}),
  mat(M.DUST,'dust','Dust','Loose fine particles fall and slide.',[170,143,116],{granular:true,cohesion:0,digResist:5}),
  mat(M.RUBBER,'rubber','Rubber','Insulating flexible-looking solid. Burns when heated; cannot conduct electricity.',[64,67,75],{flammability:.3,thermal:.1}),
  mat(M.ALCOHOL,'alcohol','Alcohol','Low-density flammable liquid. Burns rapidly on contact with flame.',[178,199,213],{solid:false,state:'liquid',category:'fluid',density:.79,flammability:1}),
  mat(M.HONEY,'honey','Honey','Slow viscous sugar-rich liquid, compatible with adult sugar feeding.',[222,162,42],{solid:false,state:'liquid',category:'food',density:1.4,viscosity:.9,food:1,foodUnits:8}),
  mat(M.FLOUR,'flour','Flour','Falling food powder; touching water turns it into dough. Not a complete larval diet.',[221,207,171],{granular:true,cohesion:.05,food:3,foodUnits:1,category:'food',flammability:.3}),
  mat(M.DOUGH,'dough','Dough','Dough made from flour and water. Bakes into bread above 110°C.',[199,174,128],{food:3,foodUnits:1,category:'food',moistureCap:64}),
  mat(M.BREAD,'bread','Bread','Baked dough. Provides seed-category nutrition; it burns when overheated.',[177,121,63],{food:3,foodUnits:1,category:'food',flammability:.6,moistureCap:20}),
  mat(M.COAL,'coal','Coal','Falling carbon-rich fuel. Burns slowly and produces heat.',[53,55,62],{granular:true,cohesion:.1,flammability:.4}),
  mat(M.OXYGEN,'oxygen','Oxygen','A rising sandbox gas. General oxygen depletion is not modelled.',[146,179,219],{solid:false,state:'gas',density:.08,nutrient:255}),
  mat(M.HYDROGEN,'hydrogen','Hydrogen','Very light flammable gas; a touching ignition source can set off a pulse.',[173,154,199],{solid:false,state:'gas',density:.01,flammability:1,nutrient:255}),
  mat(M.CO2,'carbon-dioxide','Carbon dioxide','Heavy gas settles downward. This is occupancy and density, not a respiratory model.',[135,145,153],{solid:false,state:'gas',density:.2,nutrient:255}),
  mat(M.FUSE,'fuse','Fuse','Burning fuse conducts an ignition front toward explosives.',[179,139,75],{flammability:1,conductivity:.5}),
  mat(M.HEATER,'heater','Heater','Continuous sandbox heat source. Raises local temperature toward 1400°C.',[211,98,72],{thermal:1}),
  mat(M.COOLER,'cooler','Cooler','Continuous sandbox cold source. Lowers local temperature toward −60°C.',[87,148,212],{thermal:1}),
  mat(M.CLONER,'cloner','Cloner','Learns the first ordinary adjacent material and emits copies into neighbouring air. Copies are explicit resource sources.',[171,98,187],{}),
  mat(M.CLAY_POWDER,'clay-powder','Clay powder','Loose fine clay grains fall and slide; compacted nest clay is a separate solid material.',[178,119,93],{granular:true,cohesion:.15,moistureCap:220,permeability:.03,digResist:30}),
  mat(M.SAWDUST,'sawdust','Sawdust','Falling flammable wood particles.',[164,127,75],{granular:true,cohesion:0,flammability:.8}),
  mat(M.GLASS_SHARD,'glass-shard','Glass shards','Crushed glass grains fall and sink through lighter liquids.',[160,202,189],{granular:true,cohesion:0}),
  mat(M.SUGAR_POWDER,'sugar-powder','Sugar powder','Falling sugar food. Can feed adult ants and burn; units stay in the food ledger.',[239,222,169],{granular:true,cohesion:0,food:1,foodUnits:8,category:'food',flammability:.5}),
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
export const IS_GAS=new Uint8Array(256),IS_LIQUID=new Uint8Array(256),IS_WATER=new Uint8Array(256);
export const DENSITY=new Float32Array(256),CONDUCTIVITY=new Float32Array(256);
MATERIALS[M.AIR].state='gas';MATERIALS[M.WATER].waterEquivalent=true;MATERIALS[M.PLANT].state='solid';
for(const id of [M.WOOD,M.ROOT,M.ORGANIC,M.PLANT,M.SEED,M.SUGAR])MATERIALS[id].flammability=.4;
for (const m of MATERIALS) {
  IS_GAS[m.id]=m.state==='gas'?1:0;IS_LIQUID[m.id]=m.state==='liquid'?1:0;IS_WATER[m.id]=m.waterEquivalent?1:0;
  DENSITY[m.id]=m.density??2;CONDUCTIVITY[m.id]=m.conductivity??0;
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
