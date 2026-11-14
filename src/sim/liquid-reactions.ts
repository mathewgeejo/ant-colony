import {FOOD_OF,IS_SOLID,IS_WATER,M,MATERIALS,phaseOrigin,phaseProgress,mixturePhase} from './materials.ts';
import type {World} from './world.ts';
import type {Rng} from './rng.ts';
export const REFERENCE_LIQUIDS=[M.WATER,M.SALTWATER,M.LAVA,M.SLIME,M.CEMENT,M.OIL,M.LAMP_OIL,M.FOAM,M.ACID,M.GLUE,M.SODA,M.JUICE,M.MILK,M.VINEGAR,M.ALCOHOL,M.SOAP,M.BLEACH,M.DYE,M.INK,M.MERCURY,M.BLOOD,M.VACCINE,M.POISON,M.ANTIDOTE,M.HONEY,M.SAP,M.CARAMEL,M.MOLASSES,M.KETCHUP,M.MAYO,M.LIQUID_HYDROGEN,M.LIQUID_NITROGEN];
export interface ReactionCell{k:number;m:number;amount:number;carrier?:number;phase?:number;tint?:number}
type Change=(k:number,m:number,amount:number,cause:string,account?:boolean)=>void;

/** Authored contact chemistry. Transactions conserve declared water/food or name their sources/sinks. */
export class LiquidReactions{
 private w:World;private rng:Rng;private change:Change;
 constructor(w:World,rng:Rng,change:Change){this.w=w;this.rng=rng;this.change=change;}
 private totals(cells:ReactionCell[]){
  const w=this.w,t=[0,0,0,0];for(const c of cells){const m=w.mat[c.k],food=w.foodType(c.k);t[0]+=w.moist[c.k]+w.carrier[c.k]+(IS_WATER[m]?w.amt[c.k]:0);if(food)t[food]+=w.amt[c.k];}return t;
 }
 transaction(cells:ReactionCell[],cause:string){
  if(new Set(cells.map(c=>c.k)).size!==cells.length)throw new Error('Reaction writes a cell twice.');
  for(const c of cells)if(!Number.isInteger(c.k)||c.k<0||c.k>=this.w.N||!MATERIALS[c.m]||!Number.isInteger(c.amount)||c.amount<0||c.amount>255||c.carrier!==undefined&&(!Number.isInteger(c.carrier)||c.carrier<0||c.carrier>(MATERIALS[c.m].carrierCapacity??0)))throw new Error('Invalid reaction cell or carrier capacity.');
  const before=this.totals(cells),w=this.w;
  for(const c of cells){if(IS_WATER[c.m]&&c.amount===0)c.m=M.AIR;this.change(c.k,c.m,c.amount,cause,false);if(c.carrier!==undefined)w.carrier[c.k]=c.carrier;if(c.phase!==undefined)w.phase[c.k]=c.phase;if(c.tint!==undefined)w.setTint(c.k,c.tint);}
  const after=this.totals(cells),names=['water','sugar','protein','seed'];for(let n=0;n<4;n++){const delta=after[n]-before[n];if(delta>0)w.ledger.source(names[n],cause,delta);else if(delta<0)w.ledger.sink(names[n],cause,-delta);}
 }
 private neighbours(k:number,x:number){const w=this.w;return[k-1,k+1,k-w.W,k+w.W].filter(j=>j>=0&&j<w.N&&Math.abs(j%w.W-x)<=1);}
 consume(k:number,n:number,cause:string){
  const w=this.w;if(w.amt[k]>n){w.amt[k]-=n;w.touch(k%w.W,(k/w.W)|0);}else this.transaction([{k,m:w.carrier[k]?M.WATER:M.AIR,amount:w.carrier[k],carrier:0}],cause);
 }
 private dry(k:number,air:number,solid:number,cause:string){
  const w=this.w,water=w.carrier[k];this.transaction([{k,m:solid,amount:FOOD_OF[solid]?w.amt[k]:0,carrier:0},{k:air,m:M.STEAM,amount:water,carrier:0,tint:0}],cause);
 }
 step(x:number,y:number,k:number,tick:number):boolean{
  const w=this.w,m=w.mat[k];if((m<M.SLIME||m>M.CLOT)&&m!==M.ALCOHOL&&m!==M.HYDROGEN)return false;
  const T=w.tempAt(x,y);
  if(m===M.FROZEN_MIXTURE){const origin=phaseOrigin(w.phase[k]),progress=phaseProgress(w.phase[k]),d=MATERIALS[origin];if(d&&T>(d.freezeAt??0)+1){const water=origin===M.WATER?w.carrier[k]:0;this.transaction([{k,m:origin,amount:origin===M.WATER?water:w.amt[k],carrier:origin===M.WATER?0:w.carrier[k],phase:progress}], 'mixture thawing');return true;}return false;}
  if(MATERIALS[m].freezeAt!==undefined&&T<MATERIALS[m].freezeAt!){
   const d=MATERIALS[m],tint=w.tint[k]||(0xff000000|d.color[0]<<16|d.color[1]<<8|d.color[2])>>>0;
   this.transaction([{k,m:M.FROZEN_MIXTURE,amount:w.amt[k],carrier:w.carrier[k],phase:mixturePhase(m,w.phase[k]),tint}], 'mixture freezing');return true;
  }
  if((m===M.LIQUID_NITROGEN&&T> -196)||(m===M.LIQUID_HYDROGEN&&T> -253)){this.change(k,m===M.LIQUID_NITROGEN?M.NITROGEN:M.HYDROGEN,64,'cryogen boiling');w.temp[w.tIdx(x,y)]-=.5;return true;}
  if((m===M.NITROGEN&&T< -200)||(m===M.HYDROGEN&&T< -255)){this.change(k,m===M.NITROGEN?M.LIQUID_NITROGEN:M.LIQUID_HYDROGEN,64,'cryogen condensation');return true;}
  if(m===M.MERCURY||m===M.MERCURY_VAPOR)w.toxin[k]=Math.max(w.toxin[k],200);
  if(m===M.MERCURY&&T< -39){this.change(k,M.FROZEN_MERCURY,0,'metal freezing');return true;}
  if(m===M.FROZEN_MERCURY&&T> -38){this.change(k,M.MERCURY,0,'metal melting');return true;}
  if(m===M.MERCURY&&T>357){this.change(k,M.MERCURY_VAPOR,120,'metal boiling');return true;}
  if(m===M.MERCURY_VAPOR&&T<350){this.change(k,M.MERCURY,0,'metal condensation');return true;}
  if(m===M.ETHANOL_VAPOR&&T<70){this.change(k,M.ALCOHOL,64,'alcohol condensation');return true;}
  // Ordinary flow needs no chemistry-neighbor allocation between contact updates.
  if(tick%8!==0&&!(tick%4===0&&(m===M.CEMENT||m===M.FOAM||m===M.BUBBLE))&&!(w.carrier[k]&&T>=105)&&!(m===M.BLOOD&&T>4)&&!(m===M.DRY_GLUE&&T>60)&&!(m===M.ALCOHOL&&T>78))return false;
  const adj=this.neighbours(k,x),air=adj.find(j=>w.mat[j]===M.AIR);
  if((m===M.MERCURY||m===M.MERCURY_VAPOR)&&tick%8===0)for(const j of adj)if(!IS_SOLID[w.mat[j]]){w.toxin[j]=Math.max(w.toxin[j],90);w.chunkDirty[w.chunkOf(j%w.W,(j/w.W)|0)]=1;}
  if(m===M.ALCOHOL&&T>78){if(w.carrier[k]){if(air!==undefined){this.transaction([{k,m:M.WATER,amount:w.carrier[k],carrier:0},{k:air,m:M.ETHANOL_VAPOR,amount:64,carrier:0}], 'alcohol distillation');return true;}}else {this.change(k,M.ETHANOL_VAPOR,64,'alcohol boiling');return true;}}
  if((m===M.FOAM||m===M.BUBBLE)&&tick%4===0){if(w.amt[k]<=1){this.transaction([{k,m:w.carrier[k]?M.WATER:M.AIR,amount:w.carrier[k],carrier:0}], 'bubble collapse');return true;}w.amt[k]--;w.touch(x,y);}
  if(m===M.CHLORINE){w.toxin[k]=Math.max(w.toxin[k],180);if(tick%8===0){for(const j of adj)if(!IS_SOLID[w.mat[j]])w.toxin[j]=Math.max(w.toxin[j],120);if(w.amt[k]<=1){this.change(k,M.AIR,0,'chlorine dispersion');return true;}w.amt[k]--;w.touch(x,y);}}
  if(w.carrier[k]&&air!==undefined&&T>=105){
   const residue=m===M.MILK||m===M.WHEY||m===M.CHEESE||m===M.CLOT?M.MILK_POWDER:m===M.MAYO?M.NUT_OIL:m===M.EMULSION?M.OIL:FOOD_OF[m]===1?M.SUGAR:undefined;
   if(residue!==undefined){this.dry(k,air,residue,'solution evaporation');return true;}
   if(m===M.SLIME){this.dry(k,air,M.DUST,'gel drying');return true;}
  }
  if(m===M.CEMENT&&tick%4===0&&T>5&&adj.some(j=>IS_SOLID[w.mat[j]])){if(w.amt[k]<=1){this.change(k,M.CURED_CONCRETE,0,'cement setting');return true;}w.amt[k]--;w.touch(x,y);}
  if(m===M.GLUE&&tick%8===0&&(air!==undefined||T>50)){if(w.amt[k]<=1){this.change(k,M.DRY_GLUE,0,'adhesive setting');return true;}w.amt[k]--;if(w.carrier[k]){w.carrier[k]--;w.ledger.sink('water','adhesive evaporation',1);}w.touch(x,y);}
  if(m===M.DRY_GLUE&&T>60&&adj.some(j=>w.mat[j]===M.WATER)){this.transaction([{k,m:M.GLUE,amount:50,carrier:w.carrier[k]}], 'adhesive softening');return true;}
  if(m===M.BLOOD&&T>4&&air!==undefined&&this.rng.chance(.004)){this.change(k,M.CLOT,w.amt[k],'coagulation');return true;}
  if(tick%8)return false;
  if(m===M.POISON){w.toxin[k]=Math.max(w.toxin[k],200);const j=adj.find(j=>w.mat[j]!==M.BARRIER&&w.toxin[j]<160);if(j!==undefined){w.toxin[j]=160;this.consume(k,1,'poison depletion');return true;}}
  if(m===M.ANTIDOTE&&adj.some(j=>w.mat[j]===M.POISON)){const j=adj.find(j=>w.mat[j]===M.POISON)!;this.consume(j,8,'poison neutralization');this.consume(k,1,'antidote depletion');return true;}
  if((m===M.ANTIDOTE||m===M.BLEACH||m===M.SOAP)&&!(m===M.BLEACH&&adj.some(j=>w.mat[j]===M.ACID||w.mat[j]===M.VINEGAR))){
   const j=adj.find(j=>w.mat[j]!==M.BARRIER&&(w.toxin[j]>0||(m===M.BLEACH&&w.tint[j]>0)));
   if(j!==undefined){w.toxin[j]=Math.max(0,w.toxin[j]-(m===M.ANTIDOTE?160:40));if(m===M.BLEACH)w.setTint(j,0);this.consume(k,1,'cleaner depletion');return true;}
  }
  if(m===M.BLEACH){const j=adj.find(j=>w.mat[j]===M.ACID||w.mat[j]===M.VINEGAR);if(j!==undefined&&air!==undefined){this.transaction([{k:air,m:M.CHLORINE,amount:120}], 'acid bleach reaction');this.consume(k,1,'bleach reaction');this.consume(j,1,'acid reaction');return true;}}
  if(m===M.DYE||m===M.INK){const color=w.tint[k]||MATERIALS[m].defaultTint!,j=adj.find(j=>w.mat[j]!==M.AIR&&w.mat[j]!==m&&w.tint[j]!==color);if(j!==undefined){w.setTint(j,color);this.consume(k,1,'pigment depletion');return true;}}
  if(m===M.SOAP){
   const oil=adj.find(j=>w.mat[j]===M.OIL||w.mat[j]===M.LAMP_OIL);if(oil!==undefined){this.transaction([{k,m:M.EMULSION,amount:w.amt[k],carrier:w.carrier[k]},{k:oil,m:M.AIR,amount:0}], 'oil emulsification');return true;}
   const water=adj.find(j=>w.mat[j]===M.WATER);if(water!==undefined&&this.rng.chance(.1)){this.transaction([{k:water,m:M.FOAM,amount:60,carrier:w.amt[water]}], 'soap foam');this.consume(k,1,'soap depletion');return true;}
  }
  if(m===M.SODA&&w.phase[k]<8&&air!==undefined&&this.rng.chance(.1)){w.phase[k]++;this.transaction([{k:air,m:M.BUBBLE,amount:40,carrier:0}], 'carbonation');return true;}
  if((m===M.SAP||m===M.MOLASSES)&&T>65&&T<105&&this.rng.chance(.05)){this.change(k,M.CARAMEL,w.amt[k],'syrup concentration');return true;}
  if([M.SODA,M.JUICE,M.SAP,M.MOLASSES].includes(m as any)&&T>5&&T<40){const yeast=adj.find(j=>w.mat[j]===M.YEAST&&w.amt[j]>0);if(yeast!==undefined&&air!==undefined&&this.rng.chance(.1)){this.transaction([{k,m:M.ALCOHOL,amount:64,carrier:w.carrier[k]},{k:air,m:M.CO2,amount:120}], 'fermentation substrate');w.amt[yeast]--;w.touch(x,y);return true;}}
  if(m===M.MILK||m===M.WHEY){const acid=adj.find(j=>w.mat[j]===M.VINEGAR||w.mat[j]===M.ACID);if(acid!==undefined){const total=w.amt[k],water=w.carrier[k];if(air!==undefined&&total>=2){const whey=Math.floor(total/3),ww=Math.floor(water/2);this.transaction([{k,m:M.CHEESE,amount:total-whey,carrier:water-ww},{k:air,m:M.WHEY,amount:whey,carrier:ww}], 'milk curdling');}else this.change(k,M.CHEESE,total,'milk curdling');this.consume(acid,1,'curdling reagent');return true;}}
  if(m===M.CONCRETE||m===M.MILK_POWDER){const j=adj.find(j=>w.mat[j]===M.WATER);if(j!==undefined){const take=Math.min(w.amt[j],64-w.carrier[k]);if(take>0){const left=w.amt[j]-take;this.transaction([{k,m:m===M.CONCRETE?M.CEMENT:M.MILK,amount:m===M.CONCRETE?120:w.amt[k],carrier:w.carrier[k]+take},{k:j,m:left?M.WATER:M.AIR,amount:left,carrier:0}], 'powder hydration');return true;}}}
  if(m===M.VINEGAR){const j=adj.find(j=>w.mat[j]===M.BAKING_SODA||w.mat[j]===M.LIMESTONE);if(j!==undefined){this.transaction([{k:j,m:M.CO2,amount:120}], 'mild acid carbonate');this.consume(k,1,'mild acid depletion');return true;}}
  return false;
 }
}
