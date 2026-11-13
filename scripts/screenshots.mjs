import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser = await chromium.launch({executablePath:process.env.BROWSER_PATH??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--disable-gpu']});
const page = await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1,acceptDownloads:true});
const errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));
checks.push = function(...items){ console.log(...items); return Array.prototype.push.apply(this,items); };
const click=async s=>{console.log('Click',s);await page.evaluate(s=>document.querySelector(s).click(),s);await page.waitForTimeout(300);};
const change=async(s,v)=>{await page.evaluate(({s,v})=>{const el=document.querySelector(s);el.value=v;el.dispatchEvent(new Event('change',{bubbles:true}));},{s,v});await page.waitForTimeout(400);};
const state=()=>page.evaluate(()=>({tick:window.__antSandbox?.stats?.tick,running:window.__antSandbox?.stats?.running,ants:window.__antSandbox?.stats?.ants}));
async function until(fn,ms=30000){const end=Date.now()+ms;while(Date.now()<end){if(await fn())return;await page.waitForTimeout(250);}throw new Error('Timed out waiting for condition');}
const cdp=await page.context().newCDPSession(page);
async function shot(path){await page.waitForTimeout(500);const r=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path,Buffer.from(r.data,'base64'));}
try{
  setTimeout(()=>{console.error('Browser check exceeded four minutes');process.exit(1);},240000).unref();
  await page.goto(process.env.GAME_URL??'http://127.0.0.1:5175/');await until(async()=>!!(await state()).tick);
  await mkdir('artifacts',{recursive:true});await click('#play');
  await until(async()=>(await state()).running===false);const paused=await state();await page.waitForTimeout(700);assert.equal((await state()).tick,paused.tick);checks.push('pause freezes ticks');
  await click('#step');await until(async()=>(await state()).tick===paused.tick+1);checks.push('single step advances one tick');
  const point=await page.evaluate(()=>{const r=window.__antSandbox.renderer,b=document.querySelector('#world').getBoundingClientRect();return{x:b.x+r.ox+30*r.zoom,y:b.y+r.oy+90*r.zoom};});
  await click('[data-mat="6"]');await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',clickCount:1});await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',clickCount:1});
  await until(()=>page.evaluate(()=>window.__antSandbox.renderer.map[90*window.__antSandbox.renderer.W+30]===6));checks.push('painting changes terrain');
  await click('[data-tool="dig"]');await page.mouse.click(point.x,point.y);await until(()=>page.evaluate(()=>window.__antSandbox.renderer.map[90*window.__antSandbox.renderer.W+30]===0));checks.push('digging changes traversability');
  const z=await page.evaluate(()=>window.__antSandbox.renderer.zoom);await click('#zoom-in');assert.ok(await page.evaluate(z=>window.__antSandbox.renderer.zoom>z,z));checks.push('zoom controls');
  await click('#save-menu');await until(()=>page.evaluate(()=>!!document.querySelector('#save-now')));await click('#save-now');await until(()=>page.evaluate(()=>!!document.querySelector('[data-load]')));const savedTick=(await state()).tick;
  await click('#modal-close');await click('#step');await click('#save-menu');await until(()=>page.evaluate(()=>!!document.querySelector('[data-load]')));await click('[data-load]');await until(async()=>(await state()).tick===savedTick);checks.push('IndexedDB save and load');
  await click('#new');await click('[data-scenario="moved-food"]');await click('#create-world');await change('#speed','1000');
  await until(async()=>(await state()).tick>15000,90000);await click('#play');
  await click('#fit');await change('#overlay','trail');await page.waitForTimeout(600);assert.equal(await page.evaluate(()=>window.__antSandbox.renderer.overlay),'trail');checks.push('signal overlay');
  await click('#scenario-help');await click('[data-action="0"]');checks.push('moved food intervention');
  await shot('artifacts/desktop.png');
  await click('#journal');await click('[data-jtab="lineage"]');await until(()=>page.evaluate(()=>!!document.querySelector('.lineage-node')));checks.push('lineage journal');await click('#modal-close');
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>document.body.classList.add('panel-hidden'));await click('#fit');await shot('artifacts/mobile.png');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);checks.push('phone viewport fits');
  await page.setViewportSize({width:1440,height:900});await click('#new');await click('[data-scenario="flooded-passage"]');await click('#create-world');await click('#scenario-help');await click('[data-action="0"]');await change('#speed','100');await page.waitForTimeout(1500);checks.push('flood intervention and speed changes');
  await click('#play');
  const info=await page.evaluate(()=>({tick:window.__antSandbox.stats.tick,ants:window.__antSandbox.stats.ants,fps:window.__antSandbox.renderer.fps,renderMs:window.__antSandbox.renderer.renderMs,sim:window.__antSandbox.stats.perf,viewport:{width:innerWidth,height:innerHeight}}));
  assert.deepEqual(errors,[]);await writeFile('artifacts/browser-checks.json',JSON.stringify({browser:browser.version(),info,checks,errors},null,2));console.log(JSON.stringify({info,checks,errors}));
}finally{await browser.close();}
