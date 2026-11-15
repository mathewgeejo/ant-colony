import type { FrameMsg, OverlayKind } from '../protocol.ts';
import { IS_SOLID, M, MATERIALS } from '../sim/materials.ts';
import { TerrainRaster, TILE, terrainHash as hash } from './terrain.ts';
import { AgentRaster } from './agents.ts';
import type { RGB } from './sprites.ts';

const GROUND = Uint8Array.from(MATERIALS, m => m.state === 'solid' && m.category === 'terrain' ? 1 : 0);
const marks: RGB[] = [[239, 181, 86], [116, 190, 211], [215, 128, 152], [165, 192, 109], [190, 160, 219]];
export class Renderer {
  ctx: CanvasRenderingContext2D;
  terrain = document.createElement('canvas');
  terrainCtx = this.terrain.getContext('2d')!;
  field = document.createElement('canvas');
  fieldCtx = this.field.getContext('2d')!;
  map = new Uint16Array(0);
  tint=new Uint32Array(0);private cellDetails=new Uint8Array(0);
  W = 512; H = 256;
  surface: Int16Array = new Int16Array(0);
  private ground: Int16Array = new Int16Array(0);
  private anchored = new Uint8Array(0); private fillQueue = new Int32Array(0);
  frame: FrameMsg | null = null;
  colonies: any[] = [];
  species: any[] = [];
  notes:{x:number;y:number;text:string}[]=[];
  route: number[] = [];
  zoom = 3; ox = 0; oy = 0;
  width = 0; height = 0;
  hover: { x: number; y: number } | null = null;
  brush = 3;
  preview:{x:number;y:number;x2:number;y2:number;kind:string}|null=null;
  editing = false;
  labels = true; patterns = false; lowDetail = false;
  cutaway=true;
  renderMs = 0; fps = 60; droppedFrames = 0;
  updateMs = 0;
  private raster: TerrainRaster | null = null;
  private terrainImage: ImageData | null = null;
  overlay: OverlayKind = 'none';
  overlayData: Uint8Array | null = null;
  private agentCanvas=document.createElement('canvas');
  private agentCtx=this.agentCanvas.getContext('2d')!;
  private agents:AgentRaster|null=null;
  private agentImage:ImageData|null=null;
  private lastAgentFrame=-1;
  private lastLowDetail=false;
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
    this.W = W; this.H = H; this.map = new Uint16Array(W * H);
    this.tint=new Uint32Array(W*H);this.cellDetails=new Uint8Array(W*H);
    this.terrain.width = W * TILE; this.terrain.height = H * TILE;
    this.raster = new TerrainRaster(W,H);
    this.terrainImage = new ImageData(this.raster.data,W*TILE,H*TILE);
    this.terrainCtx.fillStyle = '#29251e'; this.terrainCtx.fillRect(0, 0, W * TILE, H * TILE);
    this.field.width = W; this.field.height = H;
    this.agents=new AgentRaster(W,H);this.agentImage=new ImageData(this.agents.data,W*3,H*3);
    this.agentCanvas.width=W*3;this.agentCanvas.height=H*3;this.lastAgentFrame=-1;
    this.frame = null; this.route = []; this.surface = new Int16Array(W); this.ground = new Int16Array(W).fill(H);
    this.anchored = new Uint8Array(W * H); this.fillQueue = new Int32Array(W * H); this.fit();
  }
  /**
   * Ground line per column for the cutaway backdrop: the top of solid material connected to the world floor.
   * Blocks dropped into the sky, falling grains and floating debris are not connected, so the air beneath
   * them stays open sky instead of being painted as an underground cavity.
   */
  private computeGround(out: Int16Array) {
    const { W, H, map } = this, seen = this.anchored, q = this.fillQueue;
    seen.fill(0); out.fill(H);
    let n = 0;
    for (let x = 0, k = (H - 1) * W; x < W; x++, k++) if (IS_SOLID[map[k]] || GROUND[map[k]]) { seen[k] = 1; q[n++] = k; }
    for (let h = 0; h < n; h++) {
      const k = q[h], x = k % W, y = (k - x) / W;
      if (y < out[x]) out[x] = y;
      if (x > 0 && !seen[k - 1] && (IS_SOLID[map[k - 1]] || GROUND[map[k - 1]])) { seen[k - 1] = 1; q[n++] = k - 1; }
      if (x < W - 1 && !seen[k + 1] && (IS_SOLID[map[k + 1]] || GROUND[map[k + 1]])) { seen[k + 1] = 1; q[n++] = k + 1; }
      if (y > 0 && !seen[k - W] && (IS_SOLID[map[k - W]] || GROUND[map[k - W]])) { seen[k - W] = 1; q[n++] = k - W; }
      if (y < H - 1 && !seen[k + W] && (IS_SOLID[map[k + W]] || GROUND[map[k + W]])) { seen[k + W] = 1; q[n++] = k + W; }
    }
  }
  fit() {
    if(!this.cutaway){
      let x0=this.W,y0=this.H,x1=-1,y1=-1;
      for(let y=0;y<this.H;y++)for(let x=0;x<this.W;x++)if(this.map[y*this.W+x]!==M.AIR){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
      if(x1>=0){this.zoom=Math.min(8,this.width/(x1-x0+20),this.height/(y1-y0+20));this.ox=this.width/2-(x0+x1+1)/2*this.zoom;this.oy=this.height/2-(y0+y1+1)/2*this.zoom;return;}
    }
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
  get minZoom() { return Math.max(.5, Math.min(this.width / this.W, this.height / this.H) * .9); }
  zoomAt(f: number, x = this.width / 2, y = this.height / 2) {
    const wx = (x - this.ox) / this.zoom, wy = (y - this.oy) / this.zoom;
    this.zoom = Math.max(this.minZoom, Math.min(24, this.zoom * f));
    this.ox = x - wx * this.zoom; this.oy = y - wy * this.zoom;
  }
  /** Keeps the world on screen: centred when smaller than the view, otherwise edges stop a short margin inside. */
  clamp() {
    const pad = Math.min(96, this.width * .15), padY = Math.min(96, this.height * .15);
    const ww = this.W * this.zoom, wh = this.H * this.zoom;
    this.ox = ww + pad * 2 <= this.width ? (this.width - ww) / 2 : Math.min(pad, Math.max(this.width - ww - pad, this.ox));
    this.oy = wh + padY * 2 <= this.height ? (this.height - wh) / 2 : Math.min(padY, Math.max(this.height - wh - padY, this.oy));
  }
  showMinimap = true;
  get minimapRect() {
    const w = this.width < 600 ? 112 : 176, h = Math.max(24, Math.round(w * this.H / this.W));
    return { x: this.width - w - 12, y: this.height - h - (this.width < 600 ? 92 : 98), w, h };
  }
  minimapAt(x: number, y: number) { if (!this.showMinimap) return false; const m = this.minimapRect; return x >= m.x - 3 && x <= m.x + m.w + 3 && y >= m.y - 3 && y <= m.y + m.h + 3; }
  centerFromMinimap(x: number, y: number) {
    const m = this.minimapRect, wx = (x - m.x) / m.w * this.W, wy = (y - m.y) / m.h * this.H;
    this.ox = this.width / 2 - wx * this.zoom; this.oy = this.height / 2 - wy * this.zoom;
  }
  accept(f: FrameMsg) {
    const start=performance.now();
    this.frame = f;
    if (f.surface) this.surface = f.surface;
    if(f.tints)for(let o=0;o<f.tints.length;o+=2)this.tint[f.tints[o]]=f.tints[o+1];
    let minX=this.W,minY=this.H,maxX=-1,maxY=-1;
    // excavated nest cells (detail bit 64) always read as tunnel, even where a shaft opens to the sky
    const draw=(x:number,y:number)=>{const k=y*this.W+x,m=this.map[k],q=this.cellDetails[k];if(this.raster!.cell(x,y,m,q,this.cutaway?(m===M.AIR&&q&64?0:this.ground[x]):this.H,this.tint[k])){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}};
    if (f.chunks) {
      const bytes = new Uint8Array(f.chunks), cw = Math.ceil(this.W / 16), cells:number[] = [];
      let o = 0, solidity = false;
      for (let c = 0; c < f.chunkCount; c++) {
        const ci = bytes[o] | bytes[o + 1] << 8; o += 2;
        const cx = ci % cw * 16, cy = Math.floor(ci / cw) * 16;
        for (let dy = 0; dy < 16; dy++) for (let dx = 0; dx < 16; dx++) {
          const m = bytes[o++] | bytes[o++] << 8, q = bytes[o++], x = cx + dx, y = cy + dy;
          if (x >= this.W || y >= this.H) continue;
          const prev = this.map[y * this.W + x];
          if (prev !== m && (IS_SOLID[prev] || GROUND[prev]) !== (IS_SOLID[m] || GROUND[m])) solidity = true;
          this.map[y * this.W + x] = m;
          this.cellDetails[y*this.W+x]=q;
          cells.push(x, y);
        }
      }
      // Tunnel backdrop only exists beneath real, anchored ground, so grains, drops and blocks in the sky never darken the air below them.
      const next = new Int16Array(this.W);
      if (solidity) this.computeGround(next); else next.set(this.ground);
      for (let x = 0; x < this.W; x++) {
        const old = this.ground[x], y = next[x]; if (old === y) continue;
        this.ground[x] = y; for (let yy = Math.min(old, y); yy < Math.max(old, y) && yy < this.H; yy++) draw(x, yy);
      }
      for (let k = 0; k < cells.length; k += 2) draw(cells[k], cells[k + 1]);
    }
    if(f.tints)for(let o=0;o<f.tints.length;o+=2){const k=f.tints[o];draw(k%this.W,(k/this.W)|0);}
    if(maxX>=0)this.terrainCtx.putImageData(this.terrainImage!,0,0,minX*TILE,minY*TILE,(maxX-minX+1)*TILE,(maxY-minY+1)*TILE);
    if (f.overlayKind !== this.overlay) { this.overlay = f.overlayKind; this.fieldCtx.clearRect(0, 0, this.W, this.H); }
    if (f.overlay) {
      this.overlayData = f.overlay;
      const img = this.fieldCtx.createImageData(this.W, this.H);
      for (let k = 0; k < f.overlay.length; k++) {
        const v = f.overlay[k]; if (!v) continue;
        let rgb = [85, 203, 221];
        if (this.overlay === 'temperature') rgb = [Math.min(255, v * 2), 160 - v / 3, Math.max(35, 255 - v)];
        else if (this.overlay === 'trail') rgb = [213, 186, 255];
        else if(this.overlay==='charge')rgb=[255,223,98];
        else if(this.overlay==='dose')rgb=[194,230,103];
        else if (this.overlay === 'alarm' || this.overlay === 'mortality' || this.overlay === 'toxin') rgb = [255, 110, 114];
        else if (this.overlay === 'food') rgb = v < 120 ? [255, 209, 94] : v < 180 ? [245, 137, 114] : [191, 214, 121];
        else if (this.overlay === 'territory') rgb = marks[(v - 1) % marks.length];
        const z = k * 4; img.data[z] = rgb[0]; img.data[z + 1] = rgb[1]; img.data[z + 2] = rgb[2];
        img.data[z + 3] = this.overlay === 'territory' || this.overlay === 'food' ? 140 : 30 + v * .65;
      }
      this.fieldCtx.putImageData(img, 0, 0);
    }
    this.updateMs+=.1*(performance.now()-start-this.updateMs);
  }
  private draw = (time: number) => {
    const start = performance.now(), dt = time - this.prev; this.prev = time;
    if (dt > 40) this.droppedFrames++;
    this.fps += .04 * (1000 / Math.max(1, dt) - this.fps);
    const c = this.ctx, dpr = this.canvas.width / Math.max(1, this.width);
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.imageSmoothingEnabled = false;
    this.clamp();
    c.fillStyle = '#17120d'; c.fillRect(0, 0, this.width, this.height);
    c.fillStyle = '#241c14'; for (let y = 0; y < this.height; y += 8) for (let x = (y / 8 & 1) * 8; x < this.width; x += 16) c.fillRect(x, y, 2, 2);
    const sx = Math.round(this.ox), sy = Math.round(this.oy), sw = Math.round(this.W * this.zoom), sh = Math.round(this.H * this.zoom);
    c.fillStyle = '#0b0806'; c.fillRect(sx - 4, sy - 4, sw + 8, sh + 8);
    c.fillStyle = '#5a4630'; c.fillRect(sx - 2, sy - 2, sw + 4, sh + 4);
    c.fillStyle = '#b8c9be'; c.fillRect(sx, sy, sw, sh);
    c.save(); c.beginPath(); c.rect(sx, sy, sw, sh); c.clip();
    c.translate(sx, sy); c.scale(this.zoom, this.zoom);
    // Pixel clouds are scenery. All plants, water, ants and underground material come from the simulation.
    c.fillStyle = '#d4ded0';
    for (let k = 0; k < 8; k++) { const x = k * 73 + 9, y = 8 + hash(k, 1) * 20; c.fillRect(x, y, 20, 3); c.fillRect(x + 4, y - 3, 12, 3); }
    c.fillStyle = '#a1b99d';
    if(this.cutaway)for (let k = 0; k < 24; k++) { const x = k * 24; const sy = this.surface[Math.min(this.W - 1, x)] || 60; c.fillRect(x, sy - 2 - hash(k, 3) * 6, 25, 8); }
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
      if(this.lastAgentFrame!==f.id||this.lastLowDetail!==this.lowDetail){
        const old=this.agents!.bounds,x=old.x,y=old.y,w=old.w,h=old.h;
        this.agents!.draw(f,this.colonies,this.species,this.lowDetail);
        const b=this.agents!.bounds,x0=w?Math.min(x,b.x):b.x,y0=h?Math.min(y,b.y):b.y;
        const x1=Math.max(x+w,b.x+b.w),y1=Math.max(y+h,b.y+b.h);
        if(x1>x0&&y1>y0)this.agentCtx.putImageData(this.agentImage!,0,0,x0,y0,x1-x0,y1-y0);
        this.lastAgentFrame=f.id;this.lastLowDetail=this.lowDetail;
      }
      const ab=this.agents!.bounds;
      if(ab.w&&ab.h)c.drawImage(this.agentCanvas,ab.x,ab.y,ab.w,ab.h,ab.x/3,ab.y/3,ab.w/3,ab.h/3);
      if(f.selected>=0){const o=f.selected*7,x=f.ants[o],y=f.ants[o+1];c.strokeStyle='#f6e4a2';c.lineWidth=1/this.zoom;c.strokeRect(x-2.5,y-2,5,4);}
      if (f.raining) { c.fillStyle = '#e2edf199'; for (let k = 0; k < 60; k++) { const x = hash(k, 12) * this.W, y = (hash(k, 15) * 50 + time / 60) % 60; c.fillRect(x, y, .4, 2); } }
    }
    if (this.route.length) { c.strokeStyle = '#f5d28188'; c.lineWidth = .5; c.setLineDash([1, 1]); c.beginPath(); for (let k = 0; k < this.route.length; k += 2) k ? c.lineTo(this.route[k], this.route[k + 1]) : c.moveTo(this.route[k], this.route[k + 1]); c.stroke(); c.setLineDash([]); }
    if(this.preview){const p=this.preview;c.strokeStyle='#ffd34d';c.lineWidth=2/this.zoom;c.setLineDash([3/this.zoom*2,3/this.zoom*2]);if(p.kind==='line'){c.beginPath();c.moveTo(p.x+.5,p.y+.5);c.lineTo(p.x2+.5,p.y2+.5);c.stroke();}else c.strokeRect(Math.min(p.x,p.x2),Math.min(p.y,p.y2),Math.abs(p.x2-p.x)+1,Math.abs(p.y2-p.y)+1);c.setLineDash([]);}
    c.restore();
    const tag = (text: string, x: number, y: number, ink = '#f7ecd2') => {
      c.font = `700 ${this.width < 600 ? 11 : 12}px "Atkinson Hyperlegible", sans-serif`; const w = Math.round(c.measureText(text).width), l = Math.round(x - w / 2 - 6);
      c.fillStyle = '#0b0806'; c.fillRect(l - 2, y - 15, w + 16, 22); c.fillStyle = '#2a2119'; c.fillRect(l, y - 13, w + 12, 18);
      c.fillStyle = '#4a3a29'; c.fillRect(l, y - 13, w + 12, 2); c.fillStyle = ink; c.fillText(text, l + 6, y);
    };
    if(this.labels)for(const note of this.notes)tag(note.text,Math.round(this.ox+note.x*this.zoom),Math.round(this.oy+note.y*this.zoom),'#ffd34d');
    if (this.labels) for (const col of this.colonies) {
      if (!col.alive) continue;
      const x = Math.round(this.ox + col.entrance.x * this.zoom), y = Math.round(this.oy + col.entrance.y * this.zoom);
      c.fillStyle = '#0b0806'; c.fillRect(x - 1, y - 24, 4, 20); c.fillRect(x + 1, y - 24, 10, 8);
      c.fillStyle = `rgb(${col.marking})`; c.fillRect(x, y - 23, 2, 18); c.fillRect(x + 2, y - 23, 8, 6);
      tag(`${col.name} · ${col.workers}`, x, y - 32);
    }
    // Brush cursor in screen space: a dark and a light ring stay visible on sky, soil and water alike.
    if (this.hover && this.editing) {
      const x = Math.round(this.ox + (this.hover.x - this.brush) * this.zoom), y = Math.round(this.oy + (this.hover.y - this.brush) * this.zoom), s = Math.max(3, Math.round((this.brush * 2 + 1) * this.zoom));
      c.lineWidth = 3; c.strokeStyle = '#0b0806'; c.strokeRect(x - .5, y - .5, s + 1, s + 1);
      c.lineWidth = 1; c.strokeStyle = '#ffe9a8'; c.strokeRect(x - .5, y - .5, s + 1, s + 1);
      const cx = Math.round(this.ox + (this.hover.x + .5) * this.zoom), cy = Math.round(this.oy + (this.hover.y + .5) * this.zoom);
      c.fillStyle = '#0b0806'; c.fillRect(cx - 4, cy - 1, 8, 3); c.fillRect(cx - 1, cy - 4, 3, 8);
      c.fillStyle = '#ffe9a8'; c.fillRect(cx - 3, cy, 6, 1); c.fillRect(cx, cy - 3, 1, 6);
    }
    if (this.showMinimap) {
      const m = this.minimapRect;
      c.fillStyle = '#0b0806'; c.fillRect(m.x - 4, m.y - 4, m.w + 8, m.h + 8);
      c.fillStyle = '#5a4630'; c.fillRect(m.x - 2, m.y - 2, m.w + 4, m.h + 4);
      c.fillStyle = '#b8c9be'; c.fillRect(m.x, m.y, m.w, m.h);
      c.drawImage(this.terrain, m.x, m.y, m.w, m.h);
      const vx = m.x + (-this.ox / this.zoom) / this.W * m.w, vy = m.y + (-this.oy / this.zoom) / this.H * m.h;
      const vw = this.width / this.zoom / this.W * m.w, vh = this.height / this.zoom / this.H * m.h;
      const x0 = Math.max(m.x, vx), y0 = Math.max(m.y, vy), x1 = Math.min(m.x + m.w, vx + vw), y1 = Math.min(m.y + m.h, vy + vh);
      if (x1 > x0 && y1 > y0 && (x1 - x0 < m.w - 1 || y1 - y0 < m.h - 1)) { c.lineWidth = 2; c.strokeStyle = '#0b0806'; c.strokeRect(x0 + 1, y0 + 1, x1 - x0 - 2, y1 - y0 - 2); c.lineWidth = 1; c.strokeStyle = '#ffd34d'; c.strokeRect(Math.round(x0) + .5, Math.round(y0) + .5, Math.round(x1 - x0) - 1, Math.round(y1 - y0) - 1); }
    }
    this.renderMs += .1 * (performance.now() - start - this.renderMs);
    requestAnimationFrame(this.draw);
  };
}
