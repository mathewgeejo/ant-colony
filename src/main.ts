import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import '@fontsource/silkscreen/400.css';
import './style.css';
import { Renderer } from './render/renderer.ts';
import { MATERIALS, M,FANTASY_MATERIALS } from './sim/materials.ts';
import { WILDLIFE,wildlifeByKey,type WildlifeDef } from './sim/wildlife-defs.ts';
import { LIFE_MATERIALS } from './sim/life-ecology.ts';
import { REFERENCE_LIQUIDS } from './sim/liquid-reactions.ts';
import { REFERENCE_POWDERS } from './sim/powder-reactions.ts';
import { SCENARIOS } from './sim/scenarios.ts';
import { LOCI, MODES } from './sim/genetics.ts';
import { TRAITS } from './sim/traits.ts';
import { ACT_NAMES, NA as BRAIN_NA, NH as BRAIN_NH, NI as BRAIN_NI, SENSE_NAMES } from './sim/brain.ts';
import type { Mode } from './sim/genetics.ts';
import type { OverlayKind, ToWorker } from './protocol.ts';
import type { Command } from './sim/sim.ts';

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)!;
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const icon = (name: string) => {
  const paths: Record<string, string> = {
    ant: '<path d="M10 8 7 5M14 8l3-3M8 12H4m12 0h4M9 15l-4 4m10-4 4 4"/><ellipse cx="12" cy="6" rx="2" ry="3"/><ellipse cx="12" cy="12" rx="2" ry="2"/><ellipse cx="12" cy="18" rx="3" ry="4"/>',
    play: '<path d="m8 5 11 7-11 7z"/>', pause: '<path d="M8 5v14M16 5v14"/>', step: '<path d="m5 5 10 7-10 7zM19 5v14"/>',
    cursor: '<path d="m5 3 14 10-7 1-3 7z"/>', shovel: '<path d="m6 18 9-9m-3-6 9 9m-6-9 6 6M6 12l6 6-5 4-5-5z"/>',
    drop: '<path d="M12 2C9 7 5 11 5 15a7 7 0 0 0 14 0c0-4-4-8-7-13Z"/>', sun: '<circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
    book: '<path d="M12 5C8 2 5 3 2 4v16c4-1 6-1 10 1 4-2 6-2 10-1V4c-3-1-6-2-10 1v16"/>',
    save: '<path d="M4 3h14l3 3v15H3V3h1Zm3 0v7h10V3M7 21v-7h10v7"/>', settings: '<path d="M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6m-7 0v6"/>',
    plus: '<path d="M12 4v16M4 12h16"/>', minus: '<path d="M4 12h16"/>', fit: '<path d="M3 9V3h6m6 0h6v6m0 6v6h-6m-6 0H3v-6"/>',
    layers: '<path d="m12 3 10 6-10 6L2 9Zm-9 11 9 5 9-5M3 19l9 4 9-4"/>', close: '<path d="m5 5 14 14M5 19 19 5"/>', tree: '<path d="M12 3v7M5 20v-6h14v6M12 10v4"/><circle cx="12" cy="3" r="2"/><circle cx="5" cy="21" r="2"/><circle cx="19" cy="21" r="2"/>',
    pan: '<path d="M12 2v20M2 12h20M12 2 9 5m3-3 3 3M12 22l-3-3m3 3 3-3M2 12l3-3m-3 3 3 3m17-3-3-3m3 3-3 3"/>',
    undo: '<path d="M9 5 4 10l5 5M4 10h10a6 6 0 0 1 0 12h-3"/>', redo: '<path d="m15 5 5 5-5 5m5-5H10a6 6 0 0 0 0 12h3"/>',
    map: '<path d="M3 5v15l6-3 6 3 6-3V2l-6 3-6-3-6 3Zm6-3v15m6-12v15"/>', camera: '<path d="M3 7h4l2-3h6l2 3h4v13H3z"/><circle cx="12" cy="13" r="4"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>', info: '<circle cx="12" cy="12" r="10"/><path d="M12 11v6m0-10v1"/>',
    reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5"/>', edit: '<path d="m4 20 4-1 11-11-3-3L5 16zM14 7l3 3"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">${paths[name] ?? paths.settings}</svg>`;
};
const OVERLAYS: [string, string][] = [['none','No overlay'],['trail','Foraging trails'],['alarm','Alarm signals'],['nest','Nest odour'],['moisture','Soil moisture'],['humidity','Air humidity'],['temperature','Temperature'],['food','Food resources'],['territory','Colony activity'],['mortality','Recent mortality'],['toxin','Contamination'],['trait','Water-balance trait'],['charge','Electrical charge'],['dose','Radiation exposure · game units']];
const CATS: [string, string][] = [['tools','Tools'],['terrain','Land'],['food','Food'],['life','Life'],['climate','Environment'],['powders','Powders'],['liquids','Liquids'],['gases','Gases'],['solids','Solids'],['energy','Energy']];

$('#app').innerHTML = `
<header class="topbar">
  <a class="brand" href="#" title="Fit world" aria-label="Ant Colony Sandbox: fit world">${icon('ant')}<h1>Ant colony<span>Sandbox</span></h1></a>
  <div class="time-controls">
    <button id="play" class="icon-btn btn-play active" title="Pause (Space)" aria-label="Pause simulation">${icon('pause')}</button>
    <button id="step" class="icon-btn" title="Single step (.)" aria-label="Single step">${icon('step')}</button>
    <label class="sr-only" for="speed">Simulation speed</label><select id="speed"><option value="1" selected>1×</option><option value="5">5×</option><option value="10">10×</option><option value="25">25×</option><option value="100">100×</option><option value="1000">Warp</option></select>
    <div class="clock"><strong id="day">Day 1</strong><span id="season">Spring · accelerated time</span></div>
  </div>
  <nav>
    <button id="new" class="text-btn">${icon('plus')}<span>New world</span></button>
    <button id="journal" class="text-btn">${icon('book')}<span>Field journal</span><i id="journal-count">0</i></button>
    <button id="save-menu" class="icon-btn" title="Save and load" aria-label="Save and load">${icon('save')}</button>
    <button id="settings" class="icon-btn" title="Settings and help (\\)" aria-label="Settings and help">${icon('settings')}</button>
    <button id="fullscreen" class="icon-btn" title="Fullscreen" aria-label="Toggle fullscreen">${icon('fit')}</button>
  </nav>
</header>
<main class="play-space">
  <div class="world-wrap">
    <canvas id="world" tabindex="0" aria-label="Editable ant ecosystem. Drag to paint; right-drag, middle-drag, Alt-drag or the hand tool pans. Scroll or pinch to zoom. Arrow keys pan, plus and minus zoom."></canvas>
    <div class="world-heading"><span class="live-dot"></span><strong id="world-title">First colony</strong><span id="mode-badge">Naturalistic</span></div>
    <div id="sheets"></div>
    <div class="hud-right">
      <button id="kingdoms-btn" title="Kingdoms &amp; alliances" aria-label="Open kingdoms and alliances">${icon('map')}<span>Kingdoms</span></button>
      <button id="sidebar-toggle" title="Open colony observatory" aria-label="Toggle colony panel">${icon('ant')}<span id="colony-peek">Colony</span></button>
      <div class="world-weather">${icon('sun')}<span id="weather">21°C · mild</span></div>
    </div>
    <div class="quick-tools" role="toolbar" aria-label="World tools">
      <button class="icon-btn" data-tool="inspect" title="Inspect (I)" aria-label="Inspect">${icon('cursor')}</button>
      <button class="icon-btn" data-tool="pan" title="Pan (H) · or middle-drag" aria-label="Pan">${icon('pan')}</button>
      <button class="icon-btn" data-tool="dig" title="Dig (D)" aria-label="Dig">${icon('shovel')}</button>
      <button class="icon-btn" data-tool="erase" title="Erase (X)" aria-label="Erase">${icon('close')}</button>
      <span class="sep"></span>
      <button class="icon-btn" data-tool="heat" title="Heat" aria-label="Heat">${icon('sun')}</button>
      <button class="icon-btn" data-tool="cool" title="Cool" aria-label="Cool">${icon('drop')}</button>
    </div>
    <div class="view-tools" role="toolbar" aria-label="Camera">
      <button class="icon-btn" id="zoom-out" title="Zoom out (−)" aria-label="Zoom out">${icon('minus')}</button>
      <output id="zoom-level" aria-live="off">100%</output>
      <button class="icon-btn" id="zoom-in" title="Zoom in (+)" aria-label="Zoom in">${icon('plus')}</button>
      <button class="icon-btn" id="fit" title="Fit world (F)" aria-label="Fit world">${icon('fit')}</button>
      <button class="icon-btn active" id="minimap-toggle" title="Minimap (M)" aria-label="Toggle minimap" aria-pressed="true">${icon('map')}</button>
    </div>
    <div id="overlay-legend" class="overlay-legend" hidden></div>
    <div class="world-bottom"><div id="hint">Click an ant to follow its story. Scroll to look closer.</div><div id="position">512 × 256 cells</div></div>
    <div id="cell-card" class="cell-card" hidden><canvas id="cell-zoom" width="99" height="99" aria-hidden="true"></canvas><div class="cell-info"><strong id="cell-name"></strong><small id="cell-pos"></small><div id="cell-lines"></div><button id="cell-more" class="cell-more">Open in observatory</button></div><button id="cell-close" class="icon-btn" aria-label="Close cell card">${icon('close')}</button></div>
    <div class="paused-tag" aria-hidden="true">Paused</div>
    <button id="restore-ui">Show controls</button>
  </div>
  <aside id="sidebar"><div class="panel-head"><span>${icon('ant')} Colony observatory</span><button id="collapse" class="icon-btn" aria-label="Hide colony panel">${icon('close')}</button></div><label class="sr-only" for="colony-select">Selected colony</label><select id="colony-select"><option>Founding queen</option></select><div id="colony-detail" class="panel-content"><p>Waiting for the world…</p></div><details id="inspector" open><summary>Inspector <span>click the world</span></summary><div id="inspect-detail" class="panel-content"><p class="muted">Every ant has a reason.<br>Click one to see its task, needs, and inherited traits.</p></div></details><details><summary>Recent events <span id="event-count">0</span></summary><div id="events" class="event-list"></div></details><details id="metrics"><summary>Developer metrics</summary><div id="metrics-detail" class="panel-content"></div></details></aside>
</main>
<section class="workbench" aria-label="Sandbox tools">
  <div class="sandbox-controls" role="toolbar" aria-label="Sandbox controls">
    <div class="current-tool" title="Selected tool"><span id="tool-chip" class="tool-chip"></span><span id="tool-name">Inspector</span></div>
    <div class="group brush-group"><button id="brush-minus" class="sq" title="Smaller brush ([)" aria-label="Smaller brush">−</button><label class="sr-only" for="brush">Brush size</label><input id="brush" type="range" min="0" max="15" value="3"><output id="brush-value" title="Brush width in cells">7</output><button id="brush-plus" class="sq" title="Larger brush (])" aria-label="Larger brush">+</button></div>
    <div class="group seg" role="group" aria-label="Draw shape"><label class="sr-only" for="draw-shape">Draw shape</label><select id="draw-shape" class="sr-only"><option value="brush">Brush</option><option value="line">Line</option><option value="box">Rectangle</option><option value="fill">Fill</option></select><button data-shape="brush" class="selected">Brush</button><button data-shape="line">Line</button><button data-shape="box">Box</button><button data-shape="fill">Fill</button></div>
    <div class="group"><input id="replace" type="checkbox" checked hidden><button id="replace-toggle" class="selected" title="Overwrite occupied cells">Replace</button><button id="shift-toggle" aria-pressed="false" title="Latch Shift: stronger tools and connected lines">Shift</button><label class="paint-color" title="Paint and dye color"><span class="sr-only">Paint color</span><input id="paint-color" type="color" value="#c953a6" aria-label="Paint and dye color"></label></div>
    <div class="group"><button id="undo" class="sq" disabled title="Undo (Ctrl+Z)" aria-label="Undo">${icon('undo')}</button><button id="redo" class="sq" disabled title="Redo (Ctrl+Y)" aria-label="Redo">${icon('redo')}</button><button id="clear-world" class="danger" title="Clear the world (undoable)">Reset</button></div>
    <div class="group end"><button id="edit-cell" title="Edit the inspected cell">Edit</button><button id="element-info" title="About the selected material">Info</button><button id="set-tps" title="Target ticks per second">TPS</button><button id="content-packs">Mods</button><button id="capture-world" class="sq" title="Save a screenshot (C)" aria-label="Capture screenshot">${icon('camera')}</button><button id="toggle-gui" class="sq" title="Hide interface (F1)" aria-label="Hide interface">${icon('eye')}</button></div>
  </div>
  <div class="bench-top"><div class="palette-tabs" role="group" aria-label="Tool category">${CATS.map(([k,t])=>`<button data-cat="${k}"${k==='terrain'?' class="selected"':''}>${t}</button>`).join('')}</div><label class="element-search"><span class="sr-only">Find a material or tool</span><input id="palette-search" type="search" placeholder="Find material…" autocomplete="off"><kbd>E</kbd></label><div class="overlay-control" title="World overlay (1–4)">${icon('layers')}<label class="sr-only" for="overlay">World overlay</label><select id="overlay">${OVERLAYS.map(([v,t])=>`<option value="${v}">${t}</option>`).join('')}</select></div></div>
  <div id="palette" class="palette"></div>
</section>
<footer><div><span class="seed-label">Seed <b id="seed-label">42</b></span><span id="status">Connecting to the ecosystem…</span></div><button id="scenario-help">${icon('book')}<span>Experiment guide</span></button><span id="fps">— fps</span></footer>
<dialog id="modal"><div class="modal-head"><h2 id="modal-title"></h2><button id="modal-close" class="icon-btn" aria-label="Close dialog">${icon('close')}</button></div><div id="modal-body"></div></dialog><div id="toast" role="status" aria-live="polite"></div><input id="file-input" type="file" accept=".antsave,.json" hidden><input id="species-file" type="file" accept=".json" hidden>`;

// The world stays full-width; the observatory opens over it when needed.
document.body.classList.add('panel-hidden');
const syncShape=()=>{const v=$<HTMLSelectElement>('#draw-shape').value;document.querySelectorAll<HTMLElement>('[data-shape]').forEach(b=>b.classList.toggle('selected',b.dataset.shape===v));};
document.querySelectorAll<HTMLElement>('[data-shape]').forEach(b=>b.onclick=()=>{$<HTMLSelectElement>('#draw-shape').value=b.dataset.shape!;syncShape();});
$('#draw-shape').addEventListener('input',syncShape);$('#draw-shape').addEventListener('change',syncShape);
const renderer = new Renderer($('#world'));
const worker = new Worker(new URL('./worker/sim.worker.ts', import.meta.url), { type: 'module' });
const send = (m: ToWorker) => worker.postMessage(m);
let brushQueue:Command[]=[];
let brushFlush=0;
function queueBrush(cmd:Command){
  brushQueue.push(cmd);
  if(!brushFlush)brushFlush=requestAnimationFrame(flushBrush);
}
function flushBrush(){if(brushFlush)cancelAnimationFrame(brushFlush);brushFlush=0;if(!brushQueue.length)return;const cmds=brushQueue;brushQueue=[];send({type:'cmds',cmds});}
let stats: any = null, evolution: any = null, species: any[] = [], running = true, tool = 'inspect', cat = 'terrain', material: number = M.SOIL;
let runRevision=0;
// default: the generated living world (several kingdoms, god-game view); ?scenario=…&seed=… picks another
const urlOpts = new URLSearchParams(location.search);
let selectedColony = -1, scenario = SCENARIOS.some((s) => s.id === urlOpts.get('scenario')) ? urlOpts.get('scenario')! : 'living-world', seed = Number(urlOpts.get('seed') ?? 42) >>> 0, mode: Mode = 'naturalistic', modalKind = '', journalTab = 'discoveries';
let lastInspect = '', genoOpen = false, colonyTraitsOpen = false, kingdomOpen = true;
const STATUS_COLOR: Record<string, string> = { war: '#e0675c', tension: '#e7bd69', neutral: '#9aa3a8', peace: '#8fd18a', alliance: '#7fb7ff' };
function kingdomHtml(k: any): string {
  if (!k) return '';
  const rel = k.relations.length ? k.relations.map((r: any) => `<div><span style="color:${STATUS_COLOR[r.status] ?? '#ccc'}">${esc(r.status)}${r.days ? ` (${r.days}d)` : ''}</span> ${esc(r.kingdom)} <small>${esc(r.colony)}</small></div>`).join('') : '<p class="muted">Has not met any other kingdom yet.</p>';
  return `<details class="tasks" id="kingdom"${kingdomOpen ? ' open' : ''}><summary>${esc(k.kingdom)}</summary><p>${k.ruler ? `Ruled by <b>Queen ${esc(k.ruler)}</b>${k.reign > 1 ? ` (ruler #${k.reign})` : ''}` : '<b>No ruler</b>'} · morale <b>${k.morale}%</b></p><p class="muted">${esc(k.cultureText)}</p><p class="muted">Clans (patrilines):</p>${k.clans.map((c: any) => `<div>${esc(c.name)}<b>${c.members}</b></div>`).join('') || '<p class="muted">None yet.</p>'}${k.heroes.length ? `<p class="muted">Heroes:</p>${k.heroes.map((h: any) => `<div>${esc(h.name)}<b>${h.kills} slain</b></div>`).join('')}` : ''}<p class="muted">Diplomacy:</p>${rel}<p class="muted">Chronicle:</p>${k.chronicle.map((l: string) => `<p><small>${esc(l)}</small></p>`).join('')}</details>`;
}
// ---------------------------------------------------------------- WorldBox-style datasheets
// Floating, draggable sheets that appear only when asked for: an ant sheet when an ant is clicked, a kingdom
// sheet per colony, and a Kingdoms & alliances window. Each re-renders only when its content changes.
type SheetKind = 'ant' | 'colony' | 'list';
const sheet = { ant: { open: false, tab: 'overview', id: 0, follow: false }, colony: { open: false, tab: 'overview', id: 0 }, list: { open: false, tab: 'world' } };
const sheetHtml: Record<SheetKind, string> = { ant: '', colony: '', list: '' };
let lastPickedAnt = 0;
const rgb = (m: number[] | undefined) => m ? `rgb(${m[0]},${m[1]},${m[2]})` : '#888';
const bar = (label: string, v: number, color: string, text?: string) => `<div class="sh-bar"><span>${esc(label)}</span><div><i style="width:${Math.round(Math.max(0, Math.min(1, v)) * 100)}%;background:${color}"></i></div><b>${esc(text ?? `${Math.round(v * 100)}%`)}</b></div>`;
const kv = (k: string, v: string | number) => `<div class="sh-kv"><span>${esc(k)}</span><b>${esc(String(v))}</b></div>`;
const sec = (t: string) => `<h4 class="sh-sec">${esc(t)}</h4>`;
function sheetFrame(kind: SheetKind, title: string, sub: string, color: string, tabs: [string, string][], active: string, body: string, actions = '') {
  return `<div class="sh-head" data-drag="${kind}"><i class="sh-swatch" style="background:${color}"></i><div class="sh-title"><strong>${esc(title)}</strong><small>${esc(sub)}</small></div><button class="icon-btn sh-x" data-sheet-close="${kind}" aria-label="Close">${icon('close')}</button></div>`
    + (tabs.length > 1 ? `<div class="sh-tabs">${tabs.map(([k, n]) => `<button data-sheet-tab="${kind}:${k}" class="${k === active ? 'active' : ''}">${esc(n)}</button>`).join('')}</div>` : '')
    + `<div class="sh-body">${body}</div>${actions ? `<div class="sh-actions">${actions}</div>` : ''}`;
}
const STRAT_TEXT: Record<string, string> = { grow: 'Growing', forage: 'Foraging widely', defend: 'Defending', fortify: 'Fortified', war: 'At war', raid: 'Raiding' };

function antSheet(a: any): string {
  const s = a.sheet, t = sheet.ant.tab;
  let body = '';
  if (t === 'overview') {
    body = `<p class="sh-doing"><b>${esc(a.task)}</b> — ${esc(a.why)}</p>`
      + bar('Health', s.health, '#e0675c') + bar('Energy', s.energy, '#e7bd69') + bar('Water', s.hydration, '#7fd8f0') + bar('Age', s.age / s.life, '#a9b473', `${s.age.toFixed(1)} / ${Math.round(s.life)} d`)
      + kv('Mood', a.mood ?? '-') + kv('Clan', a.clan ?? '-') + kv('Where', `${s.underground ? 'underground' : 'surface'} · ${s.x}, ${s.y}`)
      + (s.carrying ? kv('Carrying', s.carrying) : '') + kv('Foes slain', s.kills) + kv('Generation', s.generation)
      + sec('Personality') + `<p class="muted">${esc(a.persona ?? '')}</p>`
      + sec('Body') + kv('Size', `${s.size.toFixed(2)}×`) + kv('Attack', s.attack.toFixed(2)) + kv('Defence', s.defense.toFixed(2)) + kv('Speed', s.speed.toFixed(2));
  } else if (t === 'brain') {
    body = brainTab(a.brain);
  } else if (t === 'story') {
    body = (a.story?.length ? a.story.map((l: string) => `<p>${esc(l)}</p>`).join('') : '<p class="muted">Nothing notable has happened to this ant yet. Rulers, soldiers, princesses and fighters get life stories.</p>')
      + sec('Named traits') + traitChips(a.named ?? []) + `<p class="muted">${esc(a.namedOrigin ?? '')}</p>`;
  } else {
    body = a.lines.map((l: string) => `<p class="muted">${esc(l)}</p>`).join('') + a.traits.map((tr: any) => `<div class="sh-kv"><span>${esc(tr.name)} <small>${esc(tr.kind)}</small></span><b>${esc(tr.value)}</b></div>`).join('');
  }
  const actions = t === 'brain' ? brainActions
    : `<button data-sheet-act="follow" class="${sheet.ant.follow ? 'active' : ''}">${sheet.ant.follow ? 'Following' : 'Follow'}</button><button data-sheet-act="kingdom" data-colony="${a.colonyId}">Kingdom</button><button data-sheet-act="traits">Traits…</button>`;
  return sheetFrame('ant', a.name ?? `${a.caste} #${a.id}`, `${a.caste} #${a.id} · ${s.kingdom}`, rgb(s.marking), [['overview', 'Overview'], ['brain', 'Brain'], ['story', 'Story'], ['genes', 'Genes']], t, body, actions);
}

// ---------------------------------------------------------------- learning brain (sim/brain.ts)
const brainActions = '<button data-sheet-act="brains-export">Export brains</button><button data-sheet-act="brains-import">Import…</button><button data-sheet-act="brains-reset">Forget learnt</button>';
const signed = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}`;
const wcol = (v: number) => { const k = Math.min(1, Math.abs(v) / 2); return v >= 0 ? `rgba(231,189,105,${(0.08 + 0.92 * k).toFixed(2)})` : `rgba(127,183,255,${(0.08 + 0.92 * k).toFixed(2)})`; };
/** Weight map: sense->hidden (rows = senses) and hidden->action (rows = hidden units). Gold excites, blue inhibits. */
function weightMap(w: number[]): string {
  const w2 = BRAIN_NI * BRAIN_NH + BRAIN_NH; // layout: sense->hidden weights, hidden biases, hidden->action weights, action biases
  let a = '<div class="brain-grid" style="grid-template-columns:repeat(' + BRAIN_NH + ',1fr)">';
  for (let k = 0; k < BRAIN_NI; k++) for (let j = 0; j < BRAIN_NH; j++) { const v = w[k * BRAIN_NH + j]; a += `<i style="background:${wcol(v)}" title="${esc(SENSE_NAMES[k])} → hidden ${j + 1}: ${signed(v)}"></i>`; }
  a += '</div>';
  let b = '<div class="brain-grid" style="grid-template-columns:repeat(' + BRAIN_NA + ',1fr)">';
  for (let j = 0; j < BRAIN_NH; j++) for (let k = 0; k < BRAIN_NA; k++) { const v = w[w2 + j * BRAIN_NA + k]; b += `<i style="background:${wcol(v)}" title="hidden ${j + 1} → ${esc(ACT_NAMES[k])}: ${signed(v)}"></i>`; }
  b += '</div>';
  return `<div class="brain-maps"><div><small>senses → hidden</small>${a}</div><div><small>hidden → actions</small>${b}</div></div>`;
}
function brainTab(b: any): string {
  if (!b) return '<p class="muted">Only workers carry a learning brain. Queens and winged reproductives act on instinct.</p>';
  const lo = Math.min(-0.5, ...b.q.map((q: any) => q.v)), hi = Math.max(1, ...b.q.map((q: any) => q.v));
  const best = b.q.reduce((m: any, q: any) => (q.v > m.v ? q : m), b.q[0]);
  return `<div class="brain"><p class="muted">A ${BRAIN_NI}–${BRAIN_NH}–${BRAIN_NA} neural network of its own. It learns from drive reduction (less hunger, thirst, pain, fear or boredom = reward) and from useful work, like a norn in Creatures. ${b.current ? `Now doing: <b>${esc(b.current)}</b>.` : ''}</p>`
    + sec('Drives') + b.senses.filter((s: any) => s.drive).map((s: any) => bar(s.name, s.v, '#e0675c')).join('')
    + sec('Senses') + b.senses.filter((s: any) => !s.drive).map((s: any) => bar(s.name, s.v, '#7fd8f0')).join('')
    + sec('Expected value of each choice') + b.q.map((q: any) => bar(q.name + (q === best ? ' ★' : ''), (q.v - lo) / (hi - lo), q.name === b.current ? '#8fd18a' : '#e7bd69', signed(q.v))).join('')
    + sec('Learning') + kv('Decisions made', b.decisions) + kv('Lifetime reward', b.lifetime.toFixed(2)) + kv('Average per decision', signed(b.avg))
    + kv('Last outcome', signed(b.last)) + kv('Reward so far (current action)', signed(b.pending)) + kv('Surprise (avg. prediction error)', b.surprise.toFixed(2))
    + kv('Curiosity (exploration)', b.temperature.toFixed(2)) + kv('Learning rate', b.learnRate.toFixed(3))
    + sec('Learnt during its life') + (b.learnt.length ? b.learnt.map((l: string) => `<p class="muted">${esc(l)}</p>`).join('') : '<p class="muted">Nothing yet: still running on the template it was born with.</p>')
    + sec('Strongest associations') + (b.instincts.map((l: string) => `<p class="muted">${esc(l)}</p>`).join('') || '<p class="muted">None.</p>')
    + (b.template ? sec('Inherited template') + kv('Revision', b.template.gen) + kv('From', b.template.source) + kv('Lifetimes judged', b.template.lifetimes) + kv('Lifetimes kept', b.template.accepted) : '')
    + sec('Weights') + weightMap(b.weights) + '</div>';
}
function mindTab(m: any): string {
  if (!m) return '<p class="muted">No workers have been born yet, so the colony has no brain template.</p>';
  const total = Math.max(1, m.choosing.reduce((n: number, e: any) => n + e.n, 0));
  return `<div class="brain"><p class="muted">Newborn workers inherit this template (plus small variation). When a worker dies after a more rewarding life than average, what it learnt is blended in. The best template per species is kept in this browser and seeds colonies in new worlds.</p>`
    + kv('Template revision', m.gen) + kv('Origin', m.source) + kv('Lifetimes judged', m.lifetimes) + kv('Lifetimes kept', m.accepted)
    + kv('Average lifetime fitness', signed(m.meanFit)) + kv('Workers with brains', m.brains) + kv('Decisions so far', m.decisions) + kv('Reward per decision (living)', signed(m.avgReward))
    + sec('Workers are choosing') + (m.choosing.map((e: any) => bar(e.name, e.n / total, '#e7bd69', String(e.n))).join('') || '<p class="muted">-</p>')
    + sec('What the colony mind has learnt') + (m.assoc.map((l: string) => `<p class="muted">${esc(l)}</p>`).join('') || '<p class="muted">-</p>') + '</div>';
}

function colonySheet(c: any): string {
  const k = c.society, tr = c.territory, war = c.war, t = sheet.colony.tab;
  let body = '';
  if (t === 'overview') {
    const brood = c.brood.reduce((x: number, y: number) => x + y, 0);
    body = (k ? kv('Ruler', k.ruler ? `Queen ${k.ruler}${k.reign > 1 ? ` (#${k.reign})` : ''}` : 'none') + kv('Culture', k.culture) + bar('Morale', k.morale / 100, '#8fd18a') : '')
      + kv('Species', c.species) + kv('Stage', c.stage) + kv('Age', `${c.ageDays.toFixed(1)} days · generation ${c.generation}`)
      + sec('Population') + popChart(c) + kv('Born / died today', `${c.today?.births ?? 0} / ${c.today?.deaths ?? 0}`) + kv('Crowding', `${c.density} ants per 100 nest cells`) + kv('Nest', `${c.nestVolume} cells dug · ${c.nestDepth} deep`) + kv('Workers', `${c.workers}${c.majors ? ` (${c.majors} soldiers)` : ''}`) + kv('Queens', c.queens) + kv('Winged', c.alates) + kv('Brood', `${brood} (${c.brood[0]} eggs · ${c.brood[1]} larvae · ${c.brood[2]} pupae)`)
      + sec('Stores') + kv('Sugar', Math.round(c.store.sugar)) + kv('Protein', Math.round(c.store.protein)) + kv('Seeds', Math.round(c.store.seed))
      + (c.notes.length ? sec('Notes') + c.notes.map((n: string) => `<p class="muted">${esc(n)}</p>`).join('') : '');
  } else if (t === 'activity') {
    const total = Math.max(1, c.workers), tasks = Object.entries(c.tasks as Record<string, number>).sort((p, q) => q[1] - p[1]);
    body = tasks.length ? tasks.map(([n, v]) => bar(n, v / total, '#e7bd69', String(v))).join('') : '<p class="muted">No workers yet.</p>';
    body += sec('Lifetime') + kv('Workers reared', c.stats.workersEclosed) + kv('Daughter colonies', c.stats.daughterColonies) + kv('Food brought in', c.stats.foodIn.join(' / ') + ' (sugar/protein/seed)')
      + sec('Deaths') + (Object.entries(c.stats.adultDeaths as Record<string, number>).map(([n, v]) => kv(n, v)).join('') || '<p class="muted">None.</p>');
  } else if (t === 'territory') {
    body = bar('Map span', tr.span / 100, rgb(c.marking), `${tr.span}%`) + kv('Tunnel cells claimed', tr.cells) + kv('Still to dig', tr.todo) + kv('Outposts', tr.outposts) + kv('Entrances', tr.shafts)
      + sec('Highways') + (tr.roads.length ? tr.roads.map((r: any) => `<div class="sh-kv"><span>${esc(r.name)}<small>${esc(r.status)}</small></span><b>${r.len} cells · ${r.outposts} outposts</b></div>`).join('') : '<p class="muted">Highways start once the colony has about 16 workers.</p>')
      + sec('Underground borders') + (tr.contacts.length ? tr.contacts.map((b: any) => kv(b.colony, b.breached ? `breached at x=${b.x}` : `border at x=${b.x}`)).join('') : '<p class="muted">No tunnels have met another kingdom yet.</p>');
  } else if (t === 'war') {
    body = war ? kv('Stance', STRAT_TEXT[war.strategy] ?? war.strategy) + `<p class="muted">${esc(war.reason)}</p>` + (war.infiltrating ? '<p class="sh-alert">Infiltrators are in enemy tunnels.</p>' : '')
      + kv('Raids', `${war.raidsWon} won of ${war.raids}`) + kv('Brood captured', war.broodStolen) + kv('Colonies absorbed', war.absorbed) : '<p class="muted">Has not met a rival yet.</p>';
    body += sec('Relations') + (k?.relations.length ? k.relations.map((r: any) => `<div class="sh-kv"><span><a href="#" data-open-colony="${r.id}">${esc(r.kingdom)}</a><small>${esc(r.colony)}</small></span><b style="color:${STATUS_COLOR[r.status] ?? '#ccc'}">${esc(r.status)}${r.days ? ` · ${r.days}d` : ''}</b></div>`).join('') : '<p class="muted">No known kingdoms.</p>');
    body += sec('Battle reports') + (war?.reports.length ? war.reports.map((r: string) => `<p><small>${esc(r)}</small></p>`).join('') : '<p class="muted">None yet.</p>');
  } else if (t === 'mind') {
    body = mindTab(c.mind);
  } else {
    body = sec('Clans (patrilines)') + (k?.clans.map((x: any) => kv(x.name, x.members)).join('') || '<p class="muted">None yet.</p>')
      + sec('Heroes') + (k?.heroes.map((h: any) => kv(h.name, `${h.kills} slain`)).join('') || '<p class="muted">None yet.</p>')
      + sec('Chronicle') + (k?.chronicle.map((l: string) => `<p><small>${esc(l)}</small></p>`).join('') || '');
  }
  const actions = `<button data-sheet-act="focus">Focus nest</button>${c.queenId ? '<button data-sheet-act="queen-traits">Queen traits…</button>' : ''}<button data-sheet-act="overlay">Show tunnels</button>`;
  return sheetFrame('colony', k?.kingdom ?? c.name, `${c.name} · ${c.species}`, rgb(c.marking), [['overview', 'Overview'], ['activity', 'Activity'], ['mind', 'Mind'], ['territory', 'Territory'], ['war', 'War'], ['kingdom', 'Kingdom']], t, body, t === 'mind' ? brainActions : actions);
}

/** Line chart (SVG). series: [{ values, color }] sharing one x axis; values may differ in length (right-aligned). */
function lineChart(series: { values: number[]; color: string; fill?: boolean }[], h = 70, label = ''): string {
  const n = Math.max(2, ...series.map((s) => s.values.length)), max = Math.max(1, ...series.flatMap((s) => s.values));
  const W = 260, pad = 2;
  const pts = (v: number[]) => v.map((y, k) => `${(pad + ((n - v.length + k) / (n - 1)) * (W - 2 * pad)).toFixed(1)},${(h - pad - (y / max) * (h - 2 * pad)).toFixed(1)}`).join(' ');
  const lines = series.filter((s) => s.values.length).map((s) => s.fill
    ? `<polygon points="${pad},${h - pad} ${pts(s.values)} ${W - pad},${h - pad}" fill="${s.color}" opacity=".35"/>`
    : `<polyline points="${pts(s.values)}" fill="none" stroke="${s.color}" stroke-width="1.6"/>`).join('');
  return `<div class="chart"><svg viewBox="0 0 ${W} ${h}" preserveAspectRatio="none">${lines}</svg><small>${esc(label)}<b>${Math.round(max)}</b></small></div>`;
}
function popChart(c: any): string {
  const h = c.history ?? [];
  if (h.length < 2) return '<p class="muted">Population history appears after the first full day.</p>';
  return lineChart([{ values: h.map((e: number[]) => e[2]), color: '#e7bd69', fill: true }, { values: h.map((e: number[]) => e[1]), color: rgb(c.marking) }], 60, 'workers (line) · brood (fill) · peak');
}
function worldTab(cols: any[], census: any[]): string {
  const alive = cols.filter((c) => c.alive), last = census[census.length - 1];
  const ants = alive.reduce((n, c) => n + c.adults, 0), brood = alive.reduce((n, c) => n + c.brood.reduce((x: number, y: number) => x + y, 0), 0);
  const born = alive.reduce((n, c) => n + (c.today?.births ?? 0), 0), died = alive.reduce((n, c) => n + (c.today?.deaths ?? 0), 0);
  const top = [...alive].sort((p, q) => q.adults - p.adults).slice(0, 6);
  const oldest = [...alive].sort((p, q) => q.ageDays - p.ageDays)[0], deepest = [...alive].sort((p, q) => q.nestDepth - p.nestDepth)[0];
  const founded = census.reduce((n, d) => n + d.founded, 0), fallen = census.reduce((n, d) => n + d.fallen, 0);
  return kv('Kingdoms', alive.length) + kv('Ants alive', ants) + kv('Brood (eggs, larvae, pupae)', brood)
    + kv('Born today / died today', `${born} / ${died}`) + (last ? kv('Yesterday born / died', `${last.births} / ${last.deaths}`) : '')
    + kv('Kingdoms founded / fallen', `${founded} / ${fallen}`)
    + sec('World population') + (census.length > 1 ? lineChart([{ values: census.map((d) => d.brood), color: '#e7bd69', fill: true }, { values: census.map((d) => d.ants), color: '#8fd18a' }], 70, 'adults (line) · brood (fill) · peak') : '<p class="muted">The census is taken every dawn.</p>')
    + (census.length > 1 ? lineChart([{ values: census.map((d) => d.births), color: '#7fd8f0' }, { values: census.map((d) => d.deaths), color: '#e0675c' }], 50, 'births (blue) · deaths (red) per day · peak') : '')
    + sec('Kingdom sizes') + (top.some((c) => (c.history?.length ?? 0) > 1) ? lineChart(top.map((c) => ({ values: (c.history ?? []).map((e: number[]) => e[1]), color: rgb(c.marking) })), 70, 'workers per kingdom · peak') : '')
    + top.map((c) => `<button class="sh-row" data-open-colony="${c.id}"><i class="sh-swatch" style="background:${rgb(c.marking)}"></i><span><strong>${esc(c.society?.kingdom ?? c.name)}</strong><small>${c.ageDays.toFixed(0)} days old · dynasty ${c.generationDynasty ?? 0} · ${c.density} ants per 100 cells</small></span><b>${c.adults}<small>${c.today?.births ?? 0} born · ${c.today?.deaths ?? 0} died</small></b></button>`).join('')
    + sec('Records') + (oldest ? kv('Oldest kingdom', `${oldest.society?.kingdom ?? oldest.name} (${oldest.ageDays.toFixed(0)} d)`) : '') + (deepest ? kv('Deepest nest', `${deepest.society?.kingdom ?? deepest.name} (${deepest.nestDepth} cells)`) : '');
}

function listSheet(cols: any[]): string {
  const alive = cols.filter((c) => c.alive), t = sheet.list.tab;
  let body = '';
  if (t === 'world') {
    body = worldTab(cols, stats?.census ?? []);
  } else if (t === 'kingdoms') {
    body = alive.length ? alive.map((c) => `<button class="sh-row" data-open-colony="${c.id}"><i class="sh-swatch" style="background:${rgb(c.marking)}"></i><span><strong>${esc(c.society?.kingdom ?? c.name)}</strong><small>${esc(c.species)} · ${c.society?.ruler ? `Queen ${esc(c.society.ruler)}` : 'no ruler'} · ${c.ageDays.toFixed(0)} d</small></span><b>${c.workers}<small>${esc(STRAT_TEXT[c.war?.strategy ?? 'grow'] ?? '')}</small></b></button>`).join('') : '<p class="muted">No living kingdoms.</p>';
  } else {
    const seen = new Set<string>(), pacts: string[] = [], wars: string[] = [];
    for (const c of alive) for (const r of c.society?.relations ?? []) {
      const key = [c.id, r.id].sort().join('-') + r.status;
      if (seen.has(key)) continue; seen.add(key);
      const line = `<div class="sh-kv"><span>${esc(c.society.kingdom)} ↔ ${esc(r.kingdom)}</span><b style="color:${STATUS_COLOR[r.status]}">${esc(r.status)}${r.days ? ` · ${r.days}d` : ''}</b></div>`;
      if (r.status === 'peace' || r.status === 'alliance') pacts.push(line); else if (r.status === 'war' || r.status === 'tension') wars.push(line);
    }
    body = sec('Alliances & treaties') + (pacts.join('') || '<p class="muted">No treaties in force.</p>') + sec('Wars & tensions') + (wars.join('') || '<p class="muted">The world is at peace.</p>');
  }
  return sheetFrame('list', 'Kingdoms of the world', `${alive.length} kingdom${alive.length === 1 ? '' : 's'}`, '#ffc23d', [['world', 'World'], ['kingdoms', 'Kingdoms'], ['diplomacy', 'Alliances & wars']], t, body);
}

function sheetEl(kind: SheetKind): HTMLElement {
  let el = document.getElementById(`sheet-${kind}`);
  if (!el) { el = document.createElement('section'); el.id = `sheet-${kind}`; el.className = `sheet sheet-${kind}`; $('#sheets').appendChild(el); }
  return el;
}
function renderSheets(s: any) {
  const a = s.selectedAnt;
  if (a && a.id !== lastPickedAnt) { sheet.ant.open = true; sheet.ant.id = a.id; ($('#cell-card') as HTMLElement).hidden = true; }
  lastPickedAnt = a?.id ?? 0;
  if (sheet.ant.open && !a) { sheet.ant.open = false; sheet.ant.follow = false; }
  const col = s.colonies.find((c: any) => c.id === sheet.colony.id && c.alive);
  if (sheet.colony.open && !col) sheet.colony.open = false;
  const want: Record<SheetKind, string> = {
    ant: sheet.ant.open && a?.sheet ? antSheet(a) : '',
    colony: sheet.colony.open && col ? colonySheet(col) : '',
    list: sheet.list.open ? listSheet(s.colonies) : '',
  };
  for (const kind of ['ant', 'colony', 'list'] as SheetKind[]) {
    if (want[kind] === sheetHtml[kind]) continue;
    sheetHtml[kind] = want[kind];
    const el = sheetEl(kind), body = el.querySelector('.sh-body'), scroll = body?.scrollTop ?? 0;
    el.hidden = !want[kind];
    el.innerHTML = want[kind];
    const nb = el.querySelector('.sh-body'); if (nb) nb.scrollTop = scroll;
  }
  if (sheet.ant.follow && a?.sheet) renderer.focus(a.sheet.x, a.sheet.y);
}
function openColonySheet(id: number) { sheet.colony.open = true; sheet.colony.id = id; if (stats) renderSheets(stats); }
$('#sheets').addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  const close = t.closest<HTMLElement>('[data-sheet-close]')?.dataset.sheetClose as SheetKind | undefined;
  if (close) { sheet[close].open = false; if (close === 'ant') { sheet.ant.follow = false; send({ type: 'clearSelection' }); } }
  const tab = t.closest<HTMLElement>('[data-sheet-tab]')?.dataset.sheetTab;
  if (tab) { const [k, v] = tab.split(':') as [SheetKind, string]; sheet[k].tab = v; }
  const oc = t.closest<HTMLElement>('[data-open-colony]')?.dataset.openColony;
  if (oc) { e.preventDefault(); openColonySheet(Number(oc)); }
  const act = t.closest<HTMLElement>('[data-sheet-act]');
  if (act) {
    const a = stats?.selectedAnt, c = stats?.colonies.find((x: any) => x.id === sheet.colony.id);
    switch (act.dataset.sheetAct) {
      case 'follow': sheet.ant.follow = !sheet.ant.follow; break;
      case 'brains-export': send({ type: 'brains', op: 'export' }); break;
      case 'brains-reset': if (confirm('Forget every learnt brain template stored in this browser? New worlds will start from instincts again.')) send({ type: 'brains', op: 'reset' }); break;
      case 'brains-import': {
        const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
        inp.onchange = async () => { const f = inp.files?.[0]; if (f) send({ type: 'brains', op: 'import', json: await f.text() }); };
        inp.click(); break;
      }
      case 'kingdom': openColonySheet(Number(act.dataset.colony)); break;
      case 'traits': if (a) traitManager(a.id, `${a.name ?? a.caste} (${a.colony})`, a.named ?? []); break;
      case 'focus': if (c) renderer.focus(c.entrance.x, c.entrance.y + 12); break;
      case 'queen-traits': if (c?.queenId) traitManager(c.queenId, `queen of ${c.name}`, c.queenTraits ?? []); break;
      case 'overlay': { const sel = document.querySelector<HTMLSelectElement>('#overlay'); if (sel && c) { sel.value = 'nest'; sel.dispatchEvent(new Event('change')); } if (c) renderer.focus(c.entrance.x, c.entrance.y + 20); break; }
    }
  }
  if (stats) renderSheets(stats);
});
// drag sheets by their header
$('#sheets').addEventListener('pointerdown', (e) => {
  const head = (e.target as HTMLElement).closest<HTMLElement>('[data-drag]');
  if (!head || (e.target as HTMLElement).closest('button')) return;
  const el = head.parentElement!, wrap = $('#sheets').getBoundingClientRect(), r = el.getBoundingClientRect();
  const ox = e.clientX - r.left, oy = e.clientY - r.top;
  const move = (ev: PointerEvent) => { el.style.left = `${Math.max(0, Math.min(wrap.width - 60, ev.clientX - wrap.left - ox))}px`; el.style.top = `${Math.max(0, Math.min(wrap.height - 40, ev.clientY - wrap.top - oy))}px`; el.style.right = 'auto'; };
  const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  e.preventDefault();
});
$('#kingdoms-btn').onclick = () => { sheet.list.open = !sheet.list.open; if (stats) renderSheets(stats); };

let sound = false, audio: AudioContext | null = null, stroke = false, dragging = false, lastPoint: {x: number; y: number} | null = null, space = false;
let shapeStart:{x:number;y:number}|null=null;
let eraseStroke=false,intensify=false,shiftLatched=false,lineAnchor:{x:number;y:number}|null=null;
let heldBrushFrame=0,heldBrushAt=0;
function holdBrush(t:number){
  heldBrushFrame=0;
  if(!stroke||dragging||shapeStart)return;
  if(renderer.hover&&t-heldBrushAt>=1000/30){paint(renderer.hover.x,renderer.hover.y);heldBrushAt=t;}
  heldBrushFrame=requestAnimationFrame(holdBrush);
}
const toolHints: Record<string,string> = { inspect: 'Left-click a cell or ant to inspect it.', dig: 'Drag to excavate. Food and water stay in place.', pan: 'Drag to move around. Scroll to zoom.', queen: 'Click a surface to introduce one mated founding queen.', colony: 'Sandbox introduction: click to place a queen and 35 workers.', heat: 'Drag to heat the local temperature field immediately. Shift intensifies.', cool: 'Drag to cool the local temperature field immediately. Shift intensifies.', humid: 'Drag to add soil moisture and raise local humidity.', dry: 'Drag to remove moisture and lower humidity.', toxin: 'Drag to apply toxic contamination. It decays over time.', rain: 'Click to start a short local rain shower.', erase: 'Drag to remove material, food, or water.', spider: 'Click an open surface to introduce a spider.', springtail: 'Click an open surface to introduce a decomposer.',pick:'Click a cell to select its material. Middle-click also picks.',charge:'Apply electrical charge. Shift intensifies; conductors carry it to connected devices.',mix:'Shuffle movable particles within the brush. Fixed solids stay in place.',smash:'Crush brittle solids into falling powders: stone, glass, wood, ice, clay and sugar.',drag:'Drag existing powder, liquid or gas into empty space. Matter is moved, not copied.' };
toolHints.lookup='Click a cell to open its material information.';
toolHints.mix='Shuffle movable particles. Shift includes flame, spark and smoke; fixed walls stay in place.';
toolHints.smash='Crush brittle material. Shift grinds rock and gravel further into sand.';
function toast(text: string, error = false) { const el = $('#toast'); el.textContent = text; el.classList.toggle('error', error); el.classList.add('show'); setTimeout(() => el.classList.remove('show'), error ? 8000 : 3800); }
function beep() { if (!sound) return; audio ??= new AudioContext(); void audio.resume(); const osc = audio.createOscillator(), gain = audio.createGain(); osc.type = 'sine'; osc.frequency.value = 550; gain.gain.value = .025; osc.connect(gain).connect(audio.destination); osc.start(); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .07); osc.stop(audio.currentTime + .08); }
function setTool(t: string, m?: number) {
  tool = t; if (m !== undefined) material = m;
  renderer.editing = !['inspect','pan'].includes(t);
  $('#world').style.cursor = toolCursor();
  if (t !== 'inspect') { $('#cell-card').hidden = true; cardCell = null; }
  const chip = $('#tool-chip'); chip.style.background = t === 'paint' ? `rgb(${MATERIALS[material].color})` : ''; chip.classList.toggle('is-tool', t !== 'paint');
  $('#tool-name').textContent = t === 'paint' ? MATERIALS[material].name : t.startsWith('animal:')?wildlifeByKey(t.slice(7))!.name:({humid:'Moisten',cool:'Cool',dry:'Dry',colony:'Established colony',color:'Paint color'}[t] ?? t[0].toUpperCase() + t.slice(1));
  $('#hint').textContent = t === 'paint' ? `${MATERIALS[material].description} Drag to paint.` : t.startsWith('animal:')?wildlifeByKey(t.slice(7))!.description:t==='color'?'Paint the selected color onto matter. This changes appearance, not its material or inherited traits.':toolHints[t] ?? '';
  document.querySelectorAll<HTMLElement>('[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === t && (t !== 'paint' || Number(b.dataset.mat) === material)));
}
function palette() {
  document.body.classList.toggle('life-palette',cat==='life');
  document.body.classList.toggle('liquid-palette',cat==='liquids');
  document.body.classList.toggle('powder-palette',cat==='powders');
  document.querySelectorAll<HTMLElement>('[data-cat]').forEach(b => b.classList.toggle('selected', b.dataset.cat === cat));
  let html = '';
  const matButton = (m: number) => { const d = MATERIALS[m], names:Record<number,string>={[M.TOPSOIL]:'Topsoil',[M.ORGANIC]:'Detritus',[M.SUGAR]:'Sugar',[M.PROTEIN]:'Protein',[M.SEED]:'Seeds'},linear=d.color.map(c=>{const s=c/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;}),lum=linear[0]*.2126+linear[1]*.7152+linear[2]*.0722; return `<button data-tool="paint" data-mat="${m}" style="--element:rgb(${d.color});--element-ink:${lum>.179?'#111820':'#fff9e8'};--element-dark:rgb(${d.color.map(c=>Math.round(c*.45))})" title="${esc(d.description)}"><span class="swatch swatch-${d.key}" style="--swatch:rgb(${d.color})"></span><span>${esc(names[m]??d.name)}</span></button>`; };
  const tb = (t: string, name: string, i: string) => `<button data-tool="${t}"><span class="tool-swatch">${icon(i)}</span><span>${name}</span></button>`;
  const animalButton=(d:WildlifeDef)=>{const g=d.frames[0],h=g.length,w=Math.max(...g.map(r=>r.length));let pixels='';for(let y=0;y<h;y++)for(let x=0;x<g[y].length;x++){const c=d.colors[g[y].charCodeAt(x)-97];if(c)pixels+=`<rect x="${x}" y="${y}" width="1" height="1" fill="rgb(${c})"/>`;}return `<button data-tool="animal:${d.key}" title="${esc(d.description)}"><svg class="wildlife-icon" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" aria-hidden="true">${pixels}</svg><span>${d.name}</span></button>`;};
  if (cat === 'terrain') html = tb('dig','Dig','shovel') + [M.SAND,M.DIRT,M.MUD,M.ROCK,M.STONE,M.SANDSTONE,M.MUDSTONE,M.SNOW,M.GRAVEL,M.CLAY_POWDER,M.CLAY_SOIL,M.PERMAFROST,M.MYCELIUM,M.MULCH,M.BASALT,M.TUFF,M.CINNABAR,M.LIMESTONE,M.TOPSOIL,M.SOIL,M.CLAY,M.ORGANIC,M.WOOD,M.ROOT,M.BARRIER].map(matButton).join('') + tb('erase','Erase','close');
  if(cat==='tools')html=tb('inspect','Inspect','cursor')+tb('lookup','Lookup','book')+tb('pick','Pick','cursor')+tb('erase','Erase','close')+tb('dig','Dig','shovel')+tb('heat','Heat','sun')+tb('cool','Cool','drop')+tb('charge','Shock','sun')+tb('color','Paint color','cursor')+tb('mix','Mix','layers')+tb('smash','Smash','shovel')+tb('drag','Drag','cursor')+tb('pan','Pan','fit');
  if (cat === 'food') html = [...new Set([M.SUGAR,M.PROTEIN,M.SEED,M.WATER,M.SALT,M.YEAST,M.BAKING_SODA,...MATERIALS.filter(m=>m.category==='food').map(m=>m.id)])].map(matButton).join('') + tb('rain','Local rain','drop') + '<p class="palette-note">Sugar fuels adults. Protein feeds larvae.<br>Mixtures retain water separately.</p>';
  if (cat === 'life') html = `<div class="species-picker"><label for="species-search">Choose an ant</label><input id="species-search" placeholder="Search ant species…"><select id="species">${species.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select></div>` + tb('queen','Ant queen','ant') + tb('colony','35-worker colony','ant') + tb('spider','Spider','ant') + tb('springtail','Springtail','ant') + WILDLIFE.map(animalButton).join('')+LIFE_MATERIALS.map(matButton).join('')+'<p class="palette-note">Click once to introduce an animal. Fish need water.<br>Wildlife profiles use compressed, simplified lifecycles.</p>';
  if (cat === 'climate') html = tb('heat','Warm +','sun') + tb('cool','Cool −','sun') + tb('humid','Moisten','drop') + tb('dry','Dry','drop') + tb('rain','Local rain','drop') + tb('toxin','Toxin','close') + '<p class="palette-note">Temperature and humidity affect development,<br>water balance, foraging, and survival.</p>';
  if(['powders','liquids','gases','solids','energy'].includes(cat)){
    const energy=new Set<number>([M.FIRE,M.SPARK,M.WIRE,M.BATTERY,M.LAMP,M.HEATER,M.COOLER,M.CLONER,M.EXPLOSIVE,M.RADIATION]);
    html=(cat==='energy'?tb('charge','Shock','sun'):'')+MATERIALS.filter(m=>m.id!==M.AIR&&(cat==='energy'?energy.has(m.id):cat==='powders'?m.state==='powder':cat==='liquids'?m.state==='liquid':cat==='gases'?m.state==='gas':m.state==='solid')).map(m=>matButton(m.id)).join('');
  }
  if(cat==='liquids')html=[...new Set([...REFERENCE_LIQUIDS,...MATERIALS.filter(m=>m.state==='liquid').map(m=>m.id)])].map(matButton).join('');
  if(cat==='powders')html=[...new Set([...REFERENCE_POWDERS,...MATERIALS.filter(m=>m.state==='powder').map(m=>m.id)])].map(matButton).join('');
  const query=$<HTMLInputElement>('#palette-search').value.trim().toLowerCase();
  if(query){const rank=(name:string)=>{name=name.toLowerCase();return name===query?0:name.startsWith(query)?1:name.includes(query)?2:3;};html=MATERIALS.filter(m=>m.id!==M.AIR&&(m.name+' '+m.description).toLowerCase().includes(query)).sort((a,b)=>rank(a.name)-rank(b.name)).map(m=>matButton(m.id)).join('')+WILDLIFE.filter(d=>(d.name+' '+d.description).toLowerCase().includes(query)).sort((a,b)=>rank(a.name)-rank(b.name)).map(animalButton).join('');}
  $('#palette').innerHTML = html;
  if(mode!=='fantasy')for(const id of FANTASY_MATERIALS){const b=document.querySelector<HTMLButtonElement>(`#palette [data-mat="${id}"]`);if(b){b.disabled=true;b.title='Fictional biology: create a Fantasy world to use this material.';}}
  filterPalette();
  setTool(tool);
  if (cat === 'life') document.querySelector('#species-search')?.addEventListener('input', e => { const q = (e.target as HTMLInputElement).value.toLowerCase(); $('#species').innerHTML = species.filter(s => (s.name + s.commonName).toLowerCase().includes(q)).map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join(''); });
}
function filterPalette(){const q=$<HTMLInputElement>('#palette-search').value.toLowerCase().trim();document.querySelectorAll<HTMLElement>('#palette > button').forEach(b=>{b.hidden=!!q&&!((b.textContent??'')+' '+b.title).toLowerCase().includes(q);});}
$('#palette-search').addEventListener('input',palette);
$('#palette-search').addEventListener('keydown',e=>{if(e.key==='Enter'){const b=document.querySelector<HTMLButtonElement>('#palette>button:not([hidden]):not(:disabled)');if(b){b.click();$<HTMLInputElement>('#palette-search').blur();$('#world').focus();}}});
function setRunning(r: boolean) { running = r; send({type:'run',running:r,revision:++runRevision}); $('#play').innerHTML = icon(r ? 'pause' : 'play'); $('#play').setAttribute('aria-label', r ? 'Pause simulation' : 'Play simulation'); $('#play').title = `${r ? 'Pause' : 'Play'} (Space)`; $('#play').classList.toggle('active', r); document.body.classList.toggle('paused', !r); }
function openModal(title: string, body: string, kind = '') { modalKind = kind; $('#modal-title').textContent = title; $('#modal-body').innerHTML = body; if (!($('#modal') as HTMLDialogElement).open) ($('#modal') as HTMLDialogElement).showModal(); }
function closeModal() { ($('#modal') as HTMLDialogElement).close(); modalKind = ''; }
$('#modal-close').onclick = closeModal;
$('#modal').addEventListener('click', e => { if (e.target === $('#modal')) { const r = $('#modal').getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeModal(); } });
$('#modal').addEventListener('close', () => { modalKind = ''; });

function newWorldDialog() {
  openModal('A new small world', `<p class="muted">Start with a founding queen, or try a seeded experiment. Creating a world replaces the current run; save it first if you want to return.</p><div class="form-grid"><label>World seed<input id="new-seed" type="number" min="0" max="4294967295" value="${seed}"></label><label>Biology mode<select id="new-mode">${Object.entries(MODES).map(([k,v]) => `<option value="${k}" ${mode===k?'selected':''}>${v.label}</option>`).join('')}</select></label><label>World size<select id="new-size"><option value="scenario">Scenario default</option><option value="384,192">Compact · 384 × 192</option><option value="512,256">Standard · 512 × 256</option><option value="768,384">Large · experimental</option></select></label><label>Kingdoms (generated world)<input id="new-colonies" type="number" min="1" max="8" value="3"></label></div><div class="scenario-list">${SCENARIOS.map(s => `<button class="scenario-option ${s.id===scenario?'selected':''}" data-scenario="${s.id}"><strong>${s.title}</strong><small>${s.blurb}</small></button>`).join('')}</div><p id="mode-note" class="notice">${MODES[mode].description}</p><button id="create-world" class="primary">Create world</button>`, 'new');
  let chosen = scenario;
  $('#new-mode').onchange = () => { $('#mode-note').textContent = MODES[$<HTMLSelectElement>('#new-mode').value as Mode].description; };
  document.querySelectorAll<HTMLElement>('[data-scenario]').forEach(b => b.onclick = () => { chosen = b.dataset.scenario!; document.querySelectorAll('[data-scenario]').forEach(x => x.classList.toggle('selected', x === b)); const sm = SCENARIOS.find(s=>s.id===chosen)!.mode; $<HTMLSelectElement>('#new-mode').value=sm; $('#mode-note').textContent=MODES[sm].description; });
  $('#create-world').onclick = () => { const size = $<HTMLSelectElement>('#new-size').value; scenario=chosen; seed=Number($<HTMLInputElement>('#new-seed').value)>>>0; mode=$<HTMLSelectElement>('#new-mode').value as Mode; selectedColony=-1; send({type:'new', opts:{scenario,seed,mode,world:{colonies:Math.max(1,Math.min(8,Number($<HTMLInputElement>('#new-colonies').value)||3))},...(size==='scenario'?{}:{size:size.split(',').map(Number) as [number,number]})}}); closeModal(); setRunning(true); };
}
function guide() {
  const s = stats?.scenario;
  if(s?.id==='life-garden'){
    openModal('Living garden',`<p class="lead">Food, habitat, contact, then offspring.</p><p>${esc(s.goal)}</p><ol class="guide"><li><strong>Inspect an animal.</strong> Choose Inspect and click it. The cell inspector shows its current action, life stage, energy, health and actual parent IDs.</li><li><strong>Keep habitats connected.</strong> Fish and young frogs need water. Ground animals need support; flying animals still cannot cross a solid wall.</li><li><strong>Watch a new generation.</strong> Paired rats, flies, bees and fish start nearby. Contact and sufficient energy allow reproduction. Eggs or newborns develop; insects pass through a pupal stage.</li><li><strong>Intervene.</strong> Drain the pond, remove food, warm a bed or add a barrier. There is no guaranteed survival or breeding outcome.</li></ol><div class="scenario-actions">${s.actions.map((a:any,i:number)=>`<button class="primary" data-action="${i}">${esc(a.label)}</button>`).join('')}</div><div class="notice">These wildlife and plant profiles are simplified sandbox organisms, not validated species models. Lifecycles are compressed; non-ant inheritance records parentage without modeling genes. Plague and Primordial soup are explicitly fictional editing materials.</div><button id="guide-close">Observe the garden</button>`,'guide');
    document.querySelectorAll<HTMLElement>('[data-action]').forEach(b=>b.onclick=()=>{send({type:'scenarioAction',index:Number(b.dataset.action)});closeModal();});$('#guide-close').onclick=closeModal;return;
  }
  if(['empty','physics-lab','liquid-lab','powder-lab'].includes(s?.id)){
    openModal(s.title,`<p class="lead">Draw matter. Change conditions. Watch the result.</p><p>${esc(s.goal)}</p><ol class="guide"><li><strong>Choose a material.</strong> Powders fall, liquids spread and gases rise or settle. Fixed solids form walls.</li><li><strong>Draw a container.</strong> Use barriers or glass. Replace overwrites occupied cells; turn it off to add only into empty space.</li><li><strong>Change temperature or charge.</strong> Heat, Cool and Shock act immediately, even while paused. Shift intensifies. Resume to see melting, burning, flowing and conduction.</li><li><strong>Inspect and compare.</strong> Click cells with Inspect, then Edit to change their properties. Use temperature and charge overlays. Undo restores the previous world.</li></ol><div class="scenario-actions">${(s.actions??[]).map((a:any,i:number)=>`<button class="primary" data-action="${i}">${esc(a.label)}</button>`).join('')}</div><div class="notice">Batteries, heaters, coolers and cloners are continuous sandbox sources. Material temperatures and reactions are simplified game rules. The full Sandboxels element library and JavaScript mods are not included.</div><p>Right-drag pans with any tool. Middle-click picks. Scroll zooms. Use Pause and Step to examine individual updates. To start an ant colony, first paint a suitable soil layer, then introduce a queen from Organisms.</p><button id="guide-close">Start experimenting</button>`,'guide');
    document.querySelectorAll<HTMLElement>('[data-action]').forEach(b=>b.onclick=()=>{send({type:'scenarioAction',index:Number(b.dataset.action)});closeModal();});$('#guide-close').onclick=closeModal;return;
  }
  openModal(s?.title ?? 'Experiment guide', `<p class="lead">Create conditions. Introduce a queen. See what follows.</p><p>${esc(s?.goal)}</p><div class="notice">${mode==='fantasy'?'Fantasy: fictional adaptations are enabled.':mode==='speculative'?'Speculative: widened trait variation is an extrapolation.':'Naturalistic: researched species profiles with compressed time and colony size.'}<br>One model day = 3,600 ticks. At 1× this takes two minutes. Brood stages and lifespans are also compressed; this is a game, not a predictive model.</div><ol class="guide"><li><strong>Watch the founding queen.</strong> She chooses a site and digs. A garden ant queen seals herself in and rears first workers from reserves.</li><li><strong>Make a small intervention.</strong> Place sugar and protein on the surface. Use the trail overlay to watch successful return trips reinforce a route.</li><li><strong>Change the conditions.</strong> Move food, block a passage, or add water. The ants must find their way again.</li><li><strong>Follow later generations.</strong> Mature colonies rear winged reproductives. Flights and mating can produce daughter colonies, whose genotypes come from parents.</li></ol><div class="scenario-actions">${(s?.actions??[]).map((a:any,i:number)=>`<button class="primary" data-action="${i}">${esc(a.label)}</button>`).join('')}</div><p class="muted">Controls: drag to paint · right-drag, middle-drag, Space-drag or H to pan · click the minimap to jump · wheel or pinch to zoom · Space to pause · . to step · I inspect · D dig · F fit · [ ] brush size. On touch screens, choose the pan tool to drag the camera.</p><button id="guide-close">Explore the sandbox</button>`,'guide');
  document.querySelectorAll<HTMLElement>('[data-action]').forEach(b=>b.onclick=()=>{send({type:'scenarioAction',index:Number(b.dataset.action)});toast('Experiment intervention applied');closeModal();});
  $('#guide-close').onclick=closeModal;
}
function saves(list: any[] = []) {
  openModal('Keep this ecosystem', `<div class="save-row"><input id="save-name" aria-label="Save name" value="${esc(stats?.scenario?.title??'My colony')} · day ${stats?.day??1}"><button id="save-now" class="primary">Save new slot</button></div><p class="muted">Saved on this browser using IndexedDB. Export a portable file to keep a backup.</p><div class="saves-list">${list.length?list.map(s=>`<div class="save-item"><div><strong>${esc(s.name)}</strong><small>${esc(new Date(s.savedAt).toLocaleString())} · ${s.summary?.ants??0} ants</small></div><button data-load="${esc(s.slot)}">Load</button><button data-delete="${esc(s.slot)}" aria-label="Delete ${esc(s.name)}">×</button></div>`).join(''):'<p>No local saves yet.</p>'}</div><div class="button-row"><button id="export">Export world</button><button id="import">Import world</button></div>`, 'saves');
  $('#save-now').onclick=()=>{send({type:'save',slot:`world-${Date.now()}`,name:$<HTMLInputElement>('#save-name').value.slice(0,100)||'My colony'});};
  $('#export').onclick=()=>send({type:'export'}); $('#import').onclick=()=>$<HTMLInputElement>('#file-input').click();
  document.querySelectorAll<HTMLElement>('[data-load]').forEach(b=>b.onclick=()=>{send({type:'load',slot:b.dataset.load!});closeModal();});
  document.querySelectorAll<HTMLElement>('[data-delete]').forEach(b=>b.onclick=()=>{if(b.dataset.confirm){send({type:'deleteSave',slot:b.dataset.delete!});}else{b.dataset.confirm='yes';b.textContent='Delete?';}});
}
function settings() {
  const c=stats?.climate??{};
  openModal('Settings & field notes', `<div class="settings-grid"><section><h3>Presentation</h3><label><input id="labels" type="checkbox" ${renderer.labels?'checked':''}> Colony flags and labels</label><label><input id="patterns" type="checkbox" ${renderer.patterns?'checked':''}> Pattern marks on overlays</label><label><input id="detail" type="checkbox" ${renderer.lowDetail?'checked':''}> Reduce rendering detail (same simulation)</label><label><input id="sound" type="checkbox" ${sound?'checked':''}> Quiet tool sounds</label></section><section><h3>Ecosystem rules</h3><label><input id="weather-setting" type="checkbox" ${stats?.settings?.weather?'checked':''}> Seasonal weather</label><label><input id="predators" type="checkbox" ${stats?.settings?.naturalPredators?'checked':''}> Natural predator arrivals</label><label>Mean air temperature <output id="temp-val">${c.meanTemp}°C</output><input id="global-temp" type="range" min="0" max="38" value="${c.meanTemp}"></label><label>Surface humidity <output id="hum-val">${Math.round(c.baseHumidity*100)}%</output><input id="global-hum" type="range" min="10" max="95" value="${c.baseHumidity*100}"></label></section></div><details><summary>What the simulation abstracts</summary><p>The 2D slice constrains every route and flood to one plane. Ants walk on adjacent surfaces. Nest exit distance and colony task stimuli are bounded navigation and resource-accounting helpers; workers cannot query distant food. Surface trails decay without gas diffusion. Nest odour and alarm diffuse through open cells. Stored food and feeding are colony-scale approximations.</p><p>Learning changes task thresholds within a lifetime. Larval conditions influence realised size. Inheritance changes only offspring genotypes; mutation is random and never chosen to solve a pressure. Naturalistic trait effects and numeric rates are game assumptions.</p><p>Haploid males develop from unfertilised eggs; female offspring combine a maternal gamete with a stored paternal genome. Mating, flight seasons, recombination, and colony size are simplified. Off-map fathers are labelled background parents.</p></details><details><summary>Species and custom content</summary>${species.map(s=>`<h3><i>${esc(s.name)}</i></h3><p>${esc(s.summary)} ${esc(s.founding)} founding.</p><p class="muted">${s.simplifications.map(esc).join(' ')}</p>`).join('')}<p>Import declarative JSON matching the SpeciesDef schema in src/sim/species.ts. Executable content is never loaded.</p><button id="import-species">Import species JSON</button></details><details><summary>Research and known limits</summary><p>Sources and full assumptions are in docs/BIOLOGY.md. No oxygen-budget or ventilation simulation, full colony migration, parasites, bridge-building, or predictive evolution. Trail, moisture, temperature, and nutrition are real mechanics; future content is never displayed as an active capability.</p><p><a href="https://pubmed.ncbi.nlm.nih.gov/22972897/" target="_blank" rel="noreferrer">Czaczkes et al.: Lasius route learning</a><br><a href="https://doi.org/10.1007/s00442-002-0960-2" target="_blank" rel="noreferrer">Johnson: semi-claustral founding</a><br><a href="https://antwiki.org/wiki/Lasius_niger" target="_blank" rel="noreferrer">AntWiki: Lasius niger</a></p></details><div class="notice">Biologically informed sandbox. Associations in a run are not scientific evidence of causation. All editing tools are available immediately; discoveries only record observations.</div>`, 'settings');
  $('#modal-body').insertAdjacentHTML('afterbegin','<div class="button-row"><button id="settings-new">New world</button><button id="settings-journal">Field journal</button><button id="settings-guide">Experiment guide</button></div>');
  $('#settings-new').onclick=newWorldDialog;$('#settings-journal').onclick=()=>{evolution=null;journal();};$('#settings-guide').onclick=guide;
  for(const [id,key] of [['labels','labels'],['patterns','patterns'],['detail','lowDetail']] as const) $( '#'+id).onchange=()=>{renderer[key]=$<HTMLInputElement>('#'+id).checked;};
  $('#sound').onchange=()=>{sound=$<HTMLInputElement>('#sound').checked;beep();};
  $('#weather-setting').onchange=()=>send({type:'cmd',cmd:{t:'setting',key:'weather',value:$<HTMLInputElement>('#weather-setting').checked}});
  $('#predators').onchange=()=>send({type:'cmd',cmd:{t:'setting',key:'naturalPredators',value:$<HTMLInputElement>('#predators').checked}});
  $('#global-temp').oninput=()=>{const v=Number($<HTMLInputElement>('#global-temp').value);$('#temp-val').textContent=`${v}°C`;send({type:'cmd',cmd:{t:'climate',key:'meanTemp',value:v}});};
  $('#global-hum').oninput=()=>{const v=Number($<HTMLInputElement>('#global-hum').value);$('#hum-val').textContent=`${v}%`;send({type:'cmd',cmd:{t:'climate',key:'baseHumidity',value:v/100}});};
  $('#import-species').onclick=()=>$<HTMLInputElement>('#species-file').click();
}

// ---- named traits (WorldBox-style) ----
const traitChip = (t: number, extra = '') => { const d = TRAITS[t]; return d ? `<span class="trait-chip ${d.fantasy ? 'fantasy' : d.tone}" title="${esc(d.description)}"${extra}>${esc(d.name)}</span>` : ''; };
const traitChips = (list: number[]) => list.length ? `<div class="trait-chips">${list.map((t) => traitChip(t)).join('')}</div>` : '<p class="muted">No named traits.</p>';
const TRAIT_GROUPS: [string, string][] = [['body', 'Body'], ['survival', 'Survival'], ['mind', 'Mind'], ['combat', 'Combat'], ['work', 'Work'], ['fantasy', 'Fantasy (fictional)']];
/** Trait manager: toggle any named trait on one ant (sandbox override). A queen passes edits on to later offspring. */
function traitManager(antId: number, label: string, current: number[]) {
  const on = new Set(current);
  const render = () => {
    let body = `<p>Click a trait to add or remove it on <strong>${esc(label)}</strong>. Opposite traits replace each other. Changes apply now; a queen (or a male or winged gyne before its flight) passes the edited set on with each trait's inheritance chance. This is a sandbox override and marks the colony as edited.</p>`;
    for (const [g, name] of TRAIT_GROUPS) {
      if (g === 'fantasy' && mode !== 'fantasy') { body += `<p class="muted">Fantasy traits are available in Fantasy mode.</p>`; continue; }
      body += `<h3 class="trait-group">${name}</h3><div class="trait-chips">${TRAITS.map((d, t) => d.group === g ? traitChip(t, ` role="button" tabindex="0" data-trait="${t}" aria-pressed="${on.has(t)}"`) : '').join('')}</div>`;
    }
    body += `<div class="trait-legend"><span class="trait-chip good">beneficial</span><span class="trait-chip bad">harmful</span><span class="trait-chip mixed">trade-off</span><span class="trait-chip fantasy">fictional</span></div>`;
    openModal('Trait manager', body, 'traits');
    document.querySelectorAll<HTMLElement>('[data-trait]').forEach((el) => {
      const act = () => {
        const t = Number(el.dataset.trait), d = TRAITS[t], add = !on.has(t);
        send({ type: 'cmd', cmd: { t: 'editTraits', antId, trait: t, on: add } });
        if (add) { on.add(t); if (d.opposite) on.delete(TRAITS.findIndex((x) => x.key === d.opposite)); } else on.delete(t);
        render();
      };
      el.onclick = act; el.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } };
    });
  };
  render();
}

function journal() {
  send({type:'requestDetail',what:'evolution'});
  const tabs = `<div class="journal-tabs">${['discoveries','lineage','traits','mutations'].map(t=>`<button data-jtab="${t}" class="${journalTab===t?'selected':''}">${t[0].toUpperCase()+t.slice(1)}</button>`).join('')}</div>`;
  let body='';
  if(journalTab==='discoveries') body=`<p class="muted">Observations record what happened. They do not grant abilities.</p>${stats?.journal?.length?stats.journal.map((j:any)=>`<article class="journal-entry"><small>Day ${(j.tick/3600+1).toFixed(1)} · ${esc(j.kind)}</small><h3>${esc(j.title)}</h3><p>${esc(j.text)}</p></article>`).join(''):'<div class="empty"><h3>The first page is unwritten.</h3><p>Watch a queen establish her nest, a worker return with food, or a colony encounter a rival. Discoveries appear when those things happen.</p></div>'}`;
  if(journalTab==='lineage') body=`<p class="notice">Daughters inherit from actual reproductive parents. Background fathers come from an explicitly modelled off-map population.</p><div class="lineage">${evolution?.lineage?.map((l:any)=>`<article class="lineage-node" style="margin-left:${Math.min(l.generation,6)*14}px"><span class="gen">G${l.generation}</span><div><strong>${esc(l.name)}</strong><small>${l.motherColony?'Mother colony #'+l.motherColony:'Introduced founder'} · fathers ${esc(l.fatherColonies.map((f:number)=>f||'background').join(', '))}</small><small>Peak ${l.peakWorkers} workers · ${l.daughterColonies} daughter colonies · ${l.gynesFlown} gynes flown${l.playerEdited?' · sandbox edited':''}${l.diedTick>=0?' · extinct':''}</small></div></article>`).join('')??'Loading lineage…'}</div>`;
  if(journalTab==='traits') {
    // named traits: catalogue with inheritance odds and how common each is among each colony's workers
    body='<h3 class="trait-group">Named traits</h3><p>Every ant carries a few named traits. A trait carried by one parent passes on with its inheritance chance; carried by both, the chance is higher; any trait can appear spontaneously at birth. Opposites never co-occur. This layer is a game abstraction, not real ant genetics. Click an ant and use “Manage traits” to edit one.</p>';
    for(const [g,name] of TRAIT_GROUPS){
      if(g==='fantasy'&&mode!=='fantasy')continue;
      body+=`<h4>${name}</h4>`;
      TRAITS.forEach((d,t)=>{if(d.group!==g)return;
        body+=`<article class="trait-row named">${traitChip(t)}<p>${esc(d.description)} <span class="muted">Inherit ${Math.round(d.inherit*100)}% per parent · birth ${(d.birth*100).toFixed(1)}%${d.opposite?` · opposite: ${esc(TRAITS.find(x=>x.key===d.opposite)?.name)}`:''}</span></p>${(evolution?.colonies??[]).map((c:any)=>{const f=c.named?.[t]??0;return `<div class="distribution"><span>${esc(c.name)}${c.queenTraits?.includes(t)?' · queen has it':''}</span><div class="bar"><i style="left:0;width:${Math.max(f>0?1:0,f*100)}%;background:rgb(${c.marking})"></i></div><small>${Math.round(f*100)}%</small></div>`;}).join('')}</article>`;});
    }
    body+='<h3 class="trait-group">Quantitative loci</h3><p>Inherited variation is shown from living workers, sampled up to 300 per colony. Bars show genotype means (0–1); ranges show the sample minimum and maximum.</p>';
    for(const l of evolution?.loci??[]){ if(l.i>16 && mode!=='fantasy')continue; body+=`<article class="trait-row"><strong>${esc(l.name)}</strong><p>${esc(l.effect)} <span class="muted">Cost: ${esc(l.cost)}</span></p>${evolution.colonies.map((c:any)=>{const vals=c.workers[l.i]??[], mean=vals.length?vals.reduce((a:number,b:number)=>a+b,0)/vals.length:c.geno[l.i],lo=vals.length?Math.min(...vals):mean,hi=vals.length?Math.max(...vals):mean;return `<div class="distribution"><span>${esc(c.name)} · G${c.generation}</span><div class="bar"><i style="left:${lo*100}%;width:${Math.max(1,(hi-lo)*100)}%;background:rgb(${c.marking})"></i><b style="left:${mean*100}%"></b></div><small>${Number(mean).toFixed(2)} · n=${vals.length}</small></div>`;}).join('')}</article>`;}
    body+='<p class="notice">Trait frequency and reproductive success can be associated in this run. Small samples, ancestry, and environment confound causal explanations.</p>';
  }
  if(journalTab==='mutations') body=`<p class="muted">Random variation is generated at reproduction. Pressure influences which descendants survive; it never selects the mutation to generate.</p>${evolution?.mutations?.length?`<div class="table-scroll"><table><thead><tr><th>Day</th><th>Colony</th><th>Trait</th><th>Change</th><th>Carrier</th></tr></thead><tbody>${evolution.mutations.slice(0,100).map((m:any)=>`<tr><td>${(m.tick/3600+1).toFixed(1)}</td><td>#${m.colony}</td><td>${esc(LOCI[m.locus]?.name)}</td><td>${m.from.toFixed(3)} → ${m.to.toFixed(3)}</td><td>${esc(m.carrier)}</td></tr>`).join('')}</tbody></table></div>`:'<p>No mutations recorded yet.</p>'}<details><summary>Sandbox override · queen germline</summary><p>Changes future offspring only. Existing adults and brood keep their genotypes. Edited lineages are labelled and excluded from association analysis.</p><label>Colony<select id="edit-colony">${(stats?.colonies??[]).filter((c:any)=>c.queens).map((c:any)=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label><label>Locus<select id="edit-locus">${LOCI.map((l,i)=>!l.fantasy||mode==='fantasy'?`<option value="${i}">${esc(l.name)}</option>`:'').join('')}</select></label><label>Allele value (0–1)<input id="edit-value" type="number" min="0" max="1" step="0.05" value="0.7"></label><button id="edit-apply">Apply sandbox override</button></details>`;
  openModal('Field journal',tabs+body,'journal');
  document.querySelectorAll<HTMLElement>('[data-jtab]').forEach(b=>b.onclick=()=>{journalTab=b.dataset.jtab!;journal();});
  if(journalTab==='mutations')$('#edit-apply').onclick=()=>{const value=Number($<HTMLInputElement>('#edit-value').value);if(!Number.isFinite(value)||value<0||value>1)return toast('Enter an allele value between 0 and 1.',true);send({type:'cmd',cmd:{t:'editGenome',colonyId:Number($<HTMLSelectElement>('#edit-colony').value),locus:Number($<HTMLSelectElement>('#edit-locus').value),value}});toast('Queen germline edited for future offspring');};
}

function updateStats(s: any) {
  // A sampled status sent before the latest toggle must not reverse the next click.
  if(s.runRevision<runRevision)return;
  stats=s; running=s.running; document.body.classList.toggle('paused',!s.running);
  $<HTMLButtonElement>('#undo').disabled=!s.history?.undo;$<HTMLButtonElement>('#redo').disabled=!s.history?.redo;
  $('#day').textContent=`Day ${s.day}`; $('#season').textContent=`${s.season} · ${s.clock}`;
  $('#weather').textContent=`${s.airT.toFixed(0)}°C · ${s.raining?'raining':s.daytime?'daylight':'night'}`;
  $('#status').textContent=`${s.ants.toLocaleString()} ants · ${s.colonies.filter((c:any)=>c.alive).length} colonies · ${s.running?(s.achievedSpeed.toFixed(1)+'× achieved'):'paused'}`;
  $('#journal-count').textContent=String(s.journal.length); renderer.colonies=s.colonies; renderer.route=s.route;
  const select=$<HTMLSelectElement>('#colony-select');
  const options=s.colonies.map((c:any)=>`<option value="${c.id}">${esc(c.name)} · G${c.generation}</option>`).join('');
  if(select.innerHTML!==options){select.innerHTML=options; if(s.colonies.some((c:any)=>c.id===selectedColony))select.value=String(selectedColony);}
  if(selectedColony<0&&s.colonies.length)selectedColony=s.colonies[0].id;
  const c=s.colonies.find((c:any)=>c.id===selectedColony)??s.colonies[0];
  $('#colony-peek').textContent=c?`${c.workers} workers · ${c.brood.reduce((a:number,b:number)=>a+b,0)} brood`:'Introduce a queen';
  const a=s.selectedAnt, cell=s.selectedCell;
  if(a){
    // the inspector re-renders on every stats update; keep it stable while the trait details are open
    const html=`<div class="inspect-title">${a.name?`${esc(a.name)} · `:''}${esc(a.caste)} #${a.id}<small>${esc(a.colony)}</small></div>${a.name?`<p class="muted">${esc(a.clan??'')} · feeling <b>${esc(a.mood??'')}</b></p><p class="muted">${esc(a.persona??'')}</p>`:''}<p class="reason">${esc(a.why)}</p>${a.story?.length?`<details class="tasks" open><summary>Life story</summary>${a.story.map((l:string)=>`<p>${esc(l)}</p>`).join('')}</details>`:''}${traitChips(a.named??[])}<button id="manage-traits" class="small-btn">Manage traits</button><p class="muted">${esc(a.namedOrigin??'')}</p>${a.lines.map((l:string)=>`<p>${esc(l)}</p>`).join('')}<details id="geno-details"${genoOpen?' open':''}><summary>Inherited loci & phenotype</summary>${a.traits.map((t:any)=>`<div class="ant-trait"><span>${esc(t.name)}<small>${esc(t.kind)}</small></span><b>${esc(t.value)}</b></div>`).join('')}</details>`;
    if(html!==lastInspect){lastInspect=html;$('#inspect-detail').innerHTML=html;
      $('#manage-traits').onclick=()=>traitManager(a.id,`${a.caste} #${a.id} (${a.colony})`,a.named??[]);
      $('#geno-details').ontoggle=()=>{genoOpen=($('#geno-details') as HTMLDetailsElement).open;};}
  }
  else if(cell){lastInspect='';$('#inspect-detail').innerHTML=`<div class="inspect-title">${esc(cell.material)}<small>${cell.x}, ${cell.y}</small></div><p>${esc(cell.description)}</p>${cell.lines.map((l:string)=>`<p>${esc(l)}</p>`).join('')}`;}
  updateCellCard(s);
  renderSheets(s);
  if(document.body.classList.contains('panel-hidden'))return;
  if(c){
    const brood=c.brood.reduce((a:number,b:number)=>a+b,0);
    $('#colony-detail').innerHTML=`<div class="species-line"><i>${esc(c.species)}</i><span class="stage">${esc(c.stage)}</span></div>${kingdomHtml(c.society)}<div class="colony-count"><strong>${c.workers}</strong><span>workers<br><small>${c.queens} queen${c.queens===1?'':'s'} · generation ${c.generation}</small></span><button id="focus-colony" class="icon-btn" aria-label="Focus colony" title="Focus colony">${icon('fit')}</button></div><div class="brood-stages"><div><b>${c.brood[0]}</b><span>Eggs</span></div><span>›</span><div><b>${c.brood[1]}</b><span>Larvae</span></div><span>›</span><div><b>${c.brood[2]}</b><span>Pupae</span></div></div><div class="store-heading">Nest stores <small>food units</small></div><div class="resources"><span><i style="background:#e7bd69"></i>Sugar <b>${c.store.sugar.toFixed(0)}</b></span><span><i style="background:#d98a78"></i>Protein <b>${c.store.protein.toFixed(0)}</b></span><span><i style="background:#a9b473"></i>Seeds <b>${c.store.seed.toFixed(0)}</b></span></div>${c.stage==='founding'?`<div class="reserve-line"><span>Queen reserves</span><b>${c.reserves.toFixed(0)}</b></div><meter min="0" max="120" value="${c.reserves}"></meter>`:''}<p class="colony-note">${esc(c.notes[0]??(brood?'Brood developing in the nest. Inspect a worker to understand its task.':'The queen is looking for a suitable nest site.'))}</p><details class="tasks"><summary>Colony activity</summary>${Object.entries(c.tasks).map(([k,v])=>`<div>${esc(k)}<b>${v}</b></div>`).join('')||'<p>No workers yet.</p>'}<p>${c.stats.workersEclosed} workers emerged · ${c.stats.daughterColonies} daughters founded</p><p>Deaths: ${esc(JSON.stringify(c.stats.adultDeaths))}</p></details><details class="tasks" id="colony-traits"${colonyTraitsOpen?' open':''}><summary>Traits</summary><p class="muted">Queen${c.queenId?` #${c.queenId}`:''} (passes traits to her offspring):</p>${traitChips(c.queenTraits??[])}${c.queenId?'<button id="manage-queen-traits" class="small-btn">Manage queen traits</button>':''}<p class="muted">Most common among workers:</p>${(c.topTraits??[]).length?`<div class="trait-chips">${c.topTraits.map((e:any)=>traitChip(e.t).replace('</span>',` ${Math.round(100*e.n/Math.max(1,c.workers))}%</span>`)).join('')}</div>`:'<p class="muted">None yet.</p>'}</details>`;
    $('#focus-colony').onclick=()=>renderer.focus(c.entrance.x,c.entrance.y+12);
    $('#colony-traits').ontoggle=()=>{colonyTraitsOpen=($('#colony-traits') as HTMLDetailsElement).open;};
    const kd=document.querySelector<HTMLDetailsElement>('#kingdom');if(kd)kd.ontoggle=()=>{kingdomOpen=kd.open;};
    if(c.queenId)$('#manage-queen-traits').onclick=()=>traitManager(c.queenId,`queen #${c.queenId} of ${c.name}`,c.queenTraits??[]);
  }else $('#colony-detail').innerHTML='<p>No living colonies. Introduce a queen from Organisms.</p>';
  $('#event-count').textContent=String(s.events.length);
  $('#events').innerHTML=s.events.slice(-18).reverse().map((e:any)=>`<div><small>Day ${(e.tick/3600+1).toFixed(1)}</small><p>${esc(e.text)}</p></div>`).join('')||'<p class="muted">A new ecosystem. Events will appear here.</p>';
  if($<HTMLDetailsElement>('#metrics').open)$('#metrics-detail').innerHTML=`<dl>${Object.entries({ 'Render':renderer.renderMs.toFixed(2)+' ms', 'Simulation':s.perf.stepMs.toFixed(2)+' ms/tick', 'Fields':s.perf.fieldMs.toFixed(2)+' ms', 'Active agents':s.ants, 'Active chunks':`${s.perf.activeChunks}/${s.perf.totalChunks}`, 'Signal chunks':s.perf.signalChunks, 'Estimated buffers':s.perf.estMB.toFixed(1)+' MB', 'Command queue':s.perf.pendingCommands, 'Dropped render frames':renderer.droppedFrames, 'Dropped catch-up ticks':s.droppedTicks, 'Resource audit':JSON.stringify(s.audit) }).map(([k,v])=>`<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl><p class="muted">Buffer estimate excludes JS objects and canvas. Dropped ticks are discarded catch-up debt; simulation rules keep a fixed timestep.</p>`;
}

worker.onmessage=e=>{
  const m=e.data;
  if(m.type==='ready'){send({type:'new',opts:{scenario,seed}});send({type:'speed',speed:1});setRunning(true);}
  if(m.type==='world'){
    evolution = null;
    species=m.species;mode=m.mode;seed=m.seed;scenario=m.scenario.id;renderer.species=species;renderer.notes=m.scenario.notes??[];if(m.cutaway!==undefined)renderer.cutaway=m.cutaway;
    if(!m.keepView)renderer.reset(m.W,m.H);
    $('#world-title').textContent=m.scenario.title;$('#mode-badge').textContent=MODES[mode].label;$('#seed-label').textContent=String(seed);$('#position').textContent=`${m.W} × ${m.H} cells`;palette();
  }
  if(m.type==='frame'){try{renderer.accept(m);}finally{send({type:'frameAck',id:m.id});}}
  if(m.type==='stats')updateStats(m);
  if(m.type==='history'){$<HTMLButtonElement>('#undo').disabled=!m.undo;$<HTMLButtonElement>('#redo').disabled=!m.redo;}
  if(m.type==='evolution'){const first=!evolution;evolution=m.data;if(first&&modalKind==='journal')journal();}
  if(m.type==='error')toast(m.text,true);
  if(m.type==='saved'){toast('World saved in this browser');send({type:'listSaves'});}
  if(m.type==='loaded'){setRunning(false);toast('World loaded · paused');}
  if(m.type==='saves')saves(m.list);
  if(m.type==='brainsResult')toast(m.text);
  if(m.type==='brainsExported'){const url=URL.createObjectURL(new Blob([m.text],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=m.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);toast('Brain bank exported');}
  if(m.type==='speciesResult'){toast(m.ok?`Imported ${m.name}`:m.errors.join(' '),!m.ok);}
  if(m.type==='exported'){const url=URL.createObjectURL(new Blob([m.data],{type:'application/gzip'}));const a=document.createElement('a');a.href=url;a.download=m.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);toast('World exported');}
};
worker.onerror=e=>toast(`Simulation error: ${e.message}`,true);
$('#play').onclick=()=>setRunning(!running);$('#step').onclick=()=>{setRunning(false);send({type:'step',ticks:1});};
$('#speed').onchange=()=>send({type:'speed',speed:Number($<HTMLSelectElement>('#speed').value)});
$('#new').onclick=newWorldDialog;$('.brand').onclick=e=>{e.preventDefault();renderer.fit();};$('#journal').onclick=()=>{evolution=null;journal();};$('#settings').onclick=settings;$('#save-menu').onclick=()=>send({type:'listSaves'});$('#scenario-help').onclick=guide;
$('#zoom-in').onclick=()=>renderer.zoomAt(1.3);$('#zoom-out').onclick=()=>renderer.zoomAt(1/1.3);$('#fit').onclick=()=>renderer.fit();
$('#fullscreen').onclick=()=>{const action=document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen();void action.catch(()=>toast('Fullscreen is unavailable in this browser window.',true));};
$('#undo').onclick=()=>{flushBrush();send({type:'undo'});setRunning(false);};$('#redo').onclick=()=>{flushBrush();send({type:'redo'});setRunning(false);};
$('#clear-world').onclick=()=>{flushBrush();send({type:'clearWorld'});setRunning(false);toast('World cleared. Undo restores the previous ecosystem.');};
$('#brush-minus').onclick=()=>changeBrush(-1);$('#brush-plus').onclick=()=>changeBrush(1);
$('#shift-toggle').onclick=()=>{shiftLatched=!shiftLatched;intensify=shiftLatched;$('#shift-toggle').classList.toggle('selected',shiftLatched);$('#shift-toggle').setAttribute('aria-pressed',String(shiftLatched));};
function changeBrush(d:number){$<HTMLInputElement>('#brush').value=String(Math.max(0,Math.min(15,renderer.brush+d)));$('#brush').dispatchEvent(new Event('input'));}
$('#replace-toggle').onclick=()=>{const c=$<HTMLInputElement>('#replace');c.checked=!c.checked;$('#replace-toggle').classList.toggle('selected',c.checked);};
$('#replace').onchange=()=>$('#replace-toggle').classList.toggle('selected',$<HTMLInputElement>('#replace').checked);
$('#set-tps').onclick=()=>{openModal('Target simulation rate',`<p>TPS is fixed simulation ticks per second. Rendering remains independent; work stays within its compute budget. Actual throughput can be lower.</p><label>Target TPS<input id="tps-value" type="number" min="1" max="9000" value="${Math.min(9000,Math.round((stats?.speed??10)*30))}"></label><button id="tps-apply" class="primary">Set tick rate</button>`);$('#tps-apply').onclick=()=>{const tps=Number($<HTMLInputElement>('#tps-value').value);if(!Number.isFinite(tps)||tps<1||tps>9000)return toast('Enter a rate from 1 to 9000 TPS.',true);send({type:'speed',speed:tps/30});const sel=$<HTMLSelectElement>('#speed'),o=document.createElement('option');o.value=String(tps/30);o.textContent=`${tps} TPS`;sel.append(o);sel.value=o.value;closeModal();};};
$('#edit-cell').onclick=()=>{
 const c=stats?.selectedCell;if(!c){setTool('inspect');document.body.classList.remove('panel-hidden');toast('Select a cell in the world, then press Edit.');return;}
 openModal(`Edit cell ${c.x}, ${c.y}`,`<p>Sandbox override. Food and water changes are recorded as player sources/sinks. Temperature affects the local 4 × 4 field tile.</p><label>Material<select id="cell-mat">${MATERIALS.map(m=>`<option value="${m.id}" ${m.id===c.materialId?'selected':''}>${esc(m.name)}</option>`).join('')}</select></label><div class="form-grid"><label>Quantity<input id="cell-amount" type="number" min="0" max="255" value="${c.amount}"></label><label>Temperature °C<input id="cell-temp" type="number" min="-273" max="2000" value="${c.temperature.toFixed(1)}"></label><label>Charge 0–255<input id="cell-charge" type="number" min="0" max="255" value="${c.charge}"></label><label>Contamination<input id="cell-toxin" type="number" min="0" max="255" value="${c.toxin}"></label></div><button id="cell-apply" class="primary">Apply properties</button>`);
 const quantityLimit=()=>{$<HTMLInputElement>('#cell-amount').max=String(Number($<HTMLSelectElement>('#cell-mat').value)===M.CLONER?MATERIALS.length-1:255);};$('#cell-mat').onchange=quantityLimit;quantityLimit();
 $('#cell-apply').onclick=()=>{const nums=['cell-mat','cell-amount','cell-temp','cell-charge','cell-toxin'].map(id=>Number($<HTMLInputElement>('#'+id).value));if(nums.some(v=>!Number.isFinite(v)))return toast('Use finite numbers for cell properties.',true);send({type:'beginEdit'});send({type:'cmd',cmd:{t:'editCell',x:c.x,y:c.y,mat:nums[0],amount:nums[1],temperature:nums[2],charge:nums[3],toxin:nums[4]}});send({type:'endEdit'});closeModal();};
};
function elementInfo(id=material){const m=MATERIALS[id];if(!m)return;openModal(m.name,`<p>${esc(m.description)}</p><dl><dt>State</dt><dd>${m.state}</dd><dt>Relative density</dt><dd>${m.density}</dd><dt>Conductivity</dt><dd>${m.conductivity??0}</dd><dt>Dig resistance</dt><dd>${m.digResist}</dd><dt>Permeability</dt><dd>${m.permeability}</dd><dt>Moisture capacity</dt><dd>${m.moistureCap}</dd><dt>Mixture carrier capacity</dt><dd>${m.carrierCapacity??0}</dd><dt>Thermal diffusivity</dt><dd>${m.thermal}</dd></dl>`);}
$('#element-info').onclick=()=>elementInfo();
$('#content-packs').onclick=()=>{openModal('Mods & content packs',`<p>Import declarative species packs. Packs configure existing biology and traits; arbitrary scripts are not executed.</p><p>Sandboxels JavaScript mods use another engine and are not compatible with this game.</p>${species.map(s=>`<p><strong>${esc(s.name)}</strong> · ${s.builtin?'built-in':'imported pack'}</p>`).join('')}<button id="pack-file" class="primary">Import species JSON</button>`);$('#pack-file').onclick=()=>$<HTMLInputElement>('#species-file').click();};
$('#capture-world').onclick=()=>{canvas.toBlob(blob=>{if(!blob)return;const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=`ant-sandbox-${seed}-day${stats?.day??1}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);},'image/png');};
function toggleGUI(){document.body.classList.toggle('gui-hidden');}
$('#toggle-gui').onclick=toggleGUI;$('#restore-ui').onclick=toggleGUI;
$('#collapse').onclick=()=>document.body.classList.add('panel-hidden');$('#sidebar-toggle').onclick=()=>{document.body.classList.toggle('panel-hidden');if(stats)updateStats(stats);};
$('#colony-select').onchange=()=>{selectedColony=Number($<HTMLSelectElement>('#colony-select').value);updateOverlay();};
$('#overlay').onchange=updateOverlay;
function updateOverlay(){const kind=$<HTMLSelectElement>('#overlay').value as OverlayKind,c=stats?.colonies.find((c:any)=>c.id===selectedColony);send({type:'overlay',kind,colony:c?.slot??-1,trait:6});const el=$('#overlay-legend');el.hidden=kind==='none';el.textContent=kind==='trail'?'Foraging trail · stronger marks = more signal':kind==='temperature'?'Temperature · blue cool → red hot':kind==='territory'?'Recent visits · colony markings':`${$<HTMLSelectElement>('#overlay').selectedOptions[0].text} · faint → strong`;}
$('#brush').oninput=()=>{renderer.brush=Number($<HTMLInputElement>('#brush').value);$('#brush-value').textContent=String(renderer.brush*2+1);};
document.addEventListener('click',e=>{const b=(e.target as HTMLElement).closest<HTMLElement>('[data-tool]');if(b){setTool(b.dataset.tool!,b.dataset.mat?Number(b.dataset.mat):undefined);beep();}const tab=(e.target as HTMLElement).closest<HTMLElement>('[data-cat]');if(tab){cat=tab.dataset.cat!;palette();}});
async function importFile(input: HTMLInputElement, sp=false){const file=input.files?.[0];if(!file)return;try{if(file.size>100*1024*1024)throw new Error('File exceeds the 100 MB import limit.');if(sp)send({type:'importSpecies',json:await file.text()});else{send({type:'import',data:await file.arrayBuffer()});closeModal();}}catch(e){toast((e as Error).message,true);}input.value='';}
$('#file-input').onchange=()=>void importFile($('#file-input'));$('#species-file').onchange=()=>void importFile($('#species-file'),true);
function paint(x:number,y:number){
  if(x<0||y<0||x>=renderer.W||y>=renderer.H)return;
  const r=renderer.brush;let cmd:Command;
  if(eraseStroke)cmd={t:'erase',x,y,r};
  else if(tool==='paint')cmd={t:'paint',mat:material,x,y,r,replace:$<HTMLInputElement>('#replace').checked,...(material===M.DYE||material===M.COLOR_SAND?{tint:(0xff000000|parseInt($<HTMLInputElement>('#paint-color').value.slice(1),16))>>>0}:{})};
  else if(tool==='color')cmd={t:'color',x,y,r,tint:(0xff000000|parseInt($<HTMLInputElement>('#paint-color').value.slice(1),16))>>>0};
  else if(tool==='mix'||tool==='smash')cmd={t:tool,x,y,r,intense:intensify};
  else if(tool==='dig'||tool==='erase'||tool==='toxin'||tool==='rain')cmd={t:tool,x,y,r};
  else if(tool==='charge')cmd={t:'charge',x,y,r,amount:intensify?255:96};
  else if(tool==='heat'||tool==='cool')cmd={t:'heat',x,y,r,amount:(tool==='heat'?1:-1)*(intensify?10:2)};
  else if(tool==='humid'||tool==='dry')cmd={t:'humidity',x,y,r,amount:tool==='humid'?1:-1};
  else if(tool==='queen'||tool==='colony'){const sp=$<HTMLSelectElement>('#species')?.value??species[0]?.id;if(!sp)return;cmd=tool==='queen'?{t:'queen',species:sp,x,y}:{t:'colony',species:sp,x,y,workers:35};}
  else if(tool==='spider'||tool==='springtail'||tool.startsWith('animal:'))cmd={t:'critter',kind:tool.startsWith('animal:')?tool.slice(7):tool,x,y};else return;
  queueBrush(cmd);
}
const canvas=$<HTMLCanvasElement>('#world');
function paintShape(a:{x:number;y:number},b:{x:number;y:number},shape:string){
 if(shape==='fill'){queueBrush({t:'fill',mat:material,x:b.x,y:b.y});return;}
 if(shape==='box'){const loX=Math.min(a.x,b.x),loY=Math.min(a.y,b.y),hiX=Math.max(a.x,b.x),hiY=Math.max(a.y,b.y),spacing=Math.max(1,renderer.brush);for(let y=loY;y<=hiY;y+=spacing)for(let x=loX;x<=hiX;x+=spacing)paint(x,y);paint(hiX,hiY);return;}
 const n=Math.max(Math.abs(b.x-a.x),Math.abs(b.y-a.y),1);for(let k=0;k<=n;k++)paint(Math.round(a.x+(b.x-a.x)*k/n),Math.round(a.y+(b.y-a.y)*k/n));
}
const local=(e:PointerEvent|WheelEvent)=>{const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};};
canvas.oncontextmenu=e=>e.preventDefault();
function pickAt(w:{x:number;y:number}){if(w.x<0||w.y<0||w.x>=renderer.W||w.y>=renderer.H)return;const m=renderer.map[w.y*renderer.W+w.x];if(m===M.AIR){setTool('erase');return;}const d=MATERIALS[m];cat=d.category==='food'?'food':d.state==='powder'?'powders':d.state==='liquid'?'liquids':d.state==='gas'?'gases':'solids';palette();setTool('paint',m);}
function toolCursor(){return tool==='pan'?'grab':['inspect','pick','lookup'].includes(tool)?'crosshair':'none';}
const touches=new Map<number,{x:number;y:number}>();
let pinch:{d:number;x:number;y:number}|null=null,miniDrag=false,panPick:{x:number;y:number}|null=null,panMoved=0,lastClient={x:0,y:0},spacePanned=false;
const pinchState=()=>{const [a,b]=[...touches.values()];return{d:Math.hypot(a.x-b.x,a.y-b.y)||1,x:(a.x+b.x)/2,y:(a.y+b.y)/2};};
// A second finger turns a touch stroke into a pinch; whatever the first finger began is closed as one edit.
function abortStroke(){if(heldBrushFrame)cancelAnimationFrame(heldBrushFrame);heldBrushFrame=0;const wasEdit=stroke;shapeStart=null;renderer.preview=null;stroke=false;dragging=false;lastPoint=null;eraseStroke=false;flushBrush();if(wasEdit)send({type:'endEdit'});}
canvas.onpointerdown=e=>{
 e.preventDefault();canvas.focus();const p=local(e),w=renderer.world(p.x,p.y);renderer.hover=w;
 if(e.pointerType==='touch'){touches.set(e.pointerId,p);if(touches.size>=2){abortStroke();pinch=pinchState();return;}}
 canvas.setPointerCapture(e.pointerId);lastClient={x:e.clientX,y:e.clientY};
 if(e.button===0&&renderer.minimapAt(p.x,p.y)){miniDrag=true;renderer.centerFromMinimap(p.x,p.y);return;}
 // Middle button: drag to pan, click without moving to pick the material.
 if(e.button===1){dragging=true;panMoved=0;panPick=e.altKey?null:w;canvas.style.cursor='grabbing';return;}
 // Right-drag always moves the camera, whatever tool is selected.
 if(e.button===2){dragging=true;panMoved=0;canvas.style.cursor='grabbing';return;}
 eraseStroke=false;dragging=tool==='pan'||e.altKey||space;stroke=!dragging;lastPoint=w;intensify=e.shiftKey||shiftLatched;
 if(dragging){if(space)spacePanned=true;canvas.style.cursor='grabbing';return;}
 if(tool==='pick'&&!eraseStroke){pickAt(w);stroke=false;return;}
 if(tool==='lookup'&&!eraseStroke){if(w.x>=0&&w.y>=0&&w.x<renderer.W&&w.y<renderer.H)elementInfo(renderer.map[w.y*renderer.W+w.x]);stroke=false;return;}
 if(tool==='inspect'&&!eraseStroke){send({type:'selectAnt',...w,radius:Math.max(1,5/renderer.zoom)});$('#inspector').setAttribute('open','');showCellCard(w,p);stroke=false;return;}
 send({type:'beginEdit'});const shape=eraseStroke?'brush':$<HTMLSelectElement>('#draw-shape').value;
 if(intensify&&lineAnchor&&['paint','dig','erase'].includes(tool)){paintShape(lineAnchor,w,'line');stroke=false;flushBrush();send({type:'endEdit'});}
 else if(shape==='fill'){paintShape(w,w,'fill');stroke=false;flushBrush();send({type:'endEdit'});}
 else if(shape!=='brush'&&tool!=='drag')shapeStart={...w};else if(tool!=='drag'){
  paint(w.x,w.y);
  if(eraseStroke||(!tool.startsWith('animal:')&&!['queen','colony','spider','springtail','rain'].includes(tool))){heldBrushAt=performance.now();if(!heldBrushFrame)heldBrushFrame=requestAnimationFrame(holdBrush);}
 }
 lineAnchor=w;beep();
};
canvas.onpointermove=e=>{
 const p=local(e);
 if(touches.has(e.pointerId)){touches.set(e.pointerId,p);if(pinch&&touches.size>=2){const n=pinchState();renderer.zoomAt(n.d/pinch.d,n.x,n.y);renderer.ox+=n.x-pinch.x;renderer.oy+=n.y-pinch.y;pinch=n;return;}}
 if(miniDrag){renderer.centerFromMinimap(p.x,p.y);return;}
 if(dragging){const dx=e.clientX-lastClient.x,dy=e.clientY-lastClient.y;lastClient={x:e.clientX,y:e.clientY};renderer.ox+=dx;renderer.oy+=dy;panMoved+=Math.abs(dx)+Math.abs(dy);return;}
 if(!stroke&&!shapeStart&&renderer.minimapAt(p.x,p.y)){renderer.hover=null;canvas.style.cursor='pointer';return;}
 canvas.style.cursor=toolCursor();
 const w=renderer.world(p.x,p.y);renderer.hover=w;intensify=e.shiftKey||shiftLatched;
 $('#position').textContent=w.x>=0&&w.y>=0&&w.x<renderer.W&&w.y<renderer.H?`${w.x}, ${w.y}`:`${renderer.W} × ${renderer.H} cells`;
 if(shapeStart){renderer.preview={...shapeStart,x2:w.x,y2:w.y,kind:$<HTMLSelectElement>('#draw-shape').value};return;}
 if(!stroke||!lastPoint||(w.x===lastPoint.x&&w.y===lastPoint.y))return;
 if(tool==='drag'&&!eraseStroke){queueBrush({t:'move',x:lastPoint.x,y:lastPoint.y,toX:w.x,toY:w.y,r:renderer.brush});lastPoint=w;return;}
 if(!eraseStroke&&(tool.startsWith('animal:')||['inspect','pick','queen','colony','spider','springtail','rain'].includes(tool)))return;
 const dx=w.x-lastPoint.x,dy=w.y-lastPoint.y,d=Math.max(Math.abs(dx),Math.abs(dy)),spacing=eraseStroke||['paint','dig','erase'].includes(tool)?Math.max(1,Math.floor(renderer.brush/2)):1;
 if(d<spacing)return;const n=Math.min(100,Math.ceil(d/spacing));for(let k=1;k<=n;k++)paint(Math.round(lastPoint.x+dx*k/n),Math.round(lastPoint.y+dy*k/n));lastPoint=w;
};
const pointerEnd=(e:PointerEvent)=>{
 if(touches.delete(e.pointerId)&&pinch){if(touches.size<2)pinch=null;return;}
 miniDrag=false;
 if(panPick&&panMoved<4)pickAt(panPick);panPick=null;
 if(dragging)canvas.style.cursor=toolCursor();
 if(heldBrushFrame)cancelAnimationFrame(heldBrushFrame);heldBrushFrame=0;
 const wasEdit=stroke;
 if(shapeStart&&renderer.hover)paintShape(shapeStart,renderer.hover,$<HTMLSelectElement>('#draw-shape').value);
 else if(stroke&&renderer.hover&&lastPoint&&(eraseStroke||(!tool.startsWith('animal:')&&!['inspect','pick','drag','queen','colony','spider','springtail','rain'].includes(tool)))&&(lastPoint.x!==renderer.hover.x||lastPoint.y!==renderer.hover.y))paint(renderer.hover.x,renderer.hover.y);
 shapeStart=null;renderer.preview=null;stroke=false;dragging=false;lastPoint=null;eraseStroke=false;flushBrush();if(wasEdit)send({type:'endEdit'});
};
canvas.onpointerup=pointerEnd;canvas.onpointercancel=pointerEnd;canvas.onlostpointercapture=pointerEnd;canvas.onpointerleave=()=>{renderer.hover=null;};
// Wheel zooms around the pointer; trackpad pinches arrive as ctrl+wheel and horizontal swipes pan.
canvas.addEventListener('wheel',e=>{e.preventDefault();const p=local(e);
 if(!e.ctrlKey&&e.deltaMode===0&&Math.abs(e.deltaX)>Math.abs(e.deltaY)){renderer.ox-=e.deltaX;return;}
 const dy=e.deltaMode===1?e.deltaY*16:e.deltaMode===2?e.deltaY*400:e.deltaY;
 renderer.zoomAt(Math.exp(-Math.max(-120,Math.min(120,dy))*(e.ctrlKey?.01:.0018)),p.x,p.y);},{passive:false});
// Inspect card: a small floating readout with a magnified view of the clicked cell and its neighbours.
let cardCell:{x:number;y:number}|null=null;
function drawCellZoom(){
 if(!cardCell)return;const z=$<HTMLCanvasElement>('#cell-zoom'),g=z.getContext('2d')!,n=11,s=z.width/n,{x,y}=cardCell;
 g.imageSmoothingEnabled=false;g.fillStyle='#17120d';g.fillRect(0,0,z.width,z.height);
 const x0=x-5,y0=y-5,cx0=Math.max(0,x0),cy0=Math.max(0,y0),cx1=Math.min(renderer.W,x0+n),cy1=Math.min(renderer.H,y0+n);
 if(cx1>cx0&&cy1>cy0){g.fillStyle='#b8c9be';g.fillRect((cx0-x0)*s,(cy0-y0)*s,(cx1-cx0)*s,(cy1-cy0)*s);g.drawImage(renderer.terrain,cx0*3,cy0*3,(cx1-cx0)*3,(cy1-cy0)*3,(cx0-x0)*s,(cy0-y0)*s,(cx1-cx0)*s,(cy1-cy0)*s);}
 g.lineWidth=3;g.strokeStyle='#0b0806';g.strokeRect(5*s-1.5,5*s-1.5,s+3,s+3);g.lineWidth=1;g.strokeStyle='#ffc23d';g.strokeRect(5*s-.5,5*s-.5,s+1,s+1);
}
function showCellCard(w:{x:number;y:number},p:{x:number;y:number}){
 if(w.x<0||w.y<0||w.x>=renderer.W||w.y>=renderer.H){$('#cell-card').hidden=true;cardCell=null;return;}
 cardCell=w;const card=$('#cell-card');card.hidden=false;
 $('#cell-name').textContent=MATERIALS[renderer.map[w.y*renderer.W+w.x]]?.name??'Air';$('#cell-pos').textContent=`Cell ${w.x}, ${w.y}`;$('#cell-lines').innerHTML='';
 const r=$('.world-wrap').getBoundingClientRect(),cw=card.offsetWidth,ch=card.offsetHeight;
 card.style.left=`${Math.max(8,Math.min(r.width-cw-8,p.x+18))}px`;card.style.top=`${Math.max(8,Math.min(r.height-ch-40,p.y+18))}px`;
 drawCellZoom();
}
function updateCellCard(s:any){
 if(!cardCell||$('#cell-card').hidden)return;
 const a=s.selectedAnt,cell=s.selectedCell;drawCellZoom();
 if(a){$('#cell-name').textContent=`${a.caste} #${a.id}`;$('#cell-pos').textContent=`${a.colony} · cell ${cardCell.x}, ${cardCell.y}`;$('#cell-lines').innerHTML=`<p>${esc(a.why)}</p>`;}
 else if(cell&&cell.x===cardCell.x&&cell.y===cardCell.y){$('#cell-name').textContent=cell.material;$('#cell-pos').textContent=`Cell ${cell.x}, ${cell.y}`;$('#cell-lines').innerHTML=cell.lines.slice(0,3).map((l:string)=>`<p>${esc(l)}</p>`).join('');}
}
$('#cell-close').onclick=()=>{$('#cell-card').hidden=true;cardCell=null;};
$('#cell-more').onclick=()=>{document.body.classList.remove('panel-hidden');$('#inspector').setAttribute('open','');if(stats)updateStats(stats);};
function toggleMinimap(){renderer.showMinimap=!renderer.showMinimap;$('#minimap-toggle').classList.toggle('active',renderer.showMinimap);$('#minimap-toggle').setAttribute('aria-pressed',String(renderer.showMinimap));}
$('#minimap-toggle').onclick=toggleMinimap;
let shownZoom=0;(function hud(){if(renderer.zoom!==shownZoom){shownZoom=renderer.zoom;$('#zoom-level').textContent=`${renderer.zoom<10?renderer.zoom.toFixed(1):Math.round(renderer.zoom)}×`;}requestAnimationFrame(hud);})();
document.addEventListener('keydown',e=>{if((e.target as HTMLElement).matches('input,select,textarea')||$<HTMLDialogElement>('#modal').open)return;const key=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(key))e.preventDefault();if(key===' '&&!e.repeat){space=true;spacePanned=false;}if(key==='m')toggleMinimap();if(key==='.'){$('#step').click();}if(key==='i')setTool('inspect');if(key==='d')setTool('dig');if(key==='h')setTool('pan');if(key==='f')renderer.fit();if(key==='+'||key==='=')renderer.zoomAt(1.2);if(key==='-')renderer.zoomAt(1/1.2);const step=e.shiftKey?160:56;if(key==='arrowleft')renderer.ox+=step;if(key==='arrowright')renderer.ox-=step;if(key==='arrowup')renderer.oy+=step;if(key==='arrowdown')renderer.oy-=step;if(key==='['||key===']'){$<HTMLInputElement>('#brush').value=String(Math.max(0,Math.min(15,renderer.brush+(key==='['?-1:1))));$('#brush').dispatchEvent(new Event('input'));}});
document.addEventListener('keydown',e=>{if((e.target as HTMLElement).matches('input,select,textarea')||$<HTMLDialogElement>('#modal').open)return;if(e.key.toLowerCase()==='e'){e.preventDefault();$('#palette-search').focus();}if(e.key.toLowerCase()==='x')setTool('erase');});
// Space alone toggles pause on release; Space held while dragging pans instead.
document.addEventListener('keyup',e=>{if(e.key===' '&&space){space=false;if(!spacePanned)setRunning(!running);}});
document.addEventListener('keydown',e=>{if((e.target as HTMLElement).matches('input,select,textarea')||$<HTMLDialogElement>('#modal').open)return;const k=e.key.toLowerCase();if(k==='p')setRunning(!running);if(k==='>')$('#step').click();if(k==='c')$('#capture-world').click();if(k==='\\')settings();if(['1','2','3','4'].includes(k)){$<HTMLSelectElement>('#overlay').value=['none','temperature','trail','charge'][Number(k)-1];updateOverlay();}});
document.addEventListener('keydown',e=>{if((e.target as HTMLElement).matches('input,select,textarea'))return;if(e.key==='F1'){e.preventDefault();toggleGUI();}if(e.key==='F2'){e.preventDefault();$('#capture-world').click();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();$(e.shiftKey?'#redo':'#undo').click();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();$('#redo').click();}});
let hiddenRunning=false;document.addEventListener('visibilitychange',()=>{if(document.hidden){hiddenRunning=running;if(running)setRunning(false);}else if(hiddenRunning){setRunning(true);hiddenRunning=false;}});
setInterval(()=>{$('#fps').textContent=`${Math.round(renderer.fps)} fps · ${renderer.renderMs.toFixed(1)} ms draw · ${renderer.updateMs.toFixed(1)} ms terrain`;},1000);
// Read-only diagnostics used by the browser acceptance checks.
Object.defineProperty(window,'__antSandbox',{value:{get stats(){return stats;},get renderer(){return renderer;}}});
palette();

