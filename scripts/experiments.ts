import { createSim } from '../src/sim/scenarios.ts';
import { DAY_TICKS } from '../src/sim/physics.ts';
import { M } from '../src/sim/materials.ts';
import { writeFileSync, mkdirSync } from 'node:fs';
const quick=process.argv.includes('--quick');
const rows:any[]=[];
for(const seed of [1,19,42]){
  for(const scenario of ['first-colony','moved-food','flooded-passage','competing-colonies']){
    const sim=createSim({scenario,seed,settings:{weather:false,naturalPredators:false}});
    const days=scenario==='first-colony'?12:4,start=performance.now();
    let before=0;
    for(let k=0;k<days*DAY_TICKS;k++){
      if(k===DAY_TICKS*2){before=sim.counters.deliveries;for(const cmd of sim.scenarioInfo.actions[0]?.cmds??[])sim.queue(cmd);}
      sim.step();
    }
    const result={scenario,seed,days,seconds:(performance.now()-start)/1000,ants:sim.a.count,workers:sim.aliveColonies().map(c=>c.workers),deliveries:sim.counters.deliveries,deliveriesAfterIntervention:sim.counters.deliveries-before,rescues:sim.flags.rescues,memoryFailures:sim.flags.memoryFailures,fights:sim.colonies.reduce((n,c)=>n+(c?.stats.fights??0),0),audit:sim.audit()};
    rows.push(result);console.log(JSON.stringify(result));
  }
}
if(!quick)for(const seed of [1,19,42]){
  const sim=createSim({scenario:'sandbox',seed,size:[384,192],climate:{meanTemp:27,deepTemp:25,dayAmp:2,seasonAmp:2,rainChancePerDay:0},settings:{weather:false,naturalPredators:false}});
  // Fertile experimental garden: resource addition is explicit, not an automatic fitness reward.
  sim.applyNow({t:'colony',species:'lasius-niger',x:100,y:sim.w.surface[100]-1,workers:100});
  sim.applyNow({t:'colony',species:'lasius-niger',x:280,y:sim.w.surface[280]-1,workers:100});
  for(const c of sim.aliveColonies())if(c.workers){c.store.sugar+=3000;c.store.protein+=3000;sim.w.ledger.source('sugar','experiment provisioning',3000);sim.w.ledger.source('protein','experiment provisioning',3000);}
  for(let day=0;day<24;day++){
    // Keep accessible protein patches supplied; these are visible sources with ledger entries.
    for(const x of [60,160,240,320])sim.applyNow({t:'paint',mat:M.PROTEIN,x,y:sim.w.surface[x]-1,r:2,replace:true});
    for(let k=0;k<DAY_TICKS;k++)sim.step();
  }
  const result={scenario:'provisioned-reproduction',seed,days:24,counters:sim.counters,alates:sim.colonies.map(c=>({g:c?.stats.gynesEclosed,m:c?.stats.malesEclosed})),lineage:sim.lineage.map(l=>({id:l.id,generation:l.generation,mother:l.motherColony,daughters:l.daughterColonies})),mutations:sim.mutationCount,audit:sim.audit()};rows.push(result);console.log(JSON.stringify(result));
}
mkdirSync('artifacts',{recursive:true});writeFileSync('artifacts/experiments.json',JSON.stringify(rows,null,2));
