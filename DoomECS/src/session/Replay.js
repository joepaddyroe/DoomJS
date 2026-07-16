import { SimulationSession } from './SimulationSession.js';
import { Frame } from '../frame/Frame.js';

/**
 * Records confirmed input streams for action replay.
 */
export class ReplayRecorder {
  constructor() {
    /** @type {{ seed: number, playerMask: number, maxPlayers: number, localPlayer: number }|null} */
    this.header = null;
    /** @type {{ tick: number, inputs: number[][] }[]} */
    this.frames = [];
  }

  /**
   * @param {{ seed: number, playerMask?: number, maxPlayers?: number, localPlayer?: number }} header
   */
  begin(header) {
    this.header = {
      seed: header.seed,
      playerMask: header.playerMask ?? 1,
      maxPlayers: header.maxPlayers ?? 4,
      localPlayer: header.localPlayer ?? 0,
    };
    this.frames = [];
  }

  /**
   * @param {number} tick
   * @param {(Uint8Array|null)[]} inputs
   */
  recordConfirmed(tick, inputs) {
    this.frames.push({
      tick,
      inputs: inputs.map((b) => (b ? [...b] : null)),
    });
  }

  /** @returns {object} JSON-serializable replay */
  toJSON() {
    return {
      version: 1,
      header: this.header,
      frames: this.frames,
    };
  }

  /** @param {object} data */
  static fromJSON(data) {
    const rec = new ReplayRecorder();
    rec.header = data.header;
    rec.frames = data.frames;
    return rec;
  }
}

/**
 * Play a recorded input tape through a session (verified-only path).
 */
export class ReplayPlayer {
  /**
   * @param {object} replay JSON from ReplayRecorder
   * @param {import('./SimulationSession.js').SimulateFn} simulate
   * @param {{ createWorld?: () => import('../ecs/World.js').World }} [opts]
   */
  constructor(replay, simulate, opts = {}) {
    this.replay = ReplayRecorder.fromJSON(replay);
    this.simulate = simulate;
    this.createWorld = opts.createWorld;
  }

  /**
   * @returns {{ session: SimulationSession, checksums: number[] }}
   */
  run() {
    const h = this.replay.header;
    if (!h) {
      throw new Error('Replay missing header');
    }

    const session = new SimulationSession({
      maxPlayers: h.maxPlayers,
      localPlayer: h.localPlayer,
      playerMask: h.playerMask,
      simulate: this.simulate,
    });

    const world = this.createWorld?.();
    session.reset(Frame.create(0, { seed: h.seed, world }));

    const checksums = [session.checksum()];
    for (const step of this.replay.frames) {
      const inputs = step.inputs.map((arr) => (arr ? Uint8Array.from(arr) : null));
      session.stepVerified(step.tick, inputs);
      checksums.push(session.checksum());
    }

    return { session, checksums };
  }
}
