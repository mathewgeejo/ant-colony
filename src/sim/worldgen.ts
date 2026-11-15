// WorldBox-style procedural worlds: a seeded strip of biomes (meadow, woodland, steppe, wetland,
// rocky hills, dunes) with renewable food (plants, aphids, insect fall, seeds) and water (ponds, rain),
// laid out so that one or more colonies can persist without player intervention.
import { M, MATERIALS } from './materials.ts';
import { Rng } from './rng.ts';
import type { Sim } from './sim.ts';

export interface BiomeDef {
  name: string;
  /** plant density multiplier */
  plants: number;
  /** ground offset in cells (positive = lower ground, negative = raised) */
  lift: number;
  /** pond in the middle of the biome */
  pond: boolean;
  logs: number;
  sand: number;
  stone: number;
  /** how good a nest site it is (0..1) */
  habitable: number;
  /** species best suited to it */
  species: string;
}

export const BIOMES: Record<string, BiomeDef> = {
  meadow: { name: 'Meadow', plants: 1.2, lift: 0, pond: false, logs: 0.3, sand: 0, stone: 0, habitable: 1, species: 'lasius-niger' },
  forest: { name: 'Woodland', plants: 1.7, lift: -2, pond: false, logs: 1.5, sand: 0, stone: 0, habitable: 0.9, species: 'lasius-niger' },
  steppe: { name: 'Dry steppe', plants: 0.6, lift: 1, pond: false, logs: 0, sand: 0.35, stone: 0.15, habitable: 0.85, species: 'pogonomyrmex-californicus' },
  wetland: { name: 'Wetland', plants: 1.4, lift: 4, pond: true, logs: 0.4, sand: 0, stone: 0, habitable: 0.35, species: 'pheidole-pallidula' },
  hills: { name: 'Rocky hills', plants: 0.9, lift: -9, pond: false, logs: 0, sand: 0, stone: 0.6, habitable: 0.75, species: 'pheidole-pallidula' },
  dunes: { name: 'Sand dunes', plants: 0.45, lift: -3, pond: false, logs: 0, sand: 1, stone: 0, habitable: 0.5, species: 'pogonomyrmex-californicus' },
};

export interface WorldOptions {
  /** number of colonies to start with (1..8) */
  colonies?: number;
}

export interface Region { biome: string; name: string; x0: number; x1: number }

export interface WorldPlan {
  regions: Region[];
  lift: Float32Array;
  plantMul: Float32Array;
  pondAt: number[];
  climate: { meanTemp: number; rainChancePerDay: number; baseHumidity: number };
}

const PREFIX = ['Amber', 'Thistle', 'Moss', 'Ash', 'Clover', 'Bramble', 'Fern', 'Flint', 'Willow', 'Dusk', 'Hollow', 'Sorrel', 'Sedge', 'Briar', 'Copper', 'Rush'];
const SUFFIX: Record<string, string[]> = {
  meadow: ['field', 'lea', 'meadow', 'green'], forest: ['wood', 'shade', 'grove', 'weald'], steppe: ['reach', 'flats', 'plain', 'barrens'],
  wetland: ['fen', 'marsh', 'mere', 'bog'], hills: ['crag', 'tor', 'ridge', 'heights'], dunes: ['dunes', 'sands', 'drift', 'waste'],
};

/** Choose the biome layout and the per-column terrain modifiers. Pure function of seed and size. */
export function planWorld(seed: number, W: number): WorldPlan {
  const rng = new Rng(seed ^ 0xb10be5);
  const ids = Object.keys(BIOMES);
  const regions: Region[] = [];
  let x = 0, prev = '';
  while (x < W) {
    let width = 110 + rng.int(110);
    if (W - (x + width) < 90) width = W - x;
    let id = ids[rng.int(ids.length)];
    // never two of the same in a row; a strip never starts or ends in a wetland (ponds need room)
    for (let k = 0; k < 8 && (id === prev || (id === 'wetland' && (x === 0 || x + width >= W))); k++) id = ids[rng.int(ids.length)];
    regions.push({ biome: id, name: PREFIX[rng.int(PREFIX.length)] + SUFFIX[id][rng.int(4)], x0: x, x1: x + width });
    prev = id; x += width;
  }
  // at least one comfortable home in every world
  if (!regions.some((r) => BIOMES[r.biome].habitable >= 0.85)) regions[rng.int(regions.length)].biome = 'meadow';
  const lift = new Float32Array(W), plantMul = new Float32Array(W);
  const blend = 20;
  for (let cx = 0; cx < W; cx++) {
    let l = 0, p = 0, wsum = 0;
    for (const r of regions) {
      // smooth weight: 1 inside, falling off across the boundary
      const d = cx < r.x0 ? r.x0 - cx : cx >= r.x1 ? cx - r.x1 + 1 : 0;
      const wgt = d >= blend ? 0 : 1 - d / blend;
      if (!wgt) continue;
      l += BIOMES[r.biome].lift * wgt; p += BIOMES[r.biome].plants * wgt; wsum += wgt;
    }
    lift[cx] = l / wsum; plantMul[cx] = p / wsum;
  }
  const pondAt = regions.filter((r) => BIOMES[r.biome].pond).map((r) => Math.max(32, Math.min(W - 32, Math.round((r.x0 + r.x1) / 2))));
  const dry = regions.filter((r) => r.biome === 'steppe' || r.biome === 'dunes').length / regions.length;
  const climate = { meanTemp: Math.round(20 + rng.next() * 4 + dry * 2), rainChancePerDay: 0.3 + rng.next() * 0.15 - dry * 0.1, baseHumidity: 0.6 + rng.next() * 0.1 - dry * 0.1 };
  return { regions, lift, plantMul, pondAt, climate };
}

/** Biome-specific surface details applied after the base terrain exists. */
export function decorateWorld(sim: Sim, seed: number, plan: WorldPlan) {
  const w = sim.w, { W, H } = w;
  const rng = new Rng(seed ^ 0xdec0);
  const set = (k: number, m: number) => { w.mat[k] = m; w.amt[k] = MATERIALS[m].nutrient; };
  for (const r of plan.regions) {
    const b = BIOMES[r.biome];
    for (let x = r.x0; x < r.x1; x++) {
      const s = w.surface[x];
      if (s <= 2 || s >= H - 4) continue;
      // sandy topsoil (dunes fully, steppe in patches); plants on it die back naturally
      if (b.sand > 0 && rng.next() < b.sand) {
        const depth = r.biome === 'dunes' ? 3 + rng.int(3) : 1 + rng.int(2);
        for (let d = 0; d < depth; d++) { const k = (s + d) * W + x; if (w.mat[k] === M.TOPSOIL || w.mat[k] === M.SOIL) set(k, M.SAND); }
      }
      // rock outcrops a few cells down: nests must route around them
      if (b.stone > 0 && rng.next() < b.stone * 0.08) {
        const cy = s + 4 + rng.int(10), rx = 2 + rng.int(4), ry = 1 + rng.int(3);
        for (let y = cy - ry; y <= cy + ry; y++) for (let xx = x - rx; xx <= x + rx; xx++) {
          if (xx < 0 || xx >= W || y >= H) continue;
          const k = y * W + xx;
          if ((w.mat[k] === M.SOIL || w.mat[k] === M.TOPSOIL) && ((xx - x) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) set(k, M.STONE);
        }
      }
      // fallen wood and leaf litter in woodland
      if (b.logs > 0 && rng.next() < b.logs * 0.012 && x + 12 < r.x1) {
        const len = 6 + rng.int(8);
        let top = H; for (let xx = x; xx < x + len; xx++) top = Math.min(top, w.surface[xx]);
        const hgt = 1 + rng.int(2);
        for (let xx = x; xx < x + len; xx++) for (let y = top - hgt; y < w.surface[xx]; y++) if (y > 0 && w.mat[y * W + xx] === M.AIR) set(y * W + xx, M.WOOD);
        x += len;
      } else if (r.biome === 'forest' && rng.next() < 0.15 && w.mat[(s - 1) * W + x] === M.AIR && w.mat[s * W + x] === M.TOPSOIL) {
        const k = (s - 1) * W + x; w.mat[k] = M.ORGANIC; w.amt[k] = 120; w.moist[k] = 100;
      }
    }
  }
  w.recomputeAllSurface();
  sim.scenarioInfo.notes = plan.regions.map((r) => ({ x: Math.round((r.x0 + r.x1) / 2), y: Math.max(4, Math.min(...Array.from({ length: Math.max(1, r.x1 - r.x0) }, (_, k) => w.surface[r.x0 + k] ?? H)) - 14), text: `${r.name} · ${BIOMES[r.biome].name}` }));
}

/** Choose nest sites for n starting colonies: the most habitable regions, spread across the map. */
export function colonySites(sim: Sim, plan: WorldPlan, n: number): { x: number; species: string }[] {
  const W = sim.w.W;
  const scored = plan.regions.map((r) => ({ r, s: BIOMES[r.biome].habitable * Math.min(1, (r.x1 - r.x0) / 120) })).sort((a, b) => b.s - a.s);
  const sites: { x: number; species: string }[] = [];
  const minGap = Math.max(60, Math.round(W / (n + 1) * 0.7));
  const ok = (x: number) => x > 24 && x < W - 24 && sites.every((s) => Math.abs(s.x - x) >= minGap) && sim.w.mat[sim.w.surface[x] * W + x] !== M.WATER && !plan.pondAt.some((p) => Math.abs(p - x) < 34);
  for (const { r } of scored) {
    if (sites.length >= n) break;
    for (const f of [0.5, 0.3, 0.7]) { const x = Math.round(r.x0 + (r.x1 - r.x0) * f); if (ok(x)) { sites.push({ x, species: BIOMES[r.biome].species }); break; } }
  }
  // more colonies than good regions: fill evenly spaced gaps
  for (let k = 0; sites.length < n && k < n * 6; k++) {
    const x = Math.round(((k % (n * 2)) + 0.5) / (n * 2) * W);
    const r = plan.regions.find((q) => x >= q.x0 && x < q.x1)!;
    if (ok(x)) sites.push({ x, species: BIOMES[r.biome].species });
  }
  return sites.sort((a, b) => a.x - b.x);
}
