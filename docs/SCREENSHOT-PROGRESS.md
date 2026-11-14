# Screenshot implementation evidence

The active objective covers **all 312 named buttons** transcribed from eleven user screenshots. The reference images report Sandboxels v1.15. The entire objective remains incomplete. `SCREENSHOT-CHECKLIST.md` and `screenshot-inventory.json` preserve every named item; unchecked items must not disappear from scope.

## Land batch

All 18 shown Land entries have selectable, paintable representations. This proves basic availability, not all reference reactions. Mapping:

| Reference | Game | Mechanics / remaining parity |
| --- | --- | --- |
| Sand | Sand | Falling, wet cohesion, infiltration and melting; reference reaction audit pending |
| Dirt | Dirt | Falling soil, water absorption into mud |
| Mud | Mud | Wet cohesion, drying, freezing, baking |
| Rock | Rock | Falling dense fragments; separate from fixed rock wall |
| RockWall | Stone | Fixed rock barrier; displayed name differs |
| Sandstone | Sandstone | Porous wall, crushing into sand, melting |
| Mudstone | Mudstone | Fixed baked mud, crushing into dirt |
| Snow | Snow | Falling frozen water, melting |
| Gravel | Gravel | Dense grains, drainage |
| Clay | Clay powder | Falling grains and ceramic firing |
| ClaySoil | Clay soil | Moisture retention, firing into ceramic |
| Permafrost | Permafrost | Immobilized pore water, thawing into mud; authored thresholds differ from reference |
| Mycelium | Mycelium | Moist-substrate colonization with nutrient cost; dry/heat stress; generic fungal abstraction |
| Mulch | Mulch | Falling litter, combustion, wet decomposition |
| Basalt | Basalt | Fixed dense rock, melting, crushing |
| Tuff | Tuff | Porous rock, crushing into ash |
| Cinnabar | Cinnabar | Toxicity, simplified roasting into metal and contaminated fumes; exact mercury/sulfur chemistry unfinished |
| Limestone | Limestone | Acid consumption and carbon dioxide; other reference reactions unfinished |

Proof: `tests/land.test.ts` (8 behavior/resource/persistence cases), `scripts/land-preview.mjs` (18 entries selected and painted in a real browser, desktop capture and phone overflow), `artifacts/land-checks.json`, `artifacts/land-reference-desktop.png`. The palette shares the existing authored pixel style; new textures distinguish layering, frozen inclusions, fungal filaments and mineral flecks. No generated or copied artwork.

Water added by painting mud/permafrost/mycelium is an explicit `player material moisture` source. Dirt wetting transfers existing water; heating records lost pore water. Total ecosystem biomass and chemical stoichiometry are not conserved claims.

Verification so far: full 48-test suite passed after Land integration; renderer regression added afterward for bright RGB channels overflowing into neighboring channels (visible as colored flecks in snow). Browser Land check passed in Edge 157 at 1440×900 and 390×844. This is evidence for the Land batch, not for the other catalog categories.

Fungal growth is a local gameplay approximation, not a species profile or a model of intracellular nutrient transport. Primary research context: [Functional consequences of nutrient translocation in mycelial fungi](https://pubmed.ncbi.nlm.nih.gov/12234753/). No claim that the game's numeric thresholds were measured by that paper.

## Life batch update

All 36 Life entries now have palette representations: 14 new wildlife profiles, 19 new materials (including a mushroom fruiting-body companion) and the existing ants, spider, plants and seeds. Fantasy-only Plague/Primordial Soup controls are explicitly gated. Distinct original sprites, mobile inspection, stage/parentage records, nutrient-limited cell/plant rules, and a Living Garden scenario are implemented. See [Life mechanics and biological boundaries](LIFE-CONTENT.md) for the per-entry table, test coverage and unresolved approximations. At the Life milestone the registry contained 91 paintable materials plus air; the subsequent Liquids batch raises this to 134.

This is **partial reference parity**, not completion of all Sandboxels v1.15 Life reactions. Generic wildlife does not model genes, complete hive organization or species-specific brood care. Existing seeds do have germination on wet topsoil in spring; broader habitat rules remain a comparison item. The inventory JSON records Land and Life entries as partial with evidence paths instead of leaving their availability unaudited.

## Liquids and tool batch update

All 32 Liquids entries now have selectable representations and local mechanics. This adds 25 reference liquids and 18 actual reaction products/supporting materials: **134 paintable materials plus air** in total. Water carriers, frozen composition/progress and cosmetic stains have separate state, transaction accounting and schema-3 persistence. Milk curdling, hydration, cement setting, adhesive drying, soap/foam, dye/bleach, fermentation and cryogenic/mercury phases are working authored rules. Vaccine/Antidote are explicitly fictional and Fantasy gated. See [LIQUID-CONTENT.md](LIQUID-CONTENT.md) for every liquid's behavior, source foundations, conservation boundaries and missing details.

The Liquid Reaction Lab sets up eight labeled vessels without scripted products. Mixed-liquid and lab tests repeat seeds 1, 19, 42. Browser verification covers all 32 canvas placements, solvent inspection, cosmetic painting while paused, freezing, complete export/import, live lab products, interventions and phone scrolling. The separate tool pass adds Lookup, a visible touch-friendly Shift latch, intensified Mix and Smash, and connected lines without a keyboard. All ten screenshot tool concepts now have working representations. Their exact reference semantics and nested settings remain partial; availability is not complete parity.

A 30-second headless lab sample completed 86,871 ticks, preserved declared resource balances at every sample, and matched 120 ticks of save continuation. Sampled array buffers stayed about 3.14–3.19 MiB, while the heap varied with garbage collection. Short browser samples at 1× recorded about 60 FPS in the single-queen world and lab, with actual pointer-event-to-terrain-data updates of 10.1 ms and 15.8 ms respectively. These samples do not prove sustained 5,000-agent rendering or indefinite stability. Measurements and conditions are in `VERIFICATION.md` and `artifacts/`.

The original **312-entry objective remains incomplete**. The checklist/JSON records Liquids and Tools as partial with evidence, keeping all remaining entries visible.

## Remaining work in the original scope (after Liquids integration)

1. Finish individual Land reaction parity, including exact named products and reference trigger conditions.
2. Complete the individual Life reference-reaction audit beyond the implemented basics; add any missing specific reactions and verify each named organism's full interaction set. Preserve the documented scientific boundaries and mode labels.
3. Finish the individual Liquids reference-reaction audit and implement the remaining Powders, Solids, Energy, Weapons, Gases, Food, Machines and Special entries and reactions. Some cross-category products already work, but their complete interaction sets are not certified. Keep missing items out of the functional palette until mechanics exist.
4. Complete the toolbar gaps in `SANDBOXELS-CHECKLIST.md` and reconcile the screenshot's v1.15 controls.
5. Increase material-ID storage/packet/save capacity before exceeding 255 IDs; the current engine uses Uint8 materials. Do not silently wrap IDs or map distinct requested elements to generic recolors.
6. Verify each batch through mechanics tests and rendered/browser interaction, then audit all 312 entries. Current tests cannot establish complete catalog parity.

No packaging build was run, per user instruction. Do not mark the active goal complete on this batch.
