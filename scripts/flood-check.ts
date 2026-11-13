import { createSim } from '../src/sim/scenarios.ts';
import { writeFileSync } from 'node:fs';
const out=[];
for(const seed of [1,19,42]){
 const s=createSim({scenario:'flooded-passage',seed,settings:{weather:false,naturalPredators:false}});
 for(let k=0;k<7200;k++)s.step();
 for(const cmd of s.scenarioInfo.actions[0].cmds)s.queue(cmd);
 let maxFlood=0;
 for(let k=0;k<7200;k++){s.step();if(k%300===0){let n=0;for(let i=0;i<s.w.N;i++)if(s.w.owner[i]&&s.w.mat[i]===1)n++;maxFlood=Math.max(maxFlood,n);}}
 const r={seed,maxFlood,rescues:s.flags.rescues,floodEvents:s.colonies[0]?.stats.floodEvents,audit:s.audit()};out.push(r);console.log(JSON.stringify(r));
}
writeFileSync('artifacts/flood-check.json',JSON.stringify(out,null,2));
