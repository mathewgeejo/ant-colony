import { canStand } from './behavior.ts';
import { FOOD_OF,IS_GAS,IS_SOLID,M } from './materials.ts';
import { isDaytime } from './physics.ts';
import type { Sim } from './sim.ts';
import { wildlifeById,type WildlifeDef } from './wildlife-defs.ts';

export interface WildlifeState{
 id:number;kind:number;x:number;y:number;px:number;py:number;hp:number;hunger:number;age:number;dir:number;kills:number;leaving:boolean;
 energy:number;stage:number;stageAge:number;sex:number;cooldown:number;parentId:number;mateId:number;generation:number;
 pollen:number;pollenX:number;infection:number;action:string;eaten:boolean;
}
export function habitatAllows(sim:Sim,p:WildlifeDef,x:number,y:number,stage=2){
 const w=sim.w;if(!w.inb(x,y))return false;const m=w.get(x,y);
 if(p.habitat==='water'||(p.key==='frog'&&stage===1))return m===M.WATER||m===M.SALTWATER;
 if(p.habitat==='air'&&stage===2)return IS_GAS[m]===1||m===M.PLANT||m===M.PETAL;
 if(p.habitat==='amphibious'&&(m===M.WATER||m===M.SALTWATER))return true;
 if(p.habitat==='soil'&&[M.DIRT,M.SOIL,M.TOPSOIL,M.MUD,M.ORGANIC,M.MULCH].includes(m as any))return true;
 return canStand(sim,x,y,false);
}
export function newWildlife(id:number,kind:number,x:number,y:number,sex:number):WildlifeState{
 return{id,kind,x,y,px:x,py:y,hp:1,hunger:0,age:0,dir:1,kills:0,leaving:false,energy:.8,stage:2,stageAge:0,sex,cooldown:0,parentId:0,mateId:0,generation:0,pollen:0,pollenX:-1,infection:0,action:'Exploring local habitat',eaten:false};
}

/** Bounded spatial buckets for local animal contact; no all-pairs interaction pass. */
export class WildlifeSystem{
 private head=new Int32Array(0);private next=new Int32Array(0);private bw=0;
 private index(sim:Sim,list:WildlifeState[]){
  this.bw=Math.ceil(sim.w.W/4);const n=this.bw*Math.ceil(sim.w.H/4);
  if(this.head.length!==n)this.head=new Int32Array(n);this.head.fill(-1);
  if(this.next.length<list.length)this.next=new Int32Array(Math.max(128,list.length*2));
  for(let i=list.length-1;i>=0;i--){const c=list[i],b=(c.y>>2)*this.bw+(c.x>>2);this.next[i]=this.head[b];this.head[b]=i;}
 }
 private near(sim:Sim,list:WildlifeState[],x:number,y:number,r:number,fn:(c:WildlifeState)=>void){
  const x0=Math.max(0,(x-r)>>2),x1=Math.min(this.bw-1,(x+r)>>2),y0=Math.max(0,(y-r)>>2),y1=Math.min(Math.ceil(sim.w.H/4)-1,(y+r)>>2);
  for(let yy=y0;yy<=y1;yy++)for(let xx=x0;xx<=x1;xx++)for(let i=this.head[yy*this.bw+xx];i>=0;i=this.next[i]){const c=list[i];if(c.hp>0&&Math.abs(c.x-x)<=r&&Math.abs(c.y-y)<=r)fn(c);}
 }
 private clear(sim:Sim,x:number,y:number,xx:number,yy:number){
  const n=Math.max(Math.abs(xx-x),Math.abs(yy-y));for(let t=1;t<=n;t++){const X=Math.round(x+(xx-x)*t/n),Y=Math.round(y+(yy-y)*t/n);if(IS_SOLID[sim.w.get(X,Y)])return false;}return true;
 }
 private die(sim:Sim,c:WildlifeState,reason:string){
  c.hp=0;c.action=reason;if(c.eaten)return;const k=c.y*sim.w.W+c.x;
  if(sim.w.mat[k]===M.AIR||sim.w.mat[k]===M.WATER){
   // The water remains in the map: find nearby air rather than replacing a pool.
   for(const [dx,dy] of [[0,0],[0,-1],[-1,0],[1,0]]){const x=c.x+dx,y=c.y+dy;if(sim.w.inb(x,y)&&sim.w.get(x,y)===M.AIR){sim.setCell(y*sim.w.W+x,c.kind===9?M.BONE:M.PROTEIN,c.kind===9?0:3,'wildlife remains');break;}}
  }
 }
 private food(sim:Sim,c:WildlifeState,p:WildlifeDef):{x:number;y:number}|null{
  const w=sim.w;let target:null|{x:number;y:number}=null,best=1e9;
  for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){
   const x=c.x+dx,y=c.y+dy;if(!w.inb(x,y))continue;const k=y*w.W+x,m=w.mat[k];if((p.key==='firefly'&&c.stage===1)||!p.diet.includes(m))continue;
   const d=Math.abs(dx)+Math.abs(dy);if(d>best)continue;
   // Adjacent solids can be eaten; intervening walls cannot be sensed through.
   if(d>1&&!this.clear(sim,c.x,c.y,x-Math.sign(dx),y-Math.sign(dy)))continue;
   if(d<=1&&c.energy<.98){
    if(m===M.PETAL&&p.key==='bee'){
     if(!w.amt[k])continue;
     if(c.pollen&&c.pollenX!==x&&w.amt[k]>2){for(const [sx,sy] of [[x+1,y],[x-1,y],[x,y-1]])if(w.inb(sx,sy)&&w.get(sx,sy)===M.AIR){sim.setCell(sy*w.W+sx,M.FLOWER_SEED,1,'pollination seed');c.energy-=.05;w.amt[k]-=2;break;}}
     c.pollen=1;c.pollenX=x;c.energy=Math.min(1,c.energy+.025);if(w.amt[k])w.amt[k]--;c.action='Visiting a flower; carrying pollen';return {x,y};
    }
    if(p.key==='bee'&&m===M.POLLEN){c.pollen=1;c.pollenX=x;}
    const f=FOOD_OF[m];
    if(f){if(!w.amt[k])continue;w.amt[k]--;w.ledger.sink(f===1?'sugar':f===2?'protein':'seed','wildlife feeding',1);if(!w.amt[k])sim.setCell(k,M.AIR,0,'wildlife feeding');}
    else if((m===M.WOOD||m===M.ROOT)&&p.key==='termite'){sim.setCell(k,M.AIR,0,'termite feeding');sim.navDirty=true;}
    else if(w.amt[k]>1)w.amt[k]--;
    else if((m===M.ALGAE||m===M.KELP)&&w.moist[k]){const water=w.moist[k];w.moist[k]=0;w.setRaw(k,M.WATER,water);sim.navDirty=true;}
    else sim.setCell(k,m===M.ORGANIC||m===M.MULCH?M.DIRT:M.AIR,0,'wildlife grazing');
    c.energy=Math.min(1,c.energy+.18);c.hunger=0;c.action=p.key==='termite'?'Eating wood; opening a passage':'Feeding on '+(f?'food':'local substrate');w.touch(x,y);
    if(p.key==='worm'){const j=c.y*w.W+c.x;if(w.mat[j]===M.AIR&&w.inb(c.x,c.y+1)){const b=j+w.W;if([M.DIRT,M.TOPSOIL,M.SOIL].includes(w.mat[b] as any))w.amt[b]=Math.min(255,w.amt[b]+1);}}
    return {x,y};
   }
   target={x,y};best=d;
  }
  return target;
 }
 private move(sim:Sim,c:WildlifeState,p:WildlifeDef,target:{x:number;y:number}|null){
  const w=sim.w;if(sim.rng.chance(.08))c.dir=-c.dir;
  if(p.habitat==='ground'&&!canStand(sim,c.x,c.y,false)&&w.get(c.x,c.y+1)===M.AIR){c.px=c.x;c.py=c.y;c.y++;return;}
  let choice:null|{x:number;y:number}=null,score=-1e9;
  const directions=[[c.dir,0],[0,-1],[0,1],[-c.dir,0]];
  if(p.key==='flea'&&sim.rng.chance(.25))directions.unshift([0,-2]);
  for(const [dx,dy] of directions){
   const x=c.x+dx,y=c.y+dy,leap=p.key==='flea'&&dy===-2;
   if(!habitatAllows(sim,p,x,y,c.stage)&&!(leap&&w.inb(x,y)&&IS_GAS[w.get(x,y)]))continue;
   if(Math.abs(dy)>1&&!IS_GAS[w.get(c.x,c.y+Math.sign(dy))])continue;
   let s=sim.rng.next()*1.5+(dx===c.dir?.3:0);
   if(target)s-=Math.abs(target.x-x)+Math.abs(target.y-y);
   if(p.moisture)s+=p.moisture*(w.humAt(x,y)+w.moist[y*w.W+x]/160)*3;
   if(p.habitat==='air'&&c.stage!==2&&w.get(x,y+1)===M.AIR)s-=2;
   if(s>score){score=s;choice={x,y};}
  }
  if(choice){const k=choice.y*w.W+choice.x,old=c.y*w.W+c.x;if(IS_SOLID[w.mat[k]]){
   if(p.habitat!=='soil'||w.mat[old]!==M.AIR)return;w.swap(old,k);sim.navDirty=true;
  }c.px=c.x;c.py=c.y;c.dir=Math.sign(choice.x-c.x)||c.dir;c.x=choice.x;c.y=choice.y;}
 }
 step(sim:Sim,list:WildlifeState[],spawn:(kind:number,x:number,y:number)=>WildlifeState|undefined){
  if(sim.tick%4||!list.some(c=>c.kind>=2))return;this.index(sim,list);const w=sim.w,children:{kind:number;x:number;y:number;mother:WildlifeState;father:number;generation:number}[]=[];
  for(const c of list){
   const p=wildlifeById(c.kind);if(!p||c.hp<=0)continue;c.age+=4;c.stageAge+=4;c.cooldown=Math.max(0,c.cooldown-4);
   const k=c.y*w.W+c.x,T=w.tempAt(c.x,c.y),wet=w.mat[k]===M.WATER||w.mat[k]===M.SALTWATER;
   if(T< -5||T>42)c.hp-=.02;if(w.toxin[k])c.hp-=w.toxin[k]/255*(p.key==='stinkbug'?.001:.015);if(w.charge[k]>60)c.hp-=.05;
   if((p.habitat==='water'||(p.key==='frog'&&c.stage===1))&&!wet)c.hp-=.05;
   if(wet&&!['water','amphibious'].includes(p.habitat))c.hp-=.02;
   if(p.moisture&&w.humAt(c.x,c.y)<p.moisture&&w.moist[k]<15&&!wet)c.hp-=.003;
   for(const [dx,dy] of [[0,0],[-1,0],[1,0],[0,-1],[0,1]]){
    const m=w.get(c.x+dx,c.y+dy);if(m===M.PLAGUE)c.infection=Math.max(c.infection,600);if(m===M.CACTUS&&p.habitat!=='air')c.hp-=.002;
   }
   if(c.infection){c.infection=Math.max(0,c.infection-4);c.hp-=.003;this.near(sim,list,c.x,c.y,1,n=>{if(n!==c&&this.clear(sim,c.x,c.y,n.x,n.y))n.infection=Math.max(n.infection,120);});}
   if(c.stage===0){c.action='Developing egg / newborn';if(c.stageAge>=p.egg&&T>=8&&T<=35){c.stage=1;c.stageAge=0;}continue;}
   if(c.stage===3){c.action='Pupating';if(c.stageAge>=240){c.stage=2;c.stageAge=0;}continue;}
   if(c.stage===1&&c.stageAge>=p.juvenile&&c.energy>.35){c.stage=p.metamorphosis?3:2;c.stageAge=0;c.energy-=.1;if(c.stage===3)continue;}
   c.energy-=.0009*(p.speed+.4);c.hunger+=4;if(c.energy<=0)c.hp-=.005;
   if(c.hp<=0||c.age>p.life){this.die(sim,c,c.age>p.life?'Old age':'Environmental stress / starvation');continue;}
   if(IS_SOLID[w.mat[k]]){let escaped=false;for(const [dx,dy] of [[0,-1],[-1,0],[1,0],[0,1]])if(habitatAllows(sim,p,c.x+dx,c.y+dy,c.stage)&&!IS_SOLID[w.get(c.x+dx,c.y+dy)]){c.x+=dx;c.y+=dy;escaped=true;break;}if(!escaped){c.hp-=.03;c.action='Buried; cannot pass through the barrier';continue;}}
   if(sim.rng.next()>p.speed)continue;c.action='Exploring local habitat';let target=this.food(sim,c,p);
   if(p.key==='flea')this.near(sim,list,c.x,c.y,4,n=>{if([9,11].includes(n.kind)&&this.clear(sim,c.x,c.y,n.x,n.y)){target=n;if(Math.abs(n.x-c.x)+Math.abs(n.y-c.y)<=1){n.hp-=.02;c.energy=Math.min(1,c.energy+.08);c.action='Feeding on host';}}});
   const hunts=p.key==='firefly'?c.stage===1:p.prey.length>0;
   if(hunts)this.near(sim,list,c.x,c.y,5,n=>{const np=wildlifeById(n.kind);if(!np||n===c||!p.prey.includes(np.key)||!this.clear(sim,c.x,c.y,n.x,n.y))return;target=n;if(Math.abs(n.x-c.x)+Math.abs(n.y-c.y)<=1){n.hp-=.18*(1-np.shell);c.action='Attacking nearby prey';if(np.key==='stinkbug')for(const [dx,dy] of [[0,0],[-1,0],[1,0]])if(w.inb(n.x+dx,n.y+dy))w.toxin[(n.y+dy)*w.W+n.x+dx]=120;if(n.hp<=0){n.eaten=true;c.kills++;c.energy=Math.min(1,c.energy+.4);}}});
   if(p.key==='firefly'&&c.stage===2&&!isDaytime(sim.tick)){c.energy-=.0005;this.near(sim,list,c.x,c.y,5,n=>{if(n.kind===c.kind&&n.sex!==c.sex&&n.stage===2&&this.clear(sim,c.x,c.y,n.x,n.y))target=n;});}
   this.move(sim,c,p,target);
   if(c.stage===2&&c.energy>.7&&!c.cooldown&&list.length+children.length<384){let mate:WildlifeState|undefined;this.near(sim,list,c.x,c.y,2,n=>{if(n!==c&&n.kind===c.kind&&n.stage===2&&n.energy>.5&&!n.cooldown&&(n.sex!==c.sex||['worm','slug','snail'].includes(p.key))&&this.clear(sim,c.x,c.y,n.x,n.y))mate=n;});if(mate){c.energy-=.3;mate.energy-=.2;c.cooldown=mate.cooldown=1800;children.push({kind:c.kind,x:c.x,y:c.y,mother:c,father:mate.id,generation:Math.max(c.generation,mate.generation)+1});c.action='Reproducing after local mate contact';}}
   if(p.key==='firefly'&&c.stage===2&&!isDaytime(sim.tick))c.action='Flashing at night; searching locally';
  }
  for(let i=list.length-1;i>=0;i--)if(list[i].hp<=0){const c=list[i];if(!c.eaten&&c.action.startsWith('Attacking')===false&&c.action!=='Old age'&&c.action!=='Environmental stress / starvation')this.die(sim,c,'Predation or illness');list.splice(i,1);}
  for(const egg of children){const c=spawn(egg.kind,egg.x,egg.y);if(c){c.stage=0;c.energy=.45;c.parentId=egg.mother.id;c.mateId=egg.father;c.generation=egg.generation;c.action='Developing egg / newborn';}}
 }
}
