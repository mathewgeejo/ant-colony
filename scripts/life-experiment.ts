import {createSim} from '../src/sim/scenarios.ts';
import {writeFileSync} from 'node:fs';
import {wildlifeById} from '../src/sim/wildlife-defs.ts';
import {snapshot,restore} from '../src/sim/persist.ts';
const days=Number(process.argv[2]??2),results=[];
for(const seed of [1,19,42]){
 const s=createSim({scenario:'life-garden',seed}),start=performance.now(),initial=s.critters.list.length,births=new Map<number,unknown>(),samples=[];
 for(let t=0;t<days*3600;t++){
  s.step();for(const c of s.critters.list)if(c.parentId&&!births.has(c.id))births.set(c.id,{id:c.id,parent:c.parentId,mate:c.mateId,generation:c.generation,kind:wildlifeById(c.kind)?.key});
  if(t%1800===0){const a=s.audit();if(JSON.stringify(a.inv)!==JSON.stringify(a.exp))throw new Error('Resource audit failed for seed '+seed);samples.push({tick:s.tick,animals:s.critters.list.length,activeLivingCells:s.w.lifeCells.size});}
 }
 const r=restore(snapshot(s));for(let n=0;n<120;n++){s.step();r.step();}if(r.hash()!==s.hash()||JSON.stringify(r.critters.serialize())!==JSON.stringify(s.critters.serialize()))throw new Error('Continuation mismatch for seed '+seed);
 const a=s.audit();if(JSON.stringify(a.inv)!==JSON.stringify(a.exp))throw new Error('Final resource audit failed');
 const result={seed,days,seconds:(performance.now()-start)/1000,initialAnimals:initial,finalAnimals:s.critters.list.length,observedBirths:[...births.values()],samples,audit:a,saveContinuation:true};results.push(result);console.log(JSON.stringify(result));
}
writeFileSync('artifacts/life-experiments.json',JSON.stringify({description:'Seeded live garden; no forced births or survival outcomes. Runtime includes observation and save checks.',results},null,2));
