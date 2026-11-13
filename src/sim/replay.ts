// Deterministic replay: rebuild a world from its creation options and command log.
// Compatibility boundary: same build of this code running in the same JS engine.
import { createSim } from './scenarios.ts';
import type { Sim } from './sim.ts';

export function replay(createOpts: any, log: { tick: number; cmd: any }[], toTick: number, onProgress?: (t: number) => void): Sim {
  const sim = createSim(structuredClone(createOpts));
  let k = 0;
  while (sim.tick < toTick) {
    while (k < log.length && log[k].tick === sim.tick) sim.queue(structuredClone(log[k++].cmd));
    sim.step();
    if (onProgress && (sim.tick & 1023) === 0) onProgress(sim.tick);
  }
  return sim;
}

/** Replays the run from scratch and compares the state hash with the live simulation. */
export function verifyDeterminism(sim: Sim): { ok: boolean; reason: string; live: string; replayed: string } {
  if (!sim.createOpts) return { ok: false, reason: 'This world was loaded from a file without creation options.', live: '', replayed: '' };
  if (!sim.replayable) return { ok: false, reason: 'The command log was truncated (over 20,000 commands), so the run cannot be replayed.', live: '', replayed: '' };
  const live = sim.hash();
  const r = replay(sim.createOpts, sim.commandLog, sim.tick);
  const replayed = r.hash();
  return { ok: live === replayed, reason: live === replayed ? 'Replay matches the live state.' : 'Replay diverged from the live state.', live, replayed };
}
