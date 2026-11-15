# Ant Colony Sandbox – agent notes

## Verify
- `npm run typecheck` / `npm run build`
- `npx vitest run` (tests in `tests/`; `tests/traits.test.ts` covers named traits + soldiers)
- Headless sim probes (Node strip-types): `node --experimental-strip-types --no-warnings scripts/war-probe.ts <days>` (colonies, majors, galleries, war events), `scripts/starve-diag.ts colony-wars <days>` (where/why ants starve), `scripts/haul-diag.ts` (spoil haulers).
- Browser checks (start `npx vite --port 5175` first, set `GAME_URL=http://localhost:5175/`): `scripts/ui-drop-check.mjs` (no dark "black box" under dropped materials), `scripts/ui-fall-check.mjs`, `scripts/ui-tunnel-check.mjs`, `scripts/ui-traits-check.mjs`. Uses Edge at the default Windows path (`BROWSER_PATH` to override).

## Map
- Behaviour: `src/sim/behavior.ts`; war/strategy: `warfare.ts`; nest template/galleries: `architecture.ts`; named traits: `traits.ts`; species: `species.ts` (Pheidole = dimorphic soldiers).
- Renderer cutaway backdrop: `src/render/renderer.ts` `computeGround` (only solids connected to the world floor count as ground).
