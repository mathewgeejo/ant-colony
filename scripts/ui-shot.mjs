import { chromium } from 'playwright-core';
import { writeFile, mkdir } from 'node:fs/promises';
const b=await chromium.launch({executablePath:process.env.BROWSER_PATH??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--disable-gpu']});
const tag=process.argv[2]??'now';
try{
 const p=await b.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await p.goto(process.env.GAME_URL??'http://127.0.0.1:5175/');await p.waitForFunction(()=>window.__antSandbox?.stats?.tick>0,null,{timeout:60000});await p.waitForTimeout(1500);
 await mkdir('artifacts',{recursive:true});
 await p.screenshot({path:`artifacts/shot-${tag}-desktop.png`});
 await p.evaluate(()=>document.querySelector('[data-cat="liquids"]').click());await p.waitForTimeout(300);
 await p.evaluate(()=>document.querySelector('#sidebar-toggle').click());await p.waitForTimeout(300);
 await p.screenshot({path:`artifacts/shot-${tag}-liquids.png`});
 await p.evaluate(()=>document.querySelector('#settings').click());await p.waitForTimeout(300);
 await p.screenshot({path:`artifacts/shot-${tag}-modal.png`});
 await p.keyboard.press('Escape');
 await p.setViewportSize({width:390,height:844});await p.waitForTimeout(600);
 await p.screenshot({path:`artifacts/shot-${tag}-mobile.png`});
 console.log(JSON.stringify({errors,overflow:await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),wide:await p.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1&&!e.closest('.sandbox-controls,.bench-top')).slice(0,8).map(e=>(e.id||e.className||e.tagName)+':'+Math.round(e.getBoundingClientRect().right)))}));
}finally{await b.close();}
