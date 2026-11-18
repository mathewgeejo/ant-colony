// Runs a world at warp, then screenshots the underground cutaway, an ant's Brain tab, a colony's Mind tab and
// the World census. Usage: GAME_URL=http://127.0.0.1:5175/ node scripts/ui-underground-check.mjs [scenario] [seconds]
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
const [scenario = 'living-world', secs = '40'] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: process.env.BROWSER_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--disable-gpu'] });
try {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); const errors = [];
  p.on('pageerror', (e) => errors.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto(`${process.env.GAME_URL ?? 'http://127.0.0.1:5175/'}?scenario=${scenario}&seed=1`);
  await p.waitForFunction(() => window.__antSandbox?.stats?.tick > 0, null, { timeout: 60000 });
  // warp
  await p.selectOption('#speed', '1000');
  await p.waitForTimeout(Number(secs) * 1000);
  const st = await p.evaluate(() => ({ tick: window.__antSandbox.stats.tick, day: window.__antSandbox.stats.day, ants: window.__antSandbox.stats.ants, cols: window.__antSandbox.stats.colonies.map((c) => [c.name, c.workers, c.nestDepth]) }));
  console.log(JSON.stringify(st));
  await p.evaluate(() => document.querySelector('#play').click());
  await p.waitForTimeout(800);
  await p.screenshot({ path: `artifacts/shot-underground-${scenario}.png` });
  // pick a worker and open its Brain tab
  await p.evaluate(() => {
    const r = window.__antSandbox.renderer, f = r.frame, c = document.querySelector('#world').getBoundingClientRect();
    const k = Math.min(f.antCount - 1, 5) * 7; const x = f.ants[k], y = f.ants[k + 1];
    r.focus(x, y);
    setTimeout(() => { const ev = (t) => document.querySelector('#world').dispatchEvent(new PointerEvent(t, { clientX: c.x + r.ox + (x + 0.5) * r.zoom, clientY: c.y + r.oy + (y + 0.5) * r.zoom, bubbles: true, pointerId: 1, button: 0 })); ev('pointerdown'); ev('pointerup'); }, 300);
  });
  await p.waitForSelector('#sheet-ant [data-sheet-tab="ant:brain"]', { timeout: 15000 });
  await p.click('#sheet-ant [data-sheet-tab="ant:brain"]'); await p.waitForTimeout(800);
  const brain = await p.evaluate(() => document.querySelector('#sheet-ant .sh-body')?.textContent ?? '');
  await p.screenshot({ path: `artifacts/shot-brain-${scenario}.png` });
  await p.click('#kingdoms-btn'); await p.waitForTimeout(800);
  const world = await p.evaluate(() => document.querySelector('#sheet-list .sh-body')?.textContent ?? '');
  await p.screenshot({ path: `artifacts/shot-world-${scenario}.png` });
  console.log({ brainOk: /Expected value of each choice/.test(brain) || /act on instinct/.test(brain), worldOk: /World population|census/.test(world), errors });
  assert.deepEqual(errors, []);
  console.log('ok');
} finally { await b.close(); }
