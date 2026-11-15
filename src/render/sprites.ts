// Hand-authored pixel sprites (no generated images). Each sprite is a grid of
// palette indices; atlases are baked per colony palette and orientation.
//  .=transparent 1=outline/legs 2=thorax 3=head 4=gaster 5=highlight 6=colony marking 7=eye 8=wing 9=wing edge

export type Grid = string[];

const W_FORMICINE_A: Grid = [
  '......1.',
  '.44..331',
  '4541237.',
  '464.22..',
  '.1.1.1..',
];
const W_FORMICINE_B: Grid = [
  '......1.',
  '.44..331',
  '4541237.',
  '464.22..',
  '1.1.1...',
];
const W_MYRMICINE_A: Grid = [
  '.......1.',
  '.44...331',
  '45411237.',
  '464..231.',
  '.1.1.1...',
];
const W_MYRMICINE_B: Grid = [
  '.......1.',
  '.44...331',
  '45411237.',
  '464..231.',
  '1.1.1....',
];
const Q_FORMICINE_A: Grid = [
  '.........1.',
  '.444..2.331',
  '45444122337',
  '44644.223..',
  '.444.......',
  '..1..1.1...',
];
const Q_FORMICINE_B: Grid = [
  '.........1.',
  '.444..2.331',
  '45444122337',
  '44644.223..',
  '.444.......',
  '.1..1.1....',
];
const Q_MYRMICINE_A: Grid = [
  '..........1.',
  '.444...2.331',
  '454441122337',
  '44644..22331',
  '.444........',
  '..1..1..1...',
];
const Q_MYRMICINE_B: Grid = [
  '..........1.',
  '.444...2.331',
  '454441122337',
  '44644..22331',
  '.444........',
  '.1..1..1....',
];
// winged reproductives: wings above the body
const WINGS_Q: Grid = [
  '.9888889...',
  '988888889..',
];
const MALE_A: Grid = [
  '.98888891.',
  '9888888831',
  '.44.12237.',
  '464..22...',
  '.1.1.1....',
];
const MALE_B: Grid = [
  '.98888891.',
  '9888888831',
  '.44.12237.',
  '464..22...',
  '1.1.1.....',
];

// major worker (soldier): longer body and an oversized, square head with heavy mandibles
const W_MAJOR_A: Grid = [
  '........1..',
  '.44...3333.',
  '45411233337',
  '464..233331',
  '.1.1.1.....',
];
const W_MAJOR_B: Grid = [
  '........1..',
  '.44...3333.',
  '45411233337',
  '464..233331',
  '1.1.1......',
];

export interface SpriteSet { frames: Grid[]; wings?: Grid }

export function spriteFor(kind: 'formicine' | 'myrmicine', caste: number, major = false): SpriteSet {
  // caste: 0 worker, 1 queen, 2 male, 3 gyne
  if (caste === 0 && major) return { frames: [W_MAJOR_A, W_MAJOR_B] };
  if (caste === 2) return { frames: [MALE_A, MALE_B] };
  if (caste === 1 || caste === 3) {
    const f = kind === 'myrmicine' ? [Q_MYRMICINE_A, Q_MYRMICINE_B] : [Q_FORMICINE_A, Q_FORMICINE_B];
    return { frames: f, wings: caste === 3 ? WINGS_Q : undefined };
  }
  return { frames: kind === 'myrmicine' ? [W_MYRMICINE_A, W_MYRMICINE_B] : [W_FORMICINE_A, W_FORMICINE_B] };
}

export const BROOD_SPRITES: Record<string, Grid> = {
  egg: ['ee'],
  larva: ['.ll', 'lll'],
  cocoon: ['.cc.', 'cccc', '.cc.'],
  pupa: ['.pp', 'ppp', 'p.p'],
};

export const CRITTER_SPRITES: Record<string, Grid[]> = {
  springtail: [['.s.', 'sss', 's.s'], ['.s.', 'sss', '.s.']],
  spider: [
    ['1.1...1.1', '.1.111.1.', '..14441..', '.1.444.1.', '1..1.1..1'],
    ['.1.1.1.1.', '1..111..1', '..14441..', '1..444..1', '.1.1.1.1.'],
  ],
};

export type RGB = [number, number, number];

export function shade(c: RGB, f: number): RGB {
  return [Math.max(0, Math.min(255, Math.round(c[0] * f))), Math.max(0, Math.min(255, Math.round(c[1] * f))), Math.max(0, Math.min(255, Math.round(c[2] * f)))];
}

export interface AntPalette { body: RGB; head: RGB; gaster: RGB; marking: RGB }

/** Draw a grid into a canvas context at (ox, oy), one cell per pixel. */
export function paintGrid(ctx: CanvasRenderingContext2D, g: Grid, ox: number, oy: number, pal: Record<string, RGB | null>) {
  for (let y = 0; y < g.length; y++)
    for (let x = 0; x < g[y].length; x++) {
      const ch = g[y][x];
      const c = pal[ch];
      if (!c) continue;
      ctx.fillStyle = ch === '8' ? `rgba(${c[0]},${c[1]},${c[2]},0.55)` : `rgb(${c[0]},${c[1]},${c[2]})`;
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
}

export function antColors(p: AntPalette, caste: number): Record<string, RGB | null> {
  const outline = shade(p.body, 0.55);
  return {
    '.': null, '1': outline, '2': p.body, '3': p.head, '4': p.gaster, '5': shade(p.gaster, 1.9),
    '6': p.marking, '7': caste === 2 ? [230, 230, 210] : [200, 190, 160], '8': [225, 235, 245], '9': [160, 175, 195],
  };
}

/** Orientation codes for baked atlases. */
export const ORIENT = { FLOOR_R: 0, FLOOR_L: 1, CEIL_R: 2, CEIL_L: 3, UP_LW: 4, UP_RW: 5, DOWN_LW: 6, DOWN_RW: 7 } as const;

/** Transform a grid for an orientation (rotations keep pixels integer-aligned). */
export function orientGrid(g: Grid, o: number): Grid {
  const h = g.length, w = Math.max(...g.map((r) => r.length));
  const at = (x: number, y: number) => (g[y] && g[y][x]) || '.';
  const make = (W: number, H: number, f: (x: number, y: number) => string) => Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => f(x, y)).join(''));
  switch (o) {
    case ORIENT.FLOOR_R: return make(w, h, (x, y) => at(x, y));
    case ORIENT.FLOOR_L: return make(w, h, (x, y) => at(w - 1 - x, y));
    case ORIENT.CEIL_R: return make(w, h, (x, y) => at(x, h - 1 - y));
    case ORIENT.CEIL_L: return make(w, h, (x, y) => at(w - 1 - x, h - 1 - y));
    // rotate so the head points up; legs (bottom row) face the wall
    case ORIENT.UP_LW: return make(h, w, (x, y) => at(w - 1 - y, x)); // legs on the left
    case ORIENT.UP_RW: return make(h, w, (x, y) => at(w - 1 - y, h - 1 - x));
    case ORIENT.DOWN_LW: return make(h, w, (x, y) => at(y, x));
    case ORIENT.DOWN_RW: return make(h, w, (x, y) => at(y, h - 1 - x));
  }
  return g;
}
