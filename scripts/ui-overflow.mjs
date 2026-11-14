import { chromium } from 'playwright-core';
const b=await chromium.launch({executablePath:process.env.BROWSER_PATH??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--disable-gpu']});
try{
 const p=await b.newPage({viewport:{width:390,height:844}});
 await p.goto('http://127.0.0.1:5175/');await p.waitForFunction(()=>window.__antSandbox?.stats?.tick>0,null,{timeout:60000});
 console.log(await p.evaluate(()=>{const out=[];for(const e of document.querySelectorAll('body *')){const r=e.getBoundingClientRect();if(r.right>innerWidth+1){let a=e.parentElement,clipped=false;while(a&&a!==document.body){const s=getComputedStyle(a);if(s.overflowX!=='visible'){clipped=true;break;}a=a.parentElement;}if(!clipped)out.push((e.id||e.className||e.tagName)+':'+Math.round(r.right));}}const all=[...document.querySelectorAll('*')].map(e=>[e,e.getBoundingClientRect()]).filter(([e,r])=>r.right>800).map(([e,r])=>(e.id||e.className||e.tagName)+':'+Math.round(r.right)+':'+getComputedStyle(e).position);out.push(...all.slice(0,12));return {sw:document.documentElement.scrollWidth,bw:document.body.scrollWidth,out:out.slice(0,10)};}));
}finally{await b.close();}
