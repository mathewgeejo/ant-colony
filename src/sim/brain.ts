// Per-ant learning brain, in the spirit of Creatures (1996). Every worker carries its own small neural
// network that maps what it senses (its drives plus local cues) to a value for each high-level action
// ("verb"). The chosen verb is carried out by the existing motor programs in behavior.ts, the way a norn's
// brain picked "eat" or "push" and scripts performed it. Learning is reinforcement by drive reduction:
// when hunger, thirst, pain, fear or boredom fall after an action, that action is rewarded; when they rise
// it is punished. Useful work (food delivered, larvae fed, soil dug, refuse removed, rivals killed) also
// releases reward, because a worker's success is its colony's success.
//
// Learning rule: semi-Markov Q-learning with a one-hidden-layer network, trained online by backpropagation
// each time the ant makes its next decision (the previous action's accumulated reward plus the discounted
// value of the new situation is the target). Exploration is Boltzmann (softmax) and cools with experience.
//
// Instincts and inheritance: like Creatures' instinct genes, a colony's first workers are born with a
// template that was trained in "dreams" on a table of innate sense->action rewards. Each colony keeps that
// template (c.mind) and newborn workers copy it with small random variation. When a worker dies, its learnt
// weights are blended into the template if it lived more rewarding a life than the colony average, so
// lessons accumulate across generations of workers (a GAME ABSTRACTION of cultural/genetic transmission;
// real ant workers do not pass on learnt weights). Daughter colonies inherit their mother colony's template,
// and templates are kept in a per-species "brain bank" that survives between worlds (IndexedDB).
import type { Colony } from './colony.ts';
import type { Sim } from './sim.ts';
import { learnRate } from './traits.ts';

export const ACT = { REST: 0, FORAGE: 1, NURSE: 2, DIG: 3, CLEAN: 4, EAT: 5, DRINK: 6, DEFEND: 7, FLEE: 8 } as const;
export const ACT_NAMES = ['rest', 'forage', 'nurse brood', 'dig', 'clean the nest', 'eat', 'drink', 'defend', 'flee'];
export const NA = ACT_NAMES.length;

/** Sensory neurons (inputs). The first ND are drives: their reduction is the reward signal. */
export const S = {
  HUNGER: 0, THIRST: 1, PAIN: 2, FEAR: 3, BOREDOM: 4, FORAGE_CUE: 5, NURSE_CUE: 6, DIG_CUE: 7, WASTE_CUE: 8,
  STORES: 9, RIVALS: 10, CONTACTS: 11, DAYLIGHT: 12, YOUNG: 13, ROUTE: 14, IN_NEST: 15, CARRYING: 16,
} as const;
export const SENSE_NAMES = ['hunger', 'thirst', 'pain', 'fear', 'boredom', 'call to forage', 'call to nurse', 'call to dig', 'refuse in nest',
  'food in stores', 'rivals near', 'recruiting contacts', 'daylight', 'young', 'remembers food', 'inside nest', 'carrying'];
export const NI = SENSE_NAMES.length;
export const ND = 5;
export const NH = 12;
const B1 = NI * NH, W2 = B1 + NH, B2 = W2 + NH * NA;
/** weights per brain */
export const NW = B2 + NA;
export const NO_ACT = 255;

/** how much each unit of drive reduction is worth (hunger, thirst, pain, fear, boredom) */
const DRIVE_W = [1.5, 1.2, 2.0, 0.6, 0.4];
const BASE_LR = 0.02;
const WMAX = 4;
/** discount per 600 ticks (10 game-minutes) of an option's duration */
const GAMMA = 0.9;

/** Innate sense->action rewards ("instinct genes") used to dream a colony's first template. */
const INSTINCTS: [number, number, number][] = [
  [-1, ACT.REST, 0.25], [S.PAIN, ACT.REST, 0.6], [S.BOREDOM, ACT.REST, -0.3], [S.HUNGER, ACT.REST, -0.2],
  [S.FORAGE_CUE, ACT.FORAGE, 1.0], [S.CONTACTS, ACT.FORAGE, 0.4], [S.ROUTE, ACT.FORAGE, 0.1], [S.YOUNG, ACT.FORAGE, -0.3],
  [S.BOREDOM, ACT.DIG, 0.25], [S.BOREDOM, ACT.NURSE, 0.15],
  [S.STORES, ACT.FORAGE, -0.3], [S.PAIN, ACT.FORAGE, -0.5], [S.HUNGER, ACT.FORAGE, -0.2],
  [S.NURSE_CUE, ACT.NURSE, 1.0], [S.YOUNG, ACT.NURSE, 0.3],
  [S.DIG_CUE, ACT.DIG, 1.0],
  [S.WASTE_CUE, ACT.CLEAN, 1.0],
  [-1, ACT.EAT, -0.3], [S.HUNGER, ACT.EAT, 1.4], [S.STORES, ACT.EAT, 0.2],
  [-1, ACT.DRINK, -0.3], [S.THIRST, ACT.DRINK, 1.4],
  [-1, ACT.DEFEND, -0.2], [S.FEAR, ACT.DEFEND, 0.9], [S.RIVALS, ACT.DEFEND, 0.4], [S.PAIN, ACT.DEFEND, -0.8],
  [-1, ACT.FLEE, -0.4], [S.PAIN, ACT.FLEE, 0.8], [S.FEAR, ACT.FLEE, 0.3], [S.RIVALS, ACT.FLEE, 0.3],
];

/** Colony template ("instincts" passed to newborn workers) and its selection statistics. */
export interface Mind {
  w: Float32Array;
  /** template revisions: dreams count as 0, each accepted worker lifetime adds one */
  gen: number;
  /** running mean of worker lifetime fitness (reward per decision) */
  meanFit: number;
  lifetimes: number;
  accepted: number;
  source: string;
}
export interface BankEntry { speciesId: string; w: Float32Array; gen: number; meanFit: number; lifetimes: number; savedAt?: string; source?: string }

const H = new Float32Array(NH), Q = new Float32Array(NA), XT = new Float32Array(NI);

/** Forward pass: fills h (hidden) and q (action values). */
export function forward(w: ArrayLike<number>, o: number, x: ArrayLike<number>, xo: number, h: Float32Array = H, q: Float32Array = Q) {
  for (let j = 0; j < NH; j++) {
    let s = w[o + B1 + j];
    for (let k = 0; k < NI; k++) s += w[o + k * NH + j] * x[xo + k];
    h[j] = Math.tanh(s);
  }
  for (let a = 0; a < NA; a++) {
    let s = w[o + B2 + a];
    for (let j = 0; j < NH; j++) s += w[o + W2 + j * NA + a] * h[j];
    q[a] = s;
  }
  return q;
}

const clampW = (v: number) => (v > WMAX ? WMAX : v < -WMAX ? -WMAX : v);

/** One gradient step moving Q(x, act) toward target. Returns the TD error before the step. */
function train(w: Float32Array, o: number, x: ArrayLike<number>, xo: number, act: number, target: number, lr: number): number {
  forward(w, o, x, xo);
  const err = target - Q[act];
  const d = Math.max(-2, Math.min(2, err)) * lr;
  for (let j = 0; j < NH; j++) {
    const wi = o + W2 + j * NA + act;
    const gh = d * w[wi] * (1 - H[j] * H[j]);
    w[wi] = clampW(w[wi] + d * H[j]);
    if (gh === 0) continue;
    for (let k = 0; k < NI; k++) { const v = x[xo + k]; if (v) w[o + k * NH + j] = clampW(w[o + k * NH + j] + gh * v); }
    w[o + B1 + j] = clampW(w[o + B1 + j] + gh);
  }
  w[o + B2 + act] = clampW(w[o + B2 + act] + d);
  return err;
}

function instinctTarget(x: ArrayLike<number>, act: number) {
  let t = 0;
  for (const [s, a, v] of INSTINCTS) if (a === act) t += v * (s < 0 ? 1 : x[s]);
  return t;
}

/** Build a template from instincts alone: random wiring, then "dreams" of random sensations. */
export function dreamMind(sim: Sim, source = 'instincts (dreamed)'): Mind {
  const w = new Float32Array(NW), rng = sim.rng;
  for (let k = 0; k < NW; k++) w[k] = (rng.next() * 2 - 1) * (k < B1 ? 0.5 / Math.sqrt(NI) : k >= W2 && k < B2 ? 0.5 / Math.sqrt(NH) : 0);
  for (let it = 0; it < 500; it++) {
    for (let k = 0; k < NI; k++) XT[k] = rng.chance(0.45) ? rng.next() : 0;
    for (let a = 0; a < NA; a++) train(w, 0, XT, 0, a, instinctTarget(XT, a), 0.06);
  }
  return { w, gen: 0, meanFit: 0, lifetimes: 0, accepted: 0, source };
}

/** The colony's template, created on first use from its mother colony, the brain bank, or instincts. */
export function ensureMind(sim: Sim, c: Colony): Mind {
  if (c.mind && c.mind.w?.length === NW) return c.mind;
  const mother = c.motherColony ? sim.colonies.find((o) => o && o.id === c.motherColony && o.mind?.w?.length === NW) : null;
  const bank = sim.brainBank[c.speciesId];
  let m: Mind;
  if (mother) m = { ...mother.mind!, w: mother.mind!.w.slice(), source: `inherited from ${mother.name}` };
  else if (bank && bank.w?.length === NW) m = { w: Float32Array.from(bank.w), gen: bank.gen, meanFit: bank.meanFit, lifetimes: bank.lifetimes, accepted: 0, source: 'brain bank (learnt in earlier worlds)' };
  else m = dreamMind(sim);
  c.mind = m;
  return m;
}

/** Give a newborn worker its brain: the colony template plus small heritable variation. */
export function initBrain(sim: Sim, c: Colony, i: number) {
  const a = sim.a, m = ensureMind(sim, c), o = i * NW;
  for (let k = 0; k < NW; k++) a.brainW[o + k] = m.w[k] + sim.rng.normal() * 0.04;
  a.brainA[i] = NO_ACT; a.brainR[i] = 0; a.brainLife[i] = 0; a.brainN[i] = 0; a.brainErr[i] = 0; a.brainLast[i] = 0; a.bored[i] = 0;
  a.brainOk[i] = 1;
}

/** Reward or punishment delivered to an ant's currently open action. */
export function reward(sim: Sim, i: number, r: number) {
  const a = sim.a;
  if (!a.brainOk[i]) return;
  a.brainR[i] += r;
}

function driveDelta(prev: ArrayLike<number>, po: number, now: ArrayLike<number>, no: number) {
  let r = 0;
  for (let d = 0; d < ND; d++) r += DRIVE_W[d] * (prev[po + d] - now[no + d]);
  return r;
}

function lr(sim: Sim, i: number) { return BASE_LR * learnRate(sim.a.traits, i * 2); }

/** Close the open action: learn from what happened since it was chosen. */
function learn(sim: Sim, i: number, x: Float32Array, mask: number, terminal: number | null) {
  const a = sim.a;
  if (a.brainA[i] === NO_ACT) return;
  const o = i * NW, so = i * NI;
  const r = a.brainR[i] + driveDelta(a.brainS, so, x, 0);
  let target = r;
  if (terminal !== null) target += terminal;
  else {
    const q = forward(a.brainW, o, x, 0);
    let best = -1e9;
    for (let k = 0; k < NA; k++) if (mask & (1 << k) && q[k] > best) best = q[k];
    target += Math.pow(GAMMA, (sim.tick - a.brainT[i]) / 600) * best;
  }
  const err = train(a.brainW, o, a.brainS, so, a.brainA[i], target, lr(sim, i));
  a.brainErr[i] += 0.1 * (Math.abs(err) - a.brainErr[i]);
  a.brainLast[i] = r;
  a.brainLife[i] += r;
  a.brainR[i] = 0;
  a.brainA[i] = NO_ACT;
}

/** Exploration temperature: curious when young and inexperienced, more decisive later. */
export function temperature(sim: Sim, i: number) { return 0.08 + 0.3 / (1 + sim.a.brainN[i] / 40); }

/**
 * The ant decides: learn from the previous action, then pick a new one among the allowed actions (bit mask).
 * `force` commits to a specific action (chosen by a narrower comparison, e.g. fight-or-flight) so it can be learnt.
 */
export function think(sim: Sim, c: Colony, i: number, x: Float32Array, mask: number, force = -1): number {
  const a = sim.a;
  if (!a.brainOk[i]) initBrain(sim, c, i);
  learn(sim, i, x, mask, null);
  let act = force;
  if (act < 0) {
    const q = forward(a.brainW, i * NW, x, 0), tau = temperature(sim, i);
    let mx = -1e9;
    for (let k = 0; k < NA; k++) if (mask & (1 << k) && q[k] > mx) mx = q[k];
    let total = 0;
    for (let k = 0; k < NA; k++) { const p = mask & (1 << k) ? Math.exp((q[k] - mx) / tau) : 0; XP[k] = p; total += p; }
    let r = sim.rng.next() * total;
    act = 0;
    for (let k = 0; k < NA; k++) { if (!XP[k]) continue; act = k; r -= XP[k]; if (r <= 0) break; }
  }
  a.brainS.set(x, i * NI);
  a.brainA[i] = act; a.brainT[i] = sim.tick; a.brainR[i] = 0;
  a.brainN[i] = Math.min(4294967295, a.brainN[i] + 1);
  return act;
}
const XP = new Float32Array(NA);

/** Probability-weighted preference of `act` over `alt` given the current senses (no learning). */
export function prefers(sim: Sim, c: Colony, i: number, x: Float32Array, act: number, alt: number, bias = 0): boolean {
  const a = sim.a;
  if (!a.brainOk[i]) initBrain(sim, c, i);
  const q = forward(a.brainW, i * NW, x, 0);
  const z = (q[act] - q[alt]) / temperature(sim, i) + bias;
  return sim.rng.next() < 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));
}

const DANGER = new Set(['combat', 'starvation', 'desiccation', 'drowning', 'heat', 'cold', 'toxin', 'predation', 'buried', 'electrical shock', 'radiation exposure (game units)']);

/** A worker died: a fatal outcome is punished, then its lifetime is offered to the colony template. */
export function brainDeath(sim: Sim, c: Colony, i: number, cause: string) {
  const a = sim.a;
  if (!a.brainOk[i]) return;
  if (a.brainA[i] !== NO_ACT) {
    // drives at death: unchanged except pain, which is maximal
    const x = XT; x.set(a.brainS.subarray(i * NI, i * NI + NI));
    if (DANGER.has(cause)) x[S.PAIN] = 1;
    learn(sim, i, x, 0, DANGER.has(cause) ? -2 : 0);
  }
  const m = ensureMind(sim, c), n = a.brainN[i];
  if (n < 6) return;
  const fit = a.brainLife[i] / n;
  m.lifetimes++;
  // only lifetimes better than the colony's running average shape the template
  if (m.lifetimes > 3 && fit > m.meanFit) {
    const eta = 0.03 + 0.07 * Math.min(1, (fit - m.meanFit) / (Math.abs(m.meanFit) + 0.2));
    const o = i * NW;
    for (let k = 0; k < NW; k++) m.w[k] += eta * (a.brainW[o + k] - m.w[k]);
    m.gen++; m.accepted++;
  }
  m.meanFit += (m.lifetimes < 20 ? 1 / m.lifetimes : 0.05) * (fit - m.meanFit);
}

/** Colony template -> bank entry (best per species is kept by the worker thread). */
export function bankEntries(sim: Sim): BankEntry[] {
  const best = new Map<string, Colony>();
  for (const c of sim.colonies) {
    if (!c || !c.mind || c.mind.w.length !== NW || c.mind.gen === 0) continue;
    const b = best.get(c.speciesId);
    if (!b || c.mind!.gen > b.mind!.gen) best.set(c.speciesId, c);
  }
  const out: BankEntry[] = [];
  for (const [speciesId, c] of best) {
    const m = c.mind!;
    out.push({ speciesId, w: m.w.slice(), gen: m.gen, meanFit: m.meanFit, lifetimes: m.lifetimes, source: c.name });
  }
  for (const [speciesId, e] of Object.entries(sim.brainBank)) if (!best.has(speciesId) && e.w?.length === NW) out.push({ ...e, w: Float32Array.from(e.w) });
  return out;
}

/** Strongest learnt sense->action associations of a weight set: how much each sense raises each action's value. */
export function associations(w: ArrayLike<number>, o: number, limit = 8): { sense: number; act: number; v: number }[] {
  const base = new Float32Array(NA), q = new Float32Array(NA), h = new Float32Array(NH), x = new Float32Array(NI);
  forward(w, o, x, 0, h, base);
  const out: { sense: number; act: number; v: number }[] = [];
  for (let s = 0; s < NI; s++) {
    x.fill(0); x[s] = 1;
    forward(w, o, x, 0, h, q);
    let bestA = 0, bestV = -1e9;
    for (let k = 0; k < NA; k++) { const d = q[k] - base[k]; if (d > bestV) { bestV = d; bestA = k; } }
    out.push({ sense: s, act: bestA, v: bestV });
  }
  return out.sort((p, r) => r.v - p.v).slice(0, limit);
}

export function validBank(e: any): e is BankEntry {
  return !!e && typeof e.speciesId === 'string' && e.w && e.w.length === NW && Array.from(e.w as ArrayLike<number>).every((v) => Number.isFinite(v) && Math.abs(v) <= WMAX + 1e-3)
    && Number.isFinite(e.gen) && Number.isFinite(e.meanFit ?? 0);
}

export const actMask = (...acts: number[]) => acts.reduce((m, k) => m | (1 << k), 0);
