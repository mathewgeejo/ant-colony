// One reusable pixel layer for all individual ants. No per-ant Canvas calls or DOM nodes.
import type { FrameMsg } from '../protocol.ts';
import { antColors,orientGrid,spriteFor } from './sprites.ts';
const rgb=(r:number,g:number,b:number,a=255)=>(a<<24|b<<16|g<<8|r)>>>0;
const carryColors=[0,rgb(245,204,107),rgb(206,141,118),rgb(187,166,92),rgb(157,121,80),rgb(170,162,139),rgb(242,229,182)];
interface Bitmap {w:number;h:number;pixels:Uint32Array;offsets:Uint32Array;colors:Uint32Array}
export class AgentRaster {
 readonly data:Uint8ClampedArray<ArrayBuffer>;
 readonly pixels:Uint32Array;
 readonly width:number;readonly height:number;
 private sprites=new Map<number,Bitmap>();
 private paletteOwners=new Uint32Array(256);
 private speciesList:any[]|null=null;
 readonly bounds={x:0,y:0,w:0,h:0};
 constructor(W:number,H:number){this.width=W*3;this.height=H*3;this.data=new Uint8ClampedArray(this.width*this.height*4);this.pixels=new Uint32Array(this.data.buffer);}
 private sprite(slot:number,caste:number,anim:number,orient:number,colonies:any[],species:any[]):Bitmap{
  const key=slot*64+caste*16+anim*8+orient;let b=this.sprites.get(key);if(b)return b;
  const col=colonies.find(c=>c.slot===slot),sp=species.find(s=>s.id===col?.speciesId);
  const v=sp?.visual??{body:[50,38,29],head:[34,27,23],gaster:[62,45,32],sprite:'formicine'};
  const def=spriteFor(v.sprite,caste),grid=orientGrid(def.wings?[...def.wings,...def.frames[anim]]:def.frames[anim],orient);
  const pal=antColors({...v,marking:col?.marking??[239,181,86]},caste),w=Math.max(...grid.map(r=>r.length)),h=grid.length,pixels=new Uint32Array(w*h);
  for(let y=0;y<h;y++)for(let x=0;x<grid[y].length;x++){const ch=grid[y][x],c=pal[ch];if(c)pixels[y*w+x]=rgb(c[0],c[1],c[2],ch==='8'?140:255);}
  const offsets:number[]=[],colors:number[]=[];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(pixels[y*w+x]){offsets.push(y*this.width+x);colors.push(pixels[y*w+x]);}
  b={w,h,pixels,offsets:Uint32Array.from(offsets),colors:Uint32Array.from(colors)};this.sprites.set(key,b);return b;
 }
 private rect(x:number,y:number,w:number,h:number,color:number){
  const x0=Math.max(0,x),x1=Math.min(this.width,x+w),y0=Math.max(0,y),y1=Math.min(this.height,y+h);
  for(let yy=y0;yy<y1;yy++)this.pixels.fill(color,yy*this.width+x0,yy*this.width+x1);
 }
 draw(f:FrameMsg,colonies:any[],species:any[],lowDetail:boolean){
  if(this.speciesList!==species){this.sprites.clear();this.paletteOwners.fill(0);this.speciesList=species;}
  for(const c of colonies)if(c&&this.paletteOwners[c.slot]!==c.id){for(let i=0;i<64;i++)this.sprites.delete(c.slot*64+i);this.paletteOwners[c.slot]=c.id;}
  this.pixels.fill(0);const a=f.ants,p=this.pixels,W=this.width,H=this.height;
  let minX=W,minY=H,maxX=0,maxY=0;
  for(let k=0;k<f.antCount;k++){
   const o=k*7,x=a[o],y=a[o+1],X=x*3,Y=y*3,bits=a[o+4]&65535,slot=bits&255,caste=bits>>8&3,carry=bits>>10&7,effects=a[o+5];
   minX=Math.min(minX,X-8);minY=Math.min(minY,Y-8);maxX=Math.max(maxX,X+9);maxY=Math.max(maxY,Y+9);
   if(effects&256)this.rect(X-6,Y-6,12,12,rgb(166,245,219,85));
   if(lowDetail&&caste===0)this.rect(X,Y,3,2,rgb(31,28,23));
   else{
    const dx=x-a[o+2],dy=y-a[o+3],orient=Math.abs(dy)>Math.abs(dx)?dy<0?4:6:dx<0?1:0;
    const b=this.sprite(slot,caste,effects&1,orient,colonies,species),bx=Math.round(X+1.5-b.w/2),by=Math.round(Y+1.5-b.h/2);
    if(bx>=0&&by>=0&&bx+b.w<=W&&by+b.h<=H){const at=by*W+bx;for(let j=0;j<b.colors.length;j++)p[at+b.offsets[j]]=b.colors[j];}
    else for(let yy=0;yy<b.h;yy++){
     const sy=by+yy;if(sy<0||sy>=H)continue;
     for(let xx=0;xx<b.w;xx++){const color=b.pixels[yy*b.w+xx],sx=bx+xx;if(color&&sx>=0&&sx<W)p[sy*W+sx]=color;}
    }
   }
   if(effects&512)this.rect(X-1,Y-2,3,2,rgb(192,196,189));
   if(effects&1024){const c=rgb(158,213,223);this.rect(X-3,Y-3,7,1,c);this.rect(X-3,Y+3,7,1,c);this.rect(X-3,Y-3,1,7,c);this.rect(X+3,Y-3,1,7,c);}
   if(effects&2048)this.rect(X,Y-2,2,1,rgb(237,170,102));
   if(carry)this.rect(X+2,Y-2,2,2,carryColors[carry]??carryColors[4]);
   if(bits&8192)this.rect(X-3,Y-3,1,1,rgb(242,170,118));
   if(bits&16384)this.rect(X+3,Y+1,1,1,rgb(185,152,103));
  }
  const b=this.bounds;b.x=Math.max(0,minX);b.y=Math.max(0,minY);b.w=Math.max(0,Math.min(W,maxX)-b.x);b.h=Math.max(0,Math.min(H,maxY)-b.y);
 }
}
