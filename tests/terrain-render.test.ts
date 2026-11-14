import { expect,it } from 'vitest';
import { TerrainRaster } from '../src/render/terrain.ts';
import { M } from '../src/sim/materials.ts';
import { AgentRaster } from '../src/render/agents.ts';
import type { FrameMsg } from '../src/protocol.ts';
it('keeps pale snow textures pale when brightness exceeds an RGB channel limit',()=>{const r=new TerrainRaster(32,32);for(let y=0;y<32;y++)for(let x=0;x<32;x++)r.cell(x,y,M.SNOW,0,32);for(let i=0;i<r.data.length;i+=4){expect(r.data[i]).toBeGreaterThan(150);expect(r.data[i+1]).toBeGreaterThan(150);expect(r.data[i+2]).toBeGreaterThan(150);expect(r.data[i+3]).toBe(255);}});
it('reuses unchanged visible cells and clears an erased material to transparent sky',()=>{
 const r=new TerrainRaster(32,32);
 expect(r.cell(4,4,M.SAND,0,20)).toBe(true);
 expect(r.data.some(v=>v!==0)).toBe(true);
 expect(r.cell(4,4,M.SAND,0,20)).toBe(false);
 expect(r.cell(4,4,M.AIR,0,20)).toBe(true);
 expect(r.data.every(v=>v===0)).toBe(true);
});
it('updates a changed visible moisture state without changing material identity',()=>{
 const r=new TerrainRaster(32,32);r.cell(5,5,M.SOIL,3,2);const dry=r.pixels.slice();
 expect(r.cell(5,5,M.SOIL,4,2)).toBe(false);
 expect(r.cell(5,5,M.SOIL,15,2)).toBe(true);
 expect(r.pixels).not.toEqual(dry);
});
it('makes enclosed air visible and preserves material textures',()=>{
 const r=new TerrainRaster(32,32);r.cell(5,5,M.AIR,0,3);expect(r.pixels.some(v=>v!==0)).toBe(true);
 const original=r.pixels.slice();r.cell(5,5,M.CLAY,0,3);expect(r.pixels).not.toEqual(original);
});
it('draws distinct individual sprites and clears departed agents without leaving ghosts',()=>{
 const r=new AgentRaster(32,32),f={ants:new Uint16Array([5,5,4,5,0,0,0,20,20,19,20,256,0,0]),antCount:2} as unknown as FrameMsg;
 r.draw(f,[],[],false);
 const around=(x:number,y:number)=>{let n=0;for(let yy=y*3-5;yy<y*3+6;yy++)for(let xx=x*3-6;xx<x*3+7;xx++)if(r.pixels[yy*r.width+xx])n++;return n;};
 expect(around(5,5)).toBeGreaterThan(0);expect(around(20,20)).toBeGreaterThan(0);
 f.antCount=0;r.draw(f,[],[],false);expect(r.pixels.every(p=>p===0)).toBe(true);
});
