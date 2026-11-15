// Drops every palette material into open sky and checks that no dark "tunnel" backdrop appears in the air
// beneath it (the cutaway backdrop must only fill real underground space).
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
const b = await chromium.launch({ executablePath: process.env.BROWSER_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--disable-gpu'] });
try {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.goto(process.env.GAME_URL ?? 'http://127.0.0.1:5175/'); await p.waitForFunction(() => window.__antSandbox?.stats?.tick > 0, null, { timeout: 60000 });
  await p.evaluate(() => document.querySelector('#play').click()); await p.waitForFunction(() => !window.__antSandbox.stats.running);
  const cats = await p.evaluate(() => [...document.querySelectorAll('[data-cat]')].map(e => e.dataset.cat));
  const bad = [];
  let col = 20;
  for (const cat of cats) {
    const names = await p.evaluate(c => { document.querySelector(`[data-cat="${c}"]`).click(); return [...document.querySelectorAll('#palette [data-mat]')].map(b => b.textContent.trim()); }, cat);
    for (const name of names) {
      col += 6; if (col > 480) break;
      await p.evaluate(n => [...document.querySelectorAll('#palette [data-mat]')].find(b => b.textContent.trim() === n).click(), name);
      const pt = await p.evaluate(x => { const r = window.__antSandbox.renderer, c = document.querySelector('#world').getBoundingClientRect(); return { x: c.x + r.ox + (x + .5) * r.zoom, y: c.y + r.oy + 6.5 * r.zoom, surf: Math.min(...[-2, -1, 0, 1, 2].map(d => r.surface[x + d])) }; }, col);
      await p.mouse.click(pt.x, pt.y);
      await p.waitForTimeout(250);
      const res = await p.evaluate(([x, surf]) => {
        const r = window.__antSandbox.renderer, d = r.terrainCtx.getImageData(0, 0, r.W * 3, r.H * 3).data;
        let dark = 0;
        // open air above the pre-drop ground surface must stay transparent
        for (let dx = -2; dx <= 2; dx++) for (let y = 0; y < surf; y++) if (r.map[y * r.W + x + dx] === 0 && d[((y * 3 + 1) * r.W * 3 + (x + dx) * 3 + 1) * 4 + 3] > 0) dark++;
        return { dark, surf };
      }, [col, pt.surf]);
      if (res.dark > 0) bad.push(`${cat}/${name}: ${res.dark} dark air cells above surface ${res.surf}`);
    }
  }
  console.log(bad.length ? bad.join('\n') : 'no dark air under dropped materials');
  console.log('page errors:', errors);
  assert.deepEqual(bad, []); assert.deepEqual(errors, []);
} finally { await b.close(); }
