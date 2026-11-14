import {createSim} from '../src/sim/scenarios.ts';
import {snapshot,restore} from '../src/sim/persist.ts';
import {packChunks,packTints} from '../src/sim/view.ts';
import {cpus,totalmem,release} from 'node:os';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const seconds=Number(process.argv[2]??30);assert(Number.isFinite(seconds)&&seconds>0&&seconds<=3600);
const s=createSim({scenario:'liquid-lab',seed:42}),start=performance.now(),samples:unknown[]=[];let last=start,ticks=0;
while(performance.now()-start<seconds*1000){
 s.step();ticks++;
 if(ticks%30===0){packChunks(s,false);packTints(s,false);}
 const now=performance.now();
 if(now-last>=2000){const a=s.audit();assert.deepEqual(a.inv,a.exp);const memory=process.memoryUsage(),sample={seconds:(now-start)/1000,ticks,heapMiB:memory.heapUsed/1048576,buffersMiB:memory.arrayBuffers/1048576,stainedCells:s.w.tintedCells.size,pendingStains:s.w.tintDirty.size,activeChunks:s.w.chunkActive.filter(Boolean).length,resources:a};samples.push(sample);console.log(JSON.stringify(sample));last=now;}
}
const elapsedMs=performance.now()-start;
const r=restore(snapshot(s));for(let n=0;n<120;n++){s.step();r.step();}for(const key of ['mat','amt','moist','carrier','phase','tint'] as const)assert.deepEqual(r.w[key],s.w[key]);assert.equal(r.hash(),s.hash());assert.deepEqual(r.audit().inv,r.audit().exp);
const result={hardware:{cpu:cpus()[0].model,cores:cpus().length,ramGiB:totalmem()/1073741824,os:'Windows '+release(),node:process.version},requestedSeconds:seconds,elapsedSeconds:elapsedMs/1000,ticks,meanMsPerTick:elapsedMs/Math.max(1,ticks),samples,continuationTicks:120,continuationMatched:true,audit:s.audit(),limits:'Headless simulation and terrain packet packing; no browser rendering. Thirty seconds is a short stability sample, not proof of indefinite memory stability.'};
writeFileSync('artifacts/liquid-benchmark.json',JSON.stringify(result,null,2));console.log(JSON.stringify({ticks,continuationMatched:true,audit:result.audit}));
