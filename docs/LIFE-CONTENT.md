# Life category: working content and biological boundaries

All 36 named buttons in screenshot `170608` now have selectable representations. Plague and Primordial Soup are explicitly fictional and require **Fantasy** mode. Availability and the behavior checks below do not prove exact Sandboxels v1.15 reaction parity. The complete 312-item goal stays active.

## Animals

The existing researched ant colonies remain in their own agent system. Spider and springtail keep their existing bounded hunter/prey implementation. Fourteen additional sandbox profiles use local movement, sensory range, food preferences, energy, health, age, stages and reproduction. They are **generic game organisms, not researched species definitions**. In particular, a label such as Bee is not a full colony model or a validated demographic simulation.

| Reference entry | Working behavior |
| --- | --- |
| Worm | Moves a one-cell cavity through loose soil by displacement; consumes litter; enriches adjacent soil |
| Flea | Jumps, seeks nearby rats/humans and drains host health while feeding |
| Termite | Consumes adjacent wood, opening an actual traversable passage and invalidating nest navigation |
| Ant | Introduces a mated founding queen using the existing researched colony and genetics systems |
| Spider | Existing ant hunter with local contact combat, retreat, aging and remains; no complete spider reproduction model |
| Fly | Carrion feeding, larva/pupa/adult stages, adult flight and local mate contact |
| Firefly | Predatory larvae, pupation, adult flight and energy-costing night flashes that bias local mate approach |
| Bee | Visits flowers and pollen, carries pollen between locations, enables real seed production; empty flowers cannot provide nectar |
| StinkBug | Grazes plants; attack by a predator releases a local contamination-based defensive cue |
| Human | Walking sandbox biped, food use, compatible-mate reproduction, newborn stage and bone remains; no human demographic model |
| Bird | Flying seed eater and small-prey hunter; walls block routes and strikes |
| Rat | Fast ground omnivore; consumes ledgered grain/food and can host fleas |
| Frog | Aquatic juveniles, amphibious adults, small-prey hunting and moisture dependence |
| Fish | Connected-water movement, algae feeding, reproduction and stranding mortality; no dissolved-oxygen budget |
| Slug | Slow vegetation grazing with moisture stress |
| Snail | Slow grazer with shell-based damage reduction and moisture costs |

New wildlife reproduction requires nearby compatible adult mates, energy and a cooldown. It subtracts resources from both parents and produces a real egg/newborn record. Individual IDs, both parent IDs, developmental stage and pedigree depth persist in saves. Pedigree depth is one above the maximum of the parents' depths. Non-ant wildlife does **not** have modeled genes, mutations or heritable trait evolution. Ant inheritance remains separate.

Hermaphroditic worm/slug/snail profiles accept another adult regardless of the simplified sex field. Other new profiles require opposite field values. This is a mating-compatibility abstraction. Bee/termite hive organization, realistic animal brood care and species-specific reproductive anatomy are not implemented. Larval walking, point-sized bodies and compressed stages are substantial game simplifications.

Animals use a bounded four-cell spatial bucket grid for contact, a small local food search and cardinal movement. They do not query a global food map or use all-pairs combat. Population is capped at 384 non-ant animals, including at most 32 of each new profile, 6 spiders and 60 springtails. This cap is a performance rule. Multiple animals can occupy one symbolic cell; sprites are not physical body geometry.

## Plants, microbes and remains

| Reference entry | Working behavior |
| --- | --- |
| Plant | Existing moisture-dependent stems, roots, seed production and aphid/honeydew ecology |
| Grass | Moist-soil growth and lateral runners; drought/unsupported mortality |
| Algae | Resource-limited colonization of adjacent water; grazing; stored water is released when the last tissue is eaten |
| Cell | Nutrient-limited fission near water; consumes adjacent organic substrate; starvation and heat death |
| Plague | **Fictional**, Fantasy only: finite material that infects nearby wildlife and nutrient-rich cells |
| Bone | Persistent mineral remains; acid corrosion and crushing into dust |
| Sapling | Moist-soil tree growth, woody trunk and leafy crown; root-water access is bounded to 16 cells vertically |
| Pinecone | Falling seed food; germination into a sapling on damp soil |
| Cactus | Stored moisture, reduced water use, upward growth and contact injury to soft-bodied wildlife |
| Kelp | Upward growth through water, finite energy sharing and stranding mortality |
| Coral | Slow aquatic branching and simplified heat-stress death into a mineral skeleton |
| Seeds | Existing nutritious seeds; germinate on wet topsoil in spring through the original rolling ecology update |
| Pollen | Falls, can be carried by bees and supports flower-seed production |
| FlowerSeed | Germinates on suitable wet soil into a flowering stem; consumes its seed food unit |
| Petal | Nectar/growth reserve, pollen production, pollinator visits and support/water dependence |
| Vine | Extends along adjacent walls using growth reserves and moisture |
| BambooPlant | Upward segmented growth; mature lower shoots become wood |
| MushroomSpore | Germinates on damp organic material, establishes mycelium and produces a mushroom fruiting body |
| Lichen | Slow nutrient-limited crust growth on damp rock; drying causes decay |
| PrimordialSoup | **Fictional**, Fantasy only: warm nutrient-rich mixture can create cells; not an origin-of-life model |

Living cells have an active-location set, updated once per model second. New growth waits for the following pass. The set's iteration order is saved so random updates continue reproducibly after loading. Water displaced into aquatic tissue is retained as absorbed moisture where capacity allows; remaining displacement is a named sink. Food changes, transpiration, germination, seed production and remains use the existing ledger. Nutrient/vigour values are gameplay reserves. Total chemical mass, photosynthetic energy and ecosystem biomass are not conserved-model claims.

Photosynthesis and root transport are coarse abstractions. Coral bleaching and recovery physiology are not modeled: heat stress is collapsed into a mortality rule, and the skeleton reuses the game's generic Bone material. Coral is not literally made from vertebrate bone. Kelp/algae occupy cells and can change connectivity; this two-dimensional occupancy is not a hydrodynamic model of submerged fronds.

## Biological foundations and authored assumptions

- [USDA NRCS: earthworms](https://www.nrcs.usda.gov/sites/default/files/2022-10/Earthworms.pdf) supports the broad roles of moisture, litter and casts. The game's one-cell displacement and fertility increments are authored rules.
- [Mississippi State Extension: termite biology](https://extension.msstate.edu/insects/termites/termite-biology-eastern-subterranean-termites-and-formosan-termites) supports cellulose feeding and the importance of moisture. The game omits colony castes and gut symbionts.
- [USDA NRCS: insects and pollinators](https://www.nrcs.usda.gov/conservation-basics/animals/insects-pollinators) supports food-seeking flower visits and pollen transfer. Exact seed/energy rates are game choices.
- [Penn State: fireflies](https://extension.psu.edu/natures-quiet-fireworks) supports predatory larvae and adult signaling. Adult diets vary; the generic nectar-feeding profile does not describe every firefly species.
- [UF/IFAS: dissolved oxygen for fish](https://ask.ifas.ufl.edu/publication/FA002/about) explains gill uptake from water. This game enforces water habitat but does not simulate dissolved oxygen or salinity physiology.
- [UF/IFAS: plant propagation](https://ask.ifas.ufl.edu/publication/MG108) supports moisture and environmental requirements for germination. Instant/accelerated growth thresholds are authored.
- [NOAA: coral bleaching](https://oceanservice.noaa.gov/facts/coral_bleach.html) identifies thermal stress; real bleaching need not be fatal. The game's immediate skeleton transformation is a simplification.

Temperature thresholds, speed, sensing radii, lifespan, sex assignment, stage duration, feeding conversion, reproductive cost and population caps are authored game parameters. They are not measurements or causal predictions for named species. Plague/Primordial Soup have no established-biological claim. None of these systems grants an ant a targeted mutation.

## Verification

`tests/life.test.ts` contains 21 checks covering habitat, walls across three seeds, feeding, pollination, finite nectar, absorbed-water return, reproduction and parentage, metamorphosis, mortality, plant/microbe growth, fantasy gating, save continuation, population/import validation and individual sprite rendering. `scripts/life-preview.mjs` exercises the actual browser, selectors, introductions, fish inspection, portable export/import, fantasy gating and desktop/phone layout. See `artifacts/life-checks.json`, `life-desktop.png` and `life-mobile.png`.

`node --experimental-strip-types --no-warnings scripts/life-experiment.ts 2` runs Living Garden on seeds 1, 19, 42, observes actual births, checks resource ledgers at intervals and compares a saved continuation. Results go to `artifacts/life-experiments.json`. Initial food, water, organisms and paired adults are experimental conditions; births and deaths are not scripted. Short seeded experiments do not establish indefinite stability or full reference reaction coverage.
