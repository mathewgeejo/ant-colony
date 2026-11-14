// Cached 3×3 pixel tiles. Terrain updates write pixels, not thousands of Canvas draw calls.
import { MATERIALS, M } from '../sim/materials.ts';
export const TILE = 3;
const rgba = (r:number,g:number,b:number) => (0xff000000 | b<<16 | g<<8 | r)>>>0;
export function terrainHash(x:number,y:number){let v=Math.imul(x+19,374761393)^Math.imul(y+53,668265263);v=Math.imul(v^(v>>>13),1274126177);return((v^(v>>>16))>>>0)/4294967296;}

const tiles = new Uint32Array(MATERIALS.length * 32 * 9);
for(const def of MATERIALS)for(let variant=0;variant<32;variant++){
  const h=(variant&15)/15,wet=variant>=16,f=(.94+h*.12)*(wet?.9:1);
  const color=def.color.map(v=>Math.round(v*f));
  const o=(def.id*32+variant)*9;
  tiles.fill(rgba(color[0],color[1],color[2]),o,o+9);
  const t=h>.5 ? color.map((v,k)=>Math.round(v*.84+[240,211,164][k]*.16)) : color.map((v,k)=>Math.round(v*.77+[18,17,16][k]*.23));
  const pos=(h>.4?1:2)*3+(h>.6?1:0);
  tiles[o+pos]=rgba(t[0],t[1],t[2]);
  if(def.id===M.STONE||def.id===M.CLAY)tiles[o+pos+1]=tiles[o+pos];
  if(def.id===M.WATER&&h>.6){tiles[o]=tiles[o+1]=rgba(131,185,200);}
}

export class TerrainRaster {
  readonly data: Uint8ClampedArray<ArrayBuffer>;
  readonly pixels: Uint32Array<ArrayBuffer>;
  readonly states: Uint16Array;
  readonly variants: Uint8Array;
  readonly stride: number;
  constructor(readonly W:number,readonly H:number){
    this.stride=W*TILE;
    this.data=new Uint8ClampedArray(W*H*TILE*TILE*4);
    this.pixels=new Uint32Array(this.data.buffer);
    this.states=new Uint16Array(W*H).fill(65535);
    this.variants=new Uint8Array(W*H);
    for(let y=0;y<H;y++)for(let x=0;x<W;x++)this.variants[y*W+x]=Math.floor(terrainHash(x,y)*16);
  }
  /** Returns false when the visible state is unchanged, even if fields changed in the worker. */
  cell(x:number,y:number,m:number,q:number,surface:number):boolean{
    const k=y*this.W+x,wet=(m===M.SOIL||m===M.TOPSOIL)&&(q&15)>10,underground=m===M.AIR&&y>=surface;
    const charged=!!MATERIALS[m].conductivity&&(q&15)>0;
    const state=m|((q&112)<<8)|(wet?256:0)|(charged?512:0)|(underground?32768:0);
    if(this.states[k]===state)return false;
    this.states[k]=state;
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
    return true;
  }
}
