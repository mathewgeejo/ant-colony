import { CONDUCTIVITY,DENSITY,FOOD_OF,IS_GAS,IS_LIQUID,IS_SOLID,IS_WATER,M,MATERIALS,phaseOrigin,FANTASY_MATERIALS } from './materials.ts';
import type { World } from './world.ts';
import type { Rng } from './rng.ts';
import { LiquidReactions } from './liquid-reactions.ts';
import { PowderReactions } from './powder-reactions.ts';
const foodKey=(f:number)=>f===1?'sugar':f===2?'protein':'seed';

/** Local game rules, not a chemistry or energy-conserving scientific solver. */
export class SandboxPhysics {
 private chargeBefore:Uint8Array;
 topologyChanged=false;
 private w:World;
 private rng:Rng;
 readonly reactions:LiquidReactions;
 readonly powders:PowderReactions;
 canClone=(m:number)=>!FANTASY_MATERIALS.includes(m);
 constructor(w:World,rng:Rng){this.w=w;this.rng=rng;this.chargeBefore=new Uint8Array(w.N);this.reactions=new LiquidReactions(w,rng,(k,m,n,cause,account)=>this.transform(k,m,n,cause,account));this.powders=new PowderReactions(w,rng,this.reactions,(k,m,n,cause)=>this.transform(k,m,n,cause));}
 transform(k:number,m:number,amount:number,cause:string,account=true){
  const w=this.w,old=w.mat[k],n=w.amt[k],of=w.foodType(k),nf=FOOD_OF[m];
  const before=(IS_WATER[old]?n:0)+w.carrier[k]+w.moist[k];
  w.setRaw(k,m,amount);
  if(account){
  if(of!==nf){if(of&&n)w.ledger.sink(foodKey(of),cause,n);if(nf&&amount)w.ledger.source(foodKey(nf),cause,amount);}
  else if(of&&amount!==n){if(amount>n)w.ledger.source(foodKey(of),cause,amount-n);else w.ledger.sink(foodKey(of),cause,n-amount);}
  const after=(IS_WATER[m]?amount:0)+w.carrier[k]+w.moist[k];
  if(after>before)w.ledger.source('water',cause,after-before);else if(before>after)w.ledger.sink('water',cause,before-after);
  }
  if(IS_SOLID[old]!==IS_SOLID[m])this.topologyChanged=true;
 }
 begin(tick:number,active:Uint8Array){
  if(tick%4)return;this.powders.decayExposure();const w=this.w,b=this.chargeBefore;b.set(w.charge);
  for(let cy=0;cy<w.CH;cy++)for(let cx=0;cx<w.CW;cx++){
   if(!active[cy*w.CW+cx])continue;
   for(let y=cy*16;y<Math.min(w.H,cy*16+16);y++)for(let x=cx*16;x<Math.min(w.W,cx*16+16);x++){
    const k=y*w.W+x,m=w.mat[k];let q=Math.max(0,b[k]-12);
    if(m===M.BATTERY||m===M.SPARK)q=255;
    else if(CONDUCTIVITY[m]){for(let d=0;d<4;d++){const j=d===0?k-1:d===1?k+1:d===2?k-w.W:k+w.W;if(j>=0&&j<w.N&&Math.abs(j%w.W-x)<=1)q=Math.max(q,b[j]-Math.ceil(2/CONDUCTIVITY[m]));}}
    else q=Math.max(0,b[k]-40);
    if(q!==w.charge[k]){w.charge[k]=q;w.touch(x,y);}else if(q)w.chunkActive[cy*w.CW+cx]=8;
   }
  }
 }
 private neighbour(k:number,x:number,d:number){const j=d===0?k-1:d===1?k+1:d===2?k-this.w.W:k+this.w.W;return j>=0&&j<this.w.N&&Math.abs(j%this.w.W-x)<=1?j:-1;}
 private explosion(k:number,x:number,y:number,r:number){
  const w=this.w;
  for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
   const xx=x+dx,yy=y+dy;if(dx*dx+dy*dy>r*r||!w.inb(xx,yy))continue;
   let blocked=false;const n=Math.max(Math.abs(dx),Math.abs(dy));
   for(let t=1;t<=n;t++)if(w.get(x+Math.round(dx*t/n),y+Math.round(dy*t/n))===M.BARRIER){blocked=true;break;}
   if(blocked)continue;const j=yy*w.W+xx,m=w.mat[j];if(m===M.BARRIER||m===M.BATTERY)continue;
   this.transform(j,M.FIRE,60+this.rng.int(80),'explosion');w.temp[w.tIdx(xx,yy)]=Math.max(w.temp[w.tIdx(xx,yy)],350);
   w.moved[j]=w.moved[k];
  }
 }
 step(x:number,y:number,k:number,stamp:number,tick:number):boolean{
  const w=this.w,m=w.mat[k],tc=w.tIdx(x,y),T=w.temp[tc];
  const def=MATERIALS[m];
  if(def.meltAt!==undefined&&T>=def.meltAt){this.transform(k,def.meltInto!,w.amt[k],'material melting');return true;}
  if(def.coolAt!==undefined&&T<=def.coolAt){this.transform(k,def.coolInto!,w.amt[k],'material solidification');return true;}
  if(m>=M.CHARCOAL&&this.powders.step(x,y,k,stamp,tick))return true;
  if(((m>=M.SLIME&&m<=M.CLOT)||m===M.ALCOHOL||m===M.HYDROGEN)&&this.reactions.step(x,y,k,tick))return true;
  if((m===M.CLAY_POWDER||m===M.CLAY||m===M.CLAY_SOIL)&&T>400){this.transform(k,M.BAKED_CLAY,0,'clay firing');return true;}
  if(m>=M.DIRT&&m<=M.BAKED_CLAY){
   if(m===M.PERMAFROST){if(T>0){this.transform(k,M.MUD,w.amt[k],'soil thawing');return true;}return false;}
   if(m===M.MUD){if(T<0){this.transform(k,M.PERMAFROST,w.amt[k],'soil freezing');return true;}if(T>110){this.transform(k,M.MUDSTONE,w.amt[k],'mud baking');return true;}if(w.moist[k]<15){this.transform(k,M.DIRT,w.amt[k],'mud drying');return true;}}
   if((m===M.SANDSTONE||m===M.BAKED_CLAY)&&T>1100){this.transform(k,M.MOLTEN_GLASS,1,'mineral melting');return true;}
   if(m===M.BASALT&&T>1200){this.transform(k,M.LAVA,1,'basalt melting');return true;}
   if(m===M.CINNABAR){w.toxin[k]=Math.max(w.toxin[k],160);if(T>350){this.transform(k,M.MERCURY,0,'mineral roasting');for(let d=0;d<4;d++){const j=this.neighbour(k,x,d);if(j>=0&&w.mat[j]===M.AIR){this.transform(j,M.SULFUR_DIOXIDE,180,'mineral fumes');w.toxin[j]=255;break;}}return true;}}
   if(m===M.LIMESTONE)for(let d=0;d<4;d++){const j=this.neighbour(k,x,d);if(j>=0&&w.mat[j]===M.ACID){this.transform(k,M.CO2,255,'carbonate acid reaction');if(w.amt[j]>1)w.amt[j]--;else this.transform(j,M.AIR,0,'acid exhausted');return true;}}
   if(m===M.DIRT){if(w.moist[k]>=60){this.transform(k,M.MUD,w.amt[k],'soil wetting');return true;}for(let d=0;d<4;d++){const j=this.neighbour(k,x,d);if(j>=0&&w.mat[j]===M.WATER){const n=Math.min(w.amt[j],120-w.moist[k]);if(n<=0)continue;w.amt[j]-=n;w.moist[k]+=n;if(!w.amt[j])w.setRaw(j,M.AIR,0);else w.touch(j%w.W,(j/w.W)|0);this.transform(k,M.MUD,w.amt[k],'soil wetting');return true;}}}
   if(m===M.MULCH&&w.moist[k]>30&&tick%300===0){this.transform(k,M.DIRT,w.amt[k],'mulch decomposition');return true;}
   if(m===M.MYCELIUM&&tick%120===0){
    if(w.moist[k]<15||T>45){this.transform(k,M.DIRT,w.amt[k],'fungal stress');return true;}
    if(w.amt[k]>=2)for(let d=0;d<4;d++){const j=this.neighbour(k,x,d);if(j>=0&&w.mat[j]===M.DIRT&&w.moist[j]>=30){w.amt[k]-=2;this.transform(j,M.MYCELIUM,w.amt[j],'fungal growth');break;}}
   }
  }
  if(m<19&&m!==M.WATER&&m!==M.SAND&&!MATERIALS[m].flammability)return false;
  if(m===M.HEATER||m===M.COOLER){const target=m===M.HEATER?1400:-60;w.temp[tc]+=(target-w.temp[tc])*.03;w.touch(x,y);return true;}
  if(m===M.BATTERY||m===M.WIRE||m===M.LAMP){if(m===M.BATTERY)w.chunkActive[w.chunkOf(x,y)]=8;return true;}
  if(m===M.CLONER){
   w.chunkActive[w.chunkOf(x,y)]=8;if(tick%8)return true;
   if(!w.amt[k])for(let d=0;d<4;d++){const j=this.neighbour(k,x,d);if(j>=0&&w.mat[j]!==M.AIR&&w.mat[j]!==M.CLONER&&w.mat[j]!==M.BARRIER){w.amt[k]=w.mat[j];w.phase[k]=w.mat[j]===M.FROZEN_MIXTURE?w.phase[j]:0;break;}}
   const copy=w.amt[k];if(copy&&MATERIALS[copy]&&this.canClone(copy))for(let d=0;d<4;d++){const j=this.neighbour(k,x,d);if(j>=0&&w.mat[j]===M.AIR){const def=MATERIALS[copy===M.FROZEN_MIXTURE?phaseOrigin(w.phase[k]):copy];this.reactions.transaction([{k:j,m:copy,amount:def.food?def.foodUnits:IS_WATER[copy]?64:def.nutrient,carrier:def.initialCarrier??0,phase:copy===M.FROZEN_MIXTURE?w.phase[k]:def.phaseMax?this.rng.int(def.phaseMax+1):0,tint:def.randomTints?def.randomTints[this.rng.int(def.randomTints.length)]:def.defaultTint??0}],'cloner source');if(def.initialTemperature!==undefined)w.temp[w.tIdx(j%w.W,(j/w.W)|0)]=def.initialTemperature;w.moved[j]=stamp;break;}}return true;
  }
  if(IS_WATER[m]&&!IS_GAS[m]){
   if((m===M.ICE||m===M.SNOW)&&T>0){this.transform(k,M.WATER,w.amt[k],'melting');return true;}
   if((m===M.WATER||m===M.SALTWATER)&&T<0){this.transform(k,M.ICE,w.amt[k],'freezing');return true;}
   if((m===M.WATER||m===M.SALTWATER)&&T>=100){this.transform(k,M.STEAM,w.amt[k],'boiling');return true;}
   if(m===M.WATER||m===M.ICE||m===M.SNOW)return false;
  }
  if(m===M.STEAM&&T<95){this.transform(k,M.WATER,w.amt[k],'condensation');return true;}
  if((m===M.SAND&&T>1000)||(m===M.GLASS&&T>1000)){this.transform(k,M.MOLTEN_GLASS,1,'melting');return true;}
  if(m===M.SAND)return false;
  if(m===M.MOLTEN_GLASS&&T<900){this.transform(k,M.GLASS,0,'solidification');return true;}
  if(m===M.METAL&&T>650){this.transform(k,M.MOLTEN_METAL,1,'melting');return true;}
  if(m===M.MOLTEN_METAL&&T<600){this.transform(k,M.METAL,0,'solidification');return true;}
  if(m===M.LAVA&&T<700){this.transform(k,M.STONE,0,'lava solidification');return true;}
  if(m===M.LAVA){for(let d=0;d<4;d++){const j=this.neighbour(k,x,d);if(j>=0&&IS_WATER[w.mat[j]]){this.transform(j,M.STEAM,w.amt[j],'lava contact');this.transform(k,M.STONE,0,'lava cooling');w.temp[tc]=140;return true;}}}
  let ignition=T>220||w.charge[k]>30;
  for(let d=0;d<4;d++){const j=this.neighbour(k,x,d);if(j<0)continue;const n=w.mat[j];
   if(n===M.FIRE||n===M.SPARK||n===M.LAVA)ignition=true;
   if(m===M.SALT&&n===M.WATER){this.transform(j,M.SALTWATER,w.amt[j],'dissolving');this.transform(k,M.AIR,0,'dissolving');return true;}
   if(m===M.FLOUR&&n===M.WATER){const water=w.amt[j];w.amt[j]=0;this.transform(j,M.AIR,0,'cooking');this.transform(k,M.DOUGH,w.amt[k],'cooking');w.moist[k]=water;return true;}
  }
  if(m===M.DOUGH&&T>110){this.transform(k,M.BREAD,w.amt[k],'baking');return true;}
  if((m===M.GUNPOWDER||m===M.EXPLOSIVE||m===M.HYDROGEN)&&ignition){w.moved[k]=stamp;this.explosion(k,x,y,m===M.EXPLOSIVE?9:4);return true;}
  if(m===M.FUSE&&ignition){this.transform(k,M.FIRE,120,'fuse ignition');return true;}
  if(def.flammability&&m!==M.HYDROGEN&&ignition&&this.rng.chance(def.flammability*.04*(1-w.moist[k]/Math.max(1,def.moistureCap)))){this.transform(k,M.FIRE,180,'combustion');return true;}
  if(m===M.FIRE||m===M.SPARK){
   w.temp[tc]=Math.min(2000,w.temp[tc]+(m===M.FIRE?4:1));
   for(let d=0;d<4;d++){const j=this.neighbour(k,x,d);if(j>=0&&IS_WATER[w.mat[j]]&&!IS_GAS[w.mat[j]]){this.transform(k,M.SMOKE,50,'extinguishing');w.temp[tc]-=10;return true;}}
   if(w.amt[k]<=1){this.transform(k,m===M.SPARK?M.AIR:M.ASH,0,'burnout');return true;}w.amt[k]--;w.touch(x,y);
  }
  if(m===M.SMOKE){if(tick%4===0){if(w.amt[k]<=1){this.transform(k,M.AIR,0,'gas dispersion');return true;}w.amt[k]--;}w.toxin[k]=Math.max(w.toxin[k],25);}
  if(m===M.ACID){w.toxin[k]=Math.max(w.toxin[k],150);if(tick%8===0)for(let d=0;d<4;d++){const j=this.neighbour(k,x,d);if(j>=0&&IS_SOLID[w.mat[j]]&&!(MATERIALS[w.mat[j]].acidResistance)&&![M.BARRIER,M.GLASS,M.BATTERY,M.CLONER].includes(w.mat[j] as any)){this.transform(j,M.SMOKE,60,'acid corrosion');if(w.amt[k]>1)w.amt[k]--;else this.transform(k,M.AIR,0,'acid exhausted');break;}}}
  if(IS_GAS[m]&&m!==M.AIR){
   const dir=y>0&&IS_LIQUID[w.mat[k-w.W]]?-1:m===M.CO2?1:-1,dy=y+dir;
   if(dy<0||dy>=w.H){this.transform(k,M.AIR,0,'gas escaped at boundary');return true;}
   const target=k+dir*w.W;
   if(w.mat[target]===M.AIR||(dir<0&&IS_LIQUID[w.mat[target]])||(IS_GAS[w.mat[target]]&&((dir<0&&DENSITY[m]<DENSITY[w.mat[target]])||(dir>0&&DENSITY[m]>DENSITY[w.mat[target]])))){w.swap(k,target);w.moved[target]=stamp;return true;}
   const dx=this.rng.chance(.5)?-1:1,nx=x+dx;if(nx>=0&&nx<w.W&&w.mat[k+dx]===M.AIR){w.swap(k,k+dx);w.moved[k+dx]=stamp;}else w.chunkActive[w.chunkOf(x,y)]=8;
   return true;
  }
  if(IS_LIQUID[m]&&m!==M.WATER){
   const viscosity=Math.max(0,(MATERIALS[m].viscosity??0)-Math.max(0,T-20)*.003);
   if(viscosity>0&&this.rng.chance(viscosity)){w.chunkActive[w.chunkOf(x,y)]=8;return true;}
   if(y+1<w.H){const b=k+w.W,n=w.mat[b];if(n===M.AIR||IS_GAS[n]||((IS_LIQUID[n]||MATERIALS[n].granular)&&DENSITY[m]>DENSITY[n])){w.swap(k,b);w.moved[b]=stamp;return true;}}
   const dx=this.rng.chance(.5)?-1:1;
   for(let t=0;t<2;t++){const d=t?-dx:dx,nx=x+d;if(nx<0||nx>=w.W)continue;const j=k+d;if(w.mat[j]===M.AIR||IS_GAS[w.mat[j]]){w.swap(k,j);w.moved[j]=stamp;return true;}}
   w.chunkActive[w.chunkOf(x,y)]=8;return true;
  }
  return false;
 }
}
