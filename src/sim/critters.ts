// Non-ant organisms: springtails (prey) and hunting spiders (predators).
// Small populations stored as plain arrays.
import { CASTE, TASK } from './ants.ts';
import { canStand } from './behavior.ts';
import { P, NP } from './genetics.ts';
import { M,IS_LIQUID } from './materials.ts';
import { DAY_TICKS, isDaytime } from './physics.ts';
import type { Sim } from './sim.ts';
import { habitatAllows,newWildlife,WildlifeSystem,medicineExposure,type WildlifeState } from './wildlife.ts';
import { wildlifeById,wildlifeByKey } from './wildlife-defs.ts';

export const CRITTER = { SPRINGTAIL: 0, SPIDER: 1 } as const;
export const CRITTER_NAMES = ['springtail (prey)', 'hunting spider (predator)'];

export type Critter=WildlifeState;

export class Critters {
  list: Critter[] = [];
  nextId = 1;

  private wildlife=new WildlifeSystem();
  spawn(sim:Sim,kind:string|number,x:number,y:number):Critter|undefined {
    const p=typeof kind==='number'?wildlifeById(kind):wildlifeByKey(kind);
    const k=p?.id??(kind==='spider'||kind===1?1:kind==='springtail'||kind===0?0:-1);
    if(k<0||this.list.length>=384||this.list.filter(c=>c.kind===k).length>=(k===1?6:k===0?60:32))return;
    const w=sim.w;let sx=Math.floor(x),sy=Math.floor(y),found=false;
    if(p){for(let r=0;r<=6&&!found;r++)for(let dy=-r;dy<=r&&!found;dy++)for(let dx=-r;dx<=r&&!found;dx++)if(Math.abs(dx)+Math.abs(dy)<=r&&habitatAllows(sim,p,sx+dx,sy+dy)){sx+=dx;sy+=dy;found=true;}}
    else {sx=Math.max(0,Math.min(w.W-1,sx));sy=Math.max(0,Math.min(w.H-1,sy));for(let r=0;r<6&&!canStand(sim,sx,sy,false);r++)sy--;found=canStand(sim,sx,sy,false);}
    if(!found)return;
    if(p?.habitat==='soil'&&w.solidAt(sx,sy))sim.setCell(sy*w.W+sx,M.AIR,0,'introduced burrow');
    const c=newWildlife(this.nextId++,k,sx,sy,p?(sim.rng.chance(.5)?0:1):0);c.dir=sim.rng.chance(.5)?1:-1;
    this.list.push(c);if(k===1)sim.event('predator','A hunting spider entered the area.');return c;
  }

  step(sim: Sim) {
    const rng = sim.rng, w = sim.w, a = sim.a;
    // natural predator arrivals (rare, at night)
    if (sim.settings.naturalPredators && sim.tick % 600 === 0 && !isDaytime(sim.tick) && rng.chance(0.06)) {
      const x = rng.chance(0.5) ? 1 : w.W - 2;
      this.spawn(sim, 'spider', x, w.surface[x] - 1);
    }
    for (let k = this.list.length - 1; k >= 0; k--) {
      const c = this.list[k];
      if(c.kind>=2)continue;
      if(sim.tick%4===0){medicineExposure(sim,c);const cell=c.y*w.W+c.x,T=w.tempAt(c.x,c.y);if(T< -5||T>42)c.hp-=.02;if(IS_LIQUID[w.mat[cell]])c.hp-=.02;if(w.toxin[cell])c.hp-=w.toxin[cell]/255*.015;if(w.dose[cell])c.hp-=w.dose[cell]/255*.025;if(c.hp<=0){this.list.splice(k,1);if(w.mat[cell]===M.AIR)sim.setCell(cell,M.PROTEIN,c.kind===1?6:2,'wildlife remains');continue;}}
      c.px = c.x; c.py = c.y;
      c.age++;
      const speed = c.kind === CRITTER.SPIDER ? 0.5 : 0.3;
      if (rng.next() > speed) continue;
      if (c.kind === CRITTER.SPRINGTAIL) {
        if (c.age > DAY_TICKS * 3) { this.list.splice(k, 1); continue; }
        this.wander(sim, c, 0);
        continue;
      }
      // spider: hunt ants it can sense nearby; strong trails and light make prey easier to find
      c.hunger++;
      if (c.leaving || c.hp < 0.4 || c.age > DAY_TICKS * 2) {
        c.leaving = true;
        const tx = c.x < w.W / 2 ? -5 : w.W + 5;
        this.moveToward(sim, c, tx, c.y - 2);
        if (c.x <= 0 || c.x >= w.W - 1) { this.list.splice(k, 1); sim.event('predator', c.hp < 0.4 ? 'A spider was driven off by ants.' : 'A spider left the area.'); if (c.hp < 0.4) sim.journalUnlock('predator-repelled'); }
        continue;
      }
      let target = -1, best = 0;
      sim.idx.query(a, c.x, c.y, 5, (j) => {
        if (a.caste[j] === CASTE.QUEEN && a.task[j] === TASK.QUEEN_LAY) return;
        if (!w.skyExposed(a.x[j], a.y[j]) && Math.abs(a.y[j] - c.y) > 2) return;
        let s = 1 / (1 + Math.abs(a.x[j] - c.x) + Math.abs(a.y[j] - c.y));
        s *= 1 + 3 * a.pheno[j * NP + P.BIOLUM];
        const col = sim.colonies[a.colony[j]];
        if (col) s *= 1 + 0.3 * col.trail.get(a.x[j], a.y[j]);
        if (s > best) { best = s; target = j; }
      });
      if (target >= 0) {
        const tx = a.x[target], ty = a.y[target];
        if (Math.abs(tx - c.x) + Math.abs(ty - c.y) <= 1) {
          if (rng.chance(0.25)) {
            a.health[target] -= 0.6 * (1 - Math.min(0.8, a.pheno[target * NP + P.DEFENSE]));
            if (a.health[target] <= 0) { sim.killAnt(target, 'predation'); c.kills++; c.hunger = 0; }
          }
        } else this.moveToward(sim, c, tx, ty);
      } else this.wander(sim, c, 1);
      // ants in contact fight back and release alarm
      sim.idx.query(a, c.x, c.y, 1, (j) => {
        if(Math.abs(a.x[j]-c.x)+Math.abs(a.y[j]-c.y)>1)return;
        if (a.caste[j] !== CASTE.WORKER) return;
        const col = sim.colonies[a.colony[j]];
        if (!col) return;
        const sp = sim.speciesOf(col);
        col.alarm.add(a.x[j], a.y[j], sp.communication.alarmStrength);
        if (rng.chance(sp.aggression * 0.5)) c.hp -= 0.02 * a.pheno[j * NP + P.ATTACK] * (1 + sp.defense.power);
      });
      if (c.hp <= 0) {
        this.list.splice(k, 1);
        const i = c.y * w.W + c.x;
        if (w.mat[i] === M.AIR) sim.setCell(i, M.PROTEIN, 6, 'predator killed');
        sim.event('predator', 'Ants killed a spider; its body is now food.');
        sim.journalUnlock('predator-repelled');
      }
    }
    this.wildlife.step(sim,this.list,(kind,x,y)=>this.spawn(sim,kind,x,y));
  }

  /** Ants that bump into a springtail may capture it: it becomes a protein food cell. */
  preyContact(sim: Sim) {
    const a = sim.a, w = sim.w;
    for (let k = this.list.length - 1; k >= 0; k--) {
      const c = this.list[k];
      if (c.kind !== CRITTER.SPRINGTAIL) continue;
      let caught = false;
      sim.idx.query(a, c.x, c.y, 1, (j) => {
        if(Math.abs(a.x[j]-c.x)+Math.abs(a.y[j]-c.y)>1)return;
        if (caught || a.caste[j] !== CASTE.WORKER || a.task[j] !== TASK.FORAGE) return;
        if (sim.rng.chance(0.3 * a.pheno[j * NP + P.ATTACK])) caught = true;
      });
      if (caught) {
        const i = c.y * w.W + c.x;
        this.list.splice(k, 1);
        if (w.mat[i] === M.AIR) sim.setCell(i, M.PROTEIN, 2, 'prey killed');
      }
    }
  }

  private wander(sim: Sim, c: Critter, surfaceBias: number) {
    const rng = sim.rng;
    if (rng.chance(0.05)) c.dir = -c.dir;
    const opts: [number, number][] = [];
    for (const [dx, dy] of [[c.dir, 0], [c.dir, -1], [c.dir, 1], [0, -1], [0, 1], [-c.dir, 0]]) {
      if (canStand(sim, c.x + dx, c.y + dy, false) && sim.w.mat[(c.y + dy) * sim.w.W + c.x + dx] !== M.WATER) {
        if (surfaceBias && !sim.w.skyExposed(c.x + dx, c.y + dy) && rng.chance(0.8)) continue;
        opts.push([dx, dy]);
      }
    }
    if (!opts.length) { c.dir = -c.dir; return; }
    const [dx, dy] = opts[rng.chance(0.7) ? 0 : rng.int(opts.length)];
    c.x += dx; c.y += dy;
  }

  private moveToward(sim: Sim, c: Critter, tx: number, ty: number) {
    let best: [number, number] | null = null, bd = 1e9;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = c.x + dx, ny = c.y + dy;
        if (nx < 0 || nx >= sim.w.W) { if ((tx < 0 && nx < 0) || (tx >= sim.w.W && nx >= sim.w.W)) { c.x = Math.max(0, Math.min(sim.w.W - 1, nx)); return; } continue; }
        if (!canStand(sim, nx, ny, false) || sim.w.mat[ny * sim.w.W + nx] === M.WATER) continue;
        const d = (nx - tx) ** 2 + (ny - ty) ** 2 + sim.rng.next();
        if (d < bd) { bd = d; best = [dx, dy]; }
      }
    if (best) { c.x += best[0]; c.y += best[1]; c.dir = best[0] || c.dir; }
  }

  serialize() { return { list: this.list.map((c) => ({ ...c })), nextId: this.nextId }; }
  restore(s: { list: Critter[]; nextId: number }) { this.list = s.list.map((c) => ({ ...newWildlife(c.id,c.kind,c.x,c.y,0),...c })); this.nextId = s.nextId; }
}
