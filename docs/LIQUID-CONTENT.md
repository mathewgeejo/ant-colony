# Screenshot liquids: working mechanics and limits

All **32 named Liquids entries** have selectable representations. This batch adds 25 reference liquids and 18 reaction products/supporting materials, bringing the registry to **134 paintable materials plus air**. Availability and the tests below do **not** establish full Sandboxels v1.15 reaction parity. The screenshot checklist remains partial until every reference rule is compared and tested. No upstream code, sprites or textures were copied.

## Per-entry behavior

| Screenshot name | Game representation and implemented rules |
| --- | --- |
| Water | Integer-volume gravity, lateral pressure approximation, infiltration, evaporation, ice/steam transitions. |
| SaltWater | Saltwater: water-equivalent units, density flow and thermal transitions; dissolved salt is not separately conserved. |
| Magma | Lava: hot flowing material, water-contact steam, cooling into fixed stone. |
| Slime | Viscous water-bearing gel; slows contacting organisms, freezes and dries into dust plus steam. |
| Cement | Supported wet cement counts down to fixed concrete; bound water remains stored. Dry concrete powder hydrates using existing neighboring water. |
| Oil | Flammable light oil; floats above water and can enter a soapy emulsion. |
| LampOil | Lighter flammable fuel; viscosity/density, freezing and emulsification. |
| Foam | Buoyant finite film; holds water separately and returns it when collapsing. Boundary escape is a named water sink. |
| Acid | Finite corrosion, carbonate reaction and harmful bleach-contact gas; glass/barriers resist corrosion. |
| Glue | Sticky viscous liquid; slows nearby grains/organisms, loses explicitly ledgered water while drying into a fixed adhesive. Hot water contact softens dry glue. |
| Soda | Sugar and solvent stored separately; up to eight bubble releases per cell. Freezing saves remaining carbonation rather than refilling it. Yeast can ferment it. |
| Juice | Sugar solution; freezes, ferments with yeast at mild temperatures, dries into sugar and steam. |
| Milk | Protein plus solvent; freezes, separates into curd/whey with finite acid, dries into milk powder/steam. Powder rehydrates using existing water. |
| Vinegar | Finite mild-acid reagent; curdles milk, reacts with limestone/baking soda and bleach. Exhaustion returns its solvent. |
| Alcohol | Flammable fluid/vapor pair. Fermented alcohol retains its original water; heating separates that water and vapor into adjacent space. |
| Soap | Finite cleaner; lowers local contamination, emulsifies oil and turns existing water into temporary foam. |
| Bleach | Removes contact stains/contamination with a dose cost; acid contact takes priority and creates harmful gas when a neighboring space is available. |
| Dye | Finite pigment, player-selected color; stains touching matter. Solvent and stains travel with particles. Exhaustion leaves colored water. |
| Ink | Dark finite pigment with the same contact staining/cleaning rules. |
| Mercury | Dense conductive liquid, local contamination, solid/vapor transitions. Its arbitrary toxin numbers are game rules. |
| Blood | Protein-bearing fluid; stochastic coagulation, freezing, heat drying and compatible animal feeding. No circulation/physiology model. |
| Vaccine | **FICTIONAL, Fantasy only.** A wildlife contact dose grants 1,800 ticks of resistance to the toy Plague mechanic. Protection counts down; another dose requires less than 600 ticks remaining. Does not cure established infection, protect against poison/heat, revive animals or modify genes. |
| Poison | Finite toxic reagent; contaminates its own and contacting cells. Contamination harms organisms and decays through existing ecology. |
| Antidote | **FICTIONAL, Fantasy only.** Consumes poison reagent or lowers contamination at a cost. Does not revive life or repair temperature damage. |
| Honey | Existing viscous sugar food; adult-energy nutrition and combustible flow. It does not yet have the full solution-phase rules of juice/syrups. |
| Sap | Viscous sugar solution; mild heating can produce caramel; freezing, fermentation and boiling residue. |
| Caramel | Sticky concentrated sugar with little solvent; heat-dependent flow, freezing, drying and combustion. |
| Molasses | Dense viscous syrup; freezes, ferments and concentrates with heat. |
| Ketchup | Thick sugar-bearing sauce; freezes and dries into sugar residue/steam. Flavor, acid chemistry and ingredients are abstracted. |
| Mayo | Thick adult-energy food/emulsion; freezes and separates into edible oil plus steam when heated. Fat is represented by the existing energy-food currency. |
| LiquidHydrogen | Introduced cold; boils into combustible hydrogen, recondenses when sufficiently cold. No solid hydrogen, pressure or volume-correct expansion. |
| LiquidNitrogen | Introduced cold; boils into nonflammable nitrogen and recondenses with hysteresis. Thermal-field exchange chills nearby cells; no solid nitrogen or oxygen-displacement model. |

Supporting products are dry concrete, cured concrete, dry glue, cheese, milk powder, frozen mixture, frozen mercury, mercury vapor, nitrogen, bubble, chlorine, yeast, baking soda, nut oil, whey, oily soap, alcohol vapor and clotted blood. They are separate materials, rather than renamed generic placeholders. Some also belong to later screenshot categories; their presence here does not certify those categories' complete interaction sets.

## Resources, transport and reaction order

The world stores three different water quantities: pure-water-equivalent `amt`, absorbed soil `moist`, and **mixture `carrier`**. Food mixtures use `amt` for sugar or protein while storing solvent independently. Moving, swapping, erasing, cloning, reacting and saving preserve these layers or record named sources/sinks. Consuming the last food unit returns retained solvent to a water cell. Salt, total chemical mass, gas volume, biomass and thermal energy are not declared conserved quantities.

Contact recipes read only the cell and its four cardinal neighbors. Solid walls therefore separate reaction sites. Recipes needing a separated product require adjacent empty space. `LiquidReactions.transaction` checks the complete recipe before changing cells, then compares before/after water and all three food currencies and records net sources/sinks. Fermentation consumes sugar as a named substrate sink; cloners/player painting are sources. These transactions are accounting boundaries, not molecular stoichiometry.

`phase` packs the frozen origin material in its low 16 bits and saved reaction progress in its high 16 bits. Frozen nutritional units remain in inventory but are unavailable to foragers until thawed. Frozen soda retains its finite carbonation reserve. Other changes of identity clear phase state. `tint` is a separate cosmetic stain; black is representable without confusing it with an absent stain.

Viscosity decreases with heat. Adhesive contact checks are skipped entirely when no adhesive cells exist; derived counts rebuild on load. Stains use sparse dirty-cell packets and cached terrain textures. Painting color does not advance time, consume random numbers, alter material identity or wake physics chunks.

In 2D, a one-cell wall blocks both travel and liquid/reaction connectivity. There is no route around that wall outside the section. Temperature is shared by each 4 × 4 region. Phase expansion and latent heat are approximate; rapid cryogen/mercury transitions are game abstractions.

## Foundations and authored assumptions

The qualitative distinction between surfactants, pigments, gels, fuels and aqueous foods informs these authored profiles; exact doses, timers, nutrient counts and reaction probabilities are game design choices. Milk curdling, fermentation and cement setting are simplified families of processes, not validated recipes or predictive chemistry.

NIST lists normal nitrogen boiling near 77.34 K (−195.81°C) and mercury boiling near 629.81 K (356.66°C), with mercury fusion near 234.31 K (−38.84°C). The game rounds these and deliberately separates cooling/condensing thresholds to avoid oscillation. Hydrogen's cryogenic range is informed by NIST phase/vapor-pressure data, with an authored −253°C boiling trigger and −255°C condensation trigger. Cryogenic solids and pressure dependence are omitted. [NIST nitrogen](https://webbook.nist.gov/cgi/cbook.cgi?ID=C7727379&Mask=4), [NIST mercury](https://webbook.nist.gov/cgi/cbook.cgi?ID=C7439976&Mask=4), [NIST hydrogen](https://webbook.nist.gov/cgi/cbook.cgi?ID=C1333740&Mask=4).

The acid/bleach gas interaction reflects the documented hazard; game doses and gas amount are arbitrary. [Transport Canada CANUTEC](https://tc.canada.ca/en/dangerous-goods/canutec/articles/improper-mixing-common-household-cleaning-products). Mercury contamination is a simplified ecological hazard, not an exposure calculation. [US EPA mercury overview](https://www.epa.gov/sites/default/files/2020-11/documents/mercury.pdf).

Vaccine and Antidote are explicitly fictional universal editing substances for a toy pathogen/toxin system. Protection is a temporary individual state, **not heritable evolution**. Material color is cosmetic; adhesive avoidance/slowing is an immediate behavioral/physical response. No existing worker acquires inherited mutations from these liquids.

## Reproduce verification

```sh
npm test -- tests/liquids.test.ts tests/sandbox-physics.test.ts
node scripts/liquid-preview.mjs
node scripts/tools-preview.mjs
node --experimental-strip-types --no-warnings scripts/liquid-bench.ts 30
```

The 22 liquid tests cover all 32 definitions; mixture transfers, frozen nutrition/progress, milk separation, evaporation/rehydration, cement/glue, pigments/cleaners, soap/foam, acid/bleach, fermentation, cryogens, mercury, poison/fictional protection, cosmetic-only painting, transactional rejection, schema migration and saved continuation. Fantasy restrictions also cover cell edits, cloner emission and imported cloner templates. Mixed-liquid runs and the Liquid Reaction Lab are repeated on seeds 1, 19, 42 with balanced ledgers. This is a mechanics sample, not a complete reference reaction audit.

The browser check paints all 32 through the real canvas, inspects bound water, paints a stain, freezes milk using Edit + Step, exports/imports its complete state, observes actual lab products and exercises a lab intervention. It checks Fantasy gating and phone overflow/scrolling. See `artifacts/liquid-checks.json` and desktop/phone PNGs. The separate tool check covers Lookup, latched Shift/Heat/Smash/line drawing, phone reachability and rapid Play/Pause with injected stale worker statuses.

The remaining reference categories and unverified interactions remain listed in [SCREENSHOT-CHECKLIST.md](SCREENSHOT-CHECKLIST.md). No packaging build was run.
