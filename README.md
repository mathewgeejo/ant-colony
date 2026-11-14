# Ant Colony Sandbox

Screenshot content expansion: [all 312 named reference buttons](docs/SCREENSHOT-CHECKLIST.md), [implementation evidence and remaining scope](docs/SCREENSHOT-PROGRESS.md), [Life content and sources](docs/LIFE-CONTENT.md), and [Liquid mechanics and limits](docs/LIQUID-CONTENT.md). The registry now has **134 paintable materials**, plus 14 additional animal profiles. All 18 Land, 36 Life and 32 Liquids entries have representations; full reference organism/element/reaction parity remains incomplete. Try **New world → Living garden** or **Liquid reaction lab**. The default still starts with one founding queen.

A playable, editable pixel ecosystem with a simulation worker, autonomous ant agents, cellular terrain and water, brood development, local signals, competing colonies, and explicit inherited lineages. All art is original pixel grids and procedural code. No generated images or external art service.

## Run locally

Node.js 22.14+ is used for the headless scripts; a current Node version supported by the installed Vite also works for development. Use a modern browser with module workers, Canvas 2D, IndexedDB and CompressionStream (tested in Chromium-based Edge).

```sh
npm ci
npm run dev
```

Open the printed local URL. The default starts with **one newly mated Lasius niger queen**, at 1× / 30 TPS so material motion stays readable. Watch her excavate and rear brood; choose 10×, 100× or Warp to reach workers sooner. Use the experiment guide in the bottom bar for controls and scenario interventions. One model day is 3,600 ticks, two real minutes at 1×; biological development is further compressed.

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

`dist/` is the static browser build. Serve it over HTTP; opening index.html directly as a file cannot load a module worker. It has no backend/account dependency. Build only when needed to package or diagnose a build issue, not after every edit.

## Play

- Drag a selected material to paint; Replace determines whether occupied terrain can be overwritten. Dig removes soil while preserving food and water. Erase removes either.
- Mouse wheel / keyboard + / − zoom. Alt-drag or the Pan tool moves the camera. Right-click erases; middle-click picks a material. F fits the world/content; arrow keys pan. Touch users select Pan to drag.
- E focuses material search; X selects Erase. The compact element palette and optional overlay inspector are inspired by Sandboxels. On phones, Fit centres a readable colony slice; zoom out for the entire map. New world and Field journal are also accessible inside Settings.
- Space pauses, `.` single-steps, I inspects, D digs, H selects Pan, [ and ] change brush size. Click an ant to inspect its current reason, needs, route memory and inherited traits.
- Place sugar for adults and protein for growing larvae; the harvester profile also processes seeds. Add water, alter temperature/moisture, place barriers or introduce rival colonies to change survival conditions.
- Use overlays for trails, moisture, temperature, resources and activity. Pattern marks and labels are available in Settings. All sandbox tools are available from the start. Discovery records never grant communication or other abilities.
- Save locally in IndexedDB; export `.antsave` backups. Load/import pauses the world so it can be inspected before continuing. Storage failures appear visibly. New world replaces the active run: save first.
- Use **Inheritance garden** for an explicitly provisioned reproductive experiment, and Field journal → Lineage/Traits/Mutations to inspect descendants. The default founding world starts earlier in the lifecycle. Random mutation never guarantees the trait an environment would favour.

## Included systems and documentation

See [architecture](docs/ARCHITECTURE.md), [biology and sources](docs/BIOLOGY.md), [species/mutation schemas and scenarios](docs/CONTENT.md), and [verification and performance](docs/VERIFICATION.md).

The [sandbox toolkit](docs/SANDBOX-FEATURES.md) adds complete-world Undo/Redo, Reset, geometry/fill tools, cell/color editing, Lookup, mobile Shift, capture and TPS controls. Working powders, density, gas motion, fire, phases, electricity, explosions, corrosion, cooking, finite-reagent liquid reactions and cloning share the ant world. This is a tested toolkit, not full compatibility with the entire Sandboxels catalog or its JavaScript mods.

For material experiments, choose **New world → Particle physics lab** or **Empty particle sandbox**. Hold the brush to pour grains or liquids; Heat/Cool/Shock act while paused. The lab guide offers ordinary terrain interventions to release a reservoir, ignite wood, pour sand and sever a circuit.

The baseline is a researched *Lasius niger* profile; a contrasting *Pogonomyrmex californicus* profile uses semi-claustral founding and seed nutrition. Some harvester behavior is explicitly extrapolated from a related species. Naturalistic, speculative and fantasy modes have separate ranges and rules. Four fictional loci have costs and active effects; they are labelled fictional. These profiles and the normalized genetics are game abstractions, not predictive models.

## Reproduce checks

```sh
npm run experiments
npm run bench -- 120
npm run screenshots
npm run sandbox-check
node scripts/liquid-preview.mjs
node scripts/tools-preview.mjs
node --experimental-strip-types --no-warnings scripts/liquid-bench.ts 30
```

Experiments and benchmarks write JSON to `artifacts/`. The browser script expects the dev server at `http://127.0.0.1:5175/` and Edge at its standard Windows installation path. Set `GAME_URL` and `BROWSER_PATH` for another server or Chromium installation. It uses an isolated temporary browser profile. Windows PowerShell can start a server on that port with `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5175`.

## Limits

The model is a two-dimensional connected slice; tunnels and floods cannot bypass the viewing plane. Development, seasons, lifespans and colony sizes are compressed. Colony stimuli, feeding and nest-distance helpers are explicit approximations. Complete queen/nest relocation, oxygen/ventilation, parasites, researched predator species, bridge construction and ecosystem-wide biomass conservation are unfinished/future content, not active systems. Multi-generation selection outcomes in the environmental/fantasy scenarios remain exploratory. Performance varies with population, world, weather and hardware; 60 FPS at 5,000 ants is not claimed. Full lineage history is cumulative, so indefinite memory stability is not established.

Source licensing remains ISC as declared in package.json. The bundled Silkscreen and Atkinson Hyperlegible fonts retain their respective font package licenses in node_modules; all sprite grids and procedural artwork are authored source.
