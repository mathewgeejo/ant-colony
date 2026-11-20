/// <reference lib="webworker" />
// Simulation worker: owns the Sim, runs a fixed-timestep loop under a compute
// budget, and streams compact render frames + periodic stats to the UI thread.
import type { FrameMsg, OverlayKind, ToWorker } from '../protocol.ts';
import { createSim, SCENARIOS } from '../sim/scenarios.ts';
import { Sim } from '../sim/sim.ts';
import { DAY_TICKS } from '../sim/physics.ts';
import { packAnts, packBrood, packChunks, packCritters, packTints, rasterOverlay } from '../sim/view.ts';
import { antRoute, colonySummaries, evolutionDetail, inspectAnt, inspectCell } from '../sim/inspect.ts';
import { decodeJSON, encodeJSON, restore, snapshot } from '../sim/persist.ts';
import { verifyDeterminism } from '../sim/replay.ts';
import { validateSpecies, BUILTIN_SPECIES } from '../sim/species.ts';
import type { SpeciesDef } from '../sim/species.ts';
import { brainDb, db } from './db.ts';
import { NW as BRAIN_W, bankEntries, validBank, type BankEntry } from '../sim/brain.ts';
import { JOURNAL_DEFS } from '../sim/journal.ts';
import { CS } from '../sim/world.ts';

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const BASE_TPS = 30;
const MAX_SPEED = 1000;

let sim: Sim | null = null;
let running = false;
let runRevision=0;
let speed = 1;
let acc = 0;
let last = performance.now();
let lastFrame = 0;
let lastStats = 0;
let lastOverlay = 0;
let lastTempSent = 0;
let achievedTps = 0;
let ticksThisSecond = 0;
let secondStart = performance.now();
let droppedTicks = 0;
let fullTerrain = true;
let overlay: { kind: OverlayKind; colony: number; trait: number } = { kind: 'none', colony: -1, trait: 0 };
let selectedId = -1;
let selectedCell: { x: number; y: number } | null = null;
let wantDetail: { what: string; colony?: number } | null = null;
let lastDetail = 0;
let stepBudgetMs = 12;
let customSpecies: SpeciesDef[] = [];
let lastStepMs = 0;
let frameCount = 0;
let frameInFlight = 0;
let frameSerial = 0;
type HistoryEntry={file:ReturnType<typeof snapshot>;bytes:number};
let undo:HistoryEntry[]=[],redo:HistoryEntry[]=[],editOpen=false;
const HISTORY_BYTES=32*1048576;
function historyEntry():HistoryEntry{
  const file=snapshot(sim!,'Undo snapshot');let bytes=0;const seen=new Set<object>();
  const visit=(v:any)=>{if(!v||typeof v!=='object'||seen.has(v))return;seen.add(v);if(ArrayBuffer.isView(v)){bytes+=v.byteLength;return;}for(const x of Object.values(v))visit(x);};visit(file);
  return{file,bytes};
}
function pushHistory(list:HistoryEntry[],entry:HistoryEntry){list.push(entry);while(list.length>1&&(list.length>8||list.reduce((n,e)=>n+e.bytes,0)>HISTORY_BYTES))list.shift();}
function checkpoint(){if(!sim||editOpen)return;pushHistory(undo,historyEntry());redo=[];editOpen=true;post({type:'history',undo:undo.length,redo:redo.length});}
function historyMove(from:HistoryEntry[],to:HistoryEntry[]){if(!sim||!from.length)return;sim.flushCommands();pushHistory(to,historyEntry());sim=restore(from.pop()!.file);running=false;editOpen=false;frameInFlight=0;loadedWorld();}

function post(msg: any, transfer: Transferable[] = []) {
  ctx.postMessage(msg, transfer);
}

// ---------------- brain bank: learnt templates per species, kept in IndexedDB across worlds
let lastBrainSave = performance.now();
let bankPaused = false; // after "forget", the running world no longer writes its templates back

async function storedBrains(): Promise<BankEntry[]> {
  try { return (await brainDb.all()).filter(validBank); } catch { return []; }
}
/** Store each species' most refined template from this world unless the bank already holds a better one. */
async function persistBrains() {
  if (!sim || bankPaused) return;
  const have = new Map((await storedBrains()).map((e) => [e.speciesId, e.gen]));
  const better = bankEntries(sim).filter((e) => e.gen > (have.get(e.speciesId) ?? -1)).map((e) => ({ ...e, savedAt: new Date().toISOString() }));
  if (better.length) await brainDb.put(better);
}
async function brainsOp(op: 'export' | 'import' | 'reset', json?: string) {
  if (op === 'reset') {
    await brainDb.clear(); bankPaused = true;
    post({ type: 'brainsResult', text: 'Learnt brains forgotten. New worlds start from instincts; this world keeps its current ants.' });
  } else if (op === 'export') {
    await persistBrains();
    const entries = (await storedBrains()).map((e) => ({ ...e, w: Array.from(e.w) }));
    post({ type: 'brainsExported', name: 'ant-brains.json', text: JSON.stringify({ format: 'ant-colony-brains', version: 1, savedAt: new Date().toISOString(), entries }) });
  } else {
    let raw: any;
    try { raw = JSON.parse(json ?? ''); } catch { post({ type: 'error', text: 'That file is not valid JSON.' }); return; }
    const entries = (raw?.format === 'ant-colony-brains' && Array.isArray(raw.entries) ? raw.entries : []).filter(validBank).map((e: BankEntry) => ({ ...e, w: Float32Array.from(e.w) }));
    if (!entries.length) { post({ type: 'error', text: 'No valid brain templates found in that file.' }); return; }
    await brainDb.put(entries); bankPaused = false;
    post({ type: 'brainsResult', text: `Imported ${entries.length} brain template${entries.length === 1 ? '' : 's'}; they are used by colonies in new worlds.` });
  }
}

async function newWorld(opts: any) {
  try {
    const brains = await storedBrains();
    bankPaused = false;
    sim = createSim({ ...opts, customSpecies, brains });
    undo=[];redo=[];editOpen=false;
    fullTerrain = true;
    selectedId = -1; selectedCell = null;
    acc = 0; droppedTicks = 0;
    post({ type: 'world', W: sim.w.W, H: sim.w.H, scenario: sim.scenarioInfo, mode: sim.mode, seed: sim.cfg.seed, species: sim.species.map(speciesBrief), journalDefs: JOURNAL_DEFS,cutaway:!['empty','physics-lab','liquid-lab','powder-lab'].includes(sim.cfg.scenario) });
    sendFrame(true);
    sendStats();
  } catch (e) {
    post({ type: 'error', text: `Could not create world: ${(e as Error).message}` });
  }
}

function speciesBrief(s: SpeciesDef) {
  return { id: s.id, name: s.name, commonName: s.commonName, status: s.status, subfamily: s.subfamily, summary: s.summary, visual: s.visual, founding: s.founding.strategy, recruitment: s.communication.recruitment, defense: s.defense.mode, simplifications: s.simplifications, sources: s.sources, builtin: BUILTIN_SPECIES.some((b) => b.id === s.id) };
}

function sendFrame(full = false) {
  if (!sim) return;
  if(frameInFlight && !full && !fullTerrain)return;
  const s = sim;
  const { buf, count } = packChunks(s, full || fullTerrain);
  const tints=packTints(s,full||fullTerrain);
  fullTerrain = false;
  const ants = packAnts(s, null);
  const brood = packBrood(s);
  const crit = packCritters(s);
  let selected = -1;
  if (selectedId >= 0) {
    let n = 0;
    for (let i = 0; i < s.a.n; i++) { if (!s.a.alive[i]) continue; if (s.a.id[i] === selectedId) { selected = n; break; } n++; }
  }
  const now = performance.now();
  let ov: Uint8Array | null = null;
  if (overlay.kind !== 'none' && (full || now - lastOverlay > 300)) { ov = rasterOverlay(s, overlay.kind, overlay.colony, overlay.trait); lastOverlay = now; }
  let temp: Float32Array | null = null;
  if (now - lastTempSent > 1000) { temp = s.w.temp.slice(); lastTempSent = now; }
  const surface = count ? s.w.surface.slice() : null;
  const msg: FrameMsg = {
    type: 'frame', id: ++frameSerial, tick: s.tick, W: s.w.W, H: s.w.H, chunks: buf, chunkCount: count, surface,tints,
    ants: ants.buf as unknown as Int16Array, antCount: ants.count, brood: brood.buf, broodCount: brood.count, critters: crit.buf, critterCount: crit.count,
    selected, temp, overlay: ov, overlayKind: overlay.kind, dayPhase: (s.tick % DAY_TICKS) / DAY_TICKS, raining: s.phys.raining > 0,
  };
  const tr: Transferable[] = [ants.buf.buffer, brood.buf.buffer, crit.buf.buffer];
  if (buf) tr.push(buf);
  if(tints)tr.push(tints.buffer);
  if (ov) tr.push(ov.buffer);
  if (temp) tr.push(temp.buffer);
  if (surface) tr.push(surface.buffer);
  frameInFlight=msg.id;
  post(msg, tr);
  frameCount++;
}

let lastAudit: any = null;
let lastAuditAt = 0;

function sendStats() {
  if (!sim) return;
  const s = sim;
  const now = performance.now();
  if (now - lastAuditAt > 2000) { lastAudit = s.audit(); lastAuditAt = now; }
  let liveSignalChunks = 0;
  for (const c of s.colonies) if (c) liveSignalChunks += c.trail.live.length + c.alarm.live.length + c.nestOdor.live.length + c.digCue.live.length;
  let activeChunks = 0;
  for (let k = 0; k < s.w.chunkActive.length; k++) if (s.w.chunkActive[k]) activeChunks++;
  const t = s.timeString();
  const mem = (performance as any).memory;
  const pi = s.player.id ? s.a.findById(s.player.id) : -1;
  const home = pi >= 0 ? s.colonies[s.a.colony[pi]] : null;
  const route = selectedId >= 0 ? antRoute(s, s.a.findById(selectedId)) : [];
  post({
    type: 'stats',
    player: { ...s.player, alive: pi >= 0, x: s.a.x[pi], y: s.a.y[pi], cargo: s.a.carry[pi], health: s.a.health[pi], home: home?.entrance },
    tick: s.tick, day: t.day, clock: t.clock, season: t.season, airT: s.airT, daytime: s.daytime, raining: s.phys.raining > 0,
    running,runRevision, speed, achievedSpeed: achievedTps / BASE_TPS, behind: running && speed < MAX_SPEED && achievedTps < BASE_TPS * speed * 0.9 && ticksThisSecond >= 0,
    droppedTicks,
    colonies: colonySummaries(s),
    settlements: s.critters.settlements.map(h=>({...h,members:s.critters.list.filter(c=>c.community===h.id).length})),
    census: s.census.slice(-240),
    ants: s.a.count, critters: s.critters.list.length,
    events: s.events.slice(-80),
    journal: s.journal,
    unlocked: [...s.unlocked],
    settings: s.settings, climate: s.climate, mode: s.mode, scenario: s.scenarioInfo, seed: s.cfg.seed,
    audit: lastAudit, ledger: { sources: s.w.ledger.sources, sinks: s.w.ledger.sinks },
    perf: {
      ...s.perf, stepMs: lastStepMs, budgetMs: stepBudgetMs, activeChunks, totalChunks: s.w.chunkActive.length, signalChunks: liveSignalChunks,
      antCapacity: s.a.cap, heapMB: mem ? mem.usedJSHeapSize / 1048576 : null, pendingCommands: s.pending.length, events: s.events.length,
      lineage: s.lineage.length, mutations: s.mutations.length, commandLog: s.commandLog.length, frames: frameCount,
      estMB: estimateMB(s),historyMB:[...undo,...redo].reduce((n,e)=>n+e.bytes,0)/1048576,
    },
    history:{undo:undo.length,redo:redo.length},
    counters: s.counters,
    selectedAnt: selectedId >= 0 ? inspectAnt(s, s.a.findById(selectedId)) : null,
    selectedCell: selectedCell ? inspectCell(s, selectedCell.x, selectedCell.y) : null,
    route,
  });
  if (selectedId >= 0 && s.a.findById(selectedId) < 0) selectedId = -1;
}

function estimateMB(s: Sim) {
  const world = s.w.N * 19 + s.w.TW * s.w.TH * 4 * 4 + s.w.N * 2 * 2; // cell layers (including mixture fields) + coarse fields + navigation/movement
  let sig = 0;
  for (const c of s.colonies) if (c) sig += (c.trail.live.length + c.alarm.live.length + c.nestOdor.live.length + c.digCue.live.length) * CS * CS * 4;
  const ants = s.a.cap * (100 + 32 * 8 + 21 * 8 + 29 * 4 + BRAIN_W * 4 + 64);
  return (world + sig + ants) / 1048576;
}

function loop() {
  const now = performance.now();
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  if (running && sim) {
    const unlimited = speed >= MAX_SPEED;
    if (!unlimited) acc += dt * BASE_TPS * speed;
    const t0 = performance.now();
    let done = 0;
    while ((unlimited || acc >= 1) && performance.now() - t0 < stepBudgetMs) {
      const ts = performance.now();
      sim.step();
      lastStepMs = performance.now() - ts;
      acc -= 1;
      done++;
    }
    // never accumulate catch-up debt beyond a quarter second: report it instead of freezing
    const cap = BASE_TPS * speed * 0.25;
    if (!unlimited && acc > cap) { droppedTicks += Math.floor(acc - cap); acc = cap; }
    if (unlimited) acc = 0;
    ticksThisSecond += done;
  }
  if (now - secondStart >= 1000) {
    achievedTps = (ticksThisSecond * 1000) / (now - secondStart);
    ticksThisSecond = 0;
    secondStart = now;
  }
  if (sim && now - lastFrame >= 33) { sendFrame(); lastFrame = now; }
  if (sim && now - lastStats >= 250) { sendStats(); lastStats = now; }
  if (sim && running && now - lastBrainSave > 20000) { lastBrainSave = now; persistBrains().catch(() => {}); }
  if (sim && wantDetail && now - lastDetail > 1000) {
    lastDetail = now;
    if (wantDetail.what === 'evolution') post({ type: 'evolution', data: evolutionDetail(sim) });
  }
  setTimeout(loop, running ? 1 : 16);
}

async function gzip(text: string): Promise<ArrayBuffer> {
  const cs = new CompressionStream('gzip');
  const stream = new Blob([text]).stream().pipeThrough(cs);
  return await new Response(stream).arrayBuffer();
}
async function gunzipMaybe(buf: ArrayBuffer): Promise<string> {
  const u8 = new Uint8Array(buf);
  if (u8[0] === 0x1f && u8[1] === 0x8b) {
    const ds = new DecompressionStream('gzip');
    const stream = new Blob([buf]).stream().pipeThrough(ds);
    return await new Response(stream).text();
  }
  return new TextDecoder().decode(u8);
}

function loadedWorld() {
  if (!sim) return;
  fullTerrain = true;
  selectedId = -1; selectedCell = null;
  post({ type: 'world', W: sim.w.W, H: sim.w.H, scenario: sim.scenarioInfo, mode: sim.mode, seed: sim.cfg.seed, species: sim.species.map(speciesBrief), journalDefs: JOURNAL_DEFS,cutaway:!['empty','physics-lab','liquid-lab','powder-lab'].includes(sim.cfg.scenario) });
  sendFrame(true);
  sendStats();
}

ctx.onmessage = async (e: MessageEvent<ToWorker>) => {
  const m = e.data;
  try {
    switch (m.type) {
      case 'new': await newWorld(m.opts); break;
      case 'brains': await brainsOp(m.op, m.json); break;
      case 'beginEdit': checkpoint();break;
      case 'endEdit': if(sim)sim.flushCommands();editOpen=false;break;
      case 'undo': historyMove(undo,redo);break;
      case 'redo': historyMove(redo,undo);break;
      case 'clearWorld': {
        if(!sim)break;checkpoint();const cfg=structuredClone(sim.cfg);cfg.scenario='empty';sim=new Sim(cfg);sim.w.recomputeAllSurface();sim.scenarioInfo={id:'empty',title:'Empty sandbox',goal:'Paint materials and create conditions. Introduce a queen when you are ready.',actions:[]};running=false;editOpen=false;frameInFlight=0;loadedWorld();break;
      }
      case 'frameAck': if(frameInFlight===m.id)frameInFlight=0; break;
      case 'cmds':
        if(!sim)break;
        for(const cmd of m.cmds)sim.queue(cmd);
        if(!running){sim.flushCommands();sendFrame();}
        break;
      case 'cmd':
        if (!sim) break;
        if (running) sim.queue(m.cmd); else sim.applyNow(m.cmd);
        break;
      case 'run': running = m.running;runRevision=m.revision; if(!running&&sim)sim.flushCommands(); acc = 0; last = performance.now();sendStats(); break;
      case 'speed': speed = m.speed; acc = 0; break;
      case 'step':
        if (!sim) break;
        for (let k = 0; k < m.ticks; k++) sim.step();
        sendFrame(); sendStats();
        break;
      case 'inspectCell': selectedCell = { x: m.x, y: m.y }; if (sim) sendStats(); break;
      case 'selectAnt': {
        if (!sim) break;
        let best = -1, bd = 1e9;
        sim.idx.rebuild(sim.a);
        sim.idx.query(sim.a, m.x, m.y, m.radius, (j) => {
          const d = (sim!.a.x[j] - m.x) ** 2 + (sim!.a.y[j] - m.y) ** 2;
          if (d < bd) { bd = d; best = j; }
        });
        selectedId = best >= 0 ? sim.a.id[best] : -1;
        selectedCell = { x: m.x, y: m.y };
        sendStats();
        break;
      }
      case 'selectAntId': selectedId = m.id; if (sim) sendStats(); break;
      case 'clearSelection': selectedId = -1; selectedCell = null; break;
      case 'overlay': overlay = { kind: m.kind, colony: m.colony, trait: m.trait }; lastOverlay = -Infinity; sendFrame(); break;
      case 'scenarioAction': {
        if (!sim) break;
        const act = sim.scenarioInfo.actions[m.index];
        if(!act)break;
        checkpoint();for(const c of act.cmds)sim.queue(c);sim.flushCommands();editOpen=false;
        sim.event('scenario', `Scenario action: ${act?.label ?? '?'}`);
        sendFrame();sendStats();
        break;
      }
      case 'save': {
        if (!sim) break;
        const t0 = performance.now();
        const snap = snapshot(sim, m.name);
        await db.put({ slot: m.slot, name: m.name, savedAt: snap.savedAt, summary: snap.summary }, snap);
        await persistBrains().catch(() => {});
        post({ type: 'saved', slot: m.slot, ms: performance.now() - t0 });
        break;
      }
      case 'load': {
        const rec = await db.get(m.slot);
        if (!rec) { post({ type: 'error', text: 'That save slot is empty.' }); break; }
        sim = restore(rec.data);
        undo=[];redo=[];editOpen=false;
        running = false;
        loadedWorld();
        post({ type: 'loaded', slot: m.slot });
        break;
      }
      case 'listSaves': post({ type: 'saves', list: await db.list() }); break;
      case 'deleteSave': await db.del(m.slot); post({ type: 'saves', list: await db.list() }); break;
      case 'export': {
        if (!sim) break;
        const snap = snapshot(sim, 'export');
        const buf = await gzip(encodeJSON(snap));
        post({ type: 'exported', data: buf, name: `ant-colony-day${Math.floor(sim.tick / DAY_TICKS) + 1}-seed${sim.cfg.seed}.antsave` }, [buf]);
        break;
      }
      case 'import': {
        const text = await gunzipMaybe(m.data);
        const file = decodeJSON(text);
        sim = restore(file);
        undo=[];redo=[];editOpen=false;
        running = false;
        loadedWorld();
        post({ type: 'loaded', slot: 'file' });
        break;
      }
      case 'importSpecies': {
        let raw: unknown;
        try { raw = JSON.parse(m.json); } catch (err) { post({ type: 'speciesResult', ok: false, errors: [`Not valid JSON: ${(err as Error).message}`] }); break; }
        const errors = validateSpecies(raw);
        if (!errors.length && BUILTIN_SPECIES.some((b) => b.id === (raw as SpeciesDef).id)) errors.push('That id belongs to a built-in species; choose another id.');
        if (errors.length) { post({ type: 'speciesResult', ok: false, errors }); break; }
        const sp = raw as SpeciesDef;
        customSpecies = customSpecies.filter((c) => c.id !== sp.id).concat([sp]);
        if (sim) {
          sim.species = sim.species.filter((c) => c.id !== sp.id).concat([sp]);
          sim.cfg.customSpecies = customSpecies.slice();
          post({ type: 'world', W: sim.w.W, H: sim.w.H, scenario: sim.scenarioInfo, mode: sim.mode, seed: sim.cfg.seed, species: sim.species.map(speciesBrief), journalDefs: JOURNAL_DEFS, keepView: true });
        }
        post({ type: 'speciesResult', ok: true, errors: [], name: sp.name });
        break;
      }
      case 'requestDetail': wantDetail = m.what ? { what: m.what, colony: m.colony } : null; lastDetail = 0; break;
      case 'fullTerrain': fullTerrain = true; break;
      case 'benchmark': {
        if (!sim) break;
        const wasRunning = running;
        running = false;
        const report = runBenchmark(sim, m.minutes);
        running = wasRunning;
        post({ type: 'benchmark', report });
        break;
      }
    }
  } catch (err) {
    post({ type: 'error', text: (err as Error).message });
  }
};

// Determinism check is triggered through a special message to keep ToWorker typing simple.
ctx.addEventListener('message', (e: MessageEvent<any>) => {
  if (e.data?.type === 'verifyDeterminism' && sim) {
    const wasRunning = running;
    running = false;
    const t0 = performance.now();
    const r = verifyDeterminism(sim);
    running = wasRunning;
    post({ type: 'determinism', result: r, ms: performance.now() - t0 });
  }
  if (e.data?.type === 'budget') stepBudgetMs = Math.max(4, Math.min(30, e.data.ms));
});

function runBenchmark(s: Sim, minutes: number) {
  const samples: { t: number; tick: number; ants: number; msPerTick: number; heapMB: number | null }[] = [];
  const end = performance.now() + minutes * 60000;
  let lastSample = performance.now();
  let ticks = 0, tStart = performance.now();
  while (performance.now() < end) {
    s.step();
    ticks++;
    if (performance.now() - lastSample > 2000) {
      const now = performance.now();
      const mem = (performance as any).memory;
      samples.push({ t: (now - tStart) / 1000, tick: s.tick, ants: s.a.count, msPerTick: (now - lastSample) / ticks, heapMB: mem ? mem.usedJSHeapSize / 1048576 : null });
      ticks = 0;
      lastSample = now;
    }
  }
  fullTerrain = true;
  return { minutes, samples, finalTick: s.tick, ants: s.a.count, colonies: s.aliveColonies().length };
}

void SCENARIOS;
loop();
post({ type: 'ready' });
