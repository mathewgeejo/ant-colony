import { describe, it, expect } from 'vitest';
import { createSim } from '../src/sim/scenarios.ts';
import { Sim, DEFAULT_SETTINGS } from '../src/sim/sim.ts';
import { DEFAULT_CLIMATE } from '../src/sim/physics.ts';
import { World } from '../src/sim/world.ts';
import { SparseField } from '../src/sim/signals.ts';
import { M, IS_SOLID } from '../src/sim/materials.ts';
import { Rng } from '../src/sim/rng.ts';
import { founderGenome, makeEgg, NL } from '../src/sim/genetics.ts';
import { snapshot, restore, encodeJSON, decodeJSON } from '../src/sim/persist.ts';
import { replay } from '../src/sim/replay.ts';
import { LASIUS_NIGER, validateSpecies } from '../src/sim/species.ts';

const small = (scenario='moved-food',seed=42) => createSim({scenario,seed,size:[192,128],settings:{weather:false,naturalPredators:false}});
const tick = (s: Sim,n:number) => {for(let k=0;k<n;k++)s.step();};
const audit = (s:Sim) => {const a=s.audit();expect(a.inv).toEqual(a.exp);};

describe('terrain and conservation',()=>{
  it('ants stay out of solid terrain; edits invalidate routes and digging opens cells',()=>{
    const s=small();tick(s,500);
    for(let k=0;k<300;k++){s.step();for(let i=0;i<s.a.n;i++)if(s.a.alive[i])expect(IS_SOLID[s.w.get(s.a.x[i],s.a.y[i])]).toBe(0);}
    s.applyNow({t:'paint',mat:M.STONE,x:20,y:80,r:3,replace:true});expect(s.w.get(20,80)).toBe(M.STONE);
    s.applyNow({t:'dig',x:20,y:80,r:2});expect(s.w.get(20,80)).toBe(M.AIR);audit(s);
  });
  it('painting and flow conserve water with explicit sources/sinks',()=>{
    const s=small();s.applyNow({t:'paint',mat:M.WATER,x:50,y:10,r:5,replace:true});audit(s);tick(s,2500);audit(s);
    s.applyNow({t:'humidity',x:80,y:90,r:5,amount:1});audit(s);s.applyNow({t:'erase',x:50,y:70,r:6});audit(s);
  });
  it('foraging transfers do not duplicate food across repeated runs',()=>{for(const seed of [4,19,42]){const s=small('moved-food',seed);tick(s,3000);audit(s);expect(s.counters.deliveries).toBeGreaterThan(0);}},240000);
});
describe('chemical transport',()=>{
  it('surface trails never diffuse and wash out when buried or flooded',()=>{const w=new World(32,32),f=new SparseField(w,'surface',.9);f.add(5,5,3);f.step();expect(f.get(5,5)).toBeLessThan(3);expect(f.get(6,5)).toBe(0);w.setRaw(w.idx(5,5),M.WATER,64);f.step();expect(f.get(5,5)).toBe(0);});
  it('airborne signals do not pass through impermeable walls',()=>{const w=new World(32,32);for(let y=0;y<32;y++)w.setRaw(w.idx(8,y),M.STONE);const f=new SparseField(w,'air',.99,.15);f.add(7,10,10);for(let k=0;k<80;k++)f.step();expect(f.get(6,10)).toBeGreaterThan(0);expect(f.get(8,10)).toBe(0);expect(f.get(9,10)).toBe(0);});
});
describe('inheritance and development',()=>{
  it('female eggs recombine maternal alleles; males remain haploid',()=>{const rng=new Rng(7),a=founderGenome(rng),b=founderGenome(rng);for(let k=0;k<100;k++){const g=makeEgg(rng,a,b,'naturalistic',0);for(let l=0;l<NL;l++)expect([a[l],b[l]]).toContain(g[l]);} });
  it('editing a queen germline leaves existing adults and brood unchanged',()=>{const s=small();tick(s,100);const a=s.a.ga.slice(),p=s.a.pheno.slice();s.applyNow({t:'editGenome',colonyId:s.colonies[0]!.id,locus:6,value:1});expect(s.a.pheno).toEqual(p);for(let i=0;i<s.a.n;i++)if(s.a.alive[i]&&s.a.caste[i]===0)expect(s.a.ga.subarray(i*NL,(i+1)*NL)).toEqual(a.subarray(i*NL,(i+1)*NL));});
  it('cold stops egg development',()=>{const s=small(),c=s.colonies[0]!;c.brood.length=0;s.addBrood(c,founderGenome(s.rng),founderGenome(s.rng),1,0,c.chamber.x,c.chamber.y,0,true);s.w.temp.fill(3);s.updateColony(c);expect(c.brood[0].prog).toBe(0);});
  it('sugar alone cannot supply the protein needed for larval growth',()=>{const s=small(),c=s.colonies[0]!;c.brood.length=0;s.addBrood(c,founderGenome(s.rng),founderGenome(s.rng),1,0,c.chamber.x,c.chamber.y,0,false);const b=c.brood[0];c.store.protein=0;c.store.seed=0;c.store.sugar=5;const nurse=s.a.alive.findIndex((v,i)=>v>0&&s.a.caste[i]===0);s.feedLarva(c,b,nurse);expect(b.fed).toBe(0);expect(c.store.sugar).toBe(4);});
});
describe('declarative content',()=>{
  it('validates built-ins and rejects malformed imported behavior data',()=>{expect(validateSpecies(LASIUS_NIGER)).toEqual([]);const s=structuredClone(LASIUS_NIGER) as any;s.nutrition.preference.sugar='execute()';s.simplifications=[42];s.founding.moisture=[.8,.2];expect(validateSpecies(s).length).toBeGreaterThanOrEqual(3);});
});
describe('complete persistence and replay',()=>{
  it('portable save/load preserves continuing state and conservation',()=>{const s=small();tick(s,600);const copy=restore(decodeJSON(encodeJSON(snapshot(s))));expect(copy.hash()).toBe(s.hash());tick(copy,600);tick(s,600);expect(copy.hash()).toBe(s.hash());audit(copy);});
  it('same seed and command schedule reproduce the run',()=>{const s=small();s.queue({t:'paint',mat:M.SUGAR,x:100,y:12,r:2});tick(s,700);const r=replay(s.createOpts,s.commandLog,s.tick);expect(r.hash()).toBe(s.hash());});
  it('rejects corrupt saves without replacing a run',()=>{expect(()=>restore({format:'bad',version:1,state:{}} as any)).toThrow();});
  it('does not advance without steps',()=>{const s=new Sim({W:64,H:64,seed:1,mode:'naturalistic',scenario:'test',climate:{...DEFAULT_CLIMATE},settings:{...DEFAULT_SETTINGS}});const before=s.hash();s.audit();snapshot(s);expect(s.tick).toBe(0);expect(s.hash()).toBe(before);});
});
