# Verification and measured performance

Liquid expansion evidence: `tests/liquids.test.ts` adds 22 checks, including three-seed mixed-fluid and actual lab-reaction runs, and Fantasy restrictions through cloner templates. `artifacts/liquid-checks.json` records ten browser checks; `artifacts/tool-checks.json` records six more for Lookup/Shift/Heat/Smash/lines/phone reachability and run-state acknowledgements. Per-liquid rules and scientific boundaries are in `LIQUID-CONTENT.md`. Schema 3 saves retain solvent, frozen composition/progress, stains and fictional protection state.

The broader 16-check toolbar browser rerun exposed search ordering: “clay powder” selected Compacted clay because its description mentioned the phrase. Search now prioritizes exact names, then name prefixes/contains, then description matches, and skips disabled entries on Enter. The browser regression checks the selected identity before painting and erasing. This was a selection bug, not delayed right-click erasing.

Repeated browser runs also exposed stale status messages reversing the UI's Play/Pause belief after world changes. Painting still arrived, but the simulation could be unintentionally paused, leaving a held pour in one place. Run requests and status packets now carry monotonically increasing revisions; older statuses cannot overwrite the latest request. The worker acknowledges immediately. The tool regression injects stale status messages between 40 rapid toggles and verifies the final acknowledged pause; the broader held-pour check also waits for the confirmed running state.

The 30-second **headless** Liquid Reaction Lab sample (`artifacts/liquid-benchmark.json`) completed 86,871 fixed ticks. Food/water ledgers balanced at each two-second sample and after 120 matching save-continuation ticks. Sampled array buffers ranged 3.14–3.19 MiB and heap 7.71–34.37 MiB, with 109 stained cells. This tests simulation and terrain/stain packet packing, not browser FPS or large ant populations. Thirty wall-clock seconds is short stability evidence, not proof of indefinite bounded memory.

Separate 1× browser samples at 1440 × 900 in Edge 157 (`performance-liquids-default.json`, `performance-liquids-lab.json`) measured about 60 FPS. Mean terrain-packet acceptance was 0.69 ms in the one-queen default and 0.89 ms in the lab. Native pointer-event-to-updated-terrain-data was 10.1 ms and 15.8 ms; automation round-trip latency was 19.3 ms and 25.2 ms. Both achieved about 1× simulation rate. These short samples were collected before the final contact-allocation shortcut; they are checkpoint measurements, not universal latency guarantees or a 5,000-agent claim.

Screenshot Life expansion: see `docs/LIFE-CONTENT.md` and `artifacts/life-checks.json` for the new mechanics/browser checks. Repeated two-day Living Garden experiments on seeds 1, 19, 42 observed 7, 7 and 10 births, respectively, with balanced food/water ledgers and matching saved continuation in all runs (`artifacts/life-experiments.json`). The starting population was 20 introduced animals; final populations were 11, 11 and 13 after real mortality. These are provisioned experiments and do not guarantee successful breeding in arbitrary conditions. Wildlife pedigree depth is not evidence of heritable trait evolution; non-ant genes are not modeled.

Tests and measurements are reproducible scripts, not promised outcomes. Measurements taken 14 November 2026 on Windows 11 (10.0.26200), Intel Core i3-1115G4 @ 3.00 GHz, four logical cores, 7.75 GiB RAM, Node 22.14.0. Other applications and browser QA were running; this is a reference laptop, not an isolated benchmark rig.

## Engine checks

The Vitest suite checks blocked movement and terrain editing, repeated-seed food/water accounting, signal transport, maternal allele assortment, no retroactive worker mutation, developmental conditions and larval protein, detached snapshots and deterministic continuation, schema migration and malformed saves, pause behavior, and species validation. Renderer checks cover cached textures and individual ant sprites without stale trails. Sandbox checks cover grain gravity, density, water phases, reactive-chunk wakeup, burning, connected/severed circuits, barrier-blocked blasts, matter transfer, cloner sources, gas escape/walls, corrosion, melting, cooking, electrical persistence and connected fill.

The expanded suite passed **94/94** across six files, including 22 Liquid tests, 21 Life tests, Land mechanics, intensified tool rules and saved-continuation regressions. `npm run typecheck` passed for the complete UI/worker code without a packaging build. The repeated-seed experiment has a four-minute allowance so it can run alongside browser QA on the reference laptop.

The save/load check advances both original and restored worlds and compares continuation, not just their initial display. It exposed a missing active-chunk scheduler; snapshots now preserve it. Tests also exposed buried-agent movement, incomplete custom validation and protein replacement by sugar; these were corrected. The replay hash covers core state, not every byte of diagnostic output. No cross-browser reproducibility claim.

## Seeded experiments

`artifacts/experiments.json` records the repeated scenarios for seeds 1, 19, 42. First-colony runs reached workers within 12 model days, route runs delivered actual food, competition produced variable contact (not guaranteed fighting). A separate warm, provisioned experiment produced **6, 9 and 1 daughter colonies** by model day 24 across those seeds. These daughters came from actual gyne emergence, departure, mating and landing; no daughter birth was scripted. Parentage, mutations and resource ledgers were recorded. Provisioning is an explicit experimental source and not evidence that an arbitrary unassisted founder will prosper.

The flood scenario was revised after testing showed an uphill pool infiltrated before reaching the nest. Its reservoir and connected nest are now explicitly engineered and lined; the final repeated test measured peak water occupancy of **207, 165 and 166 owned nest cells**, with balanced resources on seeds 1, 19, 42. No brood rescue occurred in those runs; a safe destination is not guaranteed. `artifacts/flood-check.json` records the measurements. Environmental-shift and fantasy-divergence multi-generation frequency outcomes have not received a statistically adequate validation study. They are exploratory conditions, not guaranteed demonstrations of a favored mutation spreading.

## 4,968-agent desktop stress sample

`npm run bench -- 120` ran a 512×256 world with eight colonies, 620 workers plus one queen each. Renderer packet packing was exercised every 30 ticks; this is a **headless simulation/serialization benchmark, not a rendering FPS test**.

| Measurement | Observed |
| --- | --- |
| Wall time | 120 s |
| Fixed ticks completed | 14,261 |
| Mean time per tick including periodic packing | 8.42 ms |
| First sampled 5 seconds | 8.10 ms/tick at 4,968 ants |
| Final population | 3,741 ants; population was not held artificially constant |
| JS heap sampled | 15.1–32.0 MiB |
| Array buffers sampled | 7.8–13.9 MiB |
| Signal chunks sampled | 38–123 |
| Resource audit | Sugar, protein, seed and water matched ledger expectations |

Population declined through the actual survival rules; this does not prove constant-5,000-agent long-term throughput. Garbage collection caused sawtooth memory samples rather than monotonic sampled growth. Two minutes without a crash is useful short stability evidence, **not proof against a long-session leak**. Full lineage records are cumulative. Use `npm run bench -- 300` or longer to extend the recorded experiment.

This rerun includes the added material physics (`artifacts/benchmark.json`). The earlier engine sample is retained in `artifacts/benchmark-before-sandbox.json`. The last 25 seconds overlapped local checking work and slowed substantially; compare the actual sample series rather than inferring an isolated A/B speedup from their overall means.

The supported default is a compact 384×192 founding world; 512×256 is available. Large 768×384 is labelled experimental. Rendering detail can be reduced without changing simulation rules. Warp is compute-budget limited; lower achieved speed is visible. A 60-FPS/5,000-agent guarantee is not made on this laptop.

## Browser QA

`scripts/screenshots.mjs` uses an isolated Edge/Chromium profile against the dev server. It checks pause, exact single step, pointer painting and digging, zoom, IndexedDB save/load, overlays, moved food, lineage, phone layout, flood intervention and speed. It writes screenshots and an outcome JSON in `artifacts/`. The Sandboxels-inspired UI keeps a full-width canvas, dense material buttons/search and an optional overlay inspector. Documentation-only changes do not require rebuilding; source edits during QA trigger Vite reloads, which can interrupt a browser test.

The focused `scripts/ui-preview.mjs` check passed category switching, material filtering and observatory toggling, with screenshots at 1440×900 and 390×844 and no horizontal overflow. After the rendering optimizations, the extended `scripts/screenshots.mjs` run passed pause/step, painting/digging, zoom, IndexedDB save/load, moved food, overlays, lineage, phone layout, flood intervention and speed changes (`artifacts/browser-checks.json`).

`scripts/sandbox-controls.mjs` passed 16 checks: Reset and complete-world Undo/Redo, undoable brush edits, rectangles, connected fill, lines, a drawn battery/wire/lamp circuit, cell editing, global search, right-click erase, hide/restore UI, actual portable export/import, PNG download, phone layout, the lab reservoir intervention, continuous held-brush grain pouring and held heat changing temperature while paused. See `artifacts/sandbox-controls.json`, the desktop/mobile PNGs and `artifacts/physics-lab.png`. Full-screen permission behavior still needs a manual check on a deployment. No claim that all browsers or accessibility combinations have been certified.

## Input and rendering optimization

`scripts/performance-ui.mjs` repeats a 10× workload at 1440×900 in isolated Edge. The earlier renderer spent **71.06 ms mean / 204 ms maximum** accepting a terrain packet and displayed **10.6 FPS** (`performance-before.json`). Cached pixel textures, one regional upload, acknowledged worker frames, and batched brush input reduced the measured terrain acceptance cost to **0.33 ms mean / 1.5 ms maximum** in `performance-pixels.json`, with **60 FPS** in that sample. Later samples with Undo and the expanded physics have higher costs under concurrent laptop load; these are retained rather than replacing the earlier evidence.

Individual sprite writes now share a reusable pixel layer. In the expanded 5,000-agent browser stress sample (`performance-sandbox-stress.json`), terrain acceptance averaged **1.2 ms**, drawing **1.42 ms**, and the sampled rate was **46.9 FPS**. Automated end-to-end paint latency was **623 ms** in that loaded stress run; large populations and full-state Undo snapshots can still cause input delay. This is not a claim of 60 FPS or instant painting at 5,000 agents. The ordinary founding world defaults to 30 TPS; accelerated rates have a fixed computation budget and report achieved throughput.

The final ordinary-world 10× request (`performance-sandbox-final.json`) sampled **2.07 ms** terrain acceptance, **56.3 FPS**, and **217 ms** automated end-to-end paint latency. Achieved simulation speed was only **1.17×** in that short loaded run, so smooth rendering does not imply the simulation met the requested 10× rate. This is why requested and achieved speeds are shown separately.

At the supported **1× default**, the final check (`performance-sandbox-default.json`) sampled **55.8 FPS**, **1.86 ms** mean terrain acceptance and **31.8 ms from the actual pointer event to updated terrain data**. Its automation round-trip paint time was **77.5 ms**; the script now separates native event handling from automation transport. The terrain-data measurement precedes the next display refresh and is not a universal end-to-end display-latency guarantee.

The separate `scripts/snapshot-bench.ts` isolates Undo checkpoint serialization for 4,968 ants in Node. Twelve snapshots averaged **15.10 ms** (3.74–28.82 ms); this excludes browser message scheduling, rendering, history bookkeeping and restore. The record is `artifacts/snapshot-benchmark.json`. Input delay in a browser cannot be attributed entirely to snapshot copying from this measurement.
