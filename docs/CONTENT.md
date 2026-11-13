# Species, mutations and scenarios

## Species schema

`src/sim/species.ts` exports `SpeciesDef`, built-in profiles and `validateSpecies`. A custom file is a single JSON object in that shape, maximum 50 KB. Start by copying an exported built-in definition, change its ID (3–40 lowercase letters/digits/hyphens), name and biological status. Built-in IDs cannot be replaced. Never include JavaScript or executable expressions.

Required groups: identity/status/subfamily/summary; founding strategy, reserves, sealing, queen association, chamber depth/moisture preference; queen lifespan/laying/mating-count probabilities; nutrition efficiencies and local preferences; development stage times, thermal range, cocoons, protein and humidity requirements; activity window; nest crowding/depth; hydration/thermal/submersion tolerances; continuous worker variation; trail/alarm/contact communication; chemical defense; reproductive costs and maturity; normalized trait means/spreads; visual RGB triplets and formicine/myrmicine sprite family; source and simplification lists. Numeric bounds and enum values live alongside the validator. Errors identify fields and ranges. Invalid imports do not replace the active run.

Real names do not make a profile scientifically validated. Research sources support broad mechanisms, not exact parameter values. Use `fictional` for unsupported custom organisms. Fictional visual sprites are variations of the same authored grids. Custom content cannot add arbitrary new behaviors; it configures existing systems.

## Genetics schema

`LOCI` is the ordered schema (21 quantitative loci). Each has key, name, effect, cost, optional fantasy status and prerequisites. Alleles range 0–1. A female has `ga` and `gb`, a male one haploid set (the second storage set duplicates it for storage convenience). Female genotypic value is their mean. `makeEgg` independently samples a maternal allele at each locus and may introduce a bounded random perturbation. Stored sperm carries the male's inherited haploid set. The model does not infer real mutation rates from the per-gamete gameplay probabilities.

`phenotype` combines species profile, mode spread, genotype and developmental conditions. It writes a separate fixed adult array. `broodCost` charges provisioning; derived speed, water loss, combat and metabolic costs constrain trait combinations. Body size changes clearance and performance, but all workers currently carry one food unit. Trait histories and distributions must not be read as an upgrade tree.

Mutation records: tick, locus index, allele before/after, carrier category, colony ID, brood ID, optional founding fate. Lineage records: colony ID, species, generation, maternal colony, paternal colonies (0 = off-map background), founding/death tick, founder genotype, peak workers, flown gynes/males, daughter count, player-edited flag. IDs refer to actual modeled reproductive events. Generation labels describe colony generations, not worker batches.

## Seeded scenarios

All use the same engine; no success event, birth, mutation, trail, fight or mortality outcome is scripted. Setup may introduce established colonies, stocks, standing variation and scheduled environmental interventions. Introduced colonies are explicitly marked as experimental interventions.

| Scenario | Conditions / intervention | What to inspect |
| --- | --- | --- |
| First colony | One claustral queen; mild meadow, nearby protein, no predators | Founding chamber, eggs→larvae→pupae→workers, reserve depletion, reopened entrance |
| Moved food | Established colony and sugar patch; button removes old patch and paints another | Actual return deposits, trail decay, private-memory failures, rediscovery. Some seeds take much longer or lose workers. |
| Flooded passage | Barrier-lined overhead reservoir and connected experimental nest; button opens gate | Water occupancy and moisture separately, nest exposure, escaping ants, brood rescue when workers can reach a dry destination |
| Competing colonies | Garden and harvester colonies; central mixed food | Local encounters and fights if routes intersect. Competition does not guarantee combat in every seed. |
| Environmental shift | Twelve founding queens; sustained heat/drying starting day 30 | Exposure, deaths, reproductive success, later distributions. Long-term selection outcomes are exploratory, not statistically validated. |
| Fantasy divergence | Storms and founders with standing fictional variation | Expression, submersion and dry-air costs. Alleles are not granted by floods. Multi-generation spread is not guaranteed or validated. |
| Inheritance garden | Two mature colonies, 3,000 additional sugar and protein each, warm climate | Rapid alates, actual flights and daughter colonies; lineage and genotype differences. Resource surplus is experimental. |
| Stress test | Eight colonies, 620 workers each | Throughput, painting responsiveness and memory; colonies may shrink from crowding, conflict and finite nutrition. |

`npm run experiments` repeats founding/route/flood/competition on seeds 1, 19, 42, plus provisioned reproduction. `--quick` skips the reproductive experiment. Machine-readable results are in `artifacts/experiments.json`; results are measurements for that revision, not scripted acceptance outcomes. `npm run bench -- 300` runs five wall-clock minutes and records population, throughput and memory. `npm run screenshots` exercises the actual browser; use `BROWSER_PATH` and `GAME_URL` to override the local defaults.

Future content, not implemented: predators with researched species identities, parasites/disease transmission networks, fungal farming, raiding/brood theft, bridges, electrical defense, living tunnel plugs, complete colony relocation, explicit respiration/ventilation, ecosystem-wide biomass accounting and arbitrary behavior plugins.
