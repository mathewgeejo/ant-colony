import { createSim } from '../src/sim/scenarios.ts';
import { packAnts, packChunks } from '../src/sim/view.ts';
import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus, totalmem, platform, release } from 'node:os';
const seconds=Number(process.argv[2]??60);
const s=createSim({scenario:'stress-test',seed:42,settings:{weather:false}});
const start=performance.now(),samples:any[]=[];let ticks=0,lastSample=start,lastTicks=0;
const initial=s.a.count;
while(performance.now()-start<seconds*1000){
  s.step();ticks++;
  if(ticks%30===0){packAnts(s,null);packChunks(s,false);}
  const now=performance.now();if(now-lastSample>5000){const sample={seconds:(now-start)/1000,ticks,ants:s.a.count,colonyCount:s.aliveColonies().length,msPerTick:(now-lastSample)/(ticks-lastTicks),heapMB:process.memoryUsage().heapUsed/1048576,bufferMB:process.memoryUsage().arrayBuffers/1048576,signalChunks:s.colonies.reduce((n,c)=>n+(c?c.trail.live.length+c.nestOdor.live.length+c.alarm.live.length:0),0)};samples.push(sample);console.log(JSON.stringify(sample));lastSample=now;lastTicks=ticks;}
}
const report={hardware:{cpu:cpus()[0].model,logicalCores:cpus().length,ramGB:totalmem()/1073741824,os:platform()+' '+release(),node:process.version},seconds,initialAnts:initial,ticks,meanMsPerTick:(performance.now()-start)/ticks,finalAnts:s.a.count,samples,audit:s.audit()};
mkdirSync('artifacts',{recursive:true});writeFileSync('artifacts/benchmark.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
