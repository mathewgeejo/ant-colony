import {it,expect} from 'vitest';
import {createSim} from '../src/sim/scenarios.ts';
import {M,MATERIALS,phaseOrigin,phaseProgress} from '../src/sim/materials.ts';
import {REFERENCE_LIQUIDS} from '../src/sim/liquid-reactions.ts';
import {snapshot,restore,encodeJSON,decodeJSON} from '../src/sim/persist.ts';
import {packTints} from '../src/sim/view.ts';
import {TerrainRaster} from '../src/render/terrain.ts';
import {medicineExposure,newWildlife} from '../src/sim/wildlife.ts';
const empty=(seed=42)=>createSim({scenario:'empty',seed,size:[64,64],mode:'fantasy'});
type S=ReturnType<typeof empty>;
const paint=(s:S,m:number,x=20,y=20)=>s.applyNow({t:'paint',mat:m,x,y,r:0,replace:true});
const k=(s:S,x=20,y=20)=>s.w.idx(x,y);
const react=(s:S,tick=0,x=20,y=20)=>s.phys.sandbox.reactions.step(x,y,k(s,x,y),tick);
const audit=(s:S)=>{const a=s.audit();expect(a.inv).toEqual(a.exp);};
it('defines all 32 requested liquids with unique identities and working material profiles',()=>{
 expect(REFERENCE_LIQUIDS).toHaveLength(32);expect(new Set(REFERENCE_LIQUIDS).size).toBe(32);
 for(const m of REFERENCE_LIQUIDS){expect(MATERIALS[m]).toBeDefined();expect(MATERIALS[m].solid).toBe(false);expect(MATERIALS[m].description.length).toBeGreaterThan(20);}
});
it('moves solvent, nutrient, pigment and reaction progress together without duplication',()=>{
 const s=empty();paint(s,M.SODA);const a=k(s),b=k(s,25);s.w.phase[a]=5;s.w.setTint(a,0xffd53572);const before=s.audit();s.applyNow({t:'move',x:20,y:20,toX:25,toY:20,r:0});
 expect(s.w.mat[b]).toBe(M.SODA);expect(s.w.amt[b]).toBe(8);expect(s.w.carrier[b]).toBe(56);expect(s.w.phase[b]).toBe(5);expect(s.w.tint[b]).toBe(0xffd53572);expect(s.w.carrier[a]).toBe(0);expect(s.w.phase[a]).toBe(0);expect(s.audit()).toEqual(before);audit(s);
});
it('freezes and thaws food mixtures while retaining all water and nutrients',()=>{
 const s=empty();paint(s,M.MILK);const n=k(s);s.w.temp.fill(-10);react(s);expect(s.w.mat[n]).toBe(M.FROZEN_MIXTURE);expect(phaseOrigin(s.w.phase[n])).toBe(M.MILK);expect(s.w.cellFood()[1]).toBe(6);expect(s.w.carrier[n]).toBe(48);audit(s);
 s.w.temp.fill(20);react(s);expect(s.w.mat[n]).toBe(M.MILK);expect(s.w.amt[n]).toBe(6);expect(s.w.phase[n]).toBe(0);audit(s);
});
it('does not regenerate carbonation by freezing and thawing soda',()=>{
 const s=empty();paint(s,M.SODA);const n=k(s);s.w.phase[n]=8;s.w.temp.fill(-10);react(s);expect(phaseProgress(s.w.phase[n])).toBe(8);s.w.temp.fill(20);react(s);expect(s.w.phase[n]).toBe(8);
 for(let t=0;t<100;t++)react(s,t*8);expect(s.w.mat.some(m=>m===M.BUBBLE)).toBe(false);audit(s);
});
it('curdles milk using finite acid and splits its existing protein and water into curd and whey',()=>{
 const s=empty();paint(s,M.MILK);paint(s,M.VINEGAR,21);react(s);expect(s.w.get(20,20)).toBe(M.CHEESE);expect(s.w.get(19,20)).toBe(M.WHEY);expect(s.w.amt[k(s,21)]).toBe(63);expect(s.w.cellFood()[1]).toBe(6);audit(s);
});
it('separates steam and food residue on boiling, then rehydrates the dry powder',()=>{
 for(const [m,residue] of [[M.MILK,M.MILK_POWDER],[M.JUICE,M.SUGAR],[M.MAYO,M.NUT_OIL]]){const s=empty();paint(s,m);s.w.temp.fill(115);react(s);expect(s.w.get(20,20)).toBe(residue);expect(s.w.get(19,20)).toBe(M.STEAM);expect(s.w.carrier[k(s)]).toBe(0);audit(s);}
 const s=empty();paint(s,M.MILK_POWDER);paint(s,M.WATER,21);react(s);expect(s.w.get(20,20)).toBe(M.MILK);expect(s.w.carrier[k(s)]).toBe(64);expect(s.w.get(21,20)).toBe(M.AIR);audit(s);
});
it('sets supported cement and dries finite adhesive, retaining or recording their carrier water',()=>{
 const s=empty();paint(s,M.CEMENT);paint(s,M.BARRIER,20,21);s.w.amt[k(s)]=1;react(s,4);expect(s.w.get(20,20)).toBe(M.CURED_CONCRETE);expect(s.w.carrier[k(s)]).toBe(48);audit(s);
 paint(s,M.GLUE,30);expect(s.w.localAdhesion(29,20)).toBe(.95);for(let t=1;t<=90;t++)react(s,t*8,30);expect(s.w.get(30,20)).toBe(M.DRY_GLUE);expect(s.w.adhesiveCells).toBe(1);expect(s.w.ledger.sinks.water['adhesive evaporation']).toBe(48);audit(s);s.applyNow({t:'erase',x:30,y:20,r:0});expect(s.w.adhesiveCells).toBe(0);expect(s.w.localAdhesion(29,20)).toBe(0);audit(s);
});
it('dye stains contacting matter, bleach removes stains and exhausted pigment leaves its solvent',()=>{
 const s=empty();paint(s,M.DYE);paint(s,M.WOOD,19);s.w.amt[k(s)]=1;react(s);expect(s.w.tint[k(s,19)]).toBe(0xffc953a6);expect(s.w.get(20,20)).toBe(M.WATER);expect(s.w.amt[k(s)]).toBe(48);audit(s);
 paint(s,M.BLEACH);react(s);expect(s.w.tint[k(s,19)]).toBe(0);expect(s.w.amt[k(s)]).toBe(63);audit(s);
});
it('soap makes a water-bearing emulsion or foam, and collapsing foam returns the held water',()=>{
 const s=empty();paint(s,M.SOAP);paint(s,M.OIL,19);react(s);expect(s.w.get(20,20)).toBe(M.EMULSION);expect(s.w.get(19,20)).toBe(M.AIR);audit(s);
 const f=empty();paint(f,M.SOAP);paint(f,M.WATER,19);for(let t=0;t<100&&f.w.get(19,20)===M.WATER;t++)react(f,t*8);expect(f.w.get(19,20)).toBe(M.FOAM);expect(f.w.carrier[k(f,19)]).toBe(64);f.w.amt[k(f,19)]=1;react(f,4,19);expect(f.w.get(19,20)).toBe(M.WATER);expect(f.w.amt[k(f,19)]).toBe(64);audit(f);
});
it('bleach and acid produce local hazardous gas without deleting their carrier water',()=>{
 const s=empty();paint(s,M.BLEACH);paint(s,M.VINEGAR,21);react(s);expect(s.w.get(19,20)).toBe(M.CHLORINE);expect(s.w.amt[k(s)]).toBe(63);expect(s.w.amt[k(s,21)]).toBe(63);react(s,8,19);expect(s.w.toxin[k(s,19)]).toBeGreaterThan(0);audit(s);
});
it('fermentation consumes sugar, requires yeast and mild conditions, and retains solvent',()=>{
 const s=empty();paint(s,M.JUICE);paint(s,M.YEAST,21);for(let t=0;t<200&&s.w.get(20,20)===M.JUICE;t++)react(s,t*8);expect(s.w.get(20,20)).toBe(M.ALCOHOL);expect(s.w.get(19,20)).toBe(M.CO2);expect(s.w.carrier[k(s)]).toBe(48);expect(s.w.ledger.sinks.sugar['fermentation substrate']).toBe(8);audit(s);
 const c=empty();paint(c,M.JUICE);paint(c,M.YEAST,21);c.w.temp.fill(2);for(let t=0;t<100;t++)react(c,t*8);expect(c.w.get(20,20)).toBe(M.JUICE);audit(c);
});
it('cryogens boil into their specific gases and recondense only when sufficiently cold',()=>{
 for(const [m,gas,warm,cold] of [[M.LIQUID_NITROGEN,M.NITROGEN,-190,-210],[M.LIQUID_HYDROGEN,M.HYDROGEN,-240,-258]]){const s=empty();paint(s,m);expect(s.w.tempAt(20,20)).toBe(MATERIALS[m].initialTemperature);s.w.temp.fill(warm);react(s);expect(s.w.get(20,20)).toBe(gas);s.w.temp.fill(cold);react(s);expect(s.w.get(20,20)).toBe(m);audit(s);}
});
it('mercury freezes, melts, vaporizes and condenses, with contamination as a separate field',()=>{
 const s=empty();paint(s,M.MERCURY);for(const [T,m] of [[-45,M.FROZEN_MERCURY],[20,M.MERCURY],[360,M.MERCURY_VAPOR],[340,M.MERCURY]]){s.w.temp.fill(T);react(s);expect(s.w.get(20,20)).toBe(m);}expect(s.w.toxin[k(s)]).toBeGreaterThan(0);audit(s);
});
it('finite poison contaminates a neighbor and fictional antidote consumes poison without reviving life',()=>{
 const s=empty();paint(s,M.POISON);react(s);expect(s.w.toxin[k(s,19)]).toBe(160);expect(s.w.amt[k(s)]).toBe(63);paint(s,M.ANTIDOTE,21);react(s,8,21);expect(s.w.amt[k(s)]).toBe(55);expect(s.w.amt[k(s,21)]).toBe(63);audit(s);
});
it('fictional vaccine costs a dose, blocks new toy infections and does not cure an existing one',()=>{
 const s=empty(),a=newWildlife(1,11,20,20,0);paint(s,M.VACCINE,19);paint(s,M.PLAGUE,21);medicineExposure(s,a);expect(a.immunity).toBe(1800);expect(a.infection).toBe(0);expect(s.w.amt[k(s,19)]).toBe(63);a.infection=200;medicineExposure(s,a);expect(a.infection).toBe(196);expect(a.hp).toBeLessThan(1);audit(s);
});
it('color painting is cosmetic while paused and packets include both new stains and clear operations',()=>{
 const s=empty();paint(s,M.SAND);s.w.chunkDirty.fill(0);s.w.chunkActive.fill(0);const rng=s.rng.state(),ledger=s.audit();s.applyNow({t:'color',x:20,y:20,r:0,tint:0xff000000});expect(s.tick).toBe(0);expect(s.rng.state()).toEqual(rng);expect(s.audit()).toEqual(ledger);expect(s.w.chunkActive.some(Boolean)).toBe(false);
 expect(packTints(s,false)).toEqual(new Uint32Array([k(s),0xff000000]));expect(packTints(s,false)).toBeNull();s.w.setTint(k(s),0);expect(packTints(s,false)).toEqual(new Uint32Array([k(s),0]));
 const raster=new TerrainRaster(64,64);raster.cell(20,20,M.SAND,0,20);const plain=raster.pixels.slice();expect(raster.cell(20,20,M.SAND,0,20,0xff000000)).toBe(true);expect(raster.pixels).not.toEqual(plain);expect(raster.cell(20,20,M.SAND,0,20,0xff000000)).toBe(false);raster.cell(20,20,M.SAND,0,20,0);expect(raster.pixels).toEqual(plain);
});
it('rejects an invalid reaction before changing any cells or resource balances',()=>{
 const s=empty();paint(s,M.MILK);const a=s.audit();expect(()=>s.phys.sandbox.reactions.transaction([{k:k(s),m:M.WATER,amount:48},{k:k(s,21),m:M.STONE,amount:0,carrier:64}],'invalid')).toThrow('Invalid reaction');expect(s.w.get(20,20)).toBe(M.MILK);expect(s.audit()).toEqual(a);
});
it('retains mixture state through portable save/load and migrates the prior schema',()=>{
 const s=empty();paint(s,M.SODA);s.w.phase[k(s)]=6;s.w.temp.fill(-10);react(s);paint(s,M.GLUE,30);s.applyNow({t:'color',x:30,y:20,r:0,tint:0xff52a1d5});const f=snapshot(s),r=restore(decodeJSON(encodeJSON(f)));expect(f.version).toBe(4);expect(r.w.carrier).toEqual(s.w.carrier);expect(r.w.phase).toEqual(s.w.phase);expect(r.w.tint).toEqual(s.w.tint);expect(r.w.adhesiveCells).toBe(s.w.adhesiveCells);
 for(let t=0;t<80;t++){s.step();r.step();}expect(r.hash()).toBe(s.hash());expect(r.w.carrier).toEqual(s.w.carrier);expect(r.w.phase).toEqual(s.w.phase);expect(r.w.tint).toEqual(s.w.tint);audit(r);
 const old=snapshot(empty());old.version=2;delete old.state.world.carrier;delete old.state.world.phase;delete old.state.world.tint;const migrated=restore(old);expect(migrated.w.carrier.every(n=>n===0)).toBe(true);audit(migrated);
});
it('preserves water and all food ledgers during repeated mixed-liquid simulations',()=>{
 for(const seed of [1,19,42]){const s=empty(seed);for(let n=0;n<REFERENCE_LIQUIDS.length;n++)paint(s,REFERENCE_LIQUIDS[n],5+n%8*7,5+Math.floor(n/8)*10);for(let t=0;t<400;t++)s.step();audit(s);}
});
it('the labeled liquid lab runs actual reactions across seeds without scheduled outcomes',()=>{
 for(const seed of [1,19,42]){const s=createSim({scenario:'liquid-lab',seed});expect(s.scenarioInfo.notes).toHaveLength(8);expect(s.scheduled).toHaveLength(0);for(let t=0;t<320;t++)s.step();expect(s.w.mat.some(m=>m===M.CHEESE)).toBe(true);expect(s.w.mat.some(m=>m===M.CEMENT||m===M.CURED_CONCRETE)).toBe(true);expect(s.w.tintedCells.size).toBeGreaterThan(0);audit(s);}
});
it('rejects invalid imported carrier amounts and frozen compositions',()=>{
 const s=empty();paint(s,M.MILK);const f=snapshot(s);f.state.world.carrier[k(s)]=255;expect(()=>restore(f)).toThrow('carrier');const g=snapshot(s);g.state.world.phase[k(s)]=65535;expect(()=>restore(g)).toThrow('reaction progress');
});
it('enforces Fantasy gating through cell edits, cloner templates and imported saves',()=>{
 const s=createSim({scenario:'empty',seed:42,size:[64,64]});paint(s,M.CLONER);s.applyNow({t:'editCell',mat:M.CLONER,amount:M.VACCINE,x:20,y:20,temperature:20,charge:0,toxin:0});expect(s.w.amt[k(s)]).toBe(0);
 s.w.amt[k(s)]=M.VACCINE;s.phys.sandbox.step(20,20,k(s),1,0);expect(s.w.get(19,20)).toBe(M.AIR);expect(()=>restore(snapshot(s))).toThrow('Fantasy mode');
 s.mode=s.cfg.mode='fantasy';s.phys.sandbox.step(20,20,k(s),1,8);expect(s.w.get(19,20)).toBe(M.VACCINE);expect(s.w.carrier[k(s,19)]).toBe(48);audit(s);
});
