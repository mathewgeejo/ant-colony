// Excavated nest cells and enclosed air under the ground must keep the dark tunnel backdrop in the cutaway.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
const b = await chromium.launch({ executablePath: process.env.BROWSER_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--disable-gpu'] });
try {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(process.env.GAME_URL ?? 'http://127.0.0.1:5175/'); await p.waitForFunction(() => window.__antSandbox?.stats?.tick > 600, null, { timeout: 90000 });
  const res = await p.evaluate(() => {
    const r = window.__antSandbox.renderer, d = r.terrainCtx.getImageData(0, 0, r.W * 3, r.H * 3).data;
    let nest = 0, dark = 0;
    for (let k = 0; k < r.map.length; k++) if (r.map[k] === 0 && r.cellDetails[k] & 64) { nest++; const x = k % r.W, y = (k / r.W) | 0; if (d[((y * 3 + 1) * r.W * 3 + x * 3 + 1) * 4 + 3] > 0) dark++; }
    return { nest, dark };
  });
  console.log(res); assert.ok(res.nest > 0 && res.dark === res.nest, 'every excavated nest cell draws as tunnel'); console.log('ok');
} finally { await b.close(); }
