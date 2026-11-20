# Ant Colony Sandbox – agent notes

## Verify
- `npm run typecheck` / `npm run build`
- `npx vitest run` (tests in `tests/`; `tests/traits.test.ts` covers named traits + soldiers)
- Headless sim probes (Node strip-types): `node --experimental-strip-types --no-warnings scripts/war-probe.ts <days>` (colonies, majors, galleries, war events), `scripts/starve-diag.ts colony-wars <days>` (where/why ants starve), `scripts/haul-diag.ts` (spoil haulers).
- Browser checks (start `npx vite --port 5175` first, set `GAME_URL=http://localhost:5175/`): `scripts/ui-drop-check.mjs` (no dark "black box" under dropped materials), `scripts/ui-fall-check.mjs`, `scripts/ui-tunnel-check.mjs`, `scripts/ui-traits-check.mjs`. Uses Edge at the default Windows path (`BROWSER_PATH` to override).

- Underground/nest probe: `scripts/nest-probe.ts <scenario> <days> [seed]` (ASCII cross-section of each nest, % of workers underground, what surface workers are doing, brood stages/hatching, floating ants). `scripts/restore-diverge.ts` finds the first tick where a save/load copy diverges.
- Browser: `scripts/ui-underground-check.mjs [scenario] [seconds]` (warp, screenshot cutaway, ant Brain tab, World census; no console errors). Vite serves on `localhost` (IPv6) — use `GAME_URL=http://localhost:5175/`. `?scenario=<id>&seed=<n>` URL params pick the world.
- Sustainability probes: `scripts/longevity.ts <scenario> <days> [seed]` (daily colony line + causes of death; check founding `sandbox`/`first-colony` and `living-world`, `colony-wars`), `scripts/food-flow.ts <scenario> <days> [seed]` (world food vs delivered vs eaten, ledger sources/sinks). 60-day runs take 3–15 min.

## Map
- Generated worlds: `src/sim/worldgen.ts` (biome strip, `living-world` scenario, colony sites); hooks into `generateTerrain` via `lift`/`plantMul`/`pondAt`.
- Kingdom/social layer: `src/sim/society.ts` (names, personalities -> task/alarm multipliers, mood, clans = patrilines, rulers, chronicle, treaties; `atPeace` used in `contactPhase`). Stored lazily on `colony.society` (saved with the colony).
- Outside homing field: `Sim.buildHomeField`/`homeDist` (rebuilt in `scanNest`; saved with the world in `navCache` together with `netFields`/`frontFields`) used by `NAV.HOME` in `behavior.ts` `step`.
- Behaviour: `src/sim/behavior.ts`; war/strategy: `warfare.ts`; nest template/galleries: `architecture.ts`; named traits: `traits.ts`; species: `species.ts` (Pheidole = dimorphic soldiers).
- Learning brains: `src/sim/brain.ts` (per-worker 17-12-9 Q-network, drive-reduction reward, instincts dreamed into a colony template `colony.mind`, template blended from above-average lifetimes at death, per-species brain bank). Hooks: `behavior.ts` `chooseTask` (verb choice), alarm response, fight-or-flight in `contactPhase`, `brainReward` at work events. Weights are AntStore SoA (`brainW` etc.), saved with the world; bank persisted in IndexedDB `brains` store (`worker/db.ts`) and passed to `createSim({brains})`.
- Deep nests: `architecture.ts` `growPlan` (chambers down the whole soil column, galleries, side shafts, 4 highway levels, queen court moves down); digging is plan-only once a plan exists (`digScore`). Brood development: `nestRate` + `BROOD_PACE` in `sim.ts`. Dynasties: `Sim.succession`. Census: `sim.census`, `colony.exposure` births/deaths.
- Deploy: static Vite build; `vercel.json` (framework vite, output `dist`). No backend — saves and learnt brains live in the browser's IndexedDB.
- Renderer cutaway backdrop: `src/render/renderer.ts` `computeGround` (only solids connected to the world floor count as ground).
