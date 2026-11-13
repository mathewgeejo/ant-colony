import { createSim } from '../src/sim/scenarios.ts';
import { snapshot,restore } from '../src/sim/persist.ts';
const s=createSim({scenario:'moved-food',seed:42,size:[192,128],settings:{weather:false,naturalPredators:false}});
for(let k=0;k<600;k++)s.step();const r=restore(snapshot(s));
for(let k=0;k<600;k++){
  s.step();r.step();
  if(s.hash()!==r.hash()){
    console.log('diverged after',k+1,'tick',s.tick);
    for(const key of Object.keys(s.w)){const a=(s.w as any)[key],b=(r.w as any)[key];if(ArrayBuffer.isView(a)){for(let i=0;i<(a as any).length;i++)if((a as any)[i]!==b[i]){console.log('world',key,i,(a as any)[i],b[i]);break;}}}
    for(const key of Object.keys(s.a)){const a=(s.a as any)[key],b=(r.a as any)[key];if(ArrayBuffer.isView(a)){for(let i=0;i<(a as any).length;i++)if((a as any)[i]!==b[i]){console.log('ant',key,i,(a as any)[i],b[i]);break;}}}
    console.log('rng',s.rng.state(),r.rng.state());break;
  }
}
