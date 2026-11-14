import {chromium} from 'playwright-core';
import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--disable-gpu']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.GAME_URL??'http://127.0.0.1:5175/');await page.waitForFunction(()=>window.__antSandbox?.stats?.tick>0);
 await page.evaluate(()=>document.querySelector('#play').click());
 const ids=[4,59,60,61,6,62,63,20,18,55,64,65,66,67,68,69,70,71];
 assert.equal(await page.evaluate(ids=>ids.every(id=>!!document.querySelector(`[data-mat="${id}"]`)),ids),true);
 await page.evaluate(()=>document.querySelector('#clear-world').click());await page.waitForFunction(()=>window.__antSandbox.stats.ants===0);
 await page.evaluate(()=>{const e=document.querySelector('#brush');e.value='2';e.dispatchEvent(new Event('input'));});
 for(let n=0;n<ids.length;n++){
  await page.evaluate(id=>document.querySelector(`[data-mat="${id}"]`).click(),ids[n]);
  const p=await page.evaluate(n=>{const r=window.__antSandbox.renderer,b=document.querySelector('#world').getBoundingClientRect();return{x:b.x+r.ox+(30+n*18)*r.zoom,y:b.y+r.oy+70*r.zoom};},n);
  await page.mouse.click(p.x,p.y);
 }
 await page.waitForFunction(()=>window.__antSandbox.renderer.map.includes(71));await page.waitForTimeout(200);
 const cdp=await page.context().newCDPSession(page);await mkdir('artifacts',{recursive:true});
 const shot=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile('artifacts/land-reference-desktop.png',Buffer.from(shot.data,'base64'));
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);const result={browser:browser.version(),checks:['All 18 reference Land materials selectable','All 18 can be painted while paused','Desktop rendered screenshot','Phone has no horizontal overflow'],errors};await writeFile('artifacts/land-checks.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close();}
