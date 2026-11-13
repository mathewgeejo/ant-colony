// Evolution journal: discovery entries recorded when the player observes a
// behaviour or interaction (discovery never grants a trait), plus optional
// sandbox challenges that reveal extra tools.
import { CASTE } from './ants.ts';
import { FANTASY_LOCI, LOCI, NL, NP, P } from './genetics.ts';
import type { Sim } from './sim.ts';

export interface JournalDef {
  key: string;
  title: string;
  text: string;
  kind: 'discovery' | 'unlock';
  unlocks?: string[];
}

export const JOURNAL_DEFS: JournalDef[] = [
  { key: 'first-worker', kind: 'discovery', title: 'First workers', text: 'The founding queen reared her first workers. In claustral founding these "nanitic" workers are small because the queen fed them from her own body reserves; their size reflects developmental conditions, not their genes alone.' },
  { key: 'trail-formed', kind: 'discovery', title: 'A foraging trail formed', text: 'Successful foragers returning to the nest deposited trail pheromone; nestmates that detected it became more likely to follow it, reinforcing it further. The trail exists only as long as traffic keeps renewing it.' },
  { key: 'memory-failure', kind: 'discovery', title: 'Route memory went stale', text: 'Experienced foragers followed their own remembered route to a food source that was no longer there. Private memory initially overrides trails; after repeated failures they discarded it and searched again.' },
  { key: 'flooded-nest', kind: 'discovery', title: 'Water entered a nest', text: 'Water reached excavated passages. Water flows downhill through open cells and seeps from saturated soil; ants and brood in flooded cells can drown.', unlocks: ['rain'] },
  { key: 'brood-rescue', kind: 'discovery', title: 'Brood rescued from water', text: 'Nurses carried brood out of flooded cells toward drier parts of the nest. This is a behavioural response; no trait changed.' },
  { key: 'pleometrosis', kind: 'discovery', title: 'Cooperative founding', text: 'Several newly mated queens shared one founding chamber (pleometrosis). Whether queens later fight or coexist depends on the species profile.' },
  { key: 'semi-claustral', kind: 'discovery', title: 'Foraging founding queen', text: 'A semi-claustral founding queen left her chamber to collect food because her reserves were insufficient. This raises her exposure to hazards but allows a larger first brood.' },
  { key: 'worker-males', kind: 'discovery', title: 'Queenless workers produced males', text: 'After the queen died, workers laid unfertilised eggs that develop into males (haplodiploidy). The colony can still pass on genes through these males.' },
  { key: 'territorial-fight', kind: 'discovery', title: 'Fight between neighbouring colonies', text: 'Workers of two colonies of the same species met; nestmate recognition failed and they fought. Outcomes depend on local numbers, body condition, armour and chemical defence.' },
  { key: 'interspecific-fight', kind: 'discovery', title: 'Fight between species', text: 'Workers of different species fought over space or food.' },
  { key: 'daughter-colony', kind: 'discovery', title: 'A daughter colony was founded', text: 'A gyne from a nuptial flight mated and landed in the area. Her colony inherits her genome and the stored sperm of her mates, so it carries variation from real parents.', unlocks: ['genome-editor'] },
  { key: 'second-generation', kind: 'discovery', title: 'Second colony generation', text: 'A colony founded by a daughter of a daughter now exists. Heritable change can only occur across such reproductive generations.' },
  { key: 'trait-shift', kind: 'discovery', title: 'A heritable trait shifted', text: 'The mean genotype of living founding queens moved noticeably from its starting value. Shifts can result from selection, drift, immigration or sandbox overrides; check the evolution panel for associations.' },
  { key: 'fantasy-expressed', kind: 'discovery', title: 'A fictional adaptation was expressed (FICTIONAL)', text: 'An ant developed a fictional adaptation: the allele value passed the expression threshold and its prerequisites were met. Its costs apply from now on.' },
  { key: 'predator-repelled', kind: 'discovery', title: 'Predator repelled', text: 'Workers in contact with a spider fought back and released alarm pheromone, recruiting nestmates.' },
  { key: 'collapse', kind: 'discovery', title: 'Soil collapse', text: 'Saturated, unsupported soil slumped into loose material. Roots nearby stabilise soil; dry sand flows freely.' },
  { key: 'challenge-workers', kind: 'unlock', title: 'Challenge: a colony of 30 workers', text: 'Unlocked the spider and toxin hazard tools.', unlocks: ['spider', 'toxin'] },
  { key: 'challenge-mature', kind: 'unlock', title: 'Challenge: a mature colony', text: 'Unlocked the "introduce established colony" tool.', unlocks: ['established'] },
];

export function checkJournal(sim: Sim) {
  const has = (k: string) => sim.journal.some((j) => j.key === k);
  const cols = sim.aliveColonies();
  if (!has('trail-formed')) {
    for (const c of cols) {
      let strong = 0;
      for (const ci of c.trail.live) {
        const ch = c.trail.chunks[ci]!;
        for (let k = 0; k < ch.length; k++) if (ch[k] > 1.5) strong++;
      }
      if (strong > 40) { sim.journalUnlock('trail-formed'); break; }
    }
  }
  if (!has('challenge-workers') && cols.some((c) => c.workers >= 30)) sim.journalUnlock('challenge-workers');
  if (!has('challenge-mature') && cols.some((c) => c.stage === 'mature')) sim.journalUnlock('challenge-mature');
  if (!has('second-generation') && cols.some((c) => c.generation >= 2)) sim.journalUnlock('second-generation');
  if (!has('collapse') && sim.phys.slumps > 0) sim.journalUnlock('collapse');
  if (!has('fantasy-expressed') && sim.mode === 'fantasy') {
    const a = sim.a;
    outer: for (let i = 0; i < a.n; i++) {
      if (!a.alive[i] || a.caste[i] !== CASTE.WORKER) continue;
      for (const p of [P.BIOLUM, P.ARMOR, P.PLASTRON, P.THERMO]) if (a.pheno[i * NP + p] > 0) { sim.journalUnlock('fantasy-expressed'); break outer; }
    }
  }
  if (!has('trait-shift') && sim.traitHistory.length > 2) {
    for (const sp of sim.species) {
      const h = sim.traitHistory.filter((t) => t.species === sp.id);
      if (h.length < 3) continue;
      const first = h[0], last = h[h.length - 1];
      if (last.n < 4) continue;
      for (let l = 0; l < NL; l++) {
        if (FANTASY_LOCI.includes(l) && sim.mode !== 'fantasy') continue;
        const sd = Math.max(0.03, first.sd[l]);
        if (Math.abs(last.mean[l] - first.mean[l]) > 2 * sd) {
          sim.journalUnlock('trait-shift');
          sim.event('evolution', `${sp.name}: mean founder genotype for ${LOCI[l].name} moved from ${first.mean[l].toFixed(2)} to ${last.mean[l].toFixed(2)} (n=${last.n} colonies).`);
          return;
        }
      }
    }
  }
}
