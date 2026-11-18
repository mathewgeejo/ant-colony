# Ant Colony Sandbox – agent notes

## Verify
- `npm run typecheck` / `npm run build`
- `npx vitest run` (tests in `tests/`; `tests/traits.test.ts` covers named traits + soldiers)
- Headless sim probes (Node strip-types): `node --experimental-strip-types --no-warnings scripts/war-probe.ts <days>` (colonies, majors, galleries, war events), `scripts/starve-diag.ts colony-wars <days>` (where/why ants starve), `scripts/haul-diag.ts` (spoil haulers).
- Browser checks (start `npx vite --port 5175` first, set `GAME_URL=http://localhost:5175/`): `scripts/ui-drop-check.mjs` (no dark "black box" under dropped materials), `scripts/ui-fall-check.mjs`, `scripts/ui-tunnel-check.mjs`, `scripts/ui-traits-check.mjs`. Uses Edge at the default Windows path (`BROWSER_PATH` to override).

- Sustainability probes: `scripts/longevity.ts <scenario> <days> [seed]` (daily colony line + causes of death; check founding `sandbox`/`first-colony` and `living-world`, `colony-wars`), `scripts/food-flow.ts <scenario> <days> [seed]` (world food vs delivered vs eaten, ledger sources/sinks). 60-day runs take 3–15 min.

## Map
- Generated worlds: `src/sim/worldgen.ts` (biome strip, `living-world` scenario, colony sites); hooks into `generateTerrain` via `lift`/`plantMul`/`pondAt`.
- Kingdom/social layer: `src/sim/society.ts` (names, personalities -> task/alarm multipliers, mood, clans = patrilines, rulers, chronicle, treaties; `atPeace` used in `contactPhase`). Stored lazily on `colony.society` (saved with the colony).
- Outside homing field: `Sim.buildHomeField`/`homeDist` (rebuilt in `scanNest`, not saved) used by `NAV.HOME` in `behavior.ts` `step`.
- Behaviour: `src/sim/behavior.ts`; war/strategy: `warfare.ts`; nest template/galleries: `architecture.ts`; named traits: `traits.ts`; species: `species.ts` (Pheidole = dimorphic soldiers).
- Renderer cutaway backdrop: `src/render/renderer.ts` `computeGround` (only solids connected to the world floor count as ground).
