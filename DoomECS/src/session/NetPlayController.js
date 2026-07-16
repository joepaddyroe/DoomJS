/**
 * Wires SimulationSession to a relay: predict locally, confirm on server fan-out.
 */
import { SimulationSession } from './SimulationSession.js';
import { ReplayRecorder } from './Replay.js';
import { arrayToBytes } from './netCompat.js';

export class NetPlayController {
  /**
   * @param {{
   *   session: SimulationSession,
   *   sendInput: (tick: number, cmd: Uint8Array) => void,
   *   recordReplay?: boolean,
   * }} opts
   */
  constructor(opts) {
    this.session = opts.session;
    this.sendInput = opts.sendInput;
    this.recorder = opts.recordReplay ? new ReplayRecorder() : null;
    this.started = false;
    /** @type {((snap: object) => void)|null} */
    this.onVerified = null;
    /** @type {Map<number, { resolve: (snap: object) => void, reject: (err: Error) => void }>} */
    this._confirmWaiters = new Map();
  }

  /**
   * @param {import('../frame/Frame.js').Frame} initial
   * @param {{ seed: number, playerMask: number }} meta
   */
  begin(initial, meta) {
    this.session.playerMask = meta.playerMask;
    this.session.reset(initial);
    this.started = true;
    this._confirmWaiters.clear();
    if (this.recorder) {
      this.recorder.begin({
        seed: meta.seed,
        playerMask: meta.playerMask,
        maxPlayers: this.session.maxPlayers,
        localPlayer: this.session.localPlayer,
      });
    }
  }

  /**
   * Submit local cmd, send to relay, advance prediction.
   * @param {Uint8Array} cmd
   * @returns {number} tick
   */
  localTick(cmd) {
    if (!this.started) {
      throw new Error('NetPlayController not started');
    }
    const tick = this.session.submitLocalInput(cmd);
    this.sendInput(tick, cmd);
    this.session.predict();
    return tick;
  }

  /**
   * Wait until relay confirms a specific tick (or already verified past it).
   * @param {number} tick
   * @param {number} [timeoutMs]
   * @returns {Promise<object>}
   */
  waitForTick(tick, timeoutMs = 10000) {
    if (this.session.verifiedTick >= tick) {
      return Promise.resolve({
        tick: this.session.verifiedTick,
        checksum: this.session.checksum(),
        rollbacks: this.session.rollbackCount,
      });
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._confirmWaiters.delete(tick);
        reject(new Error(`Timeout waiting for confirmed tick ${tick}`));
      }, timeoutMs);
      this._confirmWaiters.set(tick, {
        resolve: (snap) => {
          clearTimeout(timer);
          resolve(snap);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      });
    });
  }

  /**
   * Apply relay `confirmed` message.
   * @param {{ tick: number, inputs: (number[]|null)[], playerMask?: number }} msg
   */
  onConfirmed(msg) {
    if (!this.started) {
      return;
    }
    if (msg.playerMask !== undefined) {
      this.session.playerMask = msg.playerMask;
    }
    const inputs = msg.inputs.map((arr) => arrayToBytes(arr));
    this.session.confirmFrame(msg.tick, inputs);
    this.recorder?.recordConfirmed(msg.tick, inputs);
    const snap = {
      tick: msg.tick,
      checksum: this.session.checksum(),
      rollbacks: this.session.rollbackCount,
    };
    this.onVerified?.(snap);
    const waiter = this._confirmWaiters.get(msg.tick);
    if (waiter) {
      this._confirmWaiters.delete(msg.tick);
      waiter.resolve(snap);
    }
  }

  /** @returns {object|null} */
  getReplay() {
    return this.recorder?.toJSON() ?? null;
  }
}
