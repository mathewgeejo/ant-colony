# Sandbox toolkit: implemented behavior and remaining scope

The reference is the [official Sandboxels controls and feature overview](https://github.com/R74nCom/sandboxels#controls). This game uses its own TypeScript simulation. It currently has **134 paintable materials plus air**; it does not implement the entire Sandboxels catalog. The 312 screenshot buttons remain tracked individually with partial/pending status.

## Working controls

| Control | Actual effect |
| --- | --- |
| Pause / Play / Step | Stops fixed simulation ticks or advances one tick; rendering and editing stay responsive. |
| − / + / brush slider | Changes brush radius. Zoom has its own camera buttons. |
| Undo / Redo | Restores complete world snapshots, including time, RNG, agents, resources and fields. Restoration pauses. History is capped at eight entries and targets 32 MiB of typed-array data per stack; one very large entry can exceed that target. |
| Reset | Clears materials, organisms and colonies to an empty editable world. Undo can restore the previous ecosystem. |
| Replace | Selects whether painting replaces occupied cells or only paints air. |
| Edit | Changes selected cell material, quantity, local temperature, electrical charge and contamination. Source/sink accounting remains active. |
| Info | Shows actual material state, density, conductivity and other physical properties. |
| Lookup | Clicks a world cell to open information for its actual material. |
| ↑ Shift | Latches intensified tools and connected-line drawing, including on touch screens. |
| Paint color | Applies selected cosmetic pigment without changing material identity, simulation time, RNG or physics activity. Dye uses the same picker. |
| Search / E | Searches all registered materials, including materials outside the current category. Enter selects the first result. |
| Saves | IndexedDB local saves, portable compressed export and import. |
| Mods | Imports validated declarative species packs. **Sandboxels JavaScript mods and material packs are not compatible.** |
| Settings | Weather, predator arrivals, climate, labels, patterns, sound and render detail. |
| Capture / C / F2 | Downloads the simulation canvas as PNG. |
| Hide UI / F1 | Gives the canvas the viewport. A visible restore button also works on touch screens. |
| TPS | Sets requested fixed ticks per second; actual speed may be lower under the compute budget. |
| Brush / Line / Rectangle / Fill | Freehand painting, connected lines, filled rectangles and connected-material flood fill. |
| Right click | Erases. Alt-drag or Pan moves the camera. Middle click picks a material. Shift-click joins the previous anchor with a line for paint/dig/erase. |
| Tool palette | Inspect, pick, erase, excavate, heat, cool, shock, mix, smash, drag particles and pan. |

Default rate is 30 TPS (1×) so falling materials remain legible. Higher rates accelerate the whole model, including colony development. Temperature is a coarse 4×4-cell field; the cell editor says so. Electrical charge is a cell field. Density values are dimensionless gameplay coefficients.

Hold the mouse or touch brush to pour material continuously at up to 30 brush samples per second. Heat/Cool change temperature immediately while paused; Shift strengthens Heat/Cool/Shock. Shift also includes flame/smoke/spark in Mix and grinds stone/gravel/rock further with Smash. New world offers an Empty particle sandbox, Particle physics lab and Liquid reaction lab. Scenario interventions are undoable; none scripts a desired simulation outcome.

## Working physics

- Grains fall and slide, including sand, clay powder, snow, ash, salt, dust, sawdust, shards, coal and gunpowder. Compacted nest clay remains structural. Damp sand uses a cohesion/arching approximation.
- Water falls, spreads under a local pressure approximation, infiltrates permeable soil, seeps and evaporates. Other liquids use density and viscosity. Heavier liquids displace lighter ones; powders sink through suitable liquids.
- Gases rise or settle, move into connected spaces, and respect walls. Gas bubbles can displace liquid. Steam escapes at the boundary through a recorded water sink. This is cell occupancy, not a gas-pressure or respiration solver.
- Water freezes/melts and boils/condenses with water-equivalent quantities preserved across ice, snow, water, saltwater and steam. Dissolved salt is abstracted, not conserved separately.
- Fuel can ignite, release heat and burn out. Water contact extinguishes flame. Smoke deposits local contamination. Oxygen depletion and molecular combustion stoichiometry are not simulated.
- Lava heats through the local temperature field, reacts with water and solidifies on cooling. Sand/glass and generic metal have simplified melting/solidification rules. The numeric profiles are authored game rules, not laboratory property tables.
- Conductors transmit attenuating charge. Batteries are explicit continuous energy sources; connected lamps visibly light. Broken circuits decay. Sparks, shocks, fuses and explosives interact; barriers block the tested destructive pulse.
- Acid consumes reagent while corroding ordinary solids; glass and barriers resist it. Flour and water form dough; baking produces bread and records evaporated water.
- Cloners learn an adjacent material and emit copies into empty neighbours. Every new food/water quantity is a named source. They are sandbox devices, not biological adaptations.
- Mixing and dragging transfer existing movable matter. Crushing converts selected brittle materials to powders without inventing conserved food or water.
- Water-bearing food/chemical mixtures keep solvent separately from food and soil moisture. Finite dyes, cleaners, acids, foam, adhesives, fermentation, milk curdling, hydration, freezing and cryogen/metal phases are detailed in [LIQUID-CONTENT.md](LIQUID-CONTENT.md). Those are working authored rules, not full reference parity.

These are local game rules with explicit limits. They do not model total biomass, chemical mass, electric energy, ideal gas volume, or rigid-body mechanics. The conserved quantities are declared food units and water-equivalent units, with recorded sources and sinks.

## Interaction with colonies

The researched ant profiles, founding, brood development, autonomous workers, signals, competition and parent-linked genetics remain available in the same world. Added liquids threaten submerged ants and brood. Heat, cold, contamination and electrical charge affect survival. A player device is a sandbox intervention and never a mutation granted to an existing worker.

## Still incomplete

The complete Sandboxels element/reaction library; arbitrary executable mods; custom material/reaction imports; chemical stoichiometry; oxygen/ventilation budgets; pressure-correct fluids; rigid-body solids; and a community/cloud save browser. No inactive button is presented as implementing these systems.

## Reproduce proof

`node scripts/sandbox-controls.mjs` checks actual browser interactions including undo/redo, geometry tools, an electrical circuit, cell editing, portable files, capture and mobile layout. `npm test` includes isolated material-physics and resource-accounting tests. Results and screenshots are in `artifacts/sandbox-controls.json`, `artifacts/sandbox-desktop.png`, and `artifacts/sandbox-mobile.png`.
