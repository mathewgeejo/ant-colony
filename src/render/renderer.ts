import type { FrameMsg, OverlayKind } from '../protocol.ts';
import { MATERIALS, M } from '../sim/materials.ts';
import { spriteFor, paintGrid, antColors, orientGrid } from './sprites.ts';
import type { RGB } from './sprites.ts';

const TILE = 3;
const marks: RGB[] = [[239, 181, 86], [116, 190, 211], [215, 128, 152], [165, 192, 109], [190, 160, 219]];
const hash = (x: number, y: number) => {
  let v = Math.imul(x + 19, 374761393) ^ Math.imul(y + 53, 668265263);
  v = Math.imul(v ^ (v >>> 13), 1274126177);
  return ((v ^ (v >>> 16)) >>> 0) / 4294967296;
};
export class Renderer {
  ctx: CanvasRenderingContext2D;
  terrain = document.createElement('canvas');
  terrainCtx = this.terrain.getContext('2d')!;
  field = document.createElement('canvas');
  fieldCtx = this.field.getContext('2d')!;
  map = new Uint8Array(0);
  W = 512; H = 256;
  surface: Int16Array = new Int16Array(0);
  frame: FrameMsg | null = null;
  colonies: any[] = [];
  species: any[] = [];
  route: number[] = [];
  zoom = 3; ox = 0; oy = 0;
  width = 0; height = 0;
  hover: { x: number; y: number } | null = null;
  brush = 3;
  editing = false;
  labels = true; patterns = false; lowDetail = false;
  renderMs = 0; fps = 60; droppedFrames = 0;
  overlay: OverlayKind = 'none';
  overlayData: Uint8Array | null = null;
  sprites = new Map<string, HTMLCanvasElement>();
  private prev = performance.now();
  private observer: ResizeObserver;
  constructor(public canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas.parentElement!);
    this.resize();
    requestAnimationFrame(this.draw);
  }
  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.width = r.width; this.height = r.height;
    const d = Math.min(2, devicePixelRatio);
    this.canvas.width = Math.round(r.width * d); this.canvas.height = Math.round(r.height * d);
  }
  reset(W: number, H: number) {
    this.W = W; this.H = H; this.map = new Uint8Array(W * H);
    this.terrain.width = W * TILE; this.terrain.height = H * TILE;
    this.terrainCtx.fillStyle = '#29251e'; this.terrainCtx.fillRect(0, 0, W * TILE, H * TILE);
    this.field.width = W; this.field.height = H;
    this.frame = null; this.route = []; this.surface = new Int16Array(W); this.sprites.clear(); this.fit();
  }
  fit() {
    // A phone shows a readable slice centred on the colony; wheel/buttons can reveal the full map.
    if (this.width < 600) {
      this.zoom = Math.max(3.5, this.height / this.H);
      const x = this.colonies.find(c=>c.alive)?.entrance.x ?? this.W*.45;
      this.ox = this.width/2 - x*this.zoom; this.oy = 0;
      return;
    }
    this.zoom = Math.max(1, Math.min(this.width / this.W, this.height / (this.H * .85)));
    this.ox = (this.width - this.W * this.zoom) / 2;
    this.oy = Math.max(0, (this.height - this.H * this.zoom) / 2);
  }
  focus(x: number, y: number) { this.zoom = Math.max(5, this.zoom); this.ox = this.width / 2 - x * this.zoom; this.oy = this.height / 2 - y * this.zoom; }
  world(x: number, y: number) { return { x: Math.floor((x - this.ox) / this.zoom), y: Math.floor((y - this.oy) / this.zoom) }; }
  zoomAt(f: number, x = this.width / 2, y = this.height / 2) {
    const wx = (x - this.ox) / this.zoom, wy = (y - this.oy) / this.zoom;
    this.zoom = Math.max(.7, Math.min(18, this.zoom * f));
    this.ox = x - wx * this.zoom; this.oy = y - wy * this.zoom;
  }
  accept(f: FrameMsg) {
    this.frame = f;
    if (f.surface) this.surface = f.surface;
    if (f.chunks) {
      const bytes = new Uint8Array(f.chunks), cw = Math.ceil(this.W / 16);
      let o = 0;
      for (let c = 0; c < f.chunkCount; c++) {
        const ci = bytes[o] | bytes[o + 1] << 8; o += 2;
        const cx = ci % cw * 16, cy = Math.floor(ci / cw) * 16;
        for (let dy = 0; dy < 16; dy++) for (let dx = 0; dx < 16; dx++) {
          const m = bytes[o++], q = bytes[o++], x = cx + dx, y = cy + dy;
          if (x >= this.W || y >= this.H) continue;
          this.map[y * this.W + x] = m;
          this.cell(x, y, m, q);
        }
      }
    }
    if (f.overlayKind !== this.overlay) { this.overlay = f.overlayKind; this.fieldCtx.clearRect(0, 0, this.W, this.H); }
    if (f.overlay) {
      this.overlayData = f.overlay;
      const img = this.fieldCtx.createImageData(this.W, this.H);
      for (let k = 0; k < f.overlay.length; k++) {
        const v = f.overlay[k]; if (!v) continue;
        let rgb = [85, 203, 221];
        if (this.overlay === 'temperature') rgb = [Math.min(255, v * 2), 160 - v / 3, Math.max(35, 255 - v)];
        else if (this.overlay === 'trail') rgb = [213, 186, 255];
        else if (this.overlay === 'alarm' || this.overlay === 'mortality' || this.overlay === 'toxin') rgb = [255, 110, 114];
        else if (this.overlay === 'food') rgb = v < 120 ? [255, 209, 94] : v < 180 ? [245, 137, 114] : [191, 214, 121];
        else if (this.overlay === 'territory') rgb = marks[(v - 1) % marks.length];
        const z = k * 4; img.data[z] = rgb[0]; img.data[z + 1] = rgb[1]; img.data[z + 2] = rgb[2];
        img.data[z + 3] = this.overlay === 'territory' || this.overlay === 'food' ? 140 : 30 + v * .65;
      }
      this.fieldCtx.putImageData(img, 0, 0);
    }
  }
  private cell(x: number, y: number, m: number, q: number) {
    const c = this.terrainCtx, X = x * TILE, Y = y * TILE;
    c.clearRect(X, Y, TILE, TILE);
    if (m === M.AIR) {
      if (y < this.surface[x]) return;
      c.fillStyle = (q & 64) ? '#30291f' : '#332c23'; c.fillRect(X, Y, TILE, TILE);
      return;
    }
    const def = MATERIALS[m]; if (!def) return;
    const h = hash(x, y), f = .94 + h * .12;
    const rgb = def.color.map(v => Math.round(v * f));
    c.fillStyle = `rgb(${rgb})`; c.fillRect(X, Y, TILE, TILE);
    if (m === M.PLANT) {
      c.clearRect(X, Y, TILE, TILE); c.fillStyle = q & 16 ? '#acc861' : '#70934e'; c.fillRect(X + 1, Y, 1, 3); c.fillRect(X + (h > .5 ? 2 : 0), Y, 1, 1);
    } else if (m === M.WATER) { c.fillStyle = '#83b9c8'; if (h > .6) c.fillRect(X, Y, 2, 1); }
    else {
      c.fillStyle = `rgba(${h > .5 ? '240,211,164,.16' : '18,17,16,.23'})`;
      c.fillRect(X + (h > .6 ? 1 : 0), Y + (h > .4 ? 1 : 2), m === M.STONE || m === M.CLAY ? 2 : 1, 1);
      if ((m === M.TOPSOIL || m === M.SOIL) && (q & 15) > 10) { c.fillStyle = '#272b291d'; c.fillRect(X, Y, 3, 3); }
    }
    if (q & 32) { c.fillStyle = '#c1cf5a'; c.fillRect(X, Y, 1, 1); }
  }
  private sprite(slot: number, caste: number, anim: number, orient: number) {
    const key = `${slot}/${caste}/${anim}/${orient}`;
    let s = this.sprites.get(key);
    if (!s) {
      const col = this.colonies.find(c => c.slot === slot);
      const sp = this.species.find(s => s.id === col?.speciesId);
      const v = sp?.visual ?? { body: [50, 38, 29], head: [34, 27, 23], gaster: [62, 45, 32], sprite: 'formicine' };
      const def = spriteFor(v.sprite, caste);
      const grid = orientGrid(def.wings ? [...def.wings,...def.frames[anim]] : def.frames[anim], orient);
      s = document.createElement('canvas'); s.width = Math.max(...grid.map(r => r.length)); s.height = grid.length;
      paintGrid(s.getContext('2d')!, grid, 0, 0, antColors({ ...v, marking: col?.marking ?? marks[slot % marks.length] }, caste));
      this.sprites.set(key, s);
    }
    return s;
  }
  private draw = (time: number) => {
    const start = performance.now(), dt = time - this.prev; this.prev = time;
    if (dt > 40) this.droppedFrames++;
    this.fps += .04 * (1000 / Math.max(1, dt) - this.fps);
    const c = this.ctx, dpr = this.canvas.width / Math.max(1, this.width);
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.imageSmoothingEnabled = false;
    c.fillStyle = '#b8c9be'; c.fillRect(0, 0, this.width, this.height);
    c.save(); c.translate(Math.round(this.ox), Math.round(this.oy)); c.scale(this.zoom, this.zoom);
    // Pixel clouds are scenery. All plants, water, ants and underground material come from the simulation.
    c.fillStyle = '#d4ded0';
    for (let k = 0; k < 8; k++) { const x = k * 73 + 9, y = 8 + hash(k, 1) * 20; c.fillRect(x, y, 20, 3); c.fillRect(x + 4, y - 3, 12, 3); }
    c.fillStyle = '#a1b99d';
    for (let k = 0; k < 24; k++) { const x = k * 24; const sy = this.surface[Math.min(this.W - 1, x)] || 60; c.fillRect(x, sy - 2 - hash(k, 3) * 6, 25, 8); }
    c.drawImage(this.terrain, 0, 0, this.W, this.H);
    // Living surface fringe follows the real terrain boundary.
    for (let x = 0; x < this.W; x++) {
      const y = this.surface[x], m = this.map[y * this.W + x];
      if (m === M.TOPSOIL || m === M.SOIL) { c.fillStyle = hash(x, 4) > .5 ? '#7e9954' : '#647f43'; c.fillRect(x, y, 1, 1); if (hash(x, 6) > .76) c.fillRect(x, y - 2, .5, 2); }
    }
    if (this.overlay !== 'none') c.drawImage(this.field, 0, 0);
    if (this.patterns && this.overlay !== 'none') {
      c.fillStyle = '#fff8'; const f = this.overlayData;
      if (f) for (let y = 0; y < this.H; y += 4) for (let x = 0; x < this.W; x += 4) if (f[y * this.W + x] > 80) c.fillRect(x, y, 1, 1);
    }
    const f = this.frame;
    if (f) {
      for (let k = 0; k < f.broodCount; k++) {
        const o = k * 4, x = f.brood[o], y = f.brood[o + 1], stage = f.brood[o + 2] & 3;
        c.fillStyle = stage === 0 ? '#f4ead0' : stage === 1 ? '#e5d39e' : '#c9af78';
        c.fillRect(x - .35, y - .25, stage === 0 ? .65 : 1, .5); if (stage === 1) c.fillRect(x, y - .5, .4, .3);
      }
      for (let k = 0; k < f.antCount; k++) {
        const o = k * 7, x = f.ants[o], y = f.ants[o + 1];
        const sx = this.ox + x * this.zoom, sy = this.oy + y * this.zoom;
        if (sx < -20 || sx > this.width + 20 || sy < -20 || sy > this.height + 20) continue;
        const bits = f.ants[o + 4] & 65535, slot = bits & 255, caste = bits >> 8 & 3, carry = bits >> 10 & 7, effects = f.ants[o + 5];
        const dx = x - f.ants[o + 2], dy = y - f.ants[o + 3];
        const orient = Math.abs(dy) > Math.abs(dx) ? dy < 0 ? 4 : 6 : dx < 0 ? 1 : 0;
        if (effects & 256) { c.fillStyle = '#a6f5db55'; c.fillRect(x - 2, y - 2, 4, 4); }
        if (this.lowDetail && caste === 0) { c.fillStyle = '#1f1c17'; c.fillRect(x, y, 1, .5); }
        else {
          const spr = this.sprite(slot, caste, effects & 1, orient);
          const scale = caste === 1 ? .42 : .32;
          c.drawImage(spr, x + .5 - spr.width * scale / 2, y + .5 - spr.height * scale / 2, spr.width * scale, spr.height * scale);
        }
        if (effects & 512) { c.fillStyle = '#c0c4bd'; c.fillRect(x - .5, y - .8, 1, .5); }
        if (effects & 1024) { c.strokeStyle = '#9ed5df'; c.lineWidth = .2; c.strokeRect(x - 1, y - 1, 2, 2); }
        if (effects & 2048) { c.fillStyle = '#edaa66'; c.fillRect(x, y - .6, .6, .5); }
        if (carry) { c.fillStyle = ['','#f5cc6b','#ce8d76','#bba65c','#9d7950','#aaa28b','#f2e5b6'][carry]; c.fillRect(x + .8, y - .8, .7, .7); }
        if (bits & 8192) { c.fillStyle = '#f2aa76'; c.fillRect(x - 1, y - 1, .5, .5); }
        if (bits & 16384) { c.fillStyle = '#b99867'; c.fillRect(x + 1, y + .5, .5, .5); }
        if (f.selected === k) { c.strokeStyle = '#f6e4a2'; c.lineWidth = 1 / this.zoom; c.strokeRect(x - 2.5, y - 2, 5, 4); }
      }
      for (let k = 0; k < f.critterCount; k++) {
        const o = k * 5, x = f.critters[o], y = f.critters[o + 1]; c.fillStyle = f.critters[o + 4] & 1 ? '#563d33' : '#dfcdb0'; c.fillRect(x - 1, y - .5, 2, 1);
        if (f.critters[o + 4] & 1) for (let i = -1; i < 2; i++) { c.fillRect(x + i, y - 1.5, .3, 3); }
      }
      if (f.raining) { c.fillStyle = '#e2edf199'; for (let k = 0; k < 60; k++) { const x = hash(k, 12) * this.W, y = (hash(k, 15) * 50 + time / 60) % 60; c.fillRect(x, y, .4, 2); } }
    }
    if (this.route.length) { c.strokeStyle = '#f5d28188'; c.lineWidth = .5; c.setLineDash([1, 1]); c.beginPath(); for (let k = 0; k < this.route.length; k += 2) k ? c.lineTo(this.route[k], this.route[k + 1]) : c.moveTo(this.route[k], this.route[k + 1]); c.stroke(); c.setLineDash([]); }
    if (this.hover && this.editing) { c.strokeStyle = '#fff4d7'; c.lineWidth = 1 / this.zoom; c.strokeRect(this.hover.x - this.brush, this.hover.y - this.brush, this.brush * 2 + 1, this.brush * 2 + 1); }
    c.restore();
    if (this.labels) for (const col of this.colonies) {
      if (!col.alive) continue;
      const x = Math.round(this.ox + col.entrance.x * this.zoom), y = Math.round(this.oy + col.entrance.y * this.zoom);
      c.fillStyle = `rgb(${col.marking})`; c.fillRect(x, y - 23, 2, 18); c.fillRect(x + 2, y - 23, 8, 6);
      c.font = '11px "Atkinson Hyperlegible", sans-serif'; const text = `${col.name} · ${col.workers}`;
      const w = c.measureText(text).width; c.fillStyle = '#27382eea'; c.fillRect(x - w / 2 - 7, y - 43, w + 14, 17); c.fillStyle = '#eee9d7'; c.fillText(text, x - w / 2, y - 31);
    }
    this.renderMs += .1 * (performance.now() - start - this.renderMs);
    requestAnimationFrame(this.draw);
  };
}
