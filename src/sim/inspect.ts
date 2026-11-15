// Plain-language inspectors for cells and ants, plus colony / evolution summaries for the UI.
import { CASTE, CASTE_NAMES, MEM, NAV, TASK, TASK_NAMES, WHY_TEXT } from './ants.ts';
import type { AntInfo, CellInfo } from '../protocol.ts';
import { DESTINY_NAMES, STAGE, STAGE_NAMES } from './colony.ts';
import { FANTASY_LOCI, LOCI, MODES, NL, NP, P, PHENO_NAMES, gval } from './genetics.ts';
import { FOOD_OF, IS_SOLID, M, MATERIALS, MOIST_CAP } from './materials.ts';
import { DAY_TICKS } from './physics.ts';
import type { Sim } from './sim.ts';
import { thermalRate } from './sim.ts';
import { wildlifeById } from './wildlife-defs.ts';
import { NT, TRAITS, has, maskList } from './traits.ts';
import { FLAG_APHID, FLAG_PLUG } from './world.ts';

const pct = (v: number) => `${Math.round(v * 100)}%`;

export function inspectCell(sim: Sim, x: number, y: number): CellInfo | null {
  const w = sim.w;
  if (!w.inb(x, y)) return null;
  const k = y * w.W + x;
  const m = w.mat[k];
  const def = MATERIALS[m];
  const lines: string[] = [];
  if(w.dose[k])lines.push(`Radiation exposure ${w.dose[k]}/255 game units. Decays locally; separate from chemical contamination. Not calibrated dosimetry and does not edit inherited traits.`);
  if(w.carrier[k])lines.push(`Mixture carrier / bound water: ${w.carrier[k]} units, separate from soil moisture and food quantity.`);
  if(m===M.FROZEN_MIXTURE)lines.push(`Frozen composition: ${MATERIALS[w.phase[k]&65535]?.name??'unknown'}. Stored nutrients remain in the resource inventory; thaw before foraging.`);
  if(m===M.SODA)lines.push(`Carbonation reserve: ${Math.max(0,8-w.phase[k])} bubble releases remaining.`);
  if(w.tint[k])lines.push(`Stain color #${(w.tint[k]&0xffffff).toString(16).padStart(6,'0')}. Color alone does not change material properties.`);
  for(const c of sim.critters.list)if(Math.abs(c.x-x)+Math.abs(c.y-y)<=1){
   const d=wildlifeById(c.kind),name=d?.name??(c.kind===1?'Spider':'Springtail');
   lines.push(`${name} #${c.id}: ${c.action}. Health ${pct(c.hp)}, energy ${pct(c.energy)}.`);
   if(d){lines.push(d.description);lines.push(`Stage: ${['egg / newborn','juvenile','adult','pupa'][c.stage]}; age ${c.age} ticks. Generation ${c.generation}; parent ${c.parentId||'introduced'}, mate ${c.mateId||'none'}.`);if(c.infection)lines.push(`Fictional sandbox infection: ${c.infection} ticks remaining. Not a disease prediction.`);if(c.immunity)lines.push(`Fictional immunizer protection: ${c.immunity} ticks remaining; existing infections are not cured.`);}
  }
  const T = w.tempAt(x, y), H = w.humAt(x, y);
  if(w.charge[k])lines.push(`Electrical charge ${Math.round(w.charge[k]/255*100)}%. Charge propagates through touching conductive cells and attenuates.`);
  lines.push(`Temperature ${T.toFixed(1)} C, air humidity ${pct(H)}.`);
  const cap = MOIST_CAP[m];
  if (m === M.WATER) lines.push(`Water cell holding ${w.amt[k]} of 64 units. Water falls, spreads under pressure, soaks into permeable soil and evaporates where open to the sky.`);
  else if (cap) {
    const sat = w.moist[k] / cap;
    lines.push(`Soil moisture ${pct(sat)} of capacity (${w.moist[k]}/${cap} units).`);
    if (sat > 0.95) lines.push(y + 1 < w.H && w.mat[k + w.W] === M.AIR ? 'Saturated above an open passage: it can drip water into the passage, and may slump.' : 'Saturated: water entering here will pool or run off.');
  }
  if (def.digResist) lines.push(`Diggable (resistance ${def.digResist}${m === M.CLAY ? '; much harder when dry' : ''}). Nest suitability ${pct(def.chamberSuitability)}.`);
  else if (IS_SOLID[m] && !FOOD_OF[m]) lines.push('Cannot be excavated by ants.');
  if (FOOD_OF[m]) lines.push(`${def.name}: ${w.amt[k]} food unit(s) here. ${w.toxin[k] ? 'Contaminated: foragers avoid it.' : ''}`);
  if (m === M.PLANT) lines.push(`Plant vigour ${w.amt[k]}/20.${w.flags[k] & FLAG_APHID ? ' An aphid group feeds here and drips honeydew (sugar).' : ''}`);
  if (m === M.CORPSE) lines.push('Corpse. Nestmates carry corpses out of the nest; other colonies may scavenge it.');
  if (w.flags[k] & FLAG_PLUG) lines.push('Soil plug placed by a founding queen to seal her chamber (claustral founding).');
  if (w.toxin[k]) lines.push(`Toxic contamination ${pct(w.toxin[k] / 255)} (decays over time). Damages ants standing here.`);
  const own = w.owner[k];
  const col = own ? sim.colonies[own - 1] : null;
  if (col && col.alive) {
    lines.push(`Part of the nest of ${col.name}.`);
    if (m === M.WATER) lines.push('Water has entered this part of the nest.');
    else if (m === M.AIR) {
      // water entering via connected passages
      let wet = 0;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (w.get(x + dx, y + dy) === M.WATER) wet++;
      if (wet) lines.push(`This chamber is taking in water (${wet} water cells within 3 cells).`);
    }
  }
  // signals at this cell
  const sig: string[] = [];
  for (const c of sim.colonies) {
    if (!c || !c.alive) continue;
    const t = c.trail.get(x, y), al = c.alarm.get(x, y), no = c.nestOdor.get(x, y);
    if (t > 0.01) sig.push(`trail of ${c.name} ${t.toFixed(2)}`);
    if (al > 0.01) sig.push(`alarm of ${c.name} ${al.toFixed(2)}`);
    if (no > 0.01) sig.push(`nest odour of ${c.name} ${no.toFixed(2)}`);
  }
  if (sig.length) lines.push(`Signals: ${sig.join('; ')}. Trails are laid on the substrate and fade; alarm and nest odour drift through open air only.`);
  if (m === M.AIR && !w.skyExposed(x, y) && !own) lines.push('Enclosed air pocket.');
  return { x, y, materialId:m,amount:w.amt[k],temperature:T,charge:w.charge[k],toxin:w.toxin[k],material: def.name, description: def.description, lines };
}

export function inspectAnt(sim: Sim, i: number): AntInfo | null {
  const a = sim.a;
  if (i < 0 || !a.alive[i]) return null;
  const c = sim.colonies[a.colony[i]];
  if (!c) return null;
  const sp = sim.speciesOf(c);
  const o = i * NP;
  const lines: string[] = [];
  const caste = a.caste[i];
  lines.push(`Age ${a.age[i].toFixed(1)} days. Health ${pct(a.health[i])}, energy ${pct(a.energy[i])}, hydration ${pct(a.hydration[i])}.`);
  const T = sim.w.tempAt(a.x[i], a.y[i]);
  const dose=sim.w.dose[a.y[i]*sim.w.W+a.x[i]];if(dose)lines.push(`Radiation exposure ${dose}/255 game units can damage health. It does not edit this individual's inherited traits.`);
  if (T > sp.tolerances.heatMax - 2) lines.push(`Dangerously hot here (${T.toFixed(1)} C).`);
  if (sim.w.mat[a.y[i] * sim.w.W + a.x[i]] === M.WATER) lines.push(`Submerged for ${Math.round(a.submerged[i] / 30)} s of game time.`);
  if (a.carry[i]) lines.push(`Carrying ${MATERIALS[a.carry[i]].name.toLowerCase()}${FOOD_OF[a.carry[i]] ? ` (source quality it perceived: ${pct(a.carryQ[i])})` : ''}.`);
  if (a.carryBrood[i] >= 0) lines.push('Carrying a brood item.');
  if (caste === CASTE.WORKER) {
    lines.push(`Route memory: ${a.memLen[i]} waypoints this trip; ${a.frLen[i] ? `remembers a route to food (${a.frTrips[i]} successful trips)` : 'no remembered food route'}.`);
    if (a.contacts[i] > 0.2) lines.push(`Recent contacts with returning successful foragers: ${a.contacts[i].toFixed(1)}.`);
    const learned = ['forage', 'nurse', 'dig', 'defend'].map((n, k) => `${n} x${a.thrL[i * 4 + k].toFixed(2)}`).join(', ');
    lines.push(`Learned threshold adjustments (behavioural, this lifetime only): ${learned}.`);
    if (a.major[i]) lines.push('Major worker (soldier subcaste): reared on a larger larval ration; large head and mandibles, high thresholds for routine work, responds to strong alarm.');
  }
  if (caste === CASTE.QUEEN) {
    const q = sim.queenData(c, a.id[i]);
    if (q) {
      lines.push(`Body reserves ${q.reserves.toFixed(0)}. Eggs laid ${q.eggsLaid}. Stored sperm from ${q.sperm.length} male(s)${q.sperm.some((s) => s.colonyId === 0) ? ' (including off-map population)' : ''}.`);
      lines.push(`Founding strategy: ${sp.founding.strategy}. The queen does not direct workers; she lays eggs and emits nest odour.`);
      if (q.playerEdited) lines.push('SANDBOX OVERRIDE: this queen\'s germline was edited by the player.');
    }
  }
  lines.push(`Generation ${a.generation[i]}. Mother #${a.mother[i] || '-'}, father #${a.father[i] || (caste === CASTE.MALE ? 'none (haploid male)' : 'off-map')}.`);
  const traits: AntInfo['traits'] = [];
  const ga = a.ga.subarray(i * NL, i * NL + NL), gb = caste === CASTE.MALE ? null : a.gb.subarray(i * NL, i * NL + NL);
  traits.push({ name: 'Body size (realised)', value: (a.pheno[o + P.SIZE] / sp.traits.size).toFixed(2) + 'x', kind: 'developmental' });
  traits.push({ name: 'Size genotype', value: gval(ga, gb, 0).toFixed(2), kind: 'inherited' });
  const show: [number, string][] = [[P.CUTICLE, 'f2'], [P.MANDIBLE, 'f2'], [P.SENSORY, 'f2'], [P.SIGNAL, 'f2'], [P.FIDELITY, 'f2'], [P.WATERBAL, 'f2'], [P.TOPT, 'c'], [P.TBREADTH, 'c'], [P.METAB, 'f2'], [P.EXPLORE, 'f2'], [P.THR_FORAGE, 'f2'], [P.THR_NURSE, 'f2'], [P.THR_DIG, 'f2'], [P.CHEM, 'f2'], [P.FLOODTOL, 'f2']];
  for (const [p, f] of show) traits.push({ name: PHENO_NAMES[p], value: f === 'c' ? a.pheno[o + p].toFixed(1) + ' C' : a.pheno[o + p].toFixed(2), kind: 'inherited' });
  if (MODES[sim.mode].fantasy) for (const p of [P.BIOLUM, P.ARMOR, P.PLASTRON, P.THERMO]) traits.push({ name: PHENO_NAMES[p], value: a.pheno[o + p] > 0 ? a.pheno[o + p].toFixed(2) : 'not expressed', kind: 'fictional' });
  for (const p of [P.SPEED, P.METCOST, P.DESICC, P.DIGRATE, P.ATTACK, P.DEFENSE]) traits.push({ name: PHENO_NAMES[p] + ' (derived)', value: a.pheno[o + p].toFixed(2), kind: 'developmental' });
  let why = WHY_TEXT[a.why[i]] || TASK_NAMES[a.task[i]];
  if (a.task[i] === TASK.FORAGE && a.nav[i] === NAV.EXPLORE && a.why[i] === 0) why = WHY_TEXT[3];
  return {
    id: a.id[i], colony: c.name, colonyId: c.id, species: `${sp.name} (${sp.commonName})`, caste: caste === CASTE.WORKER && a.major[i] ? 'major worker (soldier)' : CASTE_NAMES[caste], task: TASK_NAMES[a.task[i]], why,
    lines, traits, named: maskList(a.traits, i * 2),
    namedOrigin: a.mother[i]
      ? `Inherited from mother #${a.mother[i]}${a.father[i] ? ` and father #${a.father[i]}` : caste === CASTE.MALE ? ' only (haploid male)' : ' and an off-map father'}. Each parent's trait passes on with its own chance; rare new traits appear at birth.`
      : 'Founder: traits drawn at random (no recorded parents).',
  };
}

/** Route memory waypoints for drawing the selected ant's remembered route. */
export function antRoute(sim: Sim, i: number): number[] {
  const a = sim.a;
  if (i < 0 || !a.alive[i]) return [];
  const out: number[] = [];
  const len = a.frLen[i];
  for (let k = 0; k < len; k++) out.push(a.frX[i * MEM + k], a.frY[i * MEM + k]);
  return out;
}

export function colonySummaries(sim: Sim) {
  const a = sim.a;
  return sim.colonies.filter((c) => c && (c.alive || sim.tick - c.diedTick < DAY_TICKS * 2)).map((c) => {
    const col = c!;
    const sp = sim.speciesOf(col);
    const stages = [0, 0, 0];
    let reproBrood = 0;
    for (const b of col.brood) { stages[b.stage]++; if (b.destiny === 1 || b.destiny === 2) reproBrood++; }
    const tasks: Record<string, number> = {};
    let alates = 0, majors = 0;
    const traitCount = new Array(NT).fill(0);
    for (let i = 0; i < a.n; i++) {
      if (!a.alive[i] || a.colony[i] !== col.slot) continue;
      if (a.caste[i] === CASTE.WORKER) {
        tasks[TASK_NAMES[a.task[i]]] = (tasks[TASK_NAMES[a.task[i]]] ?? 0) + 1; majors += a.major[i];
        if (a.traits[i * 2] | a.traits[i * 2 + 1]) for (let t = 0; t < NT; t++) if (has(a.traits, i * 2, t)) traitCount[t]++;
      } else if (a.caste[i] !== CASTE.QUEEN) alates++;
    }
    const topTraits = traitCount.map((n, t) => ({ t, n })).filter((e) => e.n > 0).sort((p, q) => q.n - p.n).slice(0, 6);
    const qi = col.queens.length ? a.findById(col.queens[0].antId) : -1;
    const queenTraits = qi >= 0 ? maskList(a.traits, qi * 2) : [];
    const ch = col.chamber.x >= 0 ? col.chamber : col.entrance;
    const T = sim.w.tempAt(ch.x, ch.y);
    const notes: string[] = [];
    const tr = thermalRate(sp, T);
    if (col.brood.length && tr < 0.4) notes.push(`Brood development slowed by low temperature (${T.toFixed(1)} C, ${Math.round(tr * 100)}% of optimum rate).`);
    if (col.brood.length && T > sp.development.tMax - 1) notes.push(`Brood at risk from heat (${T.toFixed(1)} C).`);
    if (!col.hasExit && col.workers > 0) notes.push('No open entrance: workers are excavating toward the surface.');
    if (col.sealed && col.workers === 0) notes.push('Claustral founding: the queen has sealed herself in and rears the first brood from her reserves.');
    if (col.stim.forage > 0.7) notes.push('Colony is hungry: foraging stimulus is high.');
    if (col.corpsesInside) notes.push(`${col.corpsesInside} corpse(s) inside the nest raise infection risk for brood.`);
    if (col.stage === 'queenless') notes.push('Queenless: no new fertilised eggs. Workers may lay male eggs.');
    if (col.reproductive) notes.push('Mature and in season: female larvae may be reared as gynes; some eggs are laid as males.');
    if (sp.workers.soldiers) notes.push(`Soldiers: ${majors} major worker${majors === 1 ? '' : 's'} (${Math.round(100 * majors / Math.max(1, col.workers))}% of workers); currently rearing about ${Math.round(100 * (col.war?.majorTarget ?? sp.workers.soldiers.baseFraction))}% of new workers as majors${(col.war?.majorTarget ?? 0) > sp.workers.soldiers.baseFraction + 0.01 ? ' (raised after meeting rivals)' : ''}.`);
    return {
      id: col.id, slot: col.slot, name: col.name, alive: col.alive, species: sp.name, speciesId: sp.id, stage: col.stage, generation: col.generation,
      marking: col.marking, workers: col.workers, majors, topTraits, queenTraits, queenId: qi >= 0 ? a.id[qi] : 0, adults: col.adults, alates, queens: col.queens.length,
      reserves: col.queens[0]?.reserves ?? 0,
      brood: stages, reproBrood, store: { ...col.store, mineral: Math.round(col.store.mineral) }, stim: col.stim, nestVolume: col.nestVolume, nestDepth: col.nestDepth,
      hasExit: col.hasExit, tasks, stats: col.stats, entrance: col.entrance, notes, ageDays: (sim.tick - col.foundedTick) / DAY_TICKS,
      playerEdited: col.playerEdited, mother: col.motherColony, exposure: col.exposure.slice(-30),
      broodList: col.brood.slice(0, 40).map((b) => `${STAGE_NAMES[b.stage]}${b.stage ? ' ' + (b.major ? 'major worker' : DESTINY_NAMES[b.destiny]) : ''} ${Math.round(b.prog * 100)}%${b.stage === STAGE.LARVA ? ` fed ${Math.round((b.fed / b.need) * 100)}%` : ''}`),
    };
  });
}

/** Evolution data: trait history, current distributions, lineage, mutations, associations. */
export function evolutionDetail(sim: Sim) {
  const a = sim.a;
  const loci = LOCI.map((l, i) => ({ i, key: l.key, name: l.name, effect: l.effect, cost: l.cost, fantasy: !!l.fantasy }))
    .filter((l) => !l.fantasy || MODES[sim.mode].fantasy);
  // per-colony founder genotypes and worker phenotype distributions (current)
  const colonies = sim.aliveColonies().map((c) => {
    const qi = c.queens.length ? a.findById(c.queens[0].antId) : -1;
    const geno: number[] = [];
    for (let l = 0; l < NL; l++) geno.push(qi >= 0 ? (a.ga[qi * NL + l] + a.gb[qi * NL + l]) / 2 : NaN);
    const workers: number[][] = Array.from({ length: NL }, () => []);
    const named = new Array(NT).fill(0);
    let nw = 0;
    for (let i = 0; i < a.n; i++) {
      if (!a.alive[i] || a.colony[i] !== c.slot || a.caste[i] !== CASTE.WORKER) continue;
      for (let l = 0; l < NL; l++) if (workers[l].length < 300) workers[l].push((a.ga[i * NL + l] + a.gb[i * NL + l]) / 2);
      nw++;
      for (let t = 0; t < NT; t++) if (has(a.traits, i * 2, t)) named[t]++;
    }
    return { id: c.id, name: c.name, species: c.speciesId, marking: c.marking, generation: c.generation, geno, workers, playerEdited: c.playerEdited,
      named: named.map((n) => (nw ? n / nw : 0)), queenTraits: qi >= 0 ? maskList(a.traits, qi * 2) : [] };
  });
  // associations between founder genotype and reproductive success across colonies with outcomes
  const recs = sim.lineage.filter((r) => r.diedTick >= 0 || sim.tick - r.foundedTick > DAY_TICKS * 20);
  const assoc = loci.map((l) => {
    const xs: number[] = [], ys: number[] = [];
    for (const r of recs) {
      if (r.playerEdited) continue;
      xs.push(r.founderGenotype[l.i]);
      ys.push(r.gynesFlown + 0.5 * r.malesFlown + 3 * r.daughterColonies);
    }
    return { locus: l.i, n: xs.length, r: corr(xs, ys) };
  });
  return {
    mode: sim.mode, modeLabel: MODES[sim.mode].label, loci, traits: TRAITS.map((t) => ({ key: t.key, name: t.name, group: t.group, tone: t.tone, description: t.description, opposite: t.opposite ?? '', inherit: t.inherit, birth: t.birth, fantasy: !!t.fantasy })), history: sim.traitHistory.slice(-400), colonies, assoc,
    lineage: sim.lineage.slice(-300), mutations: sim.mutations.slice(-200).reverse(), mutationCount: sim.mutationCount,
    fantasyLoci: FANTASY_LOCI, counters: sim.counters, day: sim.tick / DAY_TICKS,
  };
}

function corr(x: number[], y: number[]) {
  const n = x.length;
  if (n < 4) return NaN;
  let mx = 0, my = 0;
  for (let i = 0; i < n; i++) { mx += x[i]; my += y[i]; }
  mx /= n; my /= n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
  if (sxx < 1e-9 || syy < 1e-9) return NaN;
  return sxy / Math.sqrt(sxx * syy);
}
