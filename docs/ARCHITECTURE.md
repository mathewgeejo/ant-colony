# Architecture

TypeScript + Vite, Canvas 2D + DOM panels. No UI framework, one DOM node per agent, generated images, network backend or runtime content code.

## Modules

`main.ts` owns interface, camera input, and messages. `render/renderer.ts` maintains a three-pixel-per-cell cached terrain canvas, consumes dirty 16×16 chunks, draws hand-authored ant sprites and displays scalar overlays. `render/sprites.ts` contains original pixel grids. UI and simulation never share mutable world state.

`worker/sim.worker.ts` owns `Sim`, fixed ticks, serialization and IndexedDB. Base rate is 30 ticks/s, independent of requestAnimationFrame. A 12 ms compute budget with timer yields caps accelerated work; excess catch-up debt is dropped and counted rather than changing timestep or freezing input. Warp runs as fast as that budget permits. Render messages are sent at most approximately 30 Hz; the camera renders independently. Statistics are sampled four times/s; costly overlays approximately three times/s. Hidden tabs pause and resume their prior run state.

`sim/world.ts`: typed material, quantity, moisture, ownership, flags, toxicity and scheduler arrays. Coarse temperature/humidity fields at four-cell spacing. Chunks track dirty rendering and active terrain. `materials.ts` is the physical registry.

`sim/physics.ts`: falling water and grains over active chunks, rolling moisture exchange, coarse thermal diffusion, humidity and seasonal weather. Bottom/sides are closed. Open sky evaporates water. Rain and player tools are explicit sources; evaporation, drinking, transpiration and player deletion are sinks. Discrete fluid occupancy is separate from absorbed moisture. Water is integer units, 64/full cell, falls first, then spreads/merges, infiltrates permeable soil and can seep. It is not Navier–Stokes or a pressure-correct hydraulic solver. Saturated unsupported cohesive soils may slump; sand and loose spoil fall. There is no oxygen/gas/ventilation model.

`sim/ants.ts`: pooled structure-of-arrays storage, spatial buckets four cells wide and fixed-size per-ant memories. `behavior.ts`: decisions every four ticks, movement accumulators every tick, physiology every ten ticks, task FSM, local food sensing, contact interactions and threshold learning. Contact combat searches bounded local buckets and respects intervening cells. Newly buried ants escape locally or die; they cannot move into solid cells.

`sim/signals.ts`: per-colony fields allocate chunks only where used, decay and free empty chunks. Trails are substrate deposits with material-dependent persistence and no diffusion; water washes them out. Nest and alarm cues spread only through open air/plant cells. Walls and water block airborne exchange. Fields are bounded by world area and colony slots. The stable chunk iteration is deterministic within one code version, although diffusion across chunks is an ordered numerical approximation.

`sim/colony.ts` and `sim/sim.ts`: aggregate stores, queen reserves, brood, reproduction, ledger, stimuli and lineage. Colony updates every 30 ticks; ecology every 60; nest scans every 300. Brood carries genomes and parent identifiers from conception. Queens never issue per-worker commands. Mature colonies rear alates, which physically leave before mating resolution and daughter landings.

`sim/genetics.ts`: unlinked quantitative allele model; diploid females and haploid males; development fixes adult phenotype. Trait costs act through metabolism, brood feeding cost, movement, attack, clearance, signalling and water loss. Random mutations occur when new gametes are formed, independent of pressure. `species.ts` is a validated declarative content registry. `ecology.ts` and `critters.ts` add plant/food production and decay, prey, predators and contamination. Food production is ledgered, not claimed as conservation of all biomass.

## Explicit navigation and organizational shortcuts

Workers sense local food, signals, contacts, and their route waypoints. A flood-fill over at most a bounded nest region builds a shared distance-to-exit helper. It represents the nest's familiar architecture, **not knowledge of distant resources**. Terrain edits invalidate it. Fallback home steering can use the nest entrance vector (an abstract homing compass). Brood-care candidates are sampled from nearby known nest cells. Congestion and repeated failures bias workers away from failed actions.

Workers can read colony-level hunger/nursing/crowding stimuli and use aggregate stores. This approximates distributed information exchange and trophallaxis. It is not an individual biochemical-contact network. Brood relocation works; whole-colony queen relocation does not.

## Persistence

Schema 1, tagged typed arrays, gzip portable exports, structured clone for IndexedDB. Saves include terrain, moisture/thermal fields, CA activity schedule, organism arrays, brood, queen stored sperm, genomes, RNG state, signal chunks, stores, pending commands, lineage, mutations, exposure, events, scenario schedule and creation settings. UI-only camera/brush/sound preferences are session settings, not run state. Saving and compression happen in the worker; the UI remains separate. Snapshot copying is proportional to world size and not incrementally streamed; very large exports can delay worker ticks.

Snapshots are detached from live mutable records. Restoring preserves the active CA scheduler; resetting all chunks used to consume random numbers differently and was fixed. Older schema-1 files missing that scheduler still load with a reset, but cannot promise identical continuation. The migration hook rejects future schemas; no older published schema exists.

Determinism boundary: the same source revision, settings, initial seed and ordered command schedule in the same JS engine. `replay.ts` reconstructs runs; tests compare core hashes and save continuation. A hash is a regression check, not a cryptographic or comprehensive state identity. Imported custom definitions/settings must be identical. Cross-browser and cross-version replay are not guaranteed. Command logs above 20,000 truncate and mark a run non-replayable; current-world saving still works.

## Performance and bounded history

No all-pairs ant loop or per-ant global path search. Movement uses local candidates; environment and ecology use active chunks/coarse fields/rolling row slices. Temperature and humidity do scan their small coarse grid periodically. Overlay rasterization and conservation audits scan the world at diagnostic frequencies, not per-ant. Render dirty chunks and visible-agent culling reduce work.

Events retain 400; mutation records 3,000; trait history 3,000; exposure 200 days/colony; UI lineage detail 300 records. Full lineage storage remains cumulative to preserve genealogy, so indefinite sessions are **not proven memory-bounded**. Ant array capacity grows to high-water population and reuses dead slots. Signal chunk count can grow to world area for each colony; presets bound colonies, with at most 255 slots. Frame buffers are allocated/transferred per packet and garbage collected; no zero-allocation claim is made. The provided benchmark reports actual memory samples. Consider incremental archiving and double-buffer reuse before claiming large, indefinite workloads.
