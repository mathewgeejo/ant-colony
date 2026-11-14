// Material registry. Every terrain cell holds one material id (Uint16).
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
  DIRT:59,MUD:60,ROCK:61,SANDSTONE:62,MUDSTONE:63,CLAY_SOIL:64,PERMAFROST:65,MYCELIUM:66,MULCH:67,BASALT:68,TUFF:69,CINNABAR:70,LIMESTONE:71,BAKED_CLAY:72,
  GRASS:73,ALGAE:74,CELL:75,PLAGUE:76,BONE:77,SAPLING:78,PINECONE:79,CACTUS:80,KELP:81,CORAL:82,POLLEN:83,FLOWER_SEED:84,PETAL:85,VINE:86,BAMBOO_PLANT:87,MUSHROOM_SPORE:88,LICHEN:89,PRIMORDIAL_SOUP:90,MUSHROOM:91,
  SLIME:92,CEMENT:93,LAMP_OIL:94,FOAM:95,GLUE:96,SODA:97,JUICE:98,MILK:99,VINEGAR:100,SOAP:101,BLEACH:102,DYE:103,INK:104,MERCURY:105,BLOOD:106,VACCINE:107,POISON:108,ANTIDOTE:109,SAP:110,CARAMEL:111,MOLASSES:112,KETCHUP:113,MAYO:114,LIQUID_HYDROGEN:115,LIQUID_NITROGEN:116,
  CONCRETE:117,CURED_CONCRETE:118,DRY_GLUE:119,CHEESE:120,MILK_POWDER:121,FROZEN_MIXTURE:122,FROZEN_MERCURY:123,MERCURY_VAPOR:124,NITROGEN:125,BUBBLE:126,CHLORINE:127,YEAST:128,BAKING_SODA:129,NUT_OIL:130,WHEY:131,EMULSION:132,
  ETHANOL_VAPOR:133,CLOT:134,
  CHARCOAL:135,TINDER:136,WAX:137,INCENSE:138,SODIUM:139,CALCIUM:140,POTASSIUM:141,MAGNESIUM:142,LYE:143,THERMITE:144,SLAG:145,SULFUR:146,URANIUM:147,DIAMOND:148,GOLD_COIN:149,RUST:150,METAL_SCRAP:151,FEATHER:152,CONFETTI:153,GLITTER:154,BEAD:155,COLOR_SAND:156,BORAX:157,
  MOLTEN_WAX:158,BURNING_INCENSE:159,FRAGRANCE:160,MOLTEN_SODIUM:161,MOLTEN_CALCIUM:162,MOLTEN_POTASSIUM:163,MOLTEN_MAGNESIUM:164,LYE_SOLUTION:165,POTASH:166,POTASH_SOLUTION:167,LIME:168,MAGNESIUM_OXIDE:169,BURNING_MAGNESIUM:170,BURNING_THERMITE:171,MOLTEN_SLAG:172,MOLTEN_SULFUR:173,SULFUR_DIOXIDE:174,MOLTEN_URANIUM:175,RADIATION:176,MOLTEN_GOLD:177,GOLD:178,IRON:179,MOLTEN_IRON:180,BORAX_SOLUTION:181,BORAX_GLASS:182,MOLTEN_PLASTIC:183,PLASTIC:184,MOLTEN_BORAX:185,SODIUM_CARBONATE:186,POTASSIUM_CARBONATE:187,SODIUM_OXIDE:188,POTASSIUM_OXIDE:189,BORIC_ACID:190,
  SPENT_CHARCOAL:191,
} as const;
export type MaterialId = (typeof M)[keyof typeof M];
export const FANTASY_MATERIALS:readonly number[]=[M.PLAGUE,M.PRIMORDIAL_SOUP,M.VACCINE,M.ANTIDOTE];
export const phaseOrigin=(value:number)=>value&65535;
export const phaseProgress=(value:number)=>value>>>16;
export const mixturePhase=(origin:number,progress:number)=>((progress<<16)|origin)>>>0;

export const FOOD = { NONE: 0, SUGAR: 1, PROTEIN: 2, SEED: 3 } as const;
export type FoodType = 1 | 2 | 3;
export const FOOD_NAMES = ['none', 'sugar', 'protein', 'seed'] as const;

export interface Material {
  fallRate?:number;
  acidResistance?:number;
  meltAt?:number;meltInto?:number;
  coolAt?:number;coolInto?:number;
  phaseMax?:number;
  randomTints?:readonly number[];
  carrierCapacity?:number;
  initialCarrier?:number;
  defaultTint?:number;
  freezeAt?:number;
  adhesion?:number;
  initialMoisture?:number;
  initialTemperature?:number;
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
  mat(M.SAWDUST,'sawdust','Sawdust','Light flammable wood particles. Float, absorb water and drift down more slowly than mineral sand.',[164,127,75],{granular:true,cohesion:0,density:.3,fallRate:.65,moistureCap:60,permeability:.4,flammability:.8}),
  mat(M.GLASS_SHARD,'glass-shard','Glass shards','Crushed glass grains fall, sink, resist acid and remelt under intense heat.',[160,202,189],{granular:true,cohesion:0,acidResistance:1,meltAt:1000,meltInto:M.MOLTEN_GLASS}),
  mat(M.SUGAR_POWDER,'sugar-powder','Sugar powder','Falling sugar food. Can feed adult ants and burn; units stay in the food ledger.',[239,222,169],{granular:true,cohesion:0,food:1,foodUnits:8,category:'food',flammability:.5}),
  mat(M.DIRT,'dirt','Dirt','Loose soil grains. Absorbs touching water into mud; dries after heating.',[119,79,39],{granular:true,cohesion:.25,moistureCap:120,permeability:.35,digResist:25,nutrient:30,chamberSuitability:.55}),
  mat(M.MUD,'mud','Mud','Wet cohesive soil. Dries into dirt, freezes into permafrost and bakes into mudstone.',[83,59,38],{granular:true,cohesion:.65,moistureCap:160,initialMoisture:100,permeability:.1,digResist:20,nutrient:20,chamberSuitability:.3}),
  mat(M.ROCK,'rock','Rock','Loose rock fragments fall and slide. Unlike Rock wall, they do not stay suspended.',[105,102,94],{granular:true,cohesion:.05,density:2.7,thermal:.7}),
  mat(M.SANDSTONE,'sandstone','Sandstone','Fixed porous sedimentary rock. Retains small amounts of water; grinding releases sand; intense heat melts it.',[179,144,93],{moistureCap:30,permeability:.12,thermal:.5}),
  mat(M.MUDSTONE,'mudstone','Mudstone','Baked mud forms a stable impermeable rock. Grinding releases dirt.',[118,101,86],{thermal:.5}),
  mat(M.CLAY_SOIL,'clay-soil','Clay soil','Cohesive clay-rich soil. Absorbs water slowly and bakes into ceramic above 400°C.',[158,113,80],{digResist:95,permeability:.05,moistureCap:200,nutrient:15,chamberSuitability:.7,cohesion:.9}),
  mat(M.PERMAFROST,'permafrost','Permafrost','Frozen wet soil. Stays fixed below freezing; thawing produces mud with the stored pore water.',[122,115,103],{moistureCap:160,initialMoisture:100,initialTemperature:-12,thermal:.35,digResist:180}),
  mat(M.MYCELIUM,'mycelium','Mycelium','Simplified fungal soil network. Spreads into touching moist dirt by consuming substrate nutrients; dries into dirt. Not a researched species profile.',[141,118,135],{moistureCap:180,initialMoisture:60,permeability:.3,nutrient:40,digResist:20,flammability:.2}),
  mat(M.MULCH,'mulch','Mulch','Loose combustible plant litter. Moist mulch slowly decomposes into dirt.',[126,67,35],{granular:true,cohesion:.3,moistureCap:180,permeability:.5,nutrient:80,digResist:12,flammability:.6}),
  mat(M.BASALT,'basalt','Basalt','Dense fixed volcanic rock. Melted by intense heat; grinding yields loose rock.',[78,77,74],{density:3,thermal:.8}),
  mat(M.TUFF,'tuff','Tuff','Porous volcanic rock. Absorbs water readily and crushes into ash.',[155,144,115],{density:1.5,moistureCap:100,permeability:.6,thermal:.3,digResist:100}),
  mat(M.CINNABAR,'cinnabar','Cinnabar','Toxic mineral powder. Contaminates contact cells; strong heating leaves metal and toxic smoke. Simplified chemistry.',[165,68,52],{granular:true,cohesion:.1,density:8,thermal:.5}),
  mat(M.LIMESTONE,'limestone','Limestone','Carbonate rock. Contact with acid consumes reagent and releases carbon dioxide; crushing yields mineral dust.',[192,185,150],{density:2.7,thermal:.6}),
  mat(M.BAKED_CLAY,'baked-clay','Baked clay','Fired ceramic grains. Remains dry, falls in piles and melts into glass-like liquid under intense heat.',[166,88,67],{granular:true,cohesion:.1,density:2.4,thermal:.6}),
  mat(M.GRASS,'grass','Grass','Rooted ground cover. Uses soil moisture, spreads laterally and withers when dry.',[91,153,46],{solid:false,state:'solid',climbable:true,category:'organic',nutrient:20,flammability:.6}),
  mat(M.ALGAE,'algae','Algae','Aquatic growth. Consumes local nutrient reserves to colonize adjacent water; dries out on land.',[122,161,49],{solid:false,state:'solid',category:'organic',nutrient:40,moistureCap:64,initialMoisture:32}),
  mat(M.CELL,'cell','Cell','Generic microbial sandbox cell. Nutrient-limited fission near water; extreme temperature and starvation kill it.',[145,201,64],{solid:false,state:'solid',category:'organic',nutrient:60,moistureCap:64,initialMoisture:32}),
  mat(M.PLAGUE,'plague','Plague','FICTIONAL sandbox pathogen. Infects nearby wildlife and consumes itself while spreading in nutrient-rich wet material; not a real disease model.',[109,50,138],{solid:false,state:'solid',category:'organic',nutrient:40}),
  mat(M.BONE,'bone','Bone','Structural remains. Resists ordinary decay, dissolves in acid and crushes into mineral dust.',[219,214,195],{density:1.8,thermal:.3}),
  mat(M.SAPLING,'sapling','Sapling','Young tree. Moist fertile soil supports roots, a woody trunk and a leafy crown.',[121,148,64],{solid:false,state:'solid',category:'organic',nutrient:30,flammability:.5,climbable:true}),
  mat(M.PINECONE,'pinecone','Pinecone','Falling cone. On moist soil it can germinate into a sapling; excessive heat burns it.',[129,86,46],{granular:true,cohesion:.1,food:3,foodUnits:2,category:'organic',flammability:.5}),
  mat(M.CACTUS,'cactus','Cactus','Water-storing desert plant. Uses moisture slowly; adjacent contact injures soft-bodied wildlife.',[89,146,68],{solid:false,state:'solid',climbable:true,category:'organic',nutrient:35,moistureCap:160,initialMoisture:100,flammability:.15}),
  mat(M.KELP,'kelp','Kelp','Rooted aquatic fronds. Grows upward through water, transfers displaced water into moisture and dies when stranded.',[86,129,54],{solid:false,state:'solid',climbable:true,category:'organic',nutrient:40,moistureCap:64,initialMoisture:32}),
  mat(M.CORAL,'coral','Coral','Fixed aquatic colony. Slow nutrient-limited branching; simplified heat-stress mortality leaves a mineral skeleton. Bleaching and recovery physiology are abstracted.',[203,123,157],{category:'organic',nutrient:50,moistureCap:64,initialMoisture:32,thermal:.4}),
  mat(M.POLLEN,'pollen','Pollen','Falling pollen. Bees can carry it; touching a different flower supports seed production.',[216,194,61],{granular:true,cohesion:0,category:'organic',nutrient:1,flammability:.5}),
  mat(M.FLOWER_SEED,'flower-seed','Flower seed','Germinates on damp fertile soil into a flowering stem. Its nutritional seed unit is consumed by germination.',[125,104,55],{granular:true,cohesion:.1,food:3,foodUnits:1,category:'organic',flammability:.4}),
  mat(M.PETAL,'petal','Petal','Living flower petal. Attracts pollinators, produces pollen using stored growth energy and needs a supporting stem.',[207,109,149],{solid:false,state:'solid',category:'organic',nutrient:25,flammability:.4}),
  mat(M.VINE,'vine','Vine','Climbing plant. Grows along connected walls or stems using moisture; unsupported tips cannot keep extending.',[70,133,62],{solid:false,state:'solid',climbable:true,category:'organic',nutrient:30,flammability:.6}),
  mat(M.BAMBOO_PLANT,'bamboo-plant','Bamboo plant','Segmented tall shoots. Draws water from soil and matures lower segments into wood; growth is resource-limited.',[143,160,66],{solid:false,state:'solid',climbable:true,category:'organic',nutrient:40,flammability:.5}),
  mat(M.MUSHROOM_SPORE,'mushroom-spore','Mushroom spore','Falling fungal propagule. Damp organic substrate supports mycelium and fruiting mushrooms.',[158,133,164],{granular:true,cohesion:0,category:'organic',nutrient:4}),
  mat(M.LICHEN,'lichen','Lichen','Slow surface crust. Colonizes wet rock using stored nutrients and withers under prolonged dryness.',[156,180,144],{solid:false,state:'solid',category:'organic',nutrient:30,moistureCap:40,initialMoisture:20,flammability:.2}),
  mat(M.PRIMORDIAL_SOUP,'primordial-soup','Primordial soup','FICTIONAL abiogenesis sandbox mixture. Warm nutrient-rich liquid can form cells; this does not simulate the origin of life.',[144,83,53],{solid:false,state:'liquid',category:'fluid',density:1.1,viscosity:.5,nutrient:80,moistureCap:64,initialMoisture:40}),
  mat(M.MUSHROOM,'mushroom','Mushroom','Fungal fruiting body. Requires damp substrate; releases spores at a nutrient cost and decomposes when dry.',[170,130,123],{solid:false,state:'solid',category:'organic',nutrient:30,moistureCap:64,initialMoisture:20,flammability:.3}),
  mat(M.SLIME,'slime','Slime','Viscous wet gel. Slows contacting organisms and dries into dust when heated.',[145,194,102],{solid:false,state:'liquid',category:'fluid',density:1.2,viscosity:.95,adhesion:.7,carrierCapacity:64,initialCarrier:48,nutrient:80,freezeAt:-5}),
  mat(M.CEMENT,'cement','Cement','Wet cement. Slowly sets against a support into a fixed concrete barrier; retains its bound water.',[147,151,148],{solid:false,state:'liquid',category:'fluid',density:2.4,viscosity:.9,carrierCapacity:64,initialCarrier:48,nutrient:120}),
  mat(M.LAMP_OIL,'lamp-oil','Lamp oil','Light liquid fuel. Floats above water, ignites readily and burns out; not edible oil.',[186,190,139],{solid:false,state:'liquid',category:'fluid',density:.78,viscosity:.1,flammability:1,freezeAt:-20}),
  mat(M.FOAM,'foam','Foam','Light bubbly film. Rises, traps carrier water and collapses back into that water when its lifetime expires.',[217,229,216],{solid:false,state:'gas',density:.025,carrierCapacity:64,initialCarrier:16,nutrient:90}),
  mat(M.GLUE,'glue','Glue','Very sticky liquid. Slows grains and organisms; dries into a solid adhesive.',[205,191,131],{solid:false,state:'liquid',category:'fluid',density:1.15,viscosity:.98,adhesion:.95,carrierCapacity:64,initialCarrier:48,nutrient:80}),
  mat(M.SODA,'soda','Soda','Carbonated sugar solution. Releases gas bubbles; heating leaves sugar and steam.',[143,94,53],{solid:false,state:'liquid',category:'food',density:1.03,food:1,foodUnits:8,carrierCapacity:64,initialCarrier:56,freezeAt:-2}),
  mat(M.JUICE,'juice','Juice','Fruit sugar solution. Feeds adults, can ferment with yeast, freezes, and concentrates when boiled.',[218,168,61],{solid:false,state:'liquid',category:'food',density:1.05,food:1,foodUnits:8,carrierCapacity:64,initialCarrier:48,freezeAt:-3}),
  mat(M.MILK,'milk','Milk','Protein food with a water carrier. Freezes, curdles near acid and leaves milk powder when boiled.',[224,225,211],{solid:false,state:'liquid',category:'food',density:1.04,viscosity:.15,food:2,foodUnits:6,carrierCapacity:64,initialCarrier:48,freezeAt:-1}),
  mat(M.VINEGAR,'vinegar','Vinegar','Mild aqueous acid. Curdles milk, reacts with carbonate and baking soda, and releases hazardous gas near bleach.',[210,197,141],{solid:false,state:'liquid',category:'fluid',density:1.02,nutrient:64,carrierCapacity:64,initialCarrier:56,freezeAt:-2}),
  mat(M.SOAP,'soap','Soap','Finite cleaning reagent. Lifts oil into an emulsion, creates foam with water and lowers local contamination.',[205,218,209],{solid:false,state:'liquid',category:'fluid',density:1.08,viscosity:.3,nutrient:64,carrierCapacity:64,initialCarrier:48}),
  mat(M.BLEACH,'bleach','Bleach','Finite oxidizing cleaner. Removes stains and contamination. Contact with acid creates harmful chlorine gas.',[233,234,224],{solid:false,state:'liquid',category:'fluid',density:1.1,nutrient:64,carrierCapacity:64,initialCarrier:56}),
  mat(M.DYE,'dye','Dye','Colored liquid pigment. Finite reagent stains contacting matter; its carrier water and color persist as it moves.',[199,91,178],{solid:false,state:'liquid',category:'fluid',density:1.05,nutrient:64,carrierCapacity:64,initialCarrier:48,defaultTint:0xffc953a6}),
  mat(M.INK,'ink','Ink','Dark liquid pigment. Stains neighboring matter until exhausted; bleach can remove the color.',[52,54,63],{solid:false,state:'liquid',category:'fluid',density:1.08,viscosity:.4,nutrient:64,carrierCapacity:64,initialCarrier:40,defaultTint:0xff242533}),
  mat(M.MERCURY,'mercury','Mercury','Dense conductive toxic liquid. Freezes below −39°C and produces toxic vapor above 357°C in this game.',[166,176,181],{solid:false,state:'liquid',category:'fluid',density:13.5,conductivity:.8,viscosity:.05,thermal:.9}),
  mat(M.BLOOD,'blood','Blood','Protein-bearing fluid. Coagulates into remains, freezes and can be consumed by compatible animals.',[156,59,51],{solid:false,state:'liquid',category:'food',density:1.06,viscosity:.3,food:2,foodUnits:5,carrierCapacity:64,initialCarrier:40,freezeAt:-2}),
  mat(M.VACCINE,'vaccine','Vaccine','FICTIONAL, Fantasy only: a finite dose gives wildlife temporary resistance to the toy Plague mechanic. Does not cure an existing infection.',[152,207,224],{solid:false,state:'liquid',category:'fluid',density:1.05,nutrient:64,carrierCapacity:64,initialCarrier:48}),
  mat(M.POISON,'poison','Poison','Finite toxic reagent. Contaminates its cell and contacting surfaces, harming organisms; antidote counters it.',[113,178,65],{solid:false,state:'liquid',category:'fluid',density:1.1,nutrient:64,carrierCapacity:64,initialCarrier:48}),
  mat(M.ANTIDOTE,'antidote','Antidote','FICTIONAL, Fantasy only: consumes local contamination and poison reagent. Cannot revive organisms or repair heat damage.',[183,212,115],{solid:false,state:'liquid',category:'fluid',density:1.05,nutrient:64,carrierCapacity:64,initialCarrier:48}),
  mat(M.SAP,'sap','Sap','Viscous sugary plant liquid. Heating concentrates it into caramel; compatible ants collect its sugar.',[199,142,66],{solid:false,state:'liquid',category:'food',density:1.2,viscosity:.75,food:1,foodUnits:8,carrierCapacity:64,initialCarrier:32,freezeAt:-5}),
  mat(M.CARAMEL,'caramel','Caramel','Very viscous concentrated sugar. Heat can drive off its remaining carrier; freezing makes a solid mixture.',[175,112,53],{solid:false,state:'liquid',category:'food',density:1.3,viscosity:.95,adhesion:.4,food:1,foodUnits:8,carrierCapacity:64,initialCarrier:8,freezeAt:5,flammability:.3}),
  mat(M.MOLASSES,'molasses','Molasses','Dense sugar syrup. Flows slowly, feeds adults and can ferment with yeast.',[103,71,45],{solid:false,state:'liquid',category:'food',density:1.4,viscosity:.9,food:1,foodUnits:8,carrierCapacity:64,initialCarrier:24,freezeAt:-8}),
  mat(M.KETCHUP,'ketchup','Ketchup','Thick sugary sauce. Retains its carrier separately, freezes and leaves sugar residue under strong heating.',[174,68,48],{solid:false,state:'liquid',category:'food',density:1.16,viscosity:.9,food:1,foodUnits:6,carrierCapacity:64,initialCarrier:40,freezeAt:-3}),
  mat(M.MAYO,'mayo','Mayo','Thick edible emulsion. Provides adult-energy food; heating separates edible oil and steam.',[214,211,161],{solid:false,state:'liquid',category:'food',density:.95,viscosity:.9,food:1,foodUnits:8,carrierCapacity:64,initialCarrier:32,freezeAt:-4}),
  mat(M.LIQUID_HYDROGEN,'liquid-hydrogen','Liquid hydrogen','Cryogenic liquid introduced at −258°C. Warms into flammable hydrogen gas; phase-change volumes are abstracted.',[151,193,225],{solid:false,state:'liquid',category:'fluid',density:.07,initialTemperature:-258,nutrient:64}),
  mat(M.LIQUID_NITROGEN,'liquid-nitrogen','Liquid nitrogen','Cryogenic liquid introduced at −205°C. Warms into nitrogen gas and chills nearby material through the thermal field.',[156,200,212],{solid:false,state:'liquid',category:'fluid',density:.81,initialTemperature:-205,nutrient:64}),
  mat(M.CONCRETE,'concrete','Concrete powder','Loose dry cement-like powder. Mixes with water into wet cement, then sets into a fixed solid.',[154,157,152],{granular:true,cohesion:.05,density:2.4}),
  mat(M.CURED_CONCRETE,'cured-concrete','Cured concrete','Set concrete barrier. Strong fixed material; bound water is tracked separately.',[129,134,132],{density:2.5,carrierCapacity:64,thermal:.7}),
  mat(M.DRY_GLUE,'dry-glue','Dry glue','Dried fixed adhesive. Bonds passages shut and softens near hot water.',[184,169,109],{carrierCapacity:64,adhesion:1,flammability:.4}),
  mat(M.CHEESE,'cheese','Cheese','Curdled protein food. Retains bound water; intense heating dries it into protein powder.',[220,185,77],{food:2,foodUnits:6,carrierCapacity:64,category:'food',freezeAt:-2}),
  mat(M.MILK_POWDER,'milk-powder','Milk powder','Dry protein food. Rehydrates in water into milk.',[223,218,183],{granular:true,cohesion:.05,food:2,foodUnits:6,category:'food'}),
  mat(M.FROZEN_MIXTURE,'frozen-mixture','Frozen mixture','Frozen solution. Stores its original material, nutrients and carrier water; thaws back to that composition.',[164,199,212],{carrierCapacity:64,thermal:.7}),
  mat(M.FROZEN_MERCURY,'frozen-mercury','Frozen mercury','Cold conductive metal. Melts back to mercury above −39°C.',[152,171,180],{conductivity:.8,density:13.5,thermal:.9}),
  mat(M.MERCURY_VAPOR,'mercury-vapor','Mercury vapor','Toxic metal vapor. Condenses below 350°C; numerical toxicity is a game rule.',[165,170,175],{solid:false,state:'gas',density:.5,nutrient:120}),
  mat(M.NITROGEN,'nitrogen','Nitrogen','Nonflammable gas. Condenses into liquid nitrogen below −200°C in this game; respiration and pressure are not modeled.',[145,177,185],{solid:false,state:'gas',density:.09,nutrient:64}),
  mat(M.BUBBLE,'bubble','Bubble','Short-lived buoyant gas bubble. Releases any trapped carrier water when it collapses.',[188,213,219],{solid:false,state:'gas',density:.02,nutrient:45,carrierCapacity:64}),
  mat(M.CHLORINE,'chlorine','Chlorine','Harmful gas from an acid/bleach reaction. Spreads contamination in connected spaces and disperses.',[169,191,98],{solid:false,state:'gas',density:.22,nutrient:150}),
  mat(M.YEAST,'yeast','Yeast','Fermentation starter. Converts neighboring sugar solutions into alcohol under mild temperatures, with a nutrition cost.',[191,160,108],{granular:true,cohesion:.1,nutrient:32}),
  mat(M.BAKING_SODA,'baking-soda','Baking soda','Falling bicarbonate-like powder. Mild acid contact releases gas and neutralized water.',[222,224,216],{granular:true,cohesion:0}),
  mat(M.NUT_OIL,'nut-oil','Nut oil','Edible flammable oil. Floats above water and retains its adult-energy food units.',[197,169,66],{solid:false,state:'liquid',category:'food',density:.9,viscosity:.4,food:1,foodUnits:8,flammability:.6,freezeAt:-10}),
  mat(M.WHEY,'whey','Whey','Watery protein food separated from curds. Freezes and dries into milk powder.',[192,202,144],{solid:false,state:'liquid',category:'food',density:1.02,food:2,foodUnits:2,carrierCapacity:64,initialCarrier:48,freezeAt:-1}),
  mat(M.EMULSION,'emulsion','Oily soap','Oil lifted into a soapy emulsion. Heating separates the oil and carrier water again.',[165,173,133],{solid:false,state:'liquid',category:'fluid',density:.95,viscosity:.4,nutrient:64,carrierCapacity:64}),
  mat(M.ETHANOL_VAPOR,'ethanol-vapor','Alcohol vapor','Flammable vapor; condenses back into alcohol below 70°C. Pressure and expansion are abstracted.',[187,201,213],{solid:false,state:'gas',density:.06,flammability:1,nutrient:64}),
  mat(M.CLOT,'clot','Clotted blood','Coagulated protein food with retained water. Heat dries it; this is a sandbox material, not a physiology model.',[111,46,40],{food:2,foodUnits:5,category:'food',carrierCapacity:64}),
  mat(M.CHARCOAL,'charcoal','Charcoal','Porous carbon grains. Absorb water and remove limited contamination at contact; burn when dry. Separate from mineral coal.',[48,48,45],{granular:true,cohesion:.1,density:.7,moistureCap:80,permeability:.4,flammability:.25,nutrient:80}),
  mat(M.TINDER,'tinder','Tinder','Light, easily ignited plant fibers. Dry fibers drift and float; absorbed water suppresses ignition.',[185,144,85],{granular:true,cohesion:.05,density:.2,fallRate:.5,moistureCap:60,permeability:.4,flammability:1}),
  mat(M.WAX,'wax','Wax','Loose wax grains float on water, melt into a viscous liquid and burn as fuel.',[229,213,148],{granular:true,cohesion:.1,density:.9,meltAt:48,meltInto:M.MOLTEN_WAX,flammability:.5}),
  mat(M.INCENSE,'incense','Incense','Scented combustible grains. Warm grains release finite fragrance; ignited grains smolder into ash and smoke.',[162,113,87],{granular:true,cohesion:.1,density:.8,nutrient:100}),
  mat(M.SODIUM,'sodium','Sodium','Reactive metal grains. Water contact consumes water, releases hydrogen and heat, and forms an alkaline solution. Melts and tarnishes in air.',[179,189,184],{granular:true,cohesion:0,density:.97,conductivity:.8,nutrient:80,meltAt:98,meltInto:M.MOLTEN_SODIUM}),
  mat(M.CALCIUM,'calcium','Calcium','Reactive metal grains. Water contact forms slaked lime and hydrogen; high heat melts the metal.',[192,194,174],{granular:true,cohesion:0,density:1.55,conductivity:.5,meltAt:842,meltInto:M.MOLTEN_CALCIUM}),
  mat(M.POTASSIUM,'potassium','Potassium','Soft reactive metal grains. Water forms alkaline potash solution, hydrogen and heat; exposed grains tarnish.',[170,178,195],{granular:true,cohesion:0,density:.86,conductivity:.7,nutrient:60,meltAt:64,meltInto:M.MOLTEN_POTASSIUM}),
  mat(M.MAGNESIUM,'magnesium','Magnesium','Conductive metal grains. Resist cool water in this abstraction; strong heat ignites a bright, finite burn. Hot steam can release hydrogen.',[196,204,197],{granular:true,cohesion:0,density:1.74,conductivity:.7,meltAt:650,meltInto:M.MOLTEN_MAGNESIUM}),
  mat(M.LYE,'lye','Lye','Caustic powder. Dissolves into an alkaline solution, neutralizes acid, absorbs carbon dioxide and converts contacting edible oil into soap.',[216,221,211],{granular:true,cohesion:0,nutrient:64}),
  mat(M.THERMITE,'thermite','Thermite','Premixed sandbox heating material. Strong heat starts a finite, intensely hot burn that leaves iron and slag. Not a preparation recipe.',[133,94,70],{granular:true,cohesion:0,density:3.4,nutrient:100}),
  mat(M.SLAG,'slag','Slag','Dense refractory byproduct grains. Melt under strong heat and solidify back into slag.',[99,105,93],{granular:true,cohesion:.1,density:2.7,meltAt:1100,meltInto:M.MOLTEN_SLAG}),
  mat(M.SULFUR,'sulfur','Sulfur','Yellow mineral grains. Melt when warmed and burn in strong heat or near flame, producing irritating sulfur dioxide.',[216,202,70],{granular:true,cohesion:0,density:2,meltAt:115,meltInto:M.MOLTEN_SULFUR}),
  mat(M.URANIUM,'uranium','Uranium','Dense metal grains. Chemical contamination and accelerated, short-range radiation exposure are separate hazards. No fission chain or enrichment model.',[122,145,99],{granular:true,cohesion:0,density:19,conductivity:.25,meltAt:1132,meltInto:M.MOLTEN_URANIUM}),
  mat(M.DIAMOND,'diamond','Diamond','Hard carbon grains. Resist acid and sink in water. Strong heat in exposed air oxidizes them; hardness does not mean indestructibility.',[164,216,228],{granular:true,cohesion:0,density:3.5,acidResistance:1,thermal:1}),
  mat(M.GOLD_COIN,'gold-coin','Gold coin','Dense conductive gold pieces. Fall through water, resist acid and melt; cooling molten gold produces unminted solid gold.',[222,177,62],{granular:true,cohesion:0,density:19.3,conductivity:.9,acidResistance:1,meltAt:1064,meltInto:M.MOLTEN_GOLD}),
  mat(M.RUST,'rust','Rust','Iron-oxide-like grains. Strong heat beside charcoal can reduce them into iron with a finite carbon cost and carbon dioxide release.',[153,75,44],{granular:true,cohesion:.05,density:4.8}),
  mat(M.METAL_SCRAP,'metal-scrap','Metal scrap','Irregular conductive iron fragments. Fall, corrode at water contact and melt into iron liquid.',[122,135,133],{granular:true,cohesion:0,density:7.5,conductivity:.7,meltAt:1538,meltInto:M.MOLTEN_IRON}),
  mat(M.FEATHER,'feather','Feather','Light feather fragments. Flutter slowly, float, absorb water and burn; wet fragments fall faster.',[216,205,179],{granular:true,cohesion:0,density:.12,fallRate:.18,moistureCap:60,permeability:.4,flammability:.8}),
  mat(M.CONFETTI,'confetti','Confetti','Colored paper flecks. Drift, float, become waterlogged and burn. Color is cosmetic and stays with each particle.',[211,115,147],{granular:true,cohesion:0,density:.18,fallRate:.3,moistureCap:40,permeability:.4,flammability:.9,randomTints:[0xffdc718c,0xff68b4c3,0xffe5c269,0xff9bb66b]}),
  mat(M.GLITTER,'glitter','Glitter','Light conductive metal flakes. Drift and float; strong heating turns the metal into a liquid.',[189,186,135],{granular:true,cohesion:0,density:.3,fallRate:.45,conductivity:.35,meltAt:660,meltInto:M.MOLTEN_METAL}),
  mat(M.BEAD,'bead','Bead','Colored glass beads. Roll as loose grains, sink, resist acid and melt into glass liquid. Seeded pigment variation is cosmetic.',[109,172,184],{granular:true,cohesion:0,density:2.4,acidResistance:1,meltAt:1000,meltInto:M.MOLTEN_GLASS,randomTints:[0xff70b9d1,0xffdc8397,0xffa6c36c,0xffd4bc69,0xffaa91ce]}),
  mat(M.COLOR_SAND,'color-sand','Color sand','Colored mineral grains. Paint color with the picker; grains fall normally and preserve their stain when melting into glass.',[218,140,129],{granular:true,cohesion:0,density:2.5,defaultTint:0xffda8c81,meltAt:1000,meltInto:M.MOLTEN_GLASS}),
  mat(M.BORAX,'borax','Borax','Borate powder. Dissolves, helps turn contacting glue into slime, reacts with acid and fuses into borax glass under high heat.',[210,221,213],{granular:true,cohesion:0,nutrient:64,meltAt:740,meltInto:M.MOLTEN_BORAX}),
  mat(M.MOLTEN_WAX,'molten-wax','Molten wax','Viscous buoyant wax fuel. Cools back into wax grains in this particle abstraction.',[218,191,114],{solid:false,state:'liquid',density:.85,viscosity:.65,flammability:.6,coolAt:40,coolInto:M.WAX}),
  mat(M.BURNING_INCENSE,'burning-incense','Smoldering incense','Finite smoldering grains emit smoke and fragrance, release heat, and end as ash.',[157,81,55],{granular:true,cohesion:.1,density:.7,nutrient:100}),
  mat(M.FRAGRANCE,'fragrance','Fragrance','Non-command scent gas. Drifts through open space and disperses; ants do not mistake this for their own pheromones.',[188,168,199],{solid:false,state:'gas',density:.04,nutrient:90}),
  mat(M.MOLTEN_SODIUM,'molten-sodium','Molten sodium','Hot reactive metal liquid. Water contact forms caustic solution and hydrogen; cooling restores grains.',[199,193,156],{solid:false,state:'liquid',density:.9,conductivity:.8,nutrient:80,coolAt:90,coolInto:M.SODIUM}),
  mat(M.MOLTEN_CALCIUM,'molten-calcium','Molten calcium','Hot calcium-like metal liquid. Reacts with water and cools into grains.',[219,194,150],{solid:false,state:'liquid',density:1.4,conductivity:.5,coolAt:820,coolInto:M.CALCIUM}),
  mat(M.MOLTEN_POTASSIUM,'molten-potassium','Molten potassium','Reactive liquid metal. Water contact forms potash solution and hydrogen; cools into grains.',[193,184,197],{solid:false,state:'liquid',density:.8,conductivity:.7,nutrient:60,coolAt:58,coolInto:M.POTASSIUM}),
  mat(M.MOLTEN_MAGNESIUM,'molten-magnesium','Molten magnesium','Hot conductive metal liquid. Can burn brightly or react with steam; cools into grains.',[226,207,161],{solid:false,state:'liquid',density:1.6,conductivity:.7,coolAt:625,coolInto:M.MAGNESIUM}),
  mat(M.LYE_SOLUTION,'lye-solution','Lye solution','Caustic water-bearing reagent. Neutralizes acid, carbonates, and makes soap at oil contact. Water remains separately tracked.',[186,213,210],{solid:false,state:'liquid',density:1.15,nutrient:64,carrierCapacity:64}),
  mat(M.POTASH,'potash','Potash','Alkaline potassium-hydroxide-like grains. Dissolve and react with acid, carbon dioxide and oils.',[198,205,186],{granular:true,cohesion:0,nutrient:64}),
  mat(M.POTASH_SOLUTION,'potash-solution','Potash solution','Water-bearing alkaline reagent. Neutralizes acid and can form soap or carbonate.',[175,203,181],{solid:false,state:'liquid',density:1.12,nutrient:64,carrierCapacity:64}),
  mat(M.LIME,'lime','Slaked lime','Basic calcium-like reaction product. Retains bound water, reacts with acid and carbonates into limestone.',[204,208,185],{granular:true,cohesion:.1,nutrient:64,carrierCapacity:64}),
  mat(M.MAGNESIUM_OXIDE,'magnesium-oxide','Magnesium oxide','Refractory powder left by magnesium burning. Resists ordinary heat and neutralizes finite acid.',[221,225,213],{granular:true,cohesion:0,density:3.5,nutrient:64}),
  mat(M.BURNING_MAGNESIUM,'burning-magnesium','Burning magnesium','Finite bright metal burn. Releases heat and sparks before becoming oxide; water is not a universal extinguisher.',[246,245,205],{granular:true,cohesion:0,density:1.5,nutrient:80}),
  mat(M.BURNING_THERMITE,'burning-thermite','Burning thermite','Finite hot premixed material. Produces molten iron and slag; temperature is capped by the game field.',[245,182,79],{granular:true,cohesion:0,density:3.3,nutrient:100}),
  mat(M.MOLTEN_SLAG,'molten-slag','Molten slag','Viscous refractory melt. Cools into slag grains.',[191,126,75],{solid:false,state:'liquid',density:2.5,viscosity:.75,coolAt:1000,coolInto:M.SLAG}),
  mat(M.MOLTEN_SULFUR,'molten-sulfur','Molten sulfur','Warm sulfur liquid. Cools into yellow grains; intense heat or flame can produce sulfur dioxide.',[197,162,54],{solid:false,state:'liquid',density:1.8,viscosity:.4,coolAt:108,coolInto:M.SULFUR}),
  mat(M.SULFUR_DIOXIDE,'sulfur-dioxide','Sulfur dioxide','Irritating gas from sulfur combustion and mineral roasting. Contaminates contacting spaces and disperses.',[180,184,126],{solid:false,state:'gas',density:.2,nutrient:150}),
  mat(M.MOLTEN_URANIUM,'molten-uranium','Molten uranium','Dense hot metal liquid. Remains a chemical and accelerated radiation hazard; no reactor physics.',[180,175,91],{solid:false,state:'liquid',density:17,conductivity:.3,coolAt:1100,coolInto:M.URANIUM}),
  mat(M.RADIATION,'radiation','Radiation','Short-range ionizing-effect particle. Moves through connected gas, is absorbed by matter and leaves decaying game exposure. Not a calibrated dose or mutation grant.',[187,233,112],{solid:false,state:'gas',density:.01,nutrient:12,phaseMax:3}),
  mat(M.MOLTEN_GOLD,'molten-gold','Molten gold','Dense conducting precious-metal liquid. Cools into fixed gold, without minting new coins.',[238,186,71],{solid:false,state:'liquid',density:17,conductivity:.9,acidResistance:1,coolAt:1040,coolInto:M.GOLD}),
  mat(M.GOLD,'gold','Gold','Fixed conductive gold. Dense and acid-resistant; melts under strong heat.',[205,165,56],{density:19.3,conductivity:.9,acidResistance:1,meltAt:1064,meltInto:M.MOLTEN_GOLD}),
  mat(M.IRON,'iron','Iron','Fixed conductive metal. Water contact can rust it; strong heating melts it.',[131,143,143],{density:7.8,conductivity:.7,meltAt:1538,meltInto:M.MOLTEN_IRON}),
  mat(M.MOLTEN_IRON,'molten-iron','Molten iron','Dense hot conducting liquid. Solidifies into iron when cooled.',[228,159,83],{solid:false,state:'liquid',density:7,conductivity:.7,coolAt:1500,coolInto:M.IRON}),
  mat(M.BORAX_SOLUTION,'borax-solution','Borax solution','Dissolved finite borate reagent. Makes slime at glue contact and forms boric-acid-like residue with acid.',[181,204,202],{solid:false,state:'liquid',density:1.1,nutrient:64,carrierCapacity:64}),
  mat(M.BORAX_GLASS,'borax-glass','Borax glass','Fixed glassy fused borate. Acid-resistant and remelts under strong heat.',[166,197,179],{acidResistance:1,meltAt:740,meltInto:M.MOLTEN_BORAX}),
  mat(M.MOLTEN_PLASTIC,'molten-plastic','Molten plastic','Viscous polymer-like melt. Burns and cools into fixed plastic.',[165,159,185],{solid:false,state:'liquid',density:.9,viscosity:.8,flammability:.5,coolAt:120,coolInto:M.PLASTIC}),
  mat(M.PLASTIC,'plastic','Plastic','Fixed polymer-like barrier. Insulates electrical contacts, melts and burns under strong heat.',[173,176,191],{density:.95,thermal:.15,flammability:.4,meltAt:160,meltInto:M.MOLTEN_PLASTIC}),
  mat(M.MOLTEN_BORAX,'molten-borax','Molten borax','Hot fused borate liquid; cooling leaves borax glass.',[191,215,170],{solid:false,state:'liquid',density:2,viscosity:.5,coolAt:690,coolInto:M.BORAX_GLASS}),
  mat(M.SODIUM_CARBONATE,'sodium-carbonate','Sodium carbonate','Carbonated alkaline powder. Water forms a milder solution; acid releases carbon dioxide. Bound water is retained.',[200,211,202],{granular:true,cohesion:0,nutrient:32,carrierCapacity:64}),
  mat(M.POTASSIUM_CARBONATE,'potassium-carbonate','Potassium carbonate','Carbonated potassium-like powder. Retains solvent water and reacts with acid to release carbon dioxide.',[188,202,179],{granular:true,cohesion:0,nutrient:32,carrierCapacity:64}),
  mat(M.SODIUM_OXIDE,'sodium-oxide','Sodium oxide','Tarnished reactive-metal residue. Water contact forms lye solution and releases heat.',[176,183,157],{granular:true,cohesion:0,nutrient:64}),
  mat(M.POTASSIUM_OXIDE,'potassium-oxide','Potassium oxide','Tarnished potassium-like residue. Water contact forms alkaline potash solution and heat.',[174,176,146],{granular:true,cohesion:0,nutrient:64}),
  mat(M.BORIC_ACID,'boric-acid','Boric acid','Mild acidic borate residue. Retains bound water; contacting strong alkali can regenerate borax-like reagent.',[209,218,193],{granular:true,cohesion:0,nutrient:32,carrierCapacity:64}),
  mat(M.SPENT_CHARCOAL,'spent-charcoal','Spent charcoal','Saturated carbon filter grains. Retain absorbed moisture and contamination; still burn but no longer clean neighboring water.',[57,61,46],{granular:true,cohesion:.1,density:.8,moistureCap:80,permeability:.4,flammability:.25}),
];

export const NUM_MATERIALS = MATERIALS.length;
export const WATER_UNITS = 64; // moisture units in one full water cell

// Hot-path lookup tables
export const IS_SOLID = new Uint8Array(NUM_MATERIALS);
export const IS_GRANULAR = new Uint8Array(NUM_MATERIALS);
export const DIG_RESIST = new Uint16Array(NUM_MATERIALS);
export const MOIST_CAP = new Uint8Array(NUM_MATERIALS);
export const PERMEABILITY = new Float32Array(NUM_MATERIALS);
export const FOOD_OF = new Uint8Array(NUM_MATERIALS);
export const FOOD_UNITS = new Uint8Array(NUM_MATERIALS);
export const SIGNAL_PERSIST = new Float32Array(NUM_MATERIALS);
export const THERMAL = new Float32Array(NUM_MATERIALS);
export const CLIMBABLE = new Uint8Array(NUM_MATERIALS);
export const IS_GAS=new Uint8Array(NUM_MATERIALS),IS_LIQUID=new Uint8Array(NUM_MATERIALS),IS_WATER=new Uint8Array(NUM_MATERIALS);
export const DENSITY=new Float32Array(NUM_MATERIALS),CONDUCTIVITY=new Float32Array(NUM_MATERIALS);
MATERIALS[M.AIR].state='gas';MATERIALS[M.WATER].waterEquivalent=true;MATERIALS[M.PLANT].state='solid';
MATERIALS[M.ALCOHOL].carrierCapacity=64;MATERIALS[M.CONCRETE].carrierCapacity=64;
for(const m of MATERIALS)if(m.coolAt!==undefined&&m.initialTemperature===undefined)m.initialTemperature=Math.min(2000,m.coolAt+35);
MATERIALS[M.BURNING_MAGNESIUM].initialTemperature=900;MATERIALS[M.BURNING_THERMITE].initialTemperature=1800;MATERIALS[M.BURNING_INCENSE].initialTemperature=300;
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
