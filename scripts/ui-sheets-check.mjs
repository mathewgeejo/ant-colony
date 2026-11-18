// Datasheets: clicking an ant opens its sheet (tabs work, close clears selection); the Kingdoms window lists
// kingdoms and opens a kingdom sheet with all tabs. Screenshots go to artifacts/.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
const b = await chromium.launch({ executablePath: process.env.BROWSER_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--disable-gpu'] });
try {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.goto(process.env.GAME_URL ?? 'http://127.0.0.1:5175/'); await p.waitForFunction(() => window.__antSandbox?.stats?.tick > 0, null, { timeout: 60000 });
  await p.evaluate(() => document.querySelector('#play').click()); await p.waitForFunction(() => !window.__antSandbox.stats.running);
  assert.equal(await p.locator('.sheet:not([hidden])').count(), 0, 'no sheet until asked');
  await p.evaluate(() => { const r = window.__antSandbox.renderer, f = r.frame; const x = f.ants[0], y = f.ants[1], c = document.querySelector('#world').getBoundingClientRect(); for (const t of ['pointerdown', 'pointerup']) document.querySelector('#world').dispatchEvent(new PointerEvent(t, { clientX: c.x + r.ox + (x + .5) * r.zoom, clientY: c.y + r.oy + (y + .5) * r.zoom, bubbles: true, pointerId: 1, button: 0 })); });
  await p.waitForSelector('#sheet-ant:not([hidden]) .sh-bar', { timeout: 15000 });
  for (const tab of ['story', 'genes', 'overview']) { await p.click(`[data-sheet-tab="ant:${tab}"]`); await p.waitForSelector(`[data-sheet-tab="ant:${tab}"].active`); }
  await p.screenshot({ path: 'artifacts/sheet-ant.png' });
  await p.click('#sheet-ant [data-sheet-act="kingdom"]');
  await p.waitForSelector('#sheet-colony:not([hidden]) .sh-body');
  for (const tab of ['activity', 'territory', 'war', 'kingdom', 'overview']) { await p.click(`[data-sheet-tab="colony:${tab}"]`); await p.waitForSelector(`[data-sheet-tab="colony:${tab}"].active`); }
  await p.click('#kingdoms-btn');
  await p.waitForSelector('#sheet-list:not([hidden]) .sh-row');
  await p.click('[data-sheet-tab="list:diplomacy"]'); await p.waitForSelector('[data-sheet-tab="list:diplomacy"].active');
  await p.screenshot({ path: 'artifacts/sheet-all.png' });
  await p.click('[data-sheet-close="ant"]');
  await p.evaluate(() => document.querySelector('#step')?.click());
  await p.waitForFunction(() => !window.__antSandbox.stats.selectedAnt, null, { timeout: 15000 });
  assert.ok(await p.locator('#sheet-ant').isHidden());
  console.log({ errors }); assert.deepEqual(errors, []); console.log('ok');
} finally { await b.close(); }
