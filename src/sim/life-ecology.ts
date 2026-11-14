import { IS_SOLID,M,MOIST_CAP } from './materials.ts';
import type { Sim } from './sim.ts';

export const LIFE_MATERIALS=[M.PLANT,M.GRASS,M.ALGAE,M.CELL,M.PLAGUE,M.BONE,M.SAPLING,M.PINECONE,M.CACTUS,M.KELP,M.CORAL,M.SEED,M.POLLEN,M.FLOWER_SEED,M.PETAL,M.VINE,M.BAMBOO_PLANT,M.MUSHROOM_SPORE,M.LICHEN,M.PRIMORDIAL_SOUP];
const soil=(m:number)=>[M.DIRT,M.TOPSOIL,M.SOIL,M.CLAY_SOIL,M.MUD,M.ORGANIC,M.MULCH,M.MYCELIUM].includes(m as any);

/** Growth over registered living cells, once per model second. New cells wait for the next pass. */
export function lifeEcology(sim:Sim){
 if(sim.tick%30||!sim.w.lifeCells.size)return;
 const w=sim.w,initial=[...w.lifeCells];
 const occupy=(k:number,m:number,energy:number,cause:string)=>{
  const solid=IS_SOLID[w.mat[k]];
  const water=w.mat[k]===M.WATER||w.mat[k]===M.SALTWATER?w.amt[k]:0;
  if(water)w.amt[k]=0;sim.setCell(k,m,energy,cause);
  if(solid!==IS_SOLID[w.mat[k]])sim.navDirty=true;
  const n=Math.min(water,Math.max(0,MOIST_CAP[m]-w.moist[k]));w.moist[k]+=n;if(water>n)w.ledger.sink('water','growth displacement',water-n);
 };
 for(const k of initial){
  const m=w.mat[k];if(m<M.GRASS||m===M.BONE)continue;
  const x=k%w.W,y=(k/w.W)|0,T=w.tempAt(x,y),neighbours=[k-w.W,k-1,k+1,k+w.W].filter(j=>j>=0&&j<w.N&&Math.abs(j%w.W-x)<=1);
  const water=neighbours.some(j=>w.mat[j]===M.WATER||w.mat[j]===M.SALTWATER);
  let substrate=neighbours.find(j=>soil(w.mat[j]));
  if(substrate===undefined)for(let d=1;d<=16&&y+d<w.H;d++){const j=k+d*w.W,n=w.mat[j];if(soil(n)){substrate=j;break;}if(![M.WOOD,M.SAPLING,M.BAMBOO_PLANT,M.CACTUS,M.PLANT,M.VINE].includes(n as any))break;}
  const wet=water||w.moist[k]>0||(substrate!==undefined&&w.moist[substrate]>15);
  const supported=neighbours.some(j=>IS_SOLID[w.mat[j]]||[M.PLANT,M.VINE,M.KELP,M.BAMBOO_PLANT,M.GRASS].includes(w.mat[j] as any));
  if(m===M.POLLEN){const flower=neighbours.find(j=>w.mat[j]===M.PETAL);if(flower!==undefined&&w.amt[flower]>2){const air=neighbours.find(j=>w.mat[j]===M.AIR);if(air!==undefined){sim.setCell(air,M.FLOWER_SEED,1,'pollen fertilization');w.amt[flower]-=2;sim.setCell(k,M.AIR,0,'pollen used');}}continue;}
  if(m===M.PINECONE||m===M.FLOWER_SEED||m===M.MUSHROOM_SPORE){
   const below=k+w.W;if(y+1>=w.H||!soil(w.mat[below])||w.moist[below]<30||T<5||T>35)continue;
   if(m===M.MUSHROOM_SPORE){if(![M.ORGANIC,M.MULCH,M.MYCELIUM].includes(w.mat[below] as any))continue;occupy(below,M.MYCELIUM,w.amt[below],'fungal colonization');occupy(k,M.MUSHROOM,20,'spore germination');}
   else if(m===M.PINECONE)occupy(k,M.SAPLING,24,'cone germination');
   else {occupy(k,M.PLANT,15,'flower germination');if(y>0&&w.mat[k-w.W]===M.AIR)occupy(k-w.W,M.PETAL,18,'flower growth');}
   continue;
  }
  if(m===M.PRIMORDIAL_SOUP){if(T>=20&&T<=45&&w.amt[k]>10&&sim.rng.chance(.08)){w.amt[k]-=10;const j=neighbours.find(j=>w.mat[j]===M.WATER);if(j!==undefined)occupy(j,M.CELL,10,'fictional abiogenesis');}continue;}
  if(m===M.PLAGUE){w.toxin[k]=Math.max(w.toxin[k],100);w.amt[k]=Math.max(0,w.amt[k]-1);if(!w.amt[k]){sim.setCell(k,M.AIR,0,'fictional pathogen decay');continue;}for(const j of neighbours)if([M.CELL,M.PRIMORDIAL_SOUP].includes(w.mat[j] as any)&&w.amt[k]>2&&sim.rng.chance(.1)){w.amt[k]-=2;occupy(j,M.PLAGUE,10,'fictional infection');break;}continue;}
  if(m===M.CORAL&&(T>32||T<4)){occupy(k,M.BONE,0,'coral bleaching');continue;}
  if(neighbours.some(j=>w.mat[j]===M.ACID)){occupy(k,M.ORGANIC,5,'chemical injury');continue;}
  if(T>48||T< -5||(!wet&&[M.ALGAE,M.CELL,M.KELP,M.CORAL].includes(m as any))){occupy(k,M.ORGANIC,10,'living tissue death');continue;}
  if(m===M.CELL){
   const food=neighbours.find(j=>[M.ORGANIC,M.MULCH].includes(w.mat[j] as any)&&w.amt[j]>0);if(food!==undefined){w.amt[food]--;w.amt[k]=Math.min(100,w.amt[k]+4);if(!w.amt[food])sim.setCell(food,M.DIRT,0,'microbial substrate consumption');}
   if(w.amt[k])w.amt[k]--;else {occupy(k,M.ORGANIC,5,'microbe starvation');continue;}
   if(w.amt[k]>12&&sim.rng.chance(.15)){const j=neighbours.find(j=>w.mat[j]===M.WATER);if(j!==undefined){const share=Math.floor(w.amt[k]/2);w.amt[k]-=share;occupy(j,M.CELL,share,'microbial fission');}}continue;
  }
  const aquatic=[M.ALGAE,M.KELP,M.CORAL].includes(m as any);
  if(aquatic){
   if(w.amt[k]>4&&sim.rng.chance(m===M.CORAL?.025:.08)){
    const j=m===M.KELP?(y>0&&w.mat[k-w.W]===M.WATER?k-w.W:undefined):neighbours.find(j=>w.mat[j]===M.WATER);
    if(j!==undefined){const share=Math.floor(w.amt[k]/2);w.amt[k]-=share;occupy(j,m,share,'aquatic growth');}
   }continue;
  }
  if(m===M.LICHEN){
   const rock=neighbours.find(j=>[M.STONE,M.ROCK,M.BASALT,M.LIMESTONE].includes(w.mat[j] as any));
   if(rock===undefined)continue;
   if(wet&&w.amt[k]>4&&sim.rng.chance(.025)){const j=neighbours.find(j=>w.mat[j]===M.AIR);if(j!==undefined){const share=Math.floor(w.amt[k]/2);w.amt[k]-=share;occupy(j,M.LICHEN,share,'lichen growth');}}
   if(!wet&&w.amt[k])w.amt[k]--;if(!w.amt[k])occupy(k,M.DUST,0,'lichen desiccation');continue;
  }
  if(m===M.MUSHROOM){
   if(!wet){if(w.amt[k])w.amt[k]--;if(!w.amt[k])occupy(k,M.ORGANIC,5,'fungal desiccation');continue;}
   if(substrate!==undefined&&[M.ORGANIC,M.MULCH,M.MYCELIUM].includes(w.mat[substrate] as any)&&w.amt[substrate]){w.amt[substrate]--;w.amt[k]=Math.min(50,w.amt[k]+1);}
   if(w.amt[k]>=20&&sim.rng.chance(.04)){const j=neighbours.find(j=>w.mat[j]===M.AIR);if(j!==undefined){occupy(j,M.MUSHROOM_SPORE,4,'spore production');w.amt[k]-=4;}}continue;
  }
  if(!supported){if(w.amt[k])w.amt[k]--;if(!w.amt[k])occupy(k,M.ORGANIC,5,'unsupported plant death');continue;}
  // Photosynthetic energy is an explicit game abstraction. Water is still accounted in integer units.
  let drank=false;
  if(m===M.CACTUS&&sim.tick%240!==0)drank=wet;
  else if(w.moist[k]){w.moist[k]--;w.ledger.sink('water','plant transpiration',1);drank=true;}
  else if(substrate!==undefined&&w.moist[substrate]){w.moist[substrate]--;w.ledger.sink('water','plant transpiration',1);drank=true;w.touch(substrate%w.W,(substrate/w.W)|0);}
  else if(water)drank=true;
  if(!drank){if(w.amt[k])w.amt[k]--;if(!w.amt[k])occupy(k,M.ORGANIC,5,'plant drought');continue;}
  w.amt[k]=Math.min(100,w.amt[k]+1);w.touch(x,y);
  if(m===M.PETAL){if(w.amt[k]>=15&&sim.rng.chance(.06)){const j=neighbours.find(j=>w.mat[j]===M.AIR);if(j!==undefined){occupy(j,M.POLLEN,1,'pollen production');w.amt[k]-=3;}}continue;}
  if(m===M.BAMBOO_PLANT&&y>0&&w.mat[k-w.W]===M.BAMBOO_PLANT&&w.amt[k]>=20){occupy(k,M.WOOD,0,'bamboo maturation');continue;}
  if(w.amt[k]<12||!sim.rng.chance(.1))continue;
  if(m===M.GRASS){for(const dx of [sim.rng.chance(.5)?-1:1]){const j=k+dx,b=j+w.W;if(x+dx>=0&&x+dx<w.W&&b<w.N&&w.mat[j]===M.AIR&&soil(w.mat[b])&&w.moist[b]>15){occupy(j,M.GRASS,6,'grass runner');w.amt[k]-=6;}}}
  else if(m===M.SAPLING){if(y>1&&w.mat[k-w.W]===M.AIR){const share=Math.floor(w.amt[k]/2);occupy(k,M.WOOD,0,'tree trunk');occupy(k-w.W,M.SAPLING,share,'tree growth');for(const dx of [-1,1])if(w.inb(x+dx,y-1)&&w.get(x+dx,y-1)===M.AIR)occupy(k-w.W+dx,M.PLANT,10,'tree crown');}}
  else if(m===M.CACTUS||m===M.BAMBOO_PLANT){if(y>0&&w.mat[k-w.W]===M.AIR){const share=Math.floor(w.amt[k]/2);w.amt[k]-=share;occupy(k-w.W,m,share,'shoot growth');}}
  else if(m===M.VINE){for(const j of neighbours)if(w.mat[j]===M.AIR){const xx=j%w.W,yy=(j/w.W)|0;let wall=false;for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]])if(IS_SOLID[w.get(xx+dx,yy+dy)])wall=true;if(wall){const share=Math.floor(w.amt[k]/2);w.amt[k]-=share;occupy(j,M.VINE,share,'vine growth');break;}}}
 }
}
