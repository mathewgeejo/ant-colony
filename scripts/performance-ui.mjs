import { chromium } from 'playwright-core';
import { mkdir,writeFile } from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--disable-gpu']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.argv[3]??'http://127.0.0.1:5175/');await page.waitForFunction(()=>window.__antSandbox?.stats?.tick>10,{},{timeout:60000});
 const requestedSpeed=Number(process.argv[5]??10);
 await page.evaluate(speed=>{const e=document.querySelector('#speed');e.value=String(speed);e.dispatchEvent(new Event('change'));},requestedSpeed);
 if(process.argv[4]==='stress-test'){
   await page.evaluate(()=>{document.querySelector('#new').click();document.querySelector('[data-scenario="stress-test"]').click();document.querySelector('#create-world').click();});await page.waitForFunction(()=>window.__antSandbox?.stats?.scenario?.id==='stress-test'&&window.__antSandbox.stats.tick>10,{},{timeout:60000});
 }
 await page.evaluate(()=>{const r=window.__antSandbox.renderer,fn=r.accept.bind(r);window.__perf={accept:[],chunks:[],frames:0,paintAt:0,eventAt:0,latency:null,eventToTerrainMs:null};document.querySelector('#world').addEventListener('pointerdown',()=>{const p=window.__perf;if(p.paintAt&&!p.eventAt)p.eventAt=performance.now();},{capture:true});r.accept=f=>{const t=performance.now();fn(f);const p=window.__perf;p.accept.push(performance.now()-t);p.chunks.push(f.chunkCount);p.frames++;if(p.paintAt&&p.latency===null&&r.map[8*r.W+180]===4){p.latency=performance.now()-p.paintAt;p.eventToTerrainMs=p.eventAt?performance.now()-p.eventAt:null;}};document.querySelector('#play').click();});
 await page.waitForTimeout(500);await page.evaluate(()=>document.querySelector('[data-mat="4"]').click());
 const point=await page.evaluate(()=>{const r=window.__antSandbox.renderer,b=document.querySelector('#world').getBoundingClientRect();window.__perf.paintAt=performance.now();return{x:b.x+r.ox+180*r.zoom,y:b.y+r.oy+8*r.zoom};});
 await page.mouse.click(point.x,point.y);await page.waitForTimeout(600);
 await page.evaluate(()=>document.querySelector('#play').click());
 const start=performance.now();for(let k=0;k<40;k++){await page.mouse.click(point.x+(k%10)*8,point.y+(k%3)*8);await page.waitForTimeout(25);}
 await page.waitForTimeout(2500);
 const out=await page.evaluate(()=>{const p=window.__perf,s=window.__antSandbox.stats,r=window.__antSandbox.renderer;return{acceptMeanMs:p.accept.reduce((a,b)=>a+b,0)/p.accept.length,acceptMaxMs:Math.max(...p.accept),meanChunks:p.chunks.reduce((a,b)=>a+b,0)/p.chunks.length,packets:p.frames,paintLatencyMs:p.latency,fps:r.fps,renderMs:r.renderMs,stepMs:s.perf.stepMs,fieldMs:s.perf.fieldMs,ants:s.ants,tick:s.tick,workerAchievedSpeed:s.achievedSpeed,running:s.running,frameId:r.frame?.id,lastMessage:document.querySelector('#toast').textContent};});
 out.eventToTerrainMs=await page.evaluate(()=>window.__perf.eventToTerrainMs);out.requestedSpeed=requestedSpeed;out.testSeconds=(performance.now()-start)/1000;out.errors=errors;await mkdir('artifacts',{recursive:true});await writeFile('artifacts/performance-'+(process.argv[2]??'current')+'.json',JSON.stringify(out,null,2));console.log(JSON.stringify(out));
}finally{await browser.close();}
