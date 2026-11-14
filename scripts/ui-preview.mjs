import { chromium } from 'playwright-core';
import { writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const b=await chromium.launch({executablePath:process.env.BROWSER_PATH??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--disable-gpu']});
try{
 const p=await b.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(process.env.GAME_URL??process.argv[2]??'http://127.0.0.1:5175/');await p.waitForTimeout(2000);
 await p.evaluate(()=>document.querySelector('#play').click());await p.waitForTimeout(600);
 const checks=[];
 await p.evaluate(()=>document.querySelector('[data-cat="food"]').click());
 assert.equal(await p.evaluate(()=>!!document.querySelector('[data-mat="1"]')),true);checks.push('Food and water category');
 await p.evaluate(()=>{const s=document.querySelector('#palette-search');s.value='protein';s.dispatchEvent(new Event('input'));});
 assert.equal(await p.evaluate(()=>!document.querySelector('[data-mat="12"]').hidden&&(!document.querySelector('[data-mat="1"]')||document.querySelector('[data-mat="1"]').hidden)),true);checks.push('Material search filters buttons');
 await p.evaluate(()=>{const s=document.querySelector('#palette-search');s.value='';s.dispatchEvent(new Event('input'));document.querySelector('[data-cat="terrain"]').click();document.querySelector('#sidebar-toggle').click();});
 assert.equal(await p.evaluate(()=>document.body.classList.contains('panel-hidden')),false);checks.push('Observatory opens over full-width world');
 await p.evaluate(()=>document.querySelector('#collapse').click());
 const c=await p.context().newCDPSession(p);await mkdir('artifacts',{recursive:true});
 async function shot(name){const r=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile('artifacts/'+name,Buffer.from(r.data,'base64'));console.log(name);}
 await shot('ui-desktop.png');
 await p.setViewportSize({width:390,height:844});await p.waitForTimeout(500);await p.evaluate(()=>document.querySelector('#fit').click());await p.waitForTimeout(300);await shot('ui-mobile.png');
 console.log(await p.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,world:document.querySelector('#world').getBoundingClientRect().toJSON(),palette:document.querySelector('#palette').getBoundingClientRect().toJSON()})));
 assert.deepEqual(errors,[]);await writeFile('artifacts/ui-checks.json',JSON.stringify({browser:b.version(),checks,viewports:[[1440,900],[390,844]],errors},null,2));
}finally{await b.close();}
