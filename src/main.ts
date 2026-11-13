import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import '@fontsource/silkscreen/400.css';
import './style.css';
import { Renderer } from './render/renderer.ts';
import { MATERIALS, M } from './sim/materials.ts';
import { SCENARIOS } from './sim/scenarios.ts';
import { LOCI, MODES } from './sim/genetics.ts';
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
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.settings}</svg>`;
};

$('#app').innerHTML = `
<header class="topbar">
  <a class="brand" href="#" aria-label="Ant Colony Sandbox home">${icon('ant')}<div><h1>Ant colony <span>Sandbox</span></h1><small>A small world. A life of its own.</small></div></a>
  <div class="time-controls"><button id="play" class="icon-btn active" title="Pause (Space)" aria-label="Pause simulation">${icon('pause')}</button><button id="step" class="icon-btn" title="Single step (.)" aria-label="Single step">${icon('step')}</button><span class="divider"></span><label class="sr-only" for="speed">Simulation speed</label><select id="speed"><option value="1">1Ã—</option><option value="5">5Ã—</option><option value="10" selected>10Ã—</option><option value="25">25Ã—</option><option value="100">100Ã—</option><option value="1000">Warp</option></select><div class="clock"><strong id="day">Day 1</strong><span id="season">Spring Â· accelerated time</span></div></div>
  <nav><button id="new" class="text-btn">${icon('plus')}<span>New world</span></button><button id="journal" class="text-btn">${icon('book')}<span>Field journal</span><i id="journal-count">0</i></button><button id="save-menu" class="icon-btn" title="Save and load" aria-label="Save and load">${icon('save')}</button><button id="settings" class="icon-btn" title="Settings and help" aria-label="Settings and help">${icon('settings')}</button></nav>
</header>
<main class="play-space">
  <div class="world-wrap">
    <canvas id="world" tabindex="0" aria-label="Editable ant ecosystem. Drag to paint; right-drag or use the hand tool to pan. Scroll to zoom. Use arrow keys to pan, plus and minus to zoom."></canvas>
    <div class="world-heading"><span class="live-dot"></span><strong id="world-title">First colony</strong><span id="mode-badge">Naturalistic</span></div>
    <div class="world-weather">${icon('sun')}<span id="weather">21Â°C Â· mild</span></div>
    <div class="quick-tools"><button class="icon-btn active" data-tool="inspect" title="Inspect (I)" aria-label="Inspect">${icon('cursor')}</button><button class="icon-btn" data-tool="dig" title="Dig (D)" aria-label="Dig">${icon('shovel')}</button><button class="icon-btn" data-tool="pan" title="Pan (H)" aria-label="Pan">âœ¥</button><span></span><button class="icon-btn" id="zoom-in" aria-label="Zoom in">${icon('plus')}</button><button class="icon-btn" id="zoom-out" aria-label="Zoom out">${icon('minus')}</button><button class="icon-btn" id="fit" title="Fit world (F)" aria-label="Fit world">${icon('fit')}</button></div>
    <div id="overlay-legend" class="overlay-legend" hidden></div>
    <div class="world-bottom"><div id="hint">Click an ant to follow its story. Scroll to look closer.</div><div id="position">512 Ã— 256 cells</div></div>
    <button id="sidebar-toggle" class="icon-btn" aria-label="Toggle colony panel">${icon('ant')}</button>
  </div>
  <aside id="sidebar"><div class="panel-head"><span>${icon('ant')} Colony observatory</span><button id="collapse" class="plain" aria-label="Hide colony panel">â€º</button></div><label class="sr-only" for="colony-select">Selected colony</label><select id="colony-select"><option>Founding queen</option></select><div id="colony-detail" class="panel-content"><p>Waiting for the worldâ€¦</p></div><details id="inspector" open><summary>Inspector <span>click the world</span></summary><div id="inspect-detail" class="panel-content"><p class="muted">Every ant has a reason.<br>Click one to see its task, needs, and inherited traits.</p></div></details><details><summary>Recent events <span id="event-count">0</span></summary><div id="events" class="event-list"></div></details><details id="metrics"><summary>Developer metrics</summary><div id="metrics-detail" class="panel-content"></div></details></aside>
</main>
<section class="workbench" aria-label="Sandbox tools">
  <div class="bench-top"><div class="palette-tabs" role="group" aria-label="Tool category"><button data-cat="terrain" class="selected">Terrain</button><button data-cat="food">Food & water</button><button data-cat="life">Organisms</button><button data-cat="climate">Environment</button></div><div class="brush-controls"><span id="tool-name">Inspector</span><label for="brush">Brush</label><input id="brush" type="range" min="0" max="15" value="3"><output id="brush-value">7</output><label class="replace"><input id="replace" type="checkbox" checked> Replace</label></div><div class="overlay-control">${icon('layers')}<label class="sr-only" for="overlay">World overlay</label><select id="overlay"><option value="none">No overlay</option><option value="trail">Foraging trails</option><option value="alarm">Alarm signals</option><option value="nest">Nest odour</option><option value="moisture">Soil moisture</option><option value="humidity">Air humidity</option><option value="temperature">Temperature</option><option value="food">Food resources</option><option value="territory">Colony activity</option><option value="mortality">Recent mortality</option><option value="toxin">Contamination</option><option value="trait">Water-balance trait</option></select></div></div>
  <div id="palette" class="palette"></div>
</section>
<footer><div><span class="seed-label">Seed <b id="seed-label">42</b></span><span id="status">Connecting to the ecosystemâ€¦</span></div><button id="scenario-help">${icon('book')}<span>Experiment guide</span></button><span id="fps">â€” fps</span></footer>
<dialog id="modal"><div class="modal-head"><h2 id="modal-title"></h2><button id="modal-close" class="icon-btn" aria-label="Close dialog">${icon('close')}</button></div><div id="modal-body"></div></dialog><div id="toast" role="status" aria-live="polite"></div><input id="file-input" type="file" accept=".antsave,.json" hidden><input id="species-file" type="file" accept=".json" hidden>`;

if (matchMedia('(max-width:850px)').matches) document.body.classList.add('panel-hidden');
const renderer = new Renderer($('#world'));
const worker = new Worker(new URL('./worker/sim.worker.ts', import.meta.url), { type: 'module' });
const send = (m: ToWorker) => worker.postMessage(m);
let stats: any = null, evolution: any = null, species: any[] = [], running = true, tool = 'inspect', cat = 'terrain', material: number = M.SOIL;
let selectedColony = -1, scenario = 'first-colony', seed = 42, mode: Mode = 'naturalistic', modalKind = '', journalTab = 'discoveries';
let sound = false, audio: AudioContext | null = null, stroke = false, dragging = false, lastPoint: {x: number; y: number} | null = null, space = false;
const toolHints: Record<string,string> = { inspect: 'Click an ant or terrain cell to inspect it.', dig: 'Drag to excavate. Food and water stay in place.', pan: 'Drag to move around. Scroll to zoom.', queen: 'Click a surface to introduce one mated founding queen.', colony: 'Sandbox introduction: click to place a queen and 35 workers.', heat: 'Drag to warm local soil and air.', cool: 'Drag to cool local soil and air.', humid: 'Drag to add soil moisture and raise local humidity.', dry: 'Drag to remove moisture and lower humidity.', toxin: 'Drag to apply toxic contamination. It decays over time.', rain: 'Click to start a short local rain shower.', erase: 'Drag to remove material, food, or water.', spider: 'Click an open surface to introduce a spider.', springtail: 'Click an open surface to introduce a decomposer.' };
function toast(text: string, error = false) { const el = $('#toast'); el.textContent = text; el.classList.toggle('error', error); el.classList.add('show'); setTimeout(() => el.classList.remove('show'), error ? 8000 : 3800); }
function beep() { if (!sound) return; audio ??= new AudioContext(); void audio.resume(); const osc = audio.createOscillator(), gain = audio.createGain(); osc.type = 'sine'; osc.frequency.value = 550; gain.gain.value = .025; osc.connect(gain).connect(audio.destination); osc.start(); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .07); osc.stop(audio.currentTime + .08); }
function setTool(t: string, m?: number) {
  tool = t; if (m !== undefined) material = m;
  renderer.editing = !['inspect','pan'].includes(t);
  $('#world').style.cursor = t === 'pan' ? 'grab' : t === 'inspect' ? 'crosshair' : 'none';
  $('#tool-name').textContent = t === 'paint' ? MATERIALS[material].name : ({humid:'Moisten',cool:'Cool',dry:'Dry',colony:'Established colony'}[t] ?? t[0].toUpperCase() + t.slice(1));
  $('#hint').textContent = t === 'paint' ? `${MATERIALS[material].description} Drag to paint.` : toolHints[t] ?? '';
  document.querySelectorAll<HTMLElement>('[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === t && (t !== 'paint' || Number(b.dataset.mat) === material)));
}
function palette() {
  document.querySelectorAll<HTMLElement>('[data-cat]').forEach(b => b.classList.toggle('selected', b.dataset.cat === cat));
  let html = '';
  const matButton = (m: number) => { const d = MATERIALS[m]; return `<button data-tool="paint" data-mat="${m}" title="${esc(d.description)}"><span class="swatch swatch-${d.key}" style="--swatch:rgb(${d.color})"></span><span>${esc(d.name.replace(' (loam)',''))}</span></button>`; };
  const tb = (t: string, name: string, i: string) => `<button data-tool="${t}"><span class="tool-swatch">${icon(i)}</span><span>${name}</span></button>`;
  if (cat === 'terrain') html = tb('dig','Dig','shovel') + [M.TOPSOIL,M.SOIL,M.SAND,M.CLAY,M.STONE,M.GRAVEL,M.ORGANIC,M.WOOD,M.ROOT,M.BARRIER].map(matButton).join('') + tb('erase','Erase','close');
  if (cat === 'food') html = [M.SUGAR,M.PROTEIN,M.SEED,M.WATER].map(matButton).join('') + tb('rain','Local rain','drop') + '<p class="palette-note">Sugar fuels adults.<br>Protein feeds growing larvae.<br>Harvester ants also process seeds.</p>';
  if (cat === 'life') html = `<div class="species-picker"><label for="species-search">Choose a species</label><input id="species-search" placeholder="Search speciesâ€¦"><select id="species">${species.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select></div>` + tb('queen','Founding queen','ant') + tb('colony','35-worker colony','ant') + tb('spider','Spider','ant') + tb('springtail','Springtail','ant') + matButton(M.PLANT) + '<p class="palette-note">Introductions are sandbox interventions.<br>New colonies still need food and a safe nest.</p>';
  if (cat === 'climate') html = tb('heat','Warm +','sun') + tb('cool','Cool âˆ’','sun') + tb('humid','Moisten','drop') + tb('dry','Dry','drop') + tb('rain','Local rain','drop') + tb('toxin','Toxin','close') + '<p class="palette-note">Temperature and humidity affect development,<br>water balance, foraging, and survival.</p>';
  $('#palette').innerHTML = html;
  setTool(tool);
  if (cat === 'life') $('#species-search').addEventListener('input', e => { const q = (e.target as HTMLInputElement).value.toLowerCase(); $('#species').innerHTML = species.filter(s => (s.name + s.commonName).toLowerCase().includes(q)).map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join(''); });
}
function setRunning(r: boolean) { running = r; send({type:'run',running:r}); $('#play').innerHTML = icon(r ? 'pause' : 'play'); $('#play').setAttribute('aria-label', r ? 'Pause simulation' : 'Play simulation'); $('#play').title = `${r ? 'Pause' : 'Play'} (Space)`; $('#play').classList.toggle('active', r); }
function openModal(title: string, body: string, kind = '') { modalKind = kind; $('#modal-title').textContent = title; $('#modal-body').innerHTML = body; if (!($('#modal') as HTMLDialogElement).open) ($('#modal') as HTMLDialogElement).showModal(); }
function closeModal() { ($('#modal') as HTMLDialogElement).close(); modalKind = ''; }
$('#modal-close').onclick = closeModal;
$('#modal').addEventListener('click', e => { if (e.target === $('#modal')) { const r = $('#modal').getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeModal(); } });
$('#modal').addEventListener('close', () => { modalKind = ''; });

function newWorldDialog() {
  openModal('A new small world', `<p class="muted">Start with a founding queen, or try a seeded experiment. Creating a world replaces the current run; save it first if you want to return.</p><div class="form-grid"><label>World seed<input id="new-seed" type="number" min="0" max="4294967295" value="${seed}"></label><label>Biology mode<select id="new-mode">${Object.entries(MODES).map(([k,v]) => `<option value="${k}" ${mode===k?'selected':''}>${v.label}</option>`).join('')}</select></label><label>World size<select id="new-size"><option value="scenario">Scenario default</option><option value="384,192">Compact Â· 384 Ã— 192</option><option value="512,256">Standard Â· 512 Ã— 256</option><option value="768,384">Large Â· experimental</option></select></label></div><div class="scenario-list">${SCENARIOS.map(s => `<button class="scenario-option ${s.id===scenario?'selected':''}" data-scenario="${s.id}"><strong>${s.title}</strong><small>${s.blurb}</small></button>`).join('')}</div><p id="mode-note" class="notice">${MODES[mode].description}</p><button id="create-world" class="primary">Create world</button>`, 'new');
  let chosen = scenario;
  $('#new-mode').onchange = () => { $('#mode-note').textContent = MODES[$<HTMLSelectElement>('#new-mode').value as Mode].description; };
  document.querySelectorAll<HTMLElement>('[data-scenario]').forEach(b => b.onclick = () => { chosen = b.dataset.scenario!; document.querySelectorAll('[data-scenario]').forEach(x => x.classList.toggle('selected', x === b)); const sm = SCENARIOS.find(s=>s.id===chosen)!.mode; $<HTMLSelectElement>('#new-mode').value=sm; $('#mode-note').textContent=MODES[sm].description; });
  $('#create-world').onclick = () => { const size = $<HTMLSelectElement>('#new-size').value; scenario=chosen; seed=Number($<HTMLInputElement>('#new-seed').value)>>>0; mode=$<HTMLSelectElement>('#new-mode').value as Mode; selectedColony=-1; send({type:'new', opts:{scenario,seed,mode,...(size==='scenario'?{}:{size:size.split(',').map(Number) as [number,number]})}}); closeModal(); setRunning(true); };
}
function guide() {
  const s = stats?.scenario;
  openModal(s?.title ?? 'Experiment guide', `<p class="lead">Create conditions. Introduce a queen. See what follows.</p><p>${esc(s?.goal)}</p><div class="notice">${mode==='fantasy'?'Fantasy: fictional adaptations are enabled.':mode==='speculative'?'Speculative: widened trait variation is an extrapolation.':'Naturalistic: researched species profiles with compressed time and colony size.'}<br>One model day = 3,600 ticks. At 1Ã— this takes two minutes. Brood stages and lifespans are also compressed; this is a game, not a predictive model.</div><ol class="guide"><li><strong>Watch the founding queen.</strong> She chooses a site and digs. A garden ant queen seals herself in and rears first workers from reserves.</li><li><strong>Make a small intervention.</strong> Place sugar and protein on the surface. Use the trail overlay to watch successful return trips reinforce a route.</li><li><strong>Change the conditions.</strong> Move food, block a passage, or add water. The ants must find their way again.</li><li><strong>Follow later generations.</strong> Mature colonies rear winged reproductives. Flights and mating can produce daughter colonies, whose genotypes come from parents.</li></ol><div class="scenario-actions">${(s?.actions??[]).map((a:any,i:number)=>`<button class="primary" data-action="${i}">${esc(a.label)}</button>`).join('')}</div><p class="muted">Controls: drag to paint Â· right-drag or H to pan Â· wheel to zoom Â· Space to pause Â· . to step Â· I inspect Â· D dig Â· F fit Â· [ ] brush size. On touch screens, choose the pan tool to drag the camera.</p><button id="guide-close">Explore the sandbox</button>`,'guide');
  document.querySelectorAll<HTMLElement>('[data-action]').forEach(b=>b.onclick=()=>{send({type:'scenarioAction',index:Number(b.dataset.action)});toast('Experiment intervention applied');closeModal();});
  $('#guide-close').onclick=closeModal;
}
function saves(list: any[] = []) {
  openModal('Keep this ecosystem', `<div class="save-row"><input id="save-name" aria-label="Save name" value="${esc(stats?.scenario?.title??'My colony')} Â· day ${stats?.day??1}"><button id="save-now" class="primary">Save new slot</button></div><p class="muted">Saved on this browser using IndexedDB. Export a portable file to keep a backup.</p><div class="saves-list">${list.length?list.map(s=>`<div class="save-item"><div><strong>${esc(s.name)}</strong><small>${esc(new Date(s.savedAt).toLocaleString())} Â· ${s.summary?.ants??0} ants</small></div><button data-load="${esc(s.slot)}">Load</button><button data-delete="${esc(s.slot)}" aria-label="Delete ${esc(s.name)}">Ã—</button></div>`).join(''):'<p>No local saves yet.</p>'}</div><div class="button-row"><button id="export">Export world</button><button id="import">Import world</button></div>`, 'saves');
  $('#save-now').onclick=()=>{send({type:'save',slot:`world-${Date.now()}`,name:$<HTMLInputElement>('#save-name').value.slice(0,100)||'My colony'});};
  $('#export').onclick=()=>send({type:'export'}); $('#import').onclick=()=>$<HTMLInputElement>('#file-input').click();
  document.querySelectorAll<HTMLElement>('[data-load]').forEach(b=>b.onclick=()=>{send({type:'load',slot:b.dataset.load!});closeModal();});
  document.querySelectorAll<HTMLElement>('[data-delete]').forEach(b=>b.onclick=()=>{if(b.dataset.confirm){send({type:'deleteSave',slot:b.dataset.delete!});}else{b.dataset.confirm='yes';b.textContent='Delete?';}});
}
function settings() {
  const c=stats?.climate??{};
  openModal('Settings & field notes', `<div class="settings-grid"><section><h3>Presentation</h3><label><input id="labels" type="checkbox" ${renderer.labels?'checked':''}> Colony flags and labels</label><label><input id="patterns" type="checkbox" ${renderer.patterns?'checked':''}> Pattern marks on overlays</label><label><input id="detail" type="checkbox" ${renderer.lowDetail?'checked':''}> Reduce rendering detail (same simulation)</label><label><input id="sound" type="checkbox" ${sound?'checked':''}> Quiet tool sounds</label></section><section><h3>Ecosystem rules</h3><label><input id="weather-setting" type="checkbox" ${stats?.settings?.weather?'checked':''}> Seasonal weather</label><label><input id="predators" type="checkbox" ${stats?.settings?.naturalPredators?'checked':''}> Natural predator arrivals</label><label>Mean air temperature <output id="temp-val">${c.meanTemp}Â°C</output><input id="global-temp" type="range" min="0" max="38" value="${c.meanTemp}"></label><label>Surface humidity <output id="hum-val">${Math.round(c.baseHumidity*100)}%</output><input id="global-hum" type="range" min="10" max="95" value="${c.baseHumidity*100}"></label></section></div><details><summary>What the simulation abstracts</summary><p>The 2D slice constrains every route and flood to one plane. Ants walk on adjacent surfaces. Nest exit distance and colony task stimuli are bounded navigation and resource-accounting helpers; workers cannot query distant food. Surface trails decay without gas diffusion. Nest odour and alarm diffuse through open cells. Stored food and feeding are colony-scale approximations.</p><p>Learning changes task thresholds within a lifetime. Larval conditions influence realised size. Inheritance changes only offspring genotypes; mutation is random and never chosen to solve a pressure. Naturalistic trait effects and numeric rates are game assumptions.</p><p>Haploid males develop from unfertilised eggs; female offspring combine a maternal gamete with a stored paternal genome. Mating, flight seasons, recombination, and colony size are simplified. Off-map fathers are labelled background parents.</p></details><details><summary>Species and custom content</summary>${species.map(s=>`<h3><i>${esc(s.name)}</i></h3><p>${esc(s.summary)} ${esc(s.founding)} founding.</p><p class="muted">${s.simplifications.map(esc).join(' ')}</p>`).join('')}<p>Import declarative JSON matching the SpeciesDef schema in src/sim/species.ts. Executable content is never loaded.</p><button id="import-species">Import species JSON</button></details><details><summary>Research and known limits</summary><p>Sources and full assumptions are in docs/BIOLOGY.md. No real-time gas or oxygen simulation, full colony migration, parasites, bridge-building, or predictive evolution. Trail, moisture, temperature, and nutrition are real mechanics; future content is never displayed as an active capability.</p><p><a href="https://pubmed.ncbi.nlm.nih.gov/22972897/" target="_blank" rel="noreferrer">Czaczkes et al.: Lasius route learning</a><br><a href="https://doi.org/10.1007/s00442-002-0960-2" target="_blank" rel="noreferrer">Johnson: semi-claustral founding</a><br><a href="https://antwiki.org/wiki/Lasius_niger" target="_blank" rel="noreferrer">AntWiki: Lasius niger</a></p></details><div class="notice">Biologically informed sandbox. Associations in a run are not scientific evidence of causation. All editing tools are available immediately; discoveries only record observations.</div>`, 'settings');
  for(const [id,key] of [['labels','labels'],['patterns','patterns'],['detail','lowDetail']] as const) $( '#'+id).onchange=()=>{renderer[key]=$<HTMLInputElement>('#'+id).checked;};
  $('#sound').onchange=()=>{sound=$<HTMLInputElement>('#sound').checked;beep();};
  $('#weather-setting').onchange=()=>send({type:'cmd',cmd:{t:'setting',key:'weather',value:$<HTMLInputElement>('#weather-setting').checked}});
  $('#predators').onchange=()=>send({type:'cmd',cmd:{t:'setting',key:'naturalPredators',value:$<HTMLInputElement>('#predators').checked}});
  $('#global-temp').oninput=()=>{const v=Number($<HTMLInputElement>('#global-temp').value);$('#temp-val').textContent=`${v}Â°C`;send({type:'cmd',cmd:{t:'climate',key:'meanTemp',value:v}});};
  $('#global-hum').oninput=()=>{const v=Number($<HTMLInputElement>('#global-hum').value);$('#hum-val').textContent=`${v}%`;send({type:'cmd',cmd:{t:'climate',key:'baseHumidity',value:v/100}});};
  $('#import-species').onclick=()=>$<HTMLInputElement>('#species-file').click();
}

function journal() {
  send({type:'requestDetail',what:'evolution'});
  const tabs = `<div class="journal-tabs">${['discoveries','lineage','traits','mutations'].map(t=>`<button data-jtab="${t}" class="${journalTab===t?'selected':''}">${t[0].toUpperCase()+t.slice(1)}</button>`).join('')}</div>`;
  let body='';
  if(journalTab==='discoveries') body=`<p class="muted">Observations record what happened. They do not grant abilities.</p>${stats?.journal?.length?stats.journal.map((j:any)=>`<article class="journal-entry"><small>Day ${(j.tick/3600+1).toFixed(1)} Â· ${esc(j.kind)}</small><h3>${esc(j.title)}</h3><p>${esc(j.text)}</p></article>`).join(''):'<div class="empty"><h3>The first page is unwritten.</h3><p>Watch a queen establish her nest, a worker return with food, or a colony encounter a rival. Discoveries appear when those things happen.</p></div>'}`;
  if(journalTab==='lineage') body=`<p class="notice">Daughters inherit from actual reproductive parents. Background fathers come from an explicitly modelled off-map population.</p><div class="lineage">${evolution?.lineage?.map((l:any)=>`<article class="lineage-node" style="margin-left:${Math.min(l.generation,6)*14}px"><span class="gen">G${l.generation}</span><div><strong>${esc(l.name)}</strong><small>${l.motherColony?'Mother colony #'+l.motherColony:'Introduced founder'} Â· fathers ${esc(l.fatherColonies.map((f:number)=>f||'background').join(', '))}</small><small>Peak ${l.peakWorkers} workers Â· ${l.daughterColonies} daughter colonies Â· ${l.gynesFlown} gynes flown${l.playerEdited?' Â· sandbox edited':''}${l.diedTick>=0?' Â· extinct':''}</small></div></article>`).join('')??'Loading lineageâ€¦'}</div>`;
  if(journalTab==='traits') {
    body='<p>Inherited variation is shown from living workers, sampled up to 300 per colony. Bars show genotype means (0â€“1); ranges show the sample minimum and maximum.</p>';
    for(const l of evolution?.loci??[]){ if(l.i>16 && mode!=='fantasy')continue; body+=`<article class="trait-row"><strong>${esc(l.name)}</strong><p>${esc(l.effect)} <span class="muted">Cost: ${esc(l.cost)}</span></p>${evolution.colonies.map((c:any)=>{const vals=c.workers[l.i]??[], mean=vals.length?vals.reduce((a:number,b:number)=>a+b,0)/vals.length:c.geno[l.i],lo=vals.length?Math.min(...vals):mean,hi=vals.length?Math.max(...vals):mean;return `<div class="distribution"><span>${esc(c.name)} Â· G${c.generation}</span><div class="bar"><i style="left:${lo*100}%;width:${Math.max(1,(hi-lo)*100)}%;background:rgb(${c.marking})"></i><b style="left:${mean*100}%"></b></div><small>${Number(mean).toFixed(2)} Â· n=${vals.length}</small></div>`;}).join('')}</article>`;}
    body+='<p class="notice">Trait frequency and reproductive success can be associated in this run. Small samples, ancestry, and environment confound causal explanations.</p>';
  }
  if(journalTab==='mutations') body=`<p class="muted">Random variation is generated at reproduction. Pressure influences which descendants survive; it never selects the mutation to generate.</p>${evolution?.mutations?.length?`<div class="table-scroll"><table><thead><tr><th>Day</th><th>Colony</th><th>Trait</th><th>Change</th><th>Carrier</th></tr></thead><tbody>${evolution.mutations.slice(0,100).map((m:any)=>`<tr><td>${(m.tick/3600+1).toFixed(1)}</td><td>#${m.colony}</td><td>${esc(LOCI[m.locus]?.name)}</td><td>${m.from.toFixed(3)} â†’ ${m.to.toFixed(3)}</td><td>${esc(m.carrier)}</td></tr>`).join('')}</tbody></table></div>`:'<p>No mutations recorded yet.</p>'}<details><summary>Sandbox override Â· queen germline</summary><p>Changes future offspring only. Existing adults and brood keep their genotypes. Edited lineages are labelled and excluded from association analysis.</p><label>Colony<select id="edit-colony">${(stats?.colonies??[]).filter((c:any)=>c.queens).map((c:any)=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label><label>Locus<select id="edit-locus">${LOCI.map((l,i)=>!l.fantasy||mode==='fantasy'?`<option value="${i}">${esc(l.name)}</option>`:'').join('')}</select></label><label>Allele value (0â€“1)<input id="edit-value" type="number" min="0" max="1" step="0.05" value="0.7"></label><button id="edit-apply">Apply sandbox override</button></details>`;
  openModal('Field journal',tabs+body,'journal');
  document.querySelectorAll<HTMLElement>('[data-jtab]').forEach(b=>b.onclick=()=>{journalTab=b.dataset.jtab!;journal();});
  if(journalTab==='mutations')$('#edit-apply').onclick=()=>{const value=Number($<HTMLInputElement>('#edit-value').value);if(!Number.isFinite(value)||value<0||value>1)return toast('Enter an allele value between 0 and 1.',true);send({type:'cmd',cmd:{t:'editGenome',colonyId:Number($<HTMLSelectElement>('#edit-colony').value),locus:Number($<HTMLSelectElement>('#edit-locus').value),value}});toast('Queen germline edited for future offspring');};
}

function updateStats(s: any) {
  stats=s; running=s.running;
  $('#day').textContent=`Day ${s.day}`; $('#season').textContent=`${s.season} Â· ${s.clock}`;
  $('#weather').textContent=`${s.airT.toFixed(0)}Â°C Â· ${s.raining?'raining':s.daytime?'daylight':'night'}`;
  $('#status').textContent=`${s.ants.toLocaleString()} ants Â· ${s.colonies.filter((c:any)=>c.alive).length} colonies Â· ${s.running?(s.achievedSpeed.toFixed(1)+'Ã— achieved'):'paused'}`;
  $('#journal-count').textContent=String(s.journal.length); renderer.colonies=s.colonies; renderer.route=s.route;
  const select=$<HTMLSelectElement>('#colony-select');
  const options=s.colonies.map((c:any)=>`<option value="${c.id}">${esc(c.name)} Â· G${c.generation}</option>`).join('');
  if(select.innerHTML!==options){select.innerHTML=options; if(s.colonies.some((c:any)=>c.id===selectedColony))select.value=String(selectedColony);}
  if(selectedColony<0&&s.colonies.length)selectedColony=s.colonies[0].id;
  const c=s.colonies.find((c:any)=>c.id===selectedColony)??s.colonies[0];
  if(c){
    const brood=c.brood.reduce((a:number,b:number)=>a+b,0);
    $('#colony-detail').innerHTML=`<div class="species-line"><i>${esc(c.species)}</i><span class="stage">${esc(c.stage)}</span></div><div class="colony-count"><strong>${c.workers}</strong><span>workers<br><small>${c.queens} queen${c.queens===1?'':'s'} Â· generation ${c.generation}</small></span><button id="focus-colony" class="icon-btn" aria-label="Focus colony" title="Focus colony">${icon('fit')}</button></div><div class="brood-stages"><div><b>${c.brood[0]}</b><span>Eggs</span></div><span>â€º</span><div><b>${c.brood[1]}</b><span>Larvae</span></div><span>â€º</span><div><b>${c.brood[2]}</b><span>Pupae</span></div></div><div class="store-heading">Nest stores <small>food units</small></div><div class="resources"><span><i style="background:#e7bd69"></i>Sugar <b>${c.store.sugar.toFixed(0)}</b></span><span><i style="background:#d98a78"></i>Protein <b>${c.store.protein.toFixed(0)}</b></span><span><i style="background:#a9b473"></i>Seeds <b>${c.store.seed.toFixed(0)}</b></span></div>${c.stage==='founding'?`<div class="reserve-line"><span>Queen reserves</span><b>${c.reserves.toFixed(0)}</b></div><meter min="0" max="120" value="${c.reserves}"></meter>`:''}<p class="colony-note">${esc(c.notes[0]??(brood?'Brood developing in the nest. Inspect a worker to understand its task.':'The queen is looking for a suitable nest site.'))}</p><details class="tasks"><summary>Colony activity</summary>${Object.entries(c.tasks).map(([k,v])=>`<div>${esc(k)}<b>${v}</b></div>`).join('')||'<p>No workers yet.</p>'}<p>${c.stats.workersEclosed} workers emerged Â· ${c.stats.daughterColonies} daughters founded</p><p>Deaths: ${esc(JSON.stringify(c.stats.adultDeaths))}</p></details>`;
    $('#focus-colony').onclick=()=>renderer.focus(c.entrance.x,c.entrance.y+12);
  }else $('#colony-detail').innerHTML='<p>No living colonies. Introduce a queen from Organisms.</p>';
  const a=s.selectedAnt, cell=s.selectedCell;
  if(a)$('#inspect-detail').innerHTML=`<div class="inspect-title">${esc(a.caste)} #${a.id}<small>${esc(a.colony)}</small></div><p class="reason">${esc(a.why)}</p>${a.lines.map((l:string)=>`<p>${esc(l)}</p>`).join('')}<details><summary>Traits & inheritance</summary>${a.traits.map((t:any)=>`<div class="ant-trait"><span>${esc(t.name)}<small>${esc(t.kind)}</small></span><b>${esc(t.value)}</b></div>`).join('')}</details>`;
  else if(cell)$('#inspect-detail').innerHTML=`<div class="inspect-title">${esc(cell.material)}<small>${cell.x}, ${cell.y}</small></div><p>${esc(cell.description)}</p>${cell.lines.map((l:string)=>`<p>${esc(l)}</p>`).join('')}`;
  $('#event-count').textContent=String(s.events.length);
  $('#events').innerHTML=s.events.slice(-18).reverse().map((e:any)=>`<div><small>Day ${(e.tick/3600+1).toFixed(1)}</small><p>${esc(e.text)}</p></div>`).join('')||'<p class="muted">A new ecosystem. Events will appear here.</p>';
  if($<HTMLDetailsElement>('#metrics').open)$('#metrics-detail').innerHTML=`<dl>${Object.entries({ 'Render':renderer.renderMs.toFixed(2)+' ms', 'Simulation':s.perf.stepMs.toFixed(2)+' ms/tick', 'Fields':s.perf.fieldMs.toFixed(2)+' ms', 'Active agents':s.ants, 'Active chunks':`${s.perf.activeChunks}/${s.perf.totalChunks}`, 'Signal chunks':s.perf.signalChunks, 'Estimated buffers':s.perf.estMB.toFixed(1)+' MB', 'Command queue':s.perf.pendingCommands, 'Dropped render frames':renderer.droppedFrames, 'Dropped catch-up ticks':s.droppedTicks, 'Resource audit':JSON.stringify(s.audit) }).map(([k,v])=>`<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl><p class="muted">Buffer estimate excludes JS objects and canvas. Dropped ticks are discarded catch-up debt; simulation rules keep a fixed timestep.</p>`;
}

worker.onmessage=e=>{
  const m=e.data;
  if(m.type==='ready'){send({type:'new',opts:{scenario,seed}});send({type:'speed',speed:10});setRunning(true);}
  if(m.type==='world'){
    evolution = null;
    species=m.species;mode=m.mode;seed=m.seed;scenario=m.scenario.id;renderer.species=species;
    if(!m.keepView)renderer.reset(m.W,m.H);
    $('#world-title').textContent=m.scenario.title;$('#mode-badge').textContent=MODES[mode].label;$('#seed-label').textContent=String(seed);$('#position').textContent=`${m.W} Ã— ${m.H} cells`;palette();
  }
  if(m.type==='frame')renderer.accept(m);
  if(m.type==='stats')updateStats(m);
  if(m.type==='evolution'){const first=!evolution;evolution=m.data;if(first&&modalKind==='journal')journal();}
  if(m.type==='error')toast(m.text,true);
  if(m.type==='saved'){toast('World saved in this browser');send({type:'listSaves'});}
  if(m.type==='loaded'){setRunning(false);toast('World loaded Â· paused');}
  if(m.type==='saves')saves(m.list);
  if(m.type==='speciesResult'){toast(m.ok?`Imported ${m.name}`:m.errors.join(' '),!m.ok);}
  if(m.type==='exported'){const url=URL.createObjectURL(new Blob([m.data],{type:'application/gzip'}));const a=document.createElement('a');a.href=url;a.download=m.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);toast('World exported');}
};
worker.onerror=e=>toast(`Simulation error: ${e.message}`,true);
$('#play').onclick=()=>setRunning(!running);$('#step').onclick=()=>{setRunning(false);send({type:'step',ticks:1});};
$('#speed').onchange=()=>send({type:'speed',speed:Number($<HTMLSelectElement>('#speed').value)});
$('#new').onclick=newWorldDialog;$('.brand').onclick=e=>{e.preventDefault();renderer.fit();};$('#journal').onclick=()=>{evolution=null;journal();};$('#settings').onclick=settings;$('#save-menu').onclick=()=>send({type:'listSaves'});$('#scenario-help').onclick=guide;
$('#zoom-in').onclick=()=>renderer.zoomAt(1.3);$('#zoom-out').onclick=()=>renderer.zoomAt(1/1.3);$('#fit').onclick=()=>renderer.fit();
$('#collapse').onclick=()=>document.body.classList.toggle('panel-hidden');$('#sidebar-toggle').onclick=()=>document.body.classList.toggle('panel-hidden');
$('#colony-select').onchange=()=>{selectedColony=Number($<HTMLSelectElement>('#colony-select').value);updateOverlay();};
$('#overlay').onchange=updateOverlay;
function updateOverlay(){const kind=$<HTMLSelectElement>('#overlay').value as OverlayKind,c=stats?.colonies.find((c:any)=>c.id===selectedColony);send({type:'overlay',kind,colony:c?.slot??-1,trait:6});const el=$('#overlay-legend');el.hidden=kind==='none';el.textContent=kind==='trail'?'Foraging trail Â· stronger marks = more signal':kind==='temperature'?'Temperature Â· blue cool â†’ red hot':kind==='territory'?'Recent visits Â· colony markings':`${$<HTMLSelectElement>('#overlay').selectedOptions[0].text} Â· faint â†’ strong`;}
$('#brush').oninput=()=>{renderer.brush=Number($<HTMLInputElement>('#brush').value);$('#brush-value').textContent=String(renderer.brush*2+1);};
document.addEventListener('click',e=>{const b=(e.target as HTMLElement).closest<HTMLElement>('[data-tool]');if(b){setTool(b.dataset.tool!,b.dataset.mat?Number(b.dataset.mat):undefined);beep();}const tab=(e.target as HTMLElement).closest<HTMLElement>('[data-cat]');if(tab){cat=tab.dataset.cat!;palette();}});
async function importFile(input: HTMLInputElement, sp=false){const file=input.files?.[0];if(!file)return;try{if(file.size>100*1024*1024)throw new Error('File exceeds the 100 MB import limit.');if(sp)send({type:'importSpecies',json:await file.text()});else{send({type:'import',data:await file.arrayBuffer()});closeModal();}}catch(e){toast((e as Error).message,true);}input.value='';}
$('#file-input').onchange=()=>void importFile($('#file-input'));$('#species-file').onchange=()=>void importFile($('#species-file'),true);
function paint(x:number,y:number){
  if(x<0||y<0||x>=renderer.W||y>=renderer.H)return;
  const r=renderer.brush;let cmd:Command;
  if(tool==='paint')cmd={t:'paint',mat:material,x,y,r,replace:$<HTMLInputElement>('#replace').checked};
  else if(tool==='dig'||tool==='erase'||tool==='toxin'||tool==='rain')cmd={t:tool,x,y,r};
  else if(tool==='heat'||tool==='cool')cmd={t:'heat',x,y,r,amount:tool==='heat'?2:-2};
  else if(tool==='humid'||tool==='dry')cmd={t:'humidity',x,y,r,amount:tool==='humid'?1:-1};
  else if(tool==='queen'||tool==='colony'){const sp=$<HTMLSelectElement>('#species')?.value??species[0]?.id;if(!sp)return;cmd=tool==='queen'?{t:'queen',species:sp,x,y}:{t:'colony',species:sp,x,y,workers:35};}
  else if(tool==='spider'||tool==='springtail')cmd={t:'critter',kind:tool,x,y};else return;
  send({type:'cmd',cmd});
}
const canvas=$<HTMLCanvasElement>('#world');
const local=(e:PointerEvent|WheelEvent)=>{const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};};
canvas.oncontextmenu=e=>e.preventDefault();
canvas.onpointerdown=e=>{canvas.focus();canvas.setPointerCapture(e.pointerId);const p=local(e);dragging=e.button===2||e.button===1||tool==='pan'||space;stroke=!dragging;lastPoint=renderer.world(p.x,p.y);if(!dragging){if(tool==='inspect'){send({type:'selectAnt',...lastPoint,radius:Math.max(1,5/renderer.zoom)});$('#inspector').setAttribute('open','');document.body.classList.remove('panel-hidden');}else{paint(lastPoint.x,lastPoint.y);beep();}}};
canvas.onpointermove=e=>{const p=local(e),w=renderer.world(p.x,p.y);renderer.hover=w;$('#position').textContent=`${w.x}, ${w.y} Â· ${renderer.zoom.toFixed(1)}Ã— zoom`;if(dragging){renderer.ox+=e.movementX;renderer.oy+=e.movementY;}else if(stroke&&tool!=='inspect'&&!['queen','colony','spider','springtail','rain'].includes(tool)&&lastPoint&&(w.x!==lastPoint.x||w.y!==lastPoint.y)){const dx=w.x-lastPoint.x,dy=w.y-lastPoint.y,n=Math.min(100,Math.max(Math.abs(dx),Math.abs(dy)));for(let k=1;k<=n;k++)paint(Math.round(lastPoint.x+dx*k/n),Math.round(lastPoint.y+dy*k/n));lastPoint=w;}};
const pointerEnd=()=>{stroke=false;dragging=false;lastPoint=null;};canvas.onpointerup=pointerEnd;canvas.onpointercancel=pointerEnd;canvas.onlostpointercapture=pointerEnd;canvas.onpointerleave=()=>{renderer.hover=null;};
canvas.addEventListener('wheel',e=>{e.preventDefault();const p=local(e);renderer.zoomAt(e.deltaY<0?1.12:1/1.12,p.x,p.y);},{passive:false});
document.addEventListener('keydown',e=>{if((e.target as HTMLElement).matches('input,select,textarea')||$<HTMLDialogElement>('#modal').open)return;const key=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(key))e.preventDefault();if(key===' '&&!e.repeat){space=true;setRunning(!running);}if(key==='.'){$('#step').click();}if(key==='i')setTool('inspect');if(key==='d')setTool('dig');if(key==='h')setTool('pan');if(key==='f')renderer.fit();if(key==='+'||key==='=')renderer.zoomAt(1.2);if(key==='-')renderer.zoomAt(1/1.2);if(key==='arrowleft')renderer.ox+=40;if(key==='arrowright')renderer.ox-=40;if(key==='arrowup')renderer.oy+=40;if(key==='arrowdown')renderer.oy-=40;if(key==='['||key===']'){$<HTMLInputElement>('#brush').value=String(Math.max(0,Math.min(15,renderer.brush+(key==='['?-1:1))));$('#brush').dispatchEvent(new Event('input'));}});
document.addEventListener('keyup',e=>{if(e.key===' ')space=false;});
let hiddenRunning=false;document.addEventListener('visibilitychange',()=>{if(document.hidden){hiddenRunning=running;if(running)setRunning(false);}else if(hiddenRunning){setRunning(true);hiddenRunning=false;}});
setInterval(()=>{$('#fps').textContent=`${Math.round(renderer.fps)} fps Â· ${renderer.renderMs.toFixed(1)} ms render`;},1000);
// Read-only diagnostics used by the browser acceptance checks.
Object.defineProperty(window,'__antSandbox',{value:{get stats(){return stats;},get renderer(){return renderer;}}});
palette();

