import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
const b=await chromium.launch({executablePath:process.env.BROWSER_PATH??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--disable-gpu']});
try{
 const p=await b.newPage({viewport:{width:1440,height:900}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(process.env.GAME_URL??'http://127.0.0.1:5175/');await p.waitForFunction(()=>window.__antSandbox?.stats?.tick>0,null,{timeout:60000});
 await p.evaluate(()=>document.querySelector('#play').click());await p.waitForFunction(()=>!window.__antSandbox.stats.running);
 const sand=await p.evaluate(()=>{document.querySelector('[data-cat="powders"]').click();const b=[...document.querySelectorAll('#palette [data-mat]')].find(b=>b.textContent.trim()==='Sand');b.click();return Number(b.dataset.mat);});
 const pt=await p.evaluate(()=>{const r=window.__antSandbox.renderer,c=document.querySelector('#world').getBoundingClientRect();return{x:c.x+r.ox+(60.5)*r.zoom,y:c.y+r.oy+(6.5)*r.zoom};});
 await p.mouse.click(pt.x,pt.y);
 await p.waitForFunction(m=>{const r=window.__antSandbox.renderer;return r.map[6*r.W+60]===m;},sand);await p.waitForTimeout(200);
 const res=await p.evaluate(()=>{const r=window.__antSandbox.renderer,d=r.terrainCtx.getImageData(0,0,r.W*3,r.H*3).data;const a=(x,y)=>d[((y*3+1)*r.W*3+x*3+1)*4+3];const surf=[...r.map.keys()].find(k=>k%r.W===60&&r.map[k]!==0);return{below:[12,20,30].map(y=>a(60,y)),groundY:Math.floor(surf/r.W)};});
 console.log(res);assert.ok(res.below.every(v=>v===0),'air under a falling grain must stay transparent');assert.deepEqual(errors,[]);console.log('ok');
}finally{await b.close();}
