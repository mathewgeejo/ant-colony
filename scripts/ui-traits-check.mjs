// Selects a worker, opens the trait manager, toggles a trait and checks the inspector reflects it.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
const b = await chromium.launch({ executablePath: process.env.BROWSER_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--disable-gpu'] });
try {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.goto(process.env.GAME_URL ?? 'http://127.0.0.1:5175/'); await p.waitForFunction(() => window.__antSandbox?.stats?.tick > 0, null, { timeout: 60000 });
  await p.evaluate(() => document.querySelector('#play').click()); await p.waitForFunction(() => !window.__antSandbox.stats.running);
  // select the first ant via the worker protocol (the queen in the default scenario)
  await p.evaluate(() => { const r = window.__antSandbox.renderer, f = r.frame; const x = f.ants[0], y = f.ants[1], c = document.querySelector('#world').getBoundingClientRect(); document.querySelector('#world').dispatchEvent(new PointerEvent('pointerdown', { clientX: c.x + r.ox + (x + .5) * r.zoom, clientY: c.y + r.oy + (y + .5) * r.zoom, bubbles: true, pointerId: 1, button: 0 })); document.querySelector('#world').dispatchEvent(new PointerEvent('pointerup', { clientX: c.x + r.ox + (x + .5) * r.zoom, clientY: c.y + r.oy + (y + .5) * r.zoom, bubbles: true, pointerId: 1, button: 0 })); });
  await p.evaluate(() => { document.body.classList.remove('panel-hidden'); document.querySelector('#inspector').setAttribute('open', ''); });
  await p.waitForSelector('#manage-traits', { timeout: 15000 });
  await p.click('#manage-traits');
  await p.waitForSelector('[data-trait]');
  const n = await p.locator('[data-trait]').count();
  const name = await p.locator('[data-trait="2"]').textContent();
  const pressed = await p.locator('[data-trait="2"]').getAttribute('aria-pressed');
  await p.click('[data-trait="2"]');
  await p.waitForTimeout(300);
  assert.equal(await p.locator('[data-trait="2"]').getAttribute('aria-pressed'), pressed === 'true' ? 'false' : 'true');
  await p.keyboard.press('Escape');
  await p.evaluate(() => document.querySelector('#step')?.click());
  await p.waitForFunction(([nm, was]) => { const chips = [...document.querySelectorAll('#inspect-detail .trait-chip')].map(e => e.textContent); return was === 'true' ? !chips.includes(nm) : chips.includes(nm); }, [name, pressed], { timeout: 15000 });
  await p.screenshot({ path: 'artifacts/shot-traits.png' });
  console.log({ traitsListed: n, toggled: name, errors }); assert.ok(n >= 40); assert.deepEqual(errors, []); console.log('ok');
} finally { await b.close(); }
