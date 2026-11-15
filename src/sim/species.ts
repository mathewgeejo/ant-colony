// Data-driven species definitions. Custom species can be imported as JSON with
// the same shape; validateSpecies() checks them (no executable code is accepted).

export interface SpeciesDef {
  id: string;
  name: string;
  commonName: string;
  status: 'researched-profile' | 'fictional';
  subfamily: string;
  summary: string;
  founding: {
    strategy: 'claustral' | 'semi-claustral';
    /** queen body reserves in energy units at landing */
    reserves: number;
    /** semi-claustral queens leave the chamber to forage while reserves are low */
    forageBelowReserve: number;
    sealsChamber: boolean;
    association: 'haplometrosis' | 'pleometrosis-reduction' | 'primary-polygyny';
    /** chance a landing queen joins a nearby founding chamber of her species */
    associationChance: number;
    /** metabolic multiplier for queens in a group (P. californicus pairs ~0.86) */
    groupMetabolism: number;
    /** preferred chamber depth below surface (cells) */
    chamberDepth: number;
    /** moisture saturation (0..1) range preferred for the founding chamber */
    moisture: [number, number];
  };
  queen: {
    lifespanDays: number;
    eggsPerDay: number;
    /** probability distribution of number of males mated: [P(1), P(2), P(3), ...] */
    matings: number[];
  };
  nutrition: {
    /** efficiency (0..1) with which each food type is used */
    sugar: number;
    protein: number;
    seed: number;
    /** relative attractiveness to foragers */
    preference: { sugar: number; protein: number; seed: number };
  };
  development: {
    /** game days for each stage at tOpt with no genetic modification */
    eggDays: number;
    larvaDays: number;
    pupaDays: number;
    /** lower developmental threshold, optimum and upper lethal limit (degC) */
    tMin: number;
    tOpt: number;
    tMax: number;
    /** pupae spin cocoons (Formicinae) or are naked (Myrmicinae): visual + humidity sensitivity */
    cocoon: boolean;
    /** protein units a standard worker larva needs */
    larvalProtein: number;
    /** relative humidity below which brood desiccates */
    minHumidity: number;
  };
  activity: {
    /** surface foraging temperature window */
    minForageTemp: number;
    maxForageTemp: number;
    diurnal: boolean;
  };
  nest: {
    targetDepth: number;
    /** colony members per excavated cell before crowding stimulates digging */
    crowdingTarget: number;
    /** optional architecture template (defaults: dome mound, straight shaft, no disc clearing) */
    architecture?: {
      /** spoil heaped as a dome mound with brood galleries (Lasius) or a low crater ring (Pogonomyrmex) */
      mound: 'dome' | 'crater' | 'none';
      /** lateral wander of the main shaft in cells (helical-looking shafts) */
      shaftAmp: number;
      /** vertical spacing of the first chambers; spacing grows with depth */
      chamberSpacing: number;
      /** workers cut vegetation around the entrance */
      clearsDisc: boolean;
      /** seeds kept in shallow granary chambers */
      granaries: boolean;
    };
  };
  tolerances: {
    /** hydration lost per physiology tick in dry air at 25C (base) */
    desiccation: number;
    /** heat damage starts above this temp */
    heatMax: number;
    coldMin: number;
    /** game-ticks a standard worker survives fully submerged */
    submersionTicks: number;
  };
  workers: {
    polymorphism: 'monomorphic' | 'size-variable' | 'dimorphic';
    lifespanDays: number;
    /** dimorphic species: a discrete major-worker (soldier) subcaste reared from well-fed larvae */
    soldiers?: {
      /** share of new workers reared as majors when no rivals are perceived */
      baseFraction: number;
      /** share reached when the colony perceives strong competition (Passera et al. 1996) */
      maxFraction: number;
      /** major body size relative to a minor */
      sizeFactor: number;
      /** workers needed before the colony starts rearing majors */
      minColony: number;
    };
  };
  communication: {
    recruitment: 'mass' | 'individual';
    /** trail deposit per step for returning successful foragers */
    trailDeposit: number;
    /** per-update trail retention (surface signal) */
    trailRetention: number;
    /** how much foreign-colony trails are followed (0 = colony specific, 1 = not) */
    trailSharing: number;
    alarmStrength: number;
    alarmChemical: string;
    /** outgoing foraging rate modulated by contacts with returning successful foragers (Gordon) */
    returnRateRegulation: boolean;
    contactDescription: string;
  };
  defense: {
    mode: 'formic-spray' | 'sting';
    /** contact damage bonus from chemical defence */
    power: number;
    /** formic acid can be sprayed 1 cell beyond contact */
    range: number;
    description: string;
  };
  aggression: number;
  reproduction: {
    /** adult workers before the colony allocates to reproductives (scaled-down) */
    matureWorkers: number;
    /** fraction of reproductive-phase female larvae reared as gynes */
    gyneFraction: number;
    /** fraction of eggs laid unfertilised (males) in reproductive phase */
    maleEggFraction: number;
    gyneCostFactor: number;
    maleCostFactor: number;
    flightSeason: 'summer' | 'late-summer';
    flightCue: string;
    /** queenless workers may lay unfertilised (male) eggs */
    workerMaleProduction: boolean;
  };
  traits: {
    size: number; sizeSpread: number; mandible: number; signal: number; fidelity: number; waterbal: number;
    topt: number; tbreadth: number; explore: number; thrForage: number; thrNurse: number; thrDig: number;
    devrateSpread: number; chem: number;
  };
  visual: {
    body: [number, number, number];
    head: [number, number, number];
    gaster: [number, number, number];
    sprite: 'formicine' | 'myrmicine';
  };
  sources: string[];
  simplifications: string[];
}

export const LASIUS_NIGER: SpeciesDef = {
  id: 'lasius-niger',
  name: 'Lasius niger',
  commonName: 'Black garden ant',
  status: 'researched-profile',
  subfamily: 'Formicinae',
  summary: 'Temperate generalist. Fully claustral founding; mass recruitment with trail pheromone; tends aphids for honeydew; defends with formic acid spray.',
  founding: {
    strategy: 'claustral', reserves: 120, forageBelowReserve: 0, sealsChamber: true,
    association: 'pleometrosis-reduction', associationChance: 0.15, groupMetabolism: 0.9,
    chamberDepth: 14, moisture: [0.25, 0.8],
  },
  queen: { lifespanDays: 600, eggsPerDay: 6, matings: [0.85, 0.13, 0.02] },
  nutrition: { sugar: 1, protein: 1, seed: 0.2, preference: { sugar: 1.0, protein: 0.9, seed: 0.1 } },
  development: {
    eggDays: 1.6, larvaDays: 2.4, pupaDays: 1.8, tMin: 13, tOpt: 27, tMax: 36,
    cocoon: true, larvalProtein: 2, minHumidity: 0.35,
  },
  activity: { minForageTemp: 10, maxForageTemp: 36, diurnal: false },
  nest: { targetDepth: 45, crowdingTarget: 0.9, architecture: { mound: 'dome', shaftAmp: 1, chamberSpacing: 5, clearsDisc: false, granaries: false } },
  tolerances: { desiccation: 0.0016, heatMax: 39, coldMin: 2, submersionTicks: 5400 },
  workers: { polymorphism: 'size-variable', lifespanDays: 45 },
  communication: {
    recruitment: 'mass', trailDeposit: 0.9, trailRetention: 0.985, trailSharing: 0.35,
    alarmStrength: 1, alarmChemical: 'undecane/formic acid (Dufour & poison glands)', returnRateRegulation: false,
    contactDescription: 'Antennation, trophallaxis; foragers combine trail pheromone with private route memory.',
  },
  defense: { mode: 'formic-spray', power: 0.5, range: 1, description: 'Bites and sprays formic acid from the acidopore.' },
  aggression: 0.55,
  reproduction: {
    matureWorkers: 70, gyneFraction: 0.35, maleEggFraction: 0.4, gyneCostFactor: 3.5, maleCostFactor: 1.5,
    flightSeason: 'summer', flightCue: 'warm humid day in summer', workerMaleProduction: true,
  },
  traits: {
    size: 1.0, sizeSpread: 0.12, mandible: 0.45, signal: 1.0, fidelity: 0.7, waterbal: 0.45,
    topt: 25, tbreadth: 9, explore: 0.35, thrForage: 0.45, thrNurse: 0.35, thrDig: 0.5, devrateSpread: 0.12, chem: 0.5,
  },
  visual: { body: [38, 30, 30], head: [30, 24, 24], gaster: [46, 38, 36], sprite: 'formicine' },
  sources: ['https://antwiki.org/wiki/Lasius_niger','https://pubmed.ncbi.nlm.nih.gov/22972897/','https://pmc.ncbi.nlm.nih.gov/articles/PMC7411844/','https://pmc.ncbi.nlm.nih.gov/articles/PMC1859884/','https://pmc.ncbi.nlm.nih.gov/articles/PMC8404329/'],
  simplifications: [
    'Colony sizes are scaled down roughly 100x (mature colonies here have tens to a few hundred workers, not ~10,000).',
    'Development and lifespans are time-compressed (see clock); relative stage durations follow the temperature-dependent pattern, not exact day counts.',
    'Aphid tending is abstracted: plant cells may host aphid groups that drip honeydew; ants do not herd, move or protect aphids.',
    'Hibernation/diapause is not modelled; cold simply slows or stops brood development.',
  ],
};

export const POGONOMYRMEX_CALIFORNICUS: SpeciesDef = {
  id: 'pogonomyrmex-californicus',
  name: 'Pogonomyrmex californicus',
  commonName: 'California harvester ant',
  status: 'researched-profile',
  subfamily: 'Myrmicinae',
  summary: 'Arid-land seed harvester. Semi-claustral founding (queens forage during founding); some populations found nests cooperatively; individual foraging regulated by contacts with returning foragers; defends with a sting.',
  founding: {
    strategy: 'semi-claustral', reserves: 70, forageBelowReserve: 55, sealsChamber: false,
    association: 'primary-polygyny', associationChance: 0.35, groupMetabolism: 0.86,
    chamberDepth: 18, moisture: [0.05, 0.5],
  },
  queen: { lifespanDays: 700, eggsPerDay: 5, matings: [0.4, 0.35, 0.25] },
  nutrition: { sugar: 0.7, protein: 1, seed: 1, preference: { sugar: 0.3, protein: 0.7, seed: 1.0 } },
  development: {
    eggDays: 1.8, larvaDays: 2.8, pupaDays: 2.0, tMin: 17, tOpt: 31, tMax: 41,
    cocoon: false, larvalProtein: 2.4, minHumidity: 0.2,
  },
  activity: { minForageTemp: 16, maxForageTemp: 44, diurnal: true },
  nest: { targetDepth: 60, crowdingTarget: 0.8, architecture: { mound: 'crater', shaftAmp: 2, chamberSpacing: 6, clearsDisc: true, granaries: true } },
  tolerances: { desiccation: 0.0009, heatMax: 46, coldMin: 6, submersionTicks: 3600 },
  workers: { polymorphism: 'size-variable', lifespanDays: 50 },
  communication: {
    recruitment: 'individual', trailDeposit: 0.25, trailRetention: 0.99, trailSharing: 0.1,
    alarmStrength: 1.3, alarmChemical: '4-methyl-3-heptanone (mandibular glands)', returnRateRegulation: true,
    contactDescription: 'Outgoing foraging rate rises with the rate of antennal contacts with returning seed-carrying foragers.',
  },
  defense: { mode: 'sting', power: 0.9, range: 0, description: 'Powerful sting; mandibular alarm pheromone.' },
  aggression: 0.5,
  reproduction: {
    matureWorkers: 80, gyneFraction: 0.3, maleEggFraction: 0.35, gyneCostFactor: 4, maleCostFactor: 1.6,
    flightSeason: 'summer', flightCue: 'hot summer day (abstracted; real flights follow rain/photoperiod cues)', workerMaleProduction: true,
  },
  traits: {
    size: 1.25, sizeSpread: 0.14, mandible: 0.35, signal: 1.0, fidelity: 0.45, waterbal: 0.7,
    topt: 31, tbreadth: 10, explore: 0.55, thrForage: 0.4, thrNurse: 0.35, thrDig: 0.45, devrateSpread: 0.12, chem: 0.9,
  },
  visual: { body: [150, 58, 34], head: [132, 50, 30], gaster: [110, 44, 30], sprite: 'myrmicine' },
  sources: ['https://doi.org/10.1007/s00442-002-0960-2','https://doi.org/10.1016/j.anbehav.2003.11.021','https://pubmed.ncbi.nlm.nih.gov/15057720/','https://doi.org/10.1371/journal.pcbi.1002670'],
  simplifications: [
    'Genetic caste determination (dependent lineages) known from some Pogonomyrmex populations is not modelled; caste here is nutritional/colony-state dependent.',
    'Contact-based outgoing forager regulation is extrapolated from P. barbatus research, not established here for P. californicus.',
    'Seed husking and granary management are abstracted into the colony store.',
    'Mating multiplicity distribution is an assumption (polyandry is common in Pogonomyrmex; exact values for P. californicus were not verified).',
    'Nuptial-flight cues are abstracted to warm summer days.',
  ],
};

export const PHEIDOLE_PALLIDULA: SpeciesDef = {
  id: 'pheidole-pallidula',
  name: 'Pheidole pallidula',
  commonName: 'Big-headed ant',
  status: 'researched-profile',
  subfamily: 'Myrmicinae',
  summary: 'Mediterranean omnivore with two discrete worker subcastes: small minors do most of the work, large-headed majors (soldiers) defend the colony. Colonies rear more soldiers after meeting competing colonies.',
  founding: {
    strategy: 'claustral', reserves: 90, forageBelowReserve: 0, sealsChamber: true,
    association: 'haplometrosis', associationChance: 0, groupMetabolism: 1,
    chamberDepth: 12, moisture: [0.15, 0.7],
  },
  queen: { lifespanDays: 500, eggsPerDay: 7, matings: [0.9, 0.1] },
  nutrition: { sugar: 0.9, protein: 1, seed: 0.7, preference: { sugar: 0.8, protein: 1.0, seed: 0.5 } },
  development: {
    eggDays: 1.5, larvaDays: 2.4, pupaDays: 1.7, tMin: 15, tOpt: 28, tMax: 38,
    cocoon: false, larvalProtein: 1.6, minHumidity: 0.3,
  },
  activity: { minForageTemp: 14, maxForageTemp: 40, diurnal: false },
  nest: { targetDepth: 40, crowdingTarget: 0.9, architecture: { mound: 'crater', shaftAmp: 1, chamberSpacing: 4, clearsDisc: false, granaries: true } },
  tolerances: { desiccation: 0.0012, heatMax: 42, coldMin: 5, submersionTicks: 4200 },
  workers: { polymorphism: 'dimorphic', lifespanDays: 40, soldiers: { baseFraction: 0.1, maxFraction: 0.25, sizeFactor: 1.7, minColony: 12 } },
  communication: {
    recruitment: 'mass', trailDeposit: 1.0, trailRetention: 0.985, trailSharing: 0.2,
    alarmStrength: 1.2, alarmChemical: 'poison-gland and mandibular secretions (abstracted)', returnRateRegulation: false,
    contactDescription: 'Minors lay recruitment trails to food and to intruders; majors respond to strong recruitment (Detrain & Pasteels 1992).',
  },
  defense: { mode: 'sting', power: 0.35, range: 0, description: 'Minors bite and sting weakly; majors crush and shear opponents with their large mandibles.' },
  aggression: 0.6,
  reproduction: {
    matureWorkers: 80, gyneFraction: 0.3, maleEggFraction: 0.4, gyneCostFactor: 4, maleCostFactor: 1.5,
    flightSeason: 'summer', flightCue: 'warm summer day (abstracted)', workerMaleProduction: false,
  },
  traits: {
    size: 0.8, sizeSpread: 0.08, mandible: 0.4, signal: 1.0, fidelity: 0.75, waterbal: 0.5,
    topt: 27, tbreadth: 9, explore: 0.35, thrForage: 0.4, thrNurse: 0.35, thrDig: 0.5, devrateSpread: 0.12, chem: 0.4,
  },
  visual: { body: [128, 78, 42], head: [116, 68, 36], gaster: [74, 48, 32], sprite: 'myrmicine' },
  sources: ['https://doi.org/10.1038/379630a0', 'https://doi.org/10.1007/bf00170170', 'https://doi.org/10.1007/bf00293108', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3014662/'],
  simplifications: [
    'Major/minor fate is decided when an egg hatches, from colony size and perceived competition, and needs a larger protein ration; real caste fate is set by larval nutrition and juvenile hormone during a later sensitive period.',
    'The rise in soldier investment after meeting rivals follows Passera et al. (1996); its size and speed here are authored.',
    'Majors do not mill seeds or store liquid food; their in-nest work comes only from high response thresholds being crossed when minors are scarce (Wilson 1984 "elasticity").',
    'Facultative polygyny in P. pallidula is not modelled; colonies have one queen.',
    'Workers are treated as sterile (no worker-laid males).',
  ],
};

export const BUILTIN_SPECIES: SpeciesDef[] = [LASIUS_NIGER, POGONOMYRMEX_CALIFORNICUS, PHEIDOLE_PALLIDULA];

// ---------------- validation for imported species ----------------
type Check = [string, 'number' | 'string' | 'boolean' | 'array' | 'object', number?, number?];
const CHECKS: Check[] = [
  ['subfamily','string'],['founding.strategy','string'],['founding.association','string'],['founding.sealsChamber','boolean'],
  ['development.cocoon','boolean'],['activity.diurnal','boolean'],['workers.polymorphism','string'],
  ['communication.recruitment','string'],['communication.alarmChemical','string'],['communication.contactDescription','string'],
  ['defense.mode','string'],['defense.description','string'],['reproduction.flightSeason','string'],['reproduction.flightCue','string'],
  ['nutrition.preference.sugar','number',0,3],['nutrition.preference.protein','number',0,3],['nutrition.preference.seed','number',0,3],
  ['id', 'string'], ['name', 'string'], ['commonName', 'string'], ['status', 'string'], ['summary', 'string'],
  ['founding.reserves', 'number', 10, 500], ['founding.forageBelowReserve', 'number', 0, 500], ['founding.associationChance', 'number', 0, 1],
  ['founding.groupMetabolism', 'number', 0.5, 1.2], ['founding.chamberDepth', 'number', 4, 80], ['founding.moisture', 'array'],
  ['queen.lifespanDays', 'number', 10, 5000], ['queen.eggsPerDay', 'number', 0.5, 40], ['queen.matings', 'array'],
  ['nutrition.sugar', 'number', 0, 1], ['nutrition.protein', 'number', 0, 1], ['nutrition.seed', 'number', 0, 1],
  ['development.eggDays', 'number', 0.2, 20], ['development.larvaDays', 'number', 0.2, 30], ['development.pupaDays', 'number', 0.2, 20],
  ['development.tMin', 'number', -5, 30], ['development.tOpt', 'number', 10, 45], ['development.tMax', 'number', 20, 55],
  ['development.larvalProtein', 'number', 0.5, 10], ['development.minHumidity', 'number', 0, 1],
  ['activity.minForageTemp', 'number', -5, 40], ['activity.maxForageTemp', 'number', 10, 60],
  ['nest.targetDepth', 'number', 5, 200], ['nest.crowdingTarget', 'number', 0.1, 5],
  ['tolerances.desiccation', 'number', 0, 0.02], ['tolerances.heatMax', 'number', 20, 60], ['tolerances.coldMin', 'number', -20, 20],
  ['tolerances.submersionTicks', 'number', 60, 100000], ['workers.lifespanDays', 'number', 5, 1000],
  ['communication.trailDeposit', 'number', 0, 5], ['communication.trailRetention', 'number', 0.8, 0.9999], ['communication.trailSharing', 'number', 0, 1],
  ['communication.alarmStrength', 'number', 0, 5], ['communication.returnRateRegulation', 'boolean'],
  ['defense.power', 'number', 0, 3], ['defense.range', 'number', 0, 2], ['aggression', 'number', 0, 1],
  ['reproduction.matureWorkers', 'number', 10, 2000], ['reproduction.gyneFraction', 'number', 0, 1], ['reproduction.maleEggFraction', 'number', 0, 1],
  ['reproduction.gyneCostFactor', 'number', 1, 10], ['reproduction.maleCostFactor', 'number', 0.5, 10], ['reproduction.workerMaleProduction', 'boolean'],
  ['traits.size', 'number', 0.5, 2.5], ['traits.sizeSpread', 'number', 0, 0.5], ['traits.mandible', 'number', 0, 1], ['traits.signal', 'number', 0, 3],
  ['traits.fidelity', 'number', 0, 1], ['traits.waterbal', 'number', 0, 1], ['traits.topt', 'number', 5, 45], ['traits.tbreadth', 'number', 3, 25],
  ['traits.explore', 'number', 0, 1], ['traits.thrForage', 'number', 0.05, 3], ['traits.thrNurse', 'number', 0.05, 3], ['traits.thrDig', 'number', 0.05, 3],
  ['traits.devrateSpread', 'number', 0, 0.5], ['traits.chem', 'number', 0, 3],
  ['visual.body', 'array'], ['visual.head', 'array'], ['visual.gaster', 'array'], ['visual.sprite', 'string'],
  ['sources', 'array'], ['simplifications', 'array'],
];
const ENUMS: [string, string[]][] = [
  ['status', ['researched-profile', 'fictional']],
  ['founding.strategy', ['claustral', 'semi-claustral']],
  ['founding.association', ['haplometrosis', 'pleometrosis-reduction', 'primary-polygyny']],
  ['communication.recruitment', ['mass', 'individual']],
  ['defense.mode', ['formic-spray', 'sting']],
  ['visual.sprite', ['formicine', 'myrmicine']],
  ['workers.polymorphism', ['monomorphic', 'size-variable', 'dimorphic']],
];
const SOLDIER_CHECKS: Check[] = [
  ['workers.soldiers.baseFraction', 'number', 0, 0.6], ['workers.soldiers.maxFraction', 'number', 0, 0.6],
  ['workers.soldiers.sizeFactor', 'number', 1.1, 3], ['workers.soldiers.minColony', 'number', 1, 2000],
];

function getPath(o: any, p: string) {
  return p.split('.').reduce((v, k) => (v == null ? undefined : v[k]), o);
}

/** Validate an imported species JSON. Returns a list of human-readable errors (empty = valid). */
export function validateSpecies(raw: unknown): string[] {
  const errs: string[] = [];
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return ['The file must contain a single JSON object describing one species.'];
  const soldiers = getPath(raw, 'workers.soldiers');
  if (soldiers !== undefined && (typeof soldiers !== 'object' || soldiers === null || Array.isArray(soldiers))) errs.push('"workers.soldiers" must be an object.');
  for (const [path, type, lo, hi] of soldiers ? [...CHECKS, ...SOLDIER_CHECKS] : CHECKS) {
    const v = getPath(raw, path);
    if (v === undefined) { errs.push(`Missing field "${path}" (${type}).`); continue; }
    if (type === 'array') { if (!Array.isArray(v)) errs.push(`"${path}" must be a list.`); continue; }
    if (typeof v !== type) { errs.push(`"${path}" must be a ${type}, got ${typeof v}.`); continue; }
    if (type === 'number' && (!Number.isFinite(v) || (lo !== undefined && v < lo) || (hi !== undefined && v > hi)))
      errs.push(`"${path}" = ${v} is outside the allowed range ${lo}..${hi}.`);
  }
  for (const [path, allowed] of ENUMS) {
    const v = getPath(raw, path);
    if (v !== undefined && !allowed.includes(v)) errs.push(`"${path}" must be one of: ${allowed.join(', ')}.`);
  }
  const r = raw as any;
  for(const path of ['sources','simplifications']) {
    const list=r[path];
    if(Array.isArray(list)&&(list.length>40||list.some((v:unknown)=>typeof v!=='string'||v.length>2000)))errs.push(`"${path}" must contain at most 40 text entries of up to 2,000 characters.`);
  }
  for(const [path,type] of CHECKS)if(type==='string'&&typeof getPath(r,path)==='string'&&getPath(r,path).length>2000)errs.push(`"${path}" is too long.`);
  if (Array.isArray(r.queen?.matings)) {
    const s = r.queen.matings.reduce((a: number, b: unknown) => a + (typeof b === 'number' ? b : NaN), 0);
    if (!Number.isFinite(s) || Math.abs(s - 1) > 0.01) errs.push('"queen.matings" must be probabilities that sum to 1.');
    if (r.queen.matings.length < 1 || r.queen.matings.length > 8 || r.queen.matings.some((n:unknown)=>typeof n!=='number'||n<0||n>1)) errs.push('"queen.matings" needs 1–8 nonnegative probabilities.');
  }
  for (const k of ['visual.body', 'visual.head', 'visual.gaster']) {
    const v = getPath(raw, k);
    if (Array.isArray(v) && (v.length !== 3 || v.some((c: unknown) => typeof c !== 'number' || c < 0 || c > 255))) errs.push(`"${k}" must be [r, g, b] with values 0..255.`);
  }
  if (Array.isArray(r.founding?.moisture) && (r.founding.moisture.length !== 2 || r.founding.moisture.some((c: unknown) => typeof c !== 'number'||!Number.isFinite(c)||c<0||c>1)||r.founding.moisture[0]>r.founding.moisture[1])) errs.push('"founding.moisture" must be ordered [low, high] within 0..1.');
  if (r.workers?.soldiers && r.workers.soldiers.maxFraction < r.workers.soldiers.baseFraction) errs.push('"workers.soldiers.maxFraction" must not be below "baseFraction".');
  if (r.development && r.development.tMin >= r.development.tOpt) errs.push('"development.tMin" must be below "development.tOpt".');
  if (r.development && r.development.tOpt >= r.development.tMax) errs.push('"development.tOpt" must be below "development.tMax".');
  if (typeof r.id === 'string' && !/^[a-z0-9-]{3,40}$/.test(r.id)) errs.push('"id" must be 3-40 lowercase letters, digits or hyphens.');
  if (r.status === 'researched-profile' && (!Array.isArray(r.sources) || r.sources.length === 0)) errs.push('A "researched-profile" must list at least one source; otherwise set status to "fictional".');
  const json = JSON.stringify(raw);
  if (json.length > 50000) errs.push('Species definition is too large (max 50 KB).');
  return errs;
}

export function speciesById(list: SpeciesDef[], id: string) {
  return list.find((s) => s.id === id);
}
