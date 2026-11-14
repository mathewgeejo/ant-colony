// Cached 3×3 pixel tiles. Terrain updates write pixels, not thousands of Canvas draw calls.
import { MATERIALS, M } from '../sim/materials.ts';
export const TILE = 3;
const rgba = (r:number,g:number,b:number) => (0xff000000 | Math.max(0,Math.min(255,b))<<16 | Math.max(0,Math.min(255,g))<<8 | Math.max(0,Math.min(255,r)))>>>0;
export function terrainHash(x:number,y:number){let v=Math.imul(x+19,374761393)^Math.imul(y+53,668265263);v=Math.imul(v^(v>>>13),1274126177);return((v^(v>>>16))>>>0)/4294967296;}

const tiles = new Uint32Array(MATERIALS.length * 32 * 9);
const lifeTiles:Record<number,string>={
 [M.GRASS]:'a.a.aaa.a',[M.ALGAE]:'.aaaaa.a.',[M.CELL]:'.a.aaa.a.',[M.PLAGUE]:'a.a.a.a.a',
 [M.SAPLING]:'aaa.a..a.',[M.PINECONE]:'.a.aaa.a.',[M.CACTUS]:'a.aaaa.a.',[M.KELP]:'a.a.a.aa.',
 [M.CORAL]:'a.aaaa.a.',[M.POLLEN]:'....a....',[M.FLOWER_SEED]:'....aa...',
 [M.PETAL]:'.a.aaa.a.',[M.VINE]:'aa..aa.a.',[M.BAMBOO_PLANT]:'.a.aaa.a.',
 [M.MUSHROOM_SPORE]:'....a....',[M.LICHEN]:'aa..aaaa.',[M.MUSHROOM]:'aaa.a..a.',
};
for(const def of MATERIALS)for(let variant=0;variant<32;variant++){
  const h=(variant&15)/15,wet=variant>=16,f=(.94+h*.12)*(wet?.9:1);
  const color=def.color.map(v=>Math.round(v*f));
  const o=(def.id*32+variant)*9;
  tiles.fill(rgba(color[0],color[1],color[2]),o,o+9);
  const t=h>.5 ? color.map((v,k)=>Math.round(v*.84+[240,211,164][k]*.16)) : color.map((v,k)=>Math.round(v*.77+[18,17,16][k]*.23));
  const pos=(h>.4?1:2)*3+(h>.6?1:0);
  tiles[o+pos]=rgba(t[0],t[1],t[2]);
  if(def.id===M.SANDSTONE||def.id===M.MUDSTONE||def.id===M.CLAY_SOIL)for(let x=0;x<3;x++)tiles[o+6+x]=rgba(...t as [number,number,number]);
  if(def.id===M.PERMAFROST){tiles[o+1]=rgba(157,187,198);tiles[o+5]=rgba(199,218,219);}
  if(def.id===M.MYCELIUM){tiles[o+1]=tiles[o+4]=tiles[o+5]=rgba(208,190,213);}
  if(def.id===M.MULCH){tiles[o]=tiles[o+4]=rgba(161,106,49);}
  if(def.id===M.CINNABAR){tiles[o+1]=rgba(205,89,65);tiles[o+8]=rgba(91,52,49);}
  if(lifeTiles[def.id])for(let i=0;i<9;i++)if(lifeTiles[def.id][i]==='.')tiles[o+i]=0;
  if(def.id===M.PETAL)tiles[o+4]=rgba(236,204,78);
  if(def.id===M.MUSHROOM){tiles[o]=tiles[o+1]=tiles[o+2]=rgba(177,105,92);tiles[o+4]=tiles[o+7]=rgba(218,203,168);}
  if(def.id===M.STONE||def.id===M.CLAY)tiles[o+pos+1]=tiles[o+pos];
  if(def.id===M.WATER&&h>.6){tiles[o]=tiles[o+1]=rgba(131,185,200);}
  if(def.id===M.FOAM||def.id===M.BUBBLE){tiles[o+4]=rgba(149,180,180);for(const i of [1,3,5,7])tiles[o+i]=rgba(226,238,224);}
  if(def.id===M.MERCURY||def.id===M.FROZEN_MERCURY){tiles[o]=tiles[o+1]=rgba(224,236,236);tiles[o+7]=rgba(104,124,135);}
  if(def.id===M.GLUE||def.id===M.DRY_GLUE){tiles[o+1]=tiles[o+4]=rgba(231,218,160);tiles[o+8]=rgba(147,127,82);}
  if(def.id===M.SLIME){tiles[o+1]=tiles[o+3]=rgba(172,218,128);tiles[o+8]=rgba(105,149,71);}
  if(def.id===M.FROZEN_MIXTURE){tiles[o+1]=tiles[o+4]=tiles[o+7]=rgba(206,233,231);tiles[o+3]=tiles[o+5]=rgba(175,216,226);}
  if(def.id===M.CEMENT||def.id===M.CURED_CONCRETE){tiles[o+2]=rgba(178,182,172);tiles[o+6]=rgba(103,114,113);}
  if(def.id===M.LIQUID_HYDROGEN||def.id===M.LIQUID_NITROGEN){tiles[o+1]=tiles[o+2]=rgba(215,236,239);tiles[o+6]=rgba(126,170,200);}
  if(def.id===M.FEATHER){tiles.fill(0,o,o+9);for(const i of [1,3,4,5,7])tiles[o+i]=rgba(225,216,191);tiles[o+4]=rgba(153,144,126);}
  if(def.id===M.CONFETTI){tiles.fill(0,o,o+9);for(const i of h>.5?[1,4,5]:[3,4,7])tiles[o+i]=rgba(...color as [number,number,number]);}
  if(def.id===M.GLITTER){tiles[o+1]=tiles[o+5]=rgba(241,239,194);tiles[o+6]=rgba(113,129,126);}
  if(def.id===M.GOLD_COIN||def.id===M.BEAD||def.id===M.DIAMOND){for(const i of [0,2,6,8])tiles[o+i]=0;tiles[o+4]=def.id===M.GOLD_COIN?rgba(160,113,35):rgba(227,241,228);tiles[o+1]=rgba(240,226,164);}
  if(def.id===M.CHARCOAL||def.id===M.SPENT_CHARCOAL){tiles[o+1]=rgba(88,86,70);tiles[o+5]=rgba(24,28,24);}
  if(def.id===M.TINDER){tiles[o]=tiles[o+4]=tiles[o+8]=rgba(221,183,110);tiles[o+2]=tiles[o+6]=0;}
  if(def.id===M.INCENSE||def.id===M.BURNING_INCENSE){tiles[o+1]=tiles[o+4]=tiles[o+7]=def.id===M.INCENSE?rgba(108,77,62):rgba(230,148,79);}
  if(def.id===M.URANIUM||def.id===M.MOLTEN_URANIUM){tiles[o+1]=rgba(179,195,139);tiles[o+5]=rgba(74,93,65);}
  if(def.id===M.RADIATION){tiles.fill(0,o,o+9);tiles[o+4]=rgba(233,255,155);tiles[o+1]=tiles[o+7]=rgba(168,218,84);}
  if([M.SODIUM,M.POTASSIUM,M.CALCIUM,M.MAGNESIUM,M.METAL_SCRAP].includes(def.id as any)){tiles[o+1]=rgba(233,235,213);tiles[o+7]=rgba(105,122,120);}
  if(def.id===M.RUST){tiles[o+1]=rgba(194,122,62);tiles[o+8]=rgba(102,56,40);}
  if(def.id===M.THERMITE){tiles[o+1]=rgba(191,142,88);tiles[o+7]=rgba(89,87,82);}
}

export class TerrainRaster {
  readonly data: Uint8ClampedArray<ArrayBuffer>;
  readonly pixels: Uint32Array<ArrayBuffer>;
  readonly states: Uint32Array;
  readonly variants: Uint8Array;
  readonly tintStates:Uint32Array;
  readonly stride: number;
  constructor(readonly W:number,readonly H:number){
    this.stride=W*TILE;
    this.data=new Uint8ClampedArray(W*H*TILE*TILE*4);
    this.pixels=new Uint32Array(this.data.buffer);
    this.states=new Uint32Array(W*H).fill(0xffffffff);
    this.variants=new Uint8Array(W*H);
    this.tintStates=new Uint32Array(W*H);
    for(let y=0;y<H;y++)for(let x=0;x<W;x++)this.variants[y*W+x]=Math.floor(terrainHash(x,y)*16);
  }
  /** Returns false when the visible state is unchanged, even if fields changed in the worker. */
  cell(x:number,y:number,m:number,q:number,surface:number,tint=0):boolean{
    const k=y*this.W+x,wet=(m===M.SOIL||m===M.TOPSOIL)&&(q&15)>10,underground=m===M.AIR&&y>=surface;
    const charged=!!MATERIALS[m].conductivity&&(q&15)>0;
    const state=m|((q&112)<<16)|(wet?1<<24:0)|(charged?1<<25:0)|(underground?1<<26:0);
    if(this.states[k]===state&&this.tintStates[k]===tint)return false;
    this.states[k]=state;
    this.tintStates[k]=tint;
    const base=y*TILE*this.stride+x*TILE,p=this.pixels;
    if(m===M.AIR||m===M.PLANT){
      const color=m===M.AIR&&underground?rgba(48,41,31):0;
      for(let dy=0;dy<3;dy++){const at=base+dy*this.stride;p[at]=p[at+1]=p[at+2]=color;}
      if(m===M.PLANT){const c=q&16?rgba(172,200,97):rgba(112,147,78);p[base+1]=p[base+this.stride+1]=p[base+this.stride*2+1]=c;p[base+(this.variants[k]>7?2:0)]=c;}
    }else{
      const o=(m*32+this.variants[k]+(wet?16:0))*9;
      for(let dy=0;dy<3;dy++){const at=base+dy*this.stride,t=o+dy*3;p[at]=tiles[t];p[at+1]=tiles[t+1];p[at+2]=tiles[t+2];}
    }
    if(q&32)p[base]=rgba(193,207,90);
    if(charged){p[base+this.stride+1]=rgba(255,237,121);if(m===M.LAMP)for(let dy=0;dy<3;dy++){const at=base+dy*this.stride;p[at]=p[at+1]=p[at+2]=rgba(255,235,153);}}
    if(tint){const r=tint>>>16&255,g=tint>>>8&255,b=tint&255;for(let dy=0;dy<3;dy++)for(let dx=0;dx<3;dx++){const at=base+dy*this.stride+dx,c=p[at];if(c)p[at]=rgba(Math.round((c&255)*.25+r*.75),Math.round((c>>>8&255)*.25+g*.75),Math.round((c>>>16&255)*.25+b*.75));}}
    return true;
  }
}
