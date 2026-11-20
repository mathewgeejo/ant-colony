// Ecology: plants (growth, transpiration, seeds, roots), aphid honeydew,
// decomposition of food, corpses and litter, toxin decay and springtail emergence.
// Every food or water change goes through the ledger.
import { CRITTER } from './critters.ts';
import { FOOD_OF, M, MOIST_CAP } from './materials.ts';
import { seasonName } from './physics.ts';
import type { Sim } from './sim.ts';
import { FLAG_APHID } from './world.ts';

export function ecologyStep(sim: Sim) {
  const w = sim.w, rng = sim.rng;
  const { W, H, mat, moist, amt, flags } = w;
  const season = seasonName(sim.tick);
  const growing = season !== 'winter';
  // ---------------- plants (per column) ----------------
  for (let x = 0; x < W; x++) {
    const s = w.surface[x];
    if (s <= 1 || s >= H) continue;
    const gi = s * W + x;
    const ground = mat[gi];
    let height = 0;
    while (s - 1 - height >= 0 && mat[(s - 1 - height) * W + x] === M.PLANT) height++;
    if (height === 0) {
      if (!growing) continue;
      if ((ground === M.TOPSOIL || ground === M.ORGANIC) && moist[gi] > MOIST_CAP[ground] * 0.3 && rng.chance(0.0015)) {
        // no plant directly adjacent (keeps stems separate)
        if (mat[(s - 1) * W + x - 1] !== M.PLANT && mat[(s - 1) * W + x + 1] !== M.PLANT && mat[(s - 1) * W + x] === M.AIR) {
          sim.setCell((s - 1) * W + x, M.PLANT, 1, 'plant growth');
        }
      }
      continue;
    }
    // transpiration from the root zone (ledgered water sink)
    let need = Math.ceil(height / 3);
    for (let d = 0; d < 6 && need > 0; d++) {
      for (const dx of [0, -1, 1]) {
        const k = (s + d) * W + x + dx;
        if (s + d >= H || x + dx < 0 || x + dx >= W) continue;
        if (MOIST_CAP[mat[k]] && moist[k] > 4 && need > 0) { moist[k]--; need--; w.ledger.sink('water', 'transpiration', 1); }
      }
    }
    const base = (s - 1) * W + x;
    if (need > 0) {
      // drought stress: plant loses vigour; dead plants become litter
      amt[base] = Math.max(0, amt[base] - 1);
      if (amt[base] === 0 && rng.chance(0.3)) {
        for (let h = height - 1; h >= 1; h--) sim.setCell((s - 1 - h) * W + x, M.AIR, 0, 'plant died');
        sim.setCell(base, M.ORGANIC, 60, 'plant died');
        continue;
      }
    } else if (amt[base] < 20) amt[base]++;
    if (!growing) {
      if (rng.chance(0.02)) for (let h = 0; h < height; h++) flags[(s - 1 - h) * W + x] &= ~FLAG_APHID;
      continue;
    }
    const fert = ground === M.TOPSOIL ? Math.min(1, amt[gi] / 60) : 0.5;
    const maxH = 4 + Math.floor(fert * 8);
    if (height < maxH && need === 0 && rng.chance(0.02)) {
      const top = (s - 1 - height) * W + x;
      if (s - 1 - height >= 0 && mat[top] === M.AIR) sim.setCell(top, M.PLANT, 1, 'plant growth');
    }
    // seeds
    if (height >= 4 && (season === 'summer' || season === 'autumn') && rng.chance(0.012)) {
      const sx = x + rng.int(7) - 3;
      if (sx > 0 && sx < W - 1) {
        const sy = w.surface[sx] - 1;
        if (sy > 0 && sy + 1 < H && mat[sy * W + sx] === M.AIR && !w.owner[sy * W + sx] && !FOOD_OF[mat[(sy + 1) * W + sx]]) sim.setCell(sy * W + sx, M.SEED, 1, 'seed production');
      }
    }
    // roots
    if (height >= 3 && rng.chance(0.003)) {
      const d = 1 + rng.int(6), dx = rng.int(3) - 1;
      const k = (s + d) * W + x + dx;
      if (s + d < H && (mat[k] === M.TOPSOIL || mat[k] === M.SOIL) && !w.owner[k]) sim.setCell(k, M.ROOT, 0, 'root growth');
    }
    // arthropod fall: small insects living on vegetation die or drop to the ground and are scavenged as
    // protein (ledgered source). Without this renewable prey the soil surface has almost no protein and
    // colonies cannot rear larvae for long. Rate is an authored game value, highest in summer.
    if (rng.chance((season === 'summer' ? 0.024 : season === 'spring' ? 0.016 : 0.008) * Math.min(1, height / 5))) {
      const fx = x + rng.int(9) - 4;
      if (fx > 0 && fx < W - 1) {
        const fy = w.surface[fx] - 1, fk = fy * W + fx;
        if (fy > 0 && fy + 1 < H && mat[fk] === M.AIR && !w.owner[fk] && !FOOD_OF[mat[fk + W]] && !w.owner[fk + W]) sim.setCell(fk, M.PROTEIN, 1 + rng.int(2), 'insect fall');
      }
    }
    // aphids colonise plants and drip honeydew
    if (height >= 3 && rng.chance(0.004)) flags[(s - 1 - rng.int(height)) * W + x] |= FLAG_APHID;
    for (let h = 0; h < height; h++) {
      const k = (s - 1 - h) * W + x;
      if (!(flags[k] & FLAG_APHID) || !rng.chance(0.06)) continue;
      // honeydew falls to the ground beside the stem
      const dx = rng.chance(0.5) ? -1 : 1;
      const gx = x + dx;
      if (gx < 0 || gx >= W) continue;
      const gy = w.surface[gx] - 1;
      if (gy < 0) continue;
      const gk = gy * W + gx;
      const below = (gy + 1) * W + gx;
      // honeydew soaks into an existing drop until it is full; it never piles up into towers or lands on a nest
      if (gy + 1 < H && mat[below] === M.SUGAR) { if (amt[below] < 8) { amt[below]++; w.ledger.source('sugar', 'honeydew', 1); w.touch(gx, gy + 1); } }
      else if (mat[gk] === M.AIR && !w.owner[gk] && gy + 1 < H && !FOOD_OF[mat[below]] && !w.owner[below]) sim.setCell(gk, M.SUGAR, 1, 'honeydew');
    }
  }
  // ---------------- rolling scan: decomposition etc. ----------------
  const rows = Math.ceil(H / 8);
  const y0 = sim.ecoCursor, y1 = Math.min(H, y0 + rows);
  sim.ecoCursor = y1 >= H ? 0 : y1;
  let springtails = 0;
  for (const c of sim.critters.list) if (c.kind === CRITTER.SPRINGTAIL) springtails++;
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (w.toxin[i]) { w.toxin[i] = Math.max(0, w.toxin[i] - 3); w.chunkDirty[w.chunkOf(x, y)] = 1; }
      const m = mat[i];
      switch (m) {
        case M.PROTEIN:
          if (rng.chance(0.04)) {
            amt[i]--; w.ledger.sink('protein', 'decomposed', 1);
            if (amt[i] === 0) sim.setCell(i, M.ORGANIC, 30, 'decomposed');
            else w.touch(x, y);
          }
          break;
        case M.SUGAR:
          if (rng.chance(0.012)) {
            amt[i]--; w.ledger.sink('sugar', 'spoiled', 1);
            if (amt[i] === 0) sim.setCell(i, M.AIR, 0, 'spoiled');
            else w.touch(x, y);
          }
          break;
        case M.SEED: {
          const b = y + 1 < H ? mat[i + W] : M.STONE;
          if (b === M.TOPSOIL && moist[i + W] > 60 && w.skyExposed(x, y) && rng.chance(0.004) && seasonName(sim.tick) === 'spring') sim.setCell(i, M.PLANT, 1, 'germinated');
          break;
        }
        case M.CORPSE:
          if (++amt[i] > 16) { sim.setCell(i, M.ORGANIC, 40, 'decomposed'); for (const c of sim.colonies) if (c && w.owner[i] === c.slot + 1) c.corpsesInside = Math.max(0, c.corpsesInside - 1); }
          break;
        case M.WASTE:
          if (++amt[i] > 30) sim.setCell(i, M.ORGANIC, 40, 'decomposed');
          break;
        case M.ORGANIC:
          if (!w.skyExposed(x, y - 1) && moist[i] > 40 && rng.chance(0.004)) sim.setCell(i, M.TOPSOIL, 70, 'decomposed');
          else if (springtails < 40 && y > 0 && mat[i - W] === M.AIR && moist[i] > 30 && rng.chance(0.002)) { sim.critters.spawn(sim, 'springtail', x, y - 1); springtails++; }
          break;
      }
    }
  }
  sim.critters.preyContact(sim);
}

/** A local food pulse beneath existing vegetation, once per eligible weather day. */
export function canopyFall(sim: Sim) {
  if (!sim.settings.weather || !sim.rng.chance(0.45)) return;
  const w = sim.w, season = seasonName(sim.tick);
  if (season === 'winter') return;
  const food = season === 'autumn' ? M.SEED : M.PROTEIN;
  const start = sim.rng.int(w.W);
  for (let n = 0; n < w.W; n++) {
    const x = (start + n) % w.W, y = w.surface[x] - 1;
    if (y < 5 || y >= w.H - 1 || w.get(x, y) !== M.AIR || w.owner[y * w.W + x]) continue;
    if (![M.SOIL, M.TOPSOIL, M.ORGANIC].some(m => m === w.get(x, y + 1))) continue;
    let leafy = false;
    for (let h = 1; h <= Math.min(y, 24); h++) if (w.get(x, y - h) === M.PLANT) { leafy = true; break; }
    if (!leafy) continue;
    const units = 3 + sim.rng.int(5);
    sim.setCell(y * w.W + x, food, units, 'canopy fall');
    sim.event('ecology', food === M.SEED ? `A seed cluster fell beneath the canopy at x=${x}.` : `Insects fell from the canopy at x=${x}, leaving food for scavengers.`);
    return;
  }
}
