import {createSim} from '../src/sim/scenarios.ts';
import {snapshot,restore} from '../src/sim/persist.ts';
import {M,MATERIALS} from '../src/sim/materials.ts';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const results=[];
for(const seed of [1,19,42]){
 const s=createSim({scenario:'powder-lab',seed}),start=performance.now();
 for(let n=0;n<1800;n++)s.step();const before=s.audit();assert.deepEqual(before.inv,before.exp);assert(s.w.mat.some(m=>m===M.SLIME));
 let shielded=0;for(let y=116;y<176;y++)for(let x=321;x<372;x++)shielded+=s.w.dose[s.w.idx(x,y)];assert.equal(shielded,0);
 for(const c of s.scenarioInfo.actions[1].cmds)s.applyNow(c);let exposed=0;for(let n=0;n<800;n++){s.step();if(n%10===0)for(let y=164;y<174;y++)for(let x=321;x<325;x++)exposed+=s.w.dose[s.w.idx(x,y)];}assert(exposed>0);
 const r=restore(snapshot(s));for(let n=0;n<120;n++){s.step();r.step();}assert.equal(r.hash(),s.hash());for(const key of ['mat','amt','carrier','phase','tint','dose'] as const)assert.deepEqual(r.w[key],s.w[key]);assert.deepEqual(s.audit().inv,s.audit().exp);
 const products=Object.fromEntries([M.SLIME,M.LYE,M.LYE_SOLUTION,M.LIME,M.MOLTEN_IRON,M.IRON,M.SLAG,M.BURNING_THERMITE,M.URANIUM].map(m=>[MATERIALS[m].key,s.w.mat.filter(v=>v===m).length]));const row={seed,ticks:s.tick,wallMs:performance.now()-start,products,shieldedDose:shielded,openedExposureSamples:exposed,continuationMatched:true,resources:s.audit(),heapMiB:process.memoryUsage().heapUsed/1048576,buffersMiB:process.memoryUsage().arrayBuffers/1048576};results.push(row);console.log(JSON.stringify(row));
}
writeFileSync('artifacts/powder-experiments.json',JSON.stringify({description:'Seeded live workshop conditions; the shield intervention edits terrain. No products or exposure outcomes are scheduled.',results},null,2));
