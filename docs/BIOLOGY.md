# Biology and scientific boundaries

Ant Colony Sandbox is a biologically informed game, **not a predictive scientific model**. Research was checked on 14 November 2026. Numeric rates, normalized loci, energetic coefficients, and cell-scale mechanics are authored game rules, not estimates fitted to field data.

## What is supported, and what is abstracted

| Topic | Biological foundation | Implementation and boundary |
| --- | --- | --- |
| Baseline: *Lasius niger* | Founding queens generally rear their first workers claustrally using reserves; mature colonies normally have one queen. [AntWiki, with primary literature](https://antwiki.org/wiki/Lasius_niger). | A mated queen selects soil, excavates, seals a chamber, lays eggs, and spends reserves on first larvae. Founding associations and later queen reduction are simplified. |
| Route discovery | Workers combine private route memory and substrate pheromone. [Czaczkes et al., JEB, 2013](https://pubmed.ncbi.nlm.nih.gov/22972897/). | Bounded 32-waypoint memory, local sensing, successful-return trail deposition, decay and contact recruitment. Exact sensing radii and decay coefficients are game assumptions. This source does not validate the game's numerical behavior. |
| Context-dependent learning | A later experiment found that pheromone did not improve route-memory formation in its particular protocol. [Czaczkes et al., 2016](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0149720). | Learning is not presented as one universal consequence of pheromone. Repeated successful routes are remembered; failures discard memory. |
| Brood temperature response | First-brood success and developmental duration depend on temperature and population. [Kipyatkov et al., 2004 abstract](https://www.pleiades.online/abstract/evolbp/4/evolbp0165_abstract.pdf). | A piecewise thermal reaction norm stops development in cold conditions; heat, starvation, low humidity and submersion can kill brood. Stage durations are strongly compressed. No diapause is implemented. |
| Worker size | *L. niger* has continuous worker-size variation rather than a soldier caste. [Okrutniak et al., 2020](https://pmc.ncbi.nlm.nih.gov/articles/PMC7411844/). | Larval nutrition influences adult size fixed at emergence. Temperature-size and developmental-rate coefficients are hypotheses/game abstractions, not validated species reaction norms. |
| Inheritance | *L. niger* uses haplodiploidy. Female caste differentiation is generally developmental. [Jemielity et al., 2007](https://pmc.ncbi.nlm.nih.gov/articles/PMC1859884/). | Females receive one recombined maternal set plus a stored paternal haploid set. Males receive only a maternal gamete. Twenty-one unlinked additive quantitative loci are an invented representation, not identified ant genes. Complementary sex determination, diploid males and physical linkage are omitted. |
| Multiple mating | Queen mating frequency varies; genetic diversity and brood production are related in experiments. [Fjerdingstad et al., 2003](https://onlinelibrary.wiley.com/doi/full/10.1046/j.1420-9101.2003.00589.x), [L. niger diversity experiment, 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC8404329/). | Stored sperm contains explicit male genomes and paternity weights. The precise mating-count probabilities are design assumptions. Off-map mates are identifiable background parents. |
| Contrasting profile: *Pogonomyrmex californicus* | Queens forage during semi-claustral founding; population-specific associations occur. [Johnson, 2002](https://doi.org/10.1007/s00442-002-0960-2), [Johnson, 2004](https://doi.org/10.1016/j.anbehav.2003.11.021), [Hahn et al., 2004](https://pubmed.ncbi.nlm.nih.gov/15057720/). | Queens leave to forage when reserves fall. Seeds support adults and brood. Queen-number and mating distributions are simplified; dependent-lineage genetic caste determination is omitted. |
| Harvester-ant forager contacts | Contact-based regulation is established in *P. barbatus*. [Prabhakar et al., 2012](https://doi.org/10.1371/journal.pcbi.1002670). | Extending this rule to the *P. californicus* profile is explicitly an **unverified cross-species extrapolation**. Its individual-foraging recruitment is not a direct measurement of this species. |

## Three separate concepts

**Behavioral adaptation:** workers change task-response thresholds with experience; remember a food trip; discard blocked routes; retreat from contact; move brood away from local water or unsuitable conditions. These states are not inherited.

**Developmental plasticity:** nutrition and rearing temperature affect realised adult size in this model. Queen/worker developmental destination depends on colony maturity and resource conditions. Adult phenotype is fixed on emergence. Species-specific quantitative effects and caste-allocation probabilities are uncertain abstractions.

**Heritable evolution:** maternal allele assortment, paternal genomes and random gametic mutation produce variation; survival and reproduction can alter later colony lineages. Existing workers do not mutate in response to weather. A selectable advantage is never an automatic mutation trigger. The sandbox germline editor is a labelled override, affects later eggs only, and marks edited lineages.

## Modes

- Naturalistic: bounded variation around researched profiles. Even here, the trait loci and parameter values are game abstractions, not a validated genetic model. Basic communication is present from birth.
- Speculative: 2.5 times the naturalistic trait spread and increased random variation, subject to the same energetic and movement constraints. Unusual combinations are extrapolations.
- Fantasy: speculative ranges plus explicitly fictional loci. Fictional effects are never evidence about real ants.

## Fictional adaptations with active mechanics

All four are additive inherited loci, dormant below mean allele 0.25, expressed up to strength 1, subject to prerequisites. Mutation is blind, independent of weather. A naturalistic genome has zero fantasy expression. Expression is fixed at emergence, including a mineral-diet limit for armour.

| Fictional trait | Prerequisite / use | Cost and development | Counterplay / sprite |
| --- | --- | --- | --- |
| Bioluminescent recruitment | Signal genotype ≥0.5; local line-of-sight recruitment in water/darkness | Additional energy drain during pulses; no infinite range | Walls obstruct; rivals/predators can detect activity. Pale green light pixels. |
| Mineral armour | Cuticle ≥0.55 and mineral availability during development; contact defense | Up to +50% larval cost; slower movement; shorter submersion survival | Floods, starvation, slow foraging. Grey cuticle pixels. |
| Air-film respiration | Water-balance genotype ≥0.45; prolonged submersion survival | Up to +15% larval cost; increased dry-air water loss | Drought and energetic cost remain. Blue outline. This is not an ant plastron claim. |
| Brood thermogenesis | Metabolic genotype prerequisite in `LOCI`; nurses warm attended brood | Adult metabolic/feeding energy and sugar costs | Cannot cool an overheating nest; does not warm unattended brood. Nurse action/inspector; no global heat aura. |

Mineral availability, chemical defense, aerial odour transport, infection from corpses and thermal breadth/peak tradeoffs are game abstractions. Surface-deposited trails and airborne cues are deliberately distinct; this does not assert that every real nest cue is a freely diffusing chemical.

## Two-dimensional simplifications

There is one connected movement plane. Ants cannot step around a blocked cutaway, and water cannot drain out of the viewing plane. Cardinal/diagonal cell connectivity replaces real galleries. Ants occupy one point cell, with extra clearance for unusually large workers; sprites are visual symbols. Multiple ants may share cells with congestion penalties. Flood damage thresholds, air humidity, thermal conductivity and saturated-soil slumping are authored local rules. Oxygen, ventilation and gas depletion are **not simulated**. Brood relocation exists; full queen-led colony migration is not implemented.

Food units, reserves and development are abstract energetic currencies. The ledger conserves water and food units across explicit sources/sinks; it does **not** claim conservation of total ecosystem biomass, carbon, nitrogen or energy. Honeydew, seed growth, prey bodies and introduced organisms have explicit food-production entries, without modelling photosynthesis or a complete nutrient cycle. Sugar supplies adult energy and larval maintenance; growth requires protein or a compatible harvester seed ration.

Use “associated with higher survival in this run.” Shared ancestry, exposure, small samples, immigration and chance can explain correlations. No causal-inference experiment or validated species-distribution prediction is supplied.

The particle toolkit also provides discrete steam, smoke and other gas cells, phase changes, fire and electricity. These are material gameplay rules, not biological respiration, oxygen depletion, chemical stoichiometry or a conservation model of all energy and matter. Batteries, cloners and thermal devices are explicitly player-created sources. See [sandbox physics and limits](SANDBOX-FEATURES.md).
