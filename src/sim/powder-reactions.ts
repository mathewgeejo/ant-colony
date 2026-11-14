import {M,NUM_MATERIALS,IS_GAS,IS_SOLID} from './materials.ts';
import type {World} from './world.ts';
import type {Rng} from './rng.ts';
import type {LiquidReactions} from './liquid-reactions.ts';
export const REFERENCE_POWDERS=[M.CONCRETE,M.DUST,M.ASH,M.CHARCOAL,M.TINDER,M.SAWDUST,M.WAX,M.INCENSE,M.SODIUM,M.CALCIUM,M.POTASSIUM,M.MAGNESIUM,M.LYE,M.THERMITE,M.SLAG,M.SULFUR,M.URANIUM,M.DIAMOND,M.GOLD_COIN,M.RUST,M.METAL_SCRAP,M.GLASS_SHARD,M.BAKED_CLAY,M.FEATHER,M.CONFETTI,M.GLITTER,M.BEAD,M.COLOR_SAND,M.BORAX];
const BASES=[M.LYE,M.LYE_SOLUTION,M.POTASH,M.POTASH_SOLUTION,M.LIME,M.MAGNESIUM_OXIDE] as number[];
const REACTIVE=new Uint8Array(NUM_MATERIALS);
for(const m of [...BASES,M.CHARCOAL,M.INCENSE,M.BURNING_INCENSE,M.SODIUM,M.MOLTEN_SODIUM,M.CALCIUM,M.MOLTEN_CALCIUM,M.POTASSIUM,M.MOLTEN_POTASSIUM,M.MAGNESIUM,M.MOLTEN_MAGNESIUM,M.THERMITE,M.BURNING_THERMITE,M.BURNING_MAGNESIUM,M.SULFUR,M.MOLTEN_SULFUR,M.URANIUM,M.MOLTEN_URANIUM,M.RADIATION,M.DIAMOND,M.RUST,M.IRON,M.METAL_SCRAP,M.FRAGRANCE,M.SULFUR_DIOXIDE,M.BORAX,M.BORAX_SOLUTION,M.SODIUM_CARBONATE,M.POTASSIUM_CARBONATE,M.SODIUM_OXIDE,M.POTASSIUM_OXIDE,M.BORIC_ACID])REACTIVE[m]=1;
type Change=(k:number,m:number,n:number,cause:string)=>void;

/** Authored local sandbox rules. Water/food transactions are ledgered; chemical mass/energy are abstract. */
export class PowderReactions{
 private w:World;private rng:Rng;private chem:LiquidReactions;private change:Change;
 private adjacent=new Array<number>(4);
 constructor(w:World,rng:Rng,chem:LiquidReactions,change:Change){this.w=w;this.rng=rng;this.chem=chem;this.change=change;}
 decayExposure(){const w=this.w;for(const k of w.doseCells){w.dose[k]=Math.max(0,w.dose[k]-2);if(!w.dose[k])w.doseCells.delete(k);}}
 private near(k:number,x:number){const w=this.w,a=this.adjacent;let n=0;if(x>0)a[n++]=k-1;if(x+1<w.W)a[n++]=k+1;if(k>=w.W)a[n++]=k-w.W;if(k+w.W<w.N)a[n++]=k+w.W;a.length=n;return a;}
 private toxin(k:number,n:number){const w=this.w;if(w.toxin[k]>=n)return;w.toxin[k]=n;w.chunkDirty[w.chunkOf(k%w.W,(k/w.W)|0)]=1;}
 private emit(k:number,m:number,n:number,stamp:number,phase=0,tint?:number){this.chem.transaction([{k,m,amount:n,phase,tint}], 'powder reaction emission');this.w.moved[k]=stamp;}
 private hydrate(k:number,j:number,m:number,heat=0,consume=0){const w=this.w,water=w.amt[j],take=Math.min(water,64-w.carrier[k]);if(!take)return false;const reacted=Math.min(consume,take),left=water-take;this.chem.transaction([{k,m,amount:w.amt[k]||64,carrier:w.carrier[k]+take-reacted},{k:j,m:left?M.WATER:M.AIR,amount:left,carrier:0}], 'reagent hydration');if(heat)w.temp[w.tIdx(k%w.W,(k/w.W)|0)]=Math.max(w.tempAt(k%w.W,(k/w.W)|0),heat);return true;}
 private radiation(x:number,y:number,k:number,stamp:number){const w=this.w;w.expose(k,18);if(w.amt[k]<=1){this.change(k,M.AIR,0,'radiation range exhausted');return true;}const d=w.phase[k]&3,nx=x+(d===0?-1:d===1?1:0),ny=y+(d===2?-1:d===3?1:0);if(!w.inb(nx,ny)){this.change(k,M.AIR,0,'radiation escaped');return true;}const j=ny*w.W+nx;
  if(!IS_GAS[w.mat[j]]||w.mat[j]===M.RADIATION){if(w.mat[j]!==M.BARRIER)w.expose(j,30);this.change(k,M.AIR,0,'radiation absorbed');return true;}
  w.amt[k]--;w.swap(k,j);w.moved[j]=stamp;return true;
 }
 step(x:number,y:number,k:number,stamp:number,tick:number){
  const w=this.w,m=w.mat[k];if(!REACTIVE[m])return false;if(m===M.RADIATION)return this.radiation(x,y,k,stamp);if(tick%8)return false;
  const T=w.tempAt(x,y);if((m===M.DIAMOND&&T<=900)||(m===M.RUST&&T<=850))return false;
  const adj=this.near(k,x);let air:number|undefined,water:number|undefined,acid:number|undefined,fire=false;
  for(const j of adj){const n=w.mat[j];if(n===M.AIR&&air===undefined)air=j;else if(n===M.WATER&&w.amt[j]&&water===undefined)water=j;else if((n===M.ACID||n===M.VINEGAR)&&acid===undefined)acid=j;if(n===M.FIRE||n===M.SPARK||n===M.LAVA)fire=true;}
  if(m===M.FRAGRANCE||m===M.SULFUR_DIOXIDE){if(m===M.SULFUR_DIOXIDE){this.toxin(k,140);for(const j of adj)if(!IS_SOLID[w.mat[j]])this.toxin(j,80);}if(w.amt[k]<=1){this.change(k,M.AIR,0,'scent/fume dispersion');return true;}w.amt[k]--;w.touch(x,y);return false;}
  if(m===M.URANIUM||m===M.MOLTEN_URANIUM){this.toxin(k,100);if(water!==undefined)this.toxin(water,60);w.chunkActive[w.chunkOf(x,y)]=8;if(air!==undefined&&this.rng.chance(.07))this.emit(air,M.RADIATION,3,stamp,this.rng.int(4));return false;}
  if(m===M.CHARCOAL){const j=adj.find(j=>w.toxin[j]>0&&[M.WATER,M.SALTWATER,M.AIR].includes(w.mat[j] as any));if(j!==undefined&&w.amt[k]){const n=Math.min(20,w.toxin[j]);w.toxin[j]-=n;w.chunkDirty[w.chunkOf(j%w.W,(j/w.W)|0)]=1;this.toxin(k,Math.min(255,w.toxin[k]+n));if(w.amt[k]<=1){this.change(k,M.SPENT_CHARCOAL,0,'filter saturation');return true;}w.amt[k]--;w.touch(x,y);return false;}}
  if((m===M.SODIUM||m===M.MOLTEN_SODIUM||m===M.POTASSIUM||m===M.MOLTEN_POTASSIUM||m===M.CALCIUM||m===M.MOLTEN_CALCIUM)&&water!==undefined){const potassium=m===M.POTASSIUM||m===M.MOLTEN_POTASSIUM,calcium=m===M.CALCIUM||m===M.MOLTEN_CALCIUM,used=Math.min(8,w.amt[water]);this.chem.transaction([{k,m:calcium?M.LIME:potassium?M.POTASH_SOLUTION:M.LYE_SOLUTION,amount:64,carrier:w.amt[water]-used},{k:water,m:M.HYDROGEN,amount:64,carrier:0}], 'metal-water chemical consumption');w.temp[w.tIdx(x,y)]=Math.max(T,potassium?300:calcium?55:85);return true;}
  if((m===M.SODIUM||m===M.POTASSIUM)&&air!==undefined){if(w.amt[k]<=1){this.change(k,m===M.SODIUM?M.SODIUM_OXIDE:M.POTASSIUM_OXIDE,64,'alkali metal tarnishing');return true;}w.amt[k]--;w.touch(x,y);}
  if((m===M.SODIUM_OXIDE||m===M.POTASSIUM_OXIDE)&&water!==undefined)return this.hydrate(k,water,m===M.SODIUM_OXIDE?M.LYE_SOLUTION:M.POTASH_SOLUTION,70,8);
  if(m===M.MAGNESIUM||m===M.MOLTEN_MAGNESIUM){const steam=adj.find(j=>w.mat[j]===M.STEAM);if(T>350&&steam!==undefined){const n=w.amt[steam],used=Math.min(n,8);this.chem.transaction([{k,m:M.MAGNESIUM_OXIDE,amount:64},{k:steam,m:n>used?M.STEAM:M.AIR,amount:n-used}], 'hot metal steam consumption');if(air!==undefined)this.emit(air,M.HYDROGEN,64,stamp);w.temp[w.tIdx(x,y)]=Math.max(T,500);return true;}if(T>550||(fire&&T>100)){this.change(k,M.BURNING_MAGNESIUM,80,'magnesium ignition');return true;}}
  if(m===M.THERMITE&&T>700){this.change(k,M.BURNING_THERMITE,100,'premixed heating material ignition');return true;}
  if(m===M.BURNING_MAGNESIUM||m===M.BURNING_THERMITE){w.temp[w.tIdx(x,y)]=Math.max(T,m===M.BURNING_THERMITE?1800:900);if(w.amt[k]<=1){this.change(k,m===M.BURNING_MAGNESIUM?M.MAGNESIUM_OXIDE:this.rng.chance(.7)?M.MOLTEN_IRON:M.SLAG,m===M.BURNING_MAGNESIUM?64:0,'finite metal burn');return true;}w.amt[k]--;w.touch(x,y);if(air!==undefined&&this.rng.chance(.3))this.emit(air,M.SPARK,20,stamp,0,m===M.BURNING_MAGNESIUM?0xfff7f1d0:0xffffb74d);return false;}
  if((m===M.SULFUR||m===M.MOLTEN_SULFUR)&&(T>300||fire)){this.change(k,M.SULFUR_DIOXIDE,150,'sulfur combustion');w.temp[w.tIdx(x,y)]=Math.max(T,260);if(air!==undefined)this.emit(air,M.FIRE,40,stamp,0,0xff7486e1);return true;}
  if(m===M.INCENSE){if(fire||T>220){this.change(k,M.BURNING_INCENSE,w.amt[k]||100,'incense ignition');return true;}if(T>40&&air!==undefined&&w.amt[k]){this.emit(air,M.FRAGRANCE,90,stamp);this.chem.consume(k,1,'fragrance reserve');return true;}return false;}
  if(m===M.BURNING_INCENSE){w.temp[w.tIdx(x,y)]=Math.max(T,250);if(w.amt[k]<=1){this.change(k,M.ASH,0,'incense burnout');return true;}w.amt[k]--;w.touch(x,y);if(air!==undefined)this.emit(air,this.rng.chance(.65)?M.SMOKE:M.FRAGRANCE,90,stamp);return false;}
  if(m===M.DIAMOND&&T>900&&air!==undefined){this.change(k,M.CO2,120,'carbon oxidation');return true;}
  if((m===M.METAL_SCRAP||m===M.IRON)&&water!==undefined&&this.rng.chance(.015)){this.change(k,M.RUST,0,'iron corrosion');return true;}
  if(m===M.RUST&&T>850&&air!==undefined){const carbon=adj.find(j=>w.mat[j]===M.CHARCOAL||w.mat[j]===M.COAL);if(carbon!==undefined){this.change(k,M.IRON,0,'oxide reduction');this.emit(air,M.CO2,120,stamp);this.chem.consume(carbon,1,'reduction carbon consumed');return true;}}
  if(BASES.includes(m)){this.toxin(k,110);if(acid!==undefined){const a=w.carrier[k],b=w.carrier[acid];this.chem.transaction([{k,m:a?M.SALTWATER:M.SALT,amount:a,carrier:0},{k:acid,m:b?M.SALTWATER:M.AIR,amount:b,carrier:0}], 'acid-base neutralization');w.toxin[k]=Math.max(0,w.toxin[k]-150);w.toxin[acid]=Math.max(0,w.toxin[acid]-150);return true;}
   const boric=adj.find(j=>w.mat[j]===M.BORIC_ACID);if(boric!==undefined&&(m===M.LYE||m===M.LYE_SOLUTION)){this.chem.transaction([{k:boric,m:w.carrier[boric]?M.BORAX_SOLUTION:M.BORAX,amount:32,carrier:w.carrier[boric]}],'borate neutralization');this.chem.consume(k,1,'alkali reagent');return true;}
   const gas=adj.find(j=>w.mat[j]===M.CO2);if(gas!==undefined&&m!==M.MAGNESIUM_OXIDE){const carrier=w.carrier[k];if(m===M.LIME){this.chem.transaction([{k,m:M.LIMESTONE,amount:0,carrier:0},{k:gas,m:carrier?M.WATER:M.AIR,amount:carrier,carrier:0}],'lime carbonation');}else this.chem.transaction([{k,m:m===M.POTASH||m===M.POTASH_SOLUTION?M.POTASSIUM_CARBONATE:M.SODIUM_CARBONATE,amount:32,carrier},{k:gas,m:M.AIR,amount:0}],'alkali carbonation');return true;}
   const oil=adj.find(j=>w.mat[j]===M.NUT_OIL);if(oil!==undefined&&[M.LYE,M.LYE_SOLUTION,M.POTASH,M.POTASH_SOLUTION].includes(m as any)){this.chem.transaction([{k,m:M.SOAP,amount:64,carrier:w.carrier[k]},{k:oil,m:M.AIR,amount:0}],'soap formation');w.toxin[k]=0;return true;}
   if((m===M.LYE||m===M.POTASH)&&water!==undefined)return this.hydrate(k,water,m===M.LYE?M.LYE_SOLUTION:M.POTASH_SOLUTION);
  }
  if(m===M.SODIUM_CARBONATE||m===M.POTASSIUM_CARBONATE){if(acid!==undefined&&air!==undefined){this.chem.transaction([{k,m:w.carrier[k]?M.SALTWATER:M.SALT,amount:w.carrier[k],carrier:0},{k:air,m:M.CO2,amount:120}],'carbonate neutralization');this.chem.consume(acid,1,'carbonate acid reagent');return true;}}
  if(m===M.BORAX||m===M.BORAX_SOLUTION){if(acid!==undefined){this.chem.transaction([{k,m:M.BORIC_ACID,amount:32,carrier:w.carrier[k]}],'borate acid reaction');this.chem.consume(acid,1,'borate acid reagent');return true;}const glue=adj.find(j=>w.mat[j]===M.GLUE);if(glue!==undefined){this.chem.transaction([{k:glue,m:M.SLIME,amount:80,carrier:w.carrier[glue]}],'gel crosslinking');this.chem.consume(k,1,'borate reagent');return true;}if(m===M.BORAX&&water!==undefined)return this.hydrate(k,water,M.BORAX_SOLUTION);}
  if(T>=105&&w.carrier[k]&&air!==undefined&&[M.LYE_SOLUTION,M.POTASH_SOLUTION,M.BORAX_SOLUTION,M.SODIUM_CARBONATE,M.POTASSIUM_CARBONATE,M.BORIC_ACID,M.LIME].includes(m as any)){const out=m===M.LYE_SOLUTION?M.LYE:m===M.POTASH_SOLUTION?M.POTASH:m===M.BORAX_SOLUTION?M.BORAX:m;this.chem.transaction([{k,m:out,amount:w.amt[k],carrier:0},{k:air,m:M.STEAM,amount:w.carrier[k]}],'reagent solvent evaporation');return true;}
  return false;
 }
}
