import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
const b=await chromium.launch({executablePath:process.env.BROWSER_PATH??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--disable-gpu']});
try{
 const p=await b.newPage({viewport:{width:1440,height:900}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(process.env.GAME_URL??'http://127.0.0.1:5175/');await p.waitForFunction(()=>window.__antSandbox?.stats?.tick>0,null,{timeout:60000});
 const pos=(x,y)=>p.evaluate(({x,y})=>{const r=window.__antSandbox.renderer,c=document.querySelector('#world').getBoundingClientRect();return{x:c.x+r.ox+(x+.5)*r.zoom,y:c.y+r.oy+(y+.5)*r.zoom};},{x,y});
 let q=await pos(100,90);await p.mouse.click(q.x,q.y);
 await p.waitForFunction(()=>!document.querySelector('#cell-card').hidden&&document.querySelector('#cell-pos').textContent.includes('100, 90'));
 assert.equal(await p.evaluate(()=>document.body.classList.contains('panel-hidden')),true,'inspect keeps the observatory closed');
 await p.waitForFunction(()=>document.querySelector('#inspect-detail').textContent.includes('100, 90'));
 await p.screenshot({path:'artifacts/shot-inspect-card.png'});
 const before=await p.evaluate(()=>{const r=window.__antSandbox.renderer;return{ox:r.ox,oy:r.oy,mat:[...Array(49)].map((_,k)=>r.map[(137+(k/7|0))*r.W+297+k%7]).join()};});
 q=await pos(300,140);await p.mouse.move(q.x,q.y);await p.mouse.down({button:'right'});await p.mouse.move(q.x-120,q.y-60,{steps:6});await p.mouse.up({button:'right'});await p.waitForTimeout(400);
 const after=await p.evaluate(()=>{const r=window.__antSandbox.renderer;return{ox:r.ox,oy:r.oy,mat:[...Array(49)].map((_,k)=>r.map[(137+(k/7|0))*r.W+297+k%7]).join()};});
 assert.notEqual(after.ox,before.ox,'right-drag pans in inspect mode');assert.ok(after.mat===before.mat,'right-drag in inspect does not erase');
 assert.deepEqual(errors,[]);console.log('ok',before,after);
}finally{await b.close();}
