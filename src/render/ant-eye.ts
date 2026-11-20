import { FOOD_OF, IS_SOLID, M, MATERIALS } from '../sim/materials.ts';
import type { Renderer } from './renderer.ts';

/** Cast sight lines through the same cell map used by the cutaway and movement rules. */
export function drawAntEye(canvas: HTMLCanvasElement, r: Renderer, x: number, y: number, angle: number) {
  const ctx = canvas.getContext('2d')!;
  const width = canvas.width, height = canvas.height, horizon = height * .46;
  const underground = y >= r.surface[x];
  const light = ctx.createLinearGradient(0, 0, 0, height);
  light.addColorStop(0, underground ? '#201a17' : '#82b3c4');
  light.addColorStop(.47, underground ? '#493b2b' : '#d1d8ae');
  light.addColorStop(.48, underground ? '#34281e' : '#575c39');
  light.addColorStop(1, '#211c16');
  ctx.fillStyle = light; ctx.fillRect(0, 0, width, height);
  const depths: number[] = [];
  for (let px = 0; px < width; px += 2) {
    const offset = Math.atan((2 * px / width - 1) * .86);
    const dx = Math.cos(angle + offset), dy = Math.sin(angle + offset);
    let distance = .12;
    for (; distance < 25; distance += .15) {
      const xx = Math.floor(x + .5 + dx * distance), yy = Math.floor(y + .5 + dy * distance);
      if (xx < 0 || yy < 0 || xx >= r.W || yy >= r.H) break;
      const m = r.map[yy * r.W + xx];
      if (!IS_SOLID[m] && !FOOD_OF[m] && m !== M.PLANT && m !== M.WATER) continue;
      const depth = distance * Math.cos(offset), h = Math.min(height * 2, height / depth);
      const shade = (.86 + .1 * Math.sin(xx * 23 + yy * 7)) / (1 + depth * .065);
      ctx.fillStyle = 'rgb(' + MATERIALS[m].color.map(c => Math.round(c * shade)).join(',') + ')';
      ctx.fillRect(px, horizon - h * .5, 2, h);
      break;
    }
    depths[px >> 1] = distance;
  }
  const f = r.frame;
  const sprite = (xx: number, yy: number, color: string) => {
    const dx = xx - x, dy = yy - y, d = Math.hypot(dx, dy);
    const forward = dx * Math.cos(angle) + dy * Math.sin(angle);
    if (forward < .4 || d > 18) return;
    const px = width * (.5 + (-dx * Math.sin(angle) + dy * Math.cos(angle)) / (1.72 * forward));
    if (px < 0 || px >= width || depths[Math.floor(px / 2)] + .4 < d) return;
    const size = Math.min(28, height / (forward * 4));
    ctx.fillStyle = color;
    for (let n = -1; n <= 1; n++) { ctx.beginPath(); ctx.ellipse(px + n * size * .55, horizon + size * .4, size * .36, size * .25, 0, 0, Math.PI * 2); ctx.fill(); }
  };
  if (f) for (let i = 0; i < f.antCount; i++) sprite(f.ants[i*7], f.ants[i*7+1], '#31271f');
  ctx.strokeStyle = '#312920'; ctx.lineWidth = 3;
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(width * .5 + side * 22, height);
    ctx.quadraticCurveTo(width * .5 + side * 28, height * .79, width * .5 + side * 69, height * .72); ctx.stroke();
  }
}
