import { createSim } from '../src/sim/scenarios.ts';
import { snapshot } from '../src/sim/persist.ts';
import { cpus, totalmem } from 'node:os';
import { writeFileSync } from 'node:fs';

// Isolate full-state Undo checkpoint cost from browser input and rendering.
const sim=createSim({scenario:'stress-test',seed:42,settings:{weather:false}});
const times:number[]=[];
for(let n=0;n<12;n++){
 const t=performance.now(),file=snapshot(sim);
 times.push(performance.now()-t);
 if(file.summary.ants!==sim.a.count)throw new Error('Incomplete checkpoint');
}
const out={cpu:cpus()[0].model,logicalCores:cpus().length,ramGB:totalmem()/1073741824,node:process.version,ants:sim.a.count,snapshotMs:times,meanMs:times.reduce((a,b)=>a+b,0)/times.length};
writeFileSync('artifacts/snapshot-benchmark.json',JSON.stringify(out,null,2));console.log(JSON.stringify(out));
