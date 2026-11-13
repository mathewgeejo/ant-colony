# Verification and measured performance

Tests and measurements are reproducible scripts, not promised outcomes. Measurements taken 14 November 2026 on Windows 11 (10.0.26200), Intel Core i3-1115G4 @ 3.00 GHz, four logical cores, 7.75 GiB RAM, Node 22.14.0. Other applications and browser QA were running; this is a reference laptop, not an isolated benchmark rig.

## Engine checks

The Vitest suite covers 14 checks: blocked movement/terrain editing, water accounting, repeated foraging food accounting, surface signal decay/washout, airborne walls, maternal allele assortment, no retroactive worker genotype/phenotype edits, thermal development thresholds, larval protein requirements, save/load continuing-state agreement, seeded replay, corrupt-save rejection, pause/read-only state, and custom-content validation.

A complete expanded run passed 14/14. Under concurrent browser work another run exceeded the original two-minute test timeout during its repeated-seed experiment; it did not report an invariant failure. That experiment now has a four-minute allowance and fewer redundant ticks. Run `npm test` for the current result. `npm run typecheck` checks the complete UI/worker code without a packaging build.

The save/load check advances both original and restored worlds and compares continuation, not just their initial display. It exposed a missing active-chunk scheduler; snapshots now preserve it. Tests also exposed buried-agent movement, incomplete custom validation and protein replacement by sugar; these were corrected. The replay hash covers core state, not every byte of diagnostic output. No cross-browser reproducibility claim.

## Seeded experiments

`artifacts/experiments.json` records the repeated scenarios for seeds 1, 19, 42. First-colony runs reached workers within 12 model days, route runs delivered actual food, competition produced variable contact (not guaranteed fighting). A separate warm, provisioned experiment produced **6, 9 and 1 daughter colonies** by model day 24 across those seeds. These daughters came from actual gyne emergence, departure, mating and landing; no daughter birth was scripted. Parentage, mutations and resource ledgers were recorded. Provisioning is an explicit experimental source and not evidence that an arbitrary unassisted founder will prosper.

The flood scenario was revised after testing showed an uphill pool infiltrated before reaching the nest. Its reservoir and connected nest are now explicitly engineered and lined; the final repeated test measured peak water occupancy of **207, 165 and 166 owned nest cells**, with balanced resources on seeds 1, 19, 42. No brood rescue occurred in those runs; a safe destination is not guaranteed. `artifacts/flood-check.json` records the measurements. Environmental-shift and fantasy-divergence multi-generation frequency outcomes have not received a statistically adequate validation study. They are exploratory conditions, not guaranteed demonstrations of a favored mutation spreading.

## 4,968-agent desktop stress sample

`npm run bench -- 120` ran a 512×256 world with eight colonies, 620 workers plus one queen each. Renderer packet packing was exercised every 30 ticks; this is a **headless simulation/serialization benchmark, not a rendering FPS test**.

| Measurement | Observed |
| --- | --- |
| Wall time | 120 s |
| Fixed ticks completed | 21,416 |
| Mean time per tick including periodic packing | 5.60 ms |
| First sampled 5 seconds | 9.35 ms/tick at 4,968 ants |
| Final population | 2,942 ants; population was not held artificially constant |
| JS heap sampled | 11.9–26.4 MiB |
| Array buffers sampled | 7.3–13.3 MiB |
| Signal chunks sampled | 39–127 |
| Resource audit | Sugar, protein, seed and water matched ledger expectations |

Population declined through the actual survival rules; this does not prove constant-5,000-agent long-term throughput. Garbage collection caused sawtooth memory samples rather than monotonic sampled growth. Two minutes without a crash is useful short stability evidence, **not proof against a long-session leak**. Full lineage records are cumulative. Use `npm run bench -- 300` or longer to extend the recorded experiment.

The supported default is a compact 384×192 founding world; 512×256 is available. Large 768×384 is labelled experimental. Rendering detail can be reduced without changing simulation rules. Warp is compute-budget limited; lower achieved speed is visible. A 60-FPS/5,000-agent guarantee is not made on this laptop.

## Browser QA

`scripts/screenshots.mjs` uses an isolated Edge/Chromium profile against the dev server. It checks pause, exact single step, pointer painting and digging, zoom, IndexedDB save/load, overlays, moved food, lineage, phone layout, flood intervention and speed. It writes screenshots and an outcome JSON in `artifacts/`. The Sandboxels-inspired UI keeps a full-width canvas, dense material buttons/search and an optional overlay inspector. Documentation-only changes do not require rebuilding; source edits during QA trigger Vite reloads, which can interrupt a browser test.

The focused `scripts/ui-preview.mjs` check passed category switching, material filtering and observatory toggling, with actual screenshots at 1440×900 and 390×844 and no horizontal overflow. Earlier browser checks passed painting, digging, zoom, pause/single-step and IndexedDB save/load. The extended scenario browser script timed out after Warp; end-to-end automation of all scenarios is therefore incomplete. Mechanical route/reproduction/flood tests ran headlessly. Portable serialization is unit-tested; browser file download/import and full-screen permission behavior should also be checked manually on a deployment. No claim that all browsers or accessibility combinations have been certified.
