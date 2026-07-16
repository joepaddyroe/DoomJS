import { InputBuffer, InputSet } from '../input/InputBuffer.js';
import { emptyTicCmdBytes } from '../input/TicCmdCodec.js';

/**
 * Quantum-style simulation session:
 * - verifiedTick / verifiedFrame — authoritative (confirmed inputs)
 * - predicted head — local speculation
 * - confirmFrame() may trigger rollback + resim
 *
 * @typedef {(frame: Frame, inputs: Uint8Array[], playerMask: number) => void} SimulateFn
 */

export class SimulationSession {
  /**
   * @param {{
   *   maxPlayers?: number,
   *   localPlayer?: number,
   *   playerMask?: number,
   *   simulate: SimulateFn,
   *   predictRemoteInput?: (playerId: number, tick: number, frame: Frame) => Uint8Array,
   *   maxRollback?: number,
   * }} opts
   */
  constructor(opts) {
    this.maxPlayers = opts.maxPlayers ?? 4;
    this.localPlayer = opts.localPlayer ?? 0;
    this.playerMask = opts.playerMask ?? 1;
    this.simulate = opts.simulate;
    this.predictRemoteInput = opts.predictRemoteInput
      ?? (() => emptyTicCmdBytes());
    this.maxRollback = opts.maxRollback ?? 64;

    /** @type {Frame|null} */
    this.verifiedFrame = null;
    this.verifiedTick = -1;
    /** @type {Frame|null} predicted head (after last predict step) */
    this.predictedFrame = null;
    this.predictedTick = -1;

    this.inputs = new InputBuffer(this.maxPlayers);
    /** @type {Frame[]} snapshots at verified boundaries for rollback */
    this.history = [];

    this.rollbackCount = 0;
  }

  /** @param {Frame} initial */
  reset(initial) {
    this.verifiedFrame = initial.clone();
    this.verifiedTick = initial.tick;
    this.predictedFrame = initial.clone();
    this.predictedTick = initial.tick;
    this.inputs = new InputBuffer(this.maxPlayers);
    this.history = [initial.clone()];
    this.rollbackCount = 0;
  }

  /**
   * Queue local input for the next tick to simulate (predictedTick + 1).
   * @param {Uint8Array} bytes
   */
  submitLocalInput(bytes) {
    const tick = this.predictedTick + 1;
    this.inputs.queueLocal(tick, this.localPlayer, bytes);
    return tick;
  }

  /**
   * Advance prediction by one tick using local + predicted remote inputs.
   * @returns {Frame}
   */
  predict() {
    if (!this.predictedFrame) {
      throw new Error('Session not reset');
    }
    const tick = this.predictedTick + 1;
    const inputSet = this._buildPredictedInputs(tick);
    const next = this.predictedFrame.clone();
    this.simulate(next, inputSet.inputs.map((b, i) => b ?? emptyTicCmdBytes()), this.playerMask);
    next.tick = tick;
    this.predictedFrame = next;
    this.predictedTick = tick;
    return this.predictedFrame;
  }

  /**
   * Server/relay confirmed inputs for a tick. May rollback.
   * @param {number} tick
   * @param {(Uint8Array|null)[]} inputs length maxPlayers
   */
  confirmFrame(tick, inputs) {
    if (!this.verifiedFrame) {
      throw new Error('Session not reset');
    }
    if (tick !== this.verifiedTick + 1) {
      throw new Error(`confirmFrame expected tick ${this.verifiedTick + 1}, got ${tick}`);
    }

    this.inputs.confirm(tick, inputs);
    const confirmed = this.inputs.getConfirmed(tick);

    const predictedInputs = this._buildPredictedInputs(tick);
    const needRollback = !predictedInputs.equals(confirmed, this.playerMask)
      || tick <= this.predictedTick;

    if (needRollback && tick <= this.predictedTick) {
      this._rollbackAndResim(tick, confirmed);
    } else {
      const next = this.verifiedFrame.clone();
      this.simulate(
        next,
        confirmed.inputs.map((b) => b ?? emptyTicCmdBytes()),
        this.playerMask,
      );
      next.tick = tick;
      this.verifiedFrame = next;
      this.verifiedTick = tick;
      this._pushHistory(next);

      if (this.predictedTick < tick) {
        this.predictedFrame = next.clone();
        this.predictedTick = tick;
      }
    }

    return this.verifiedFrame;
  }

  /**
   * Offline / replay: apply confirmed inputs without prediction.
   * @param {number} tick
   * @param {(Uint8Array|null)[]} inputs
   */
  stepVerified(tick, inputs) {
    this.inputs.confirm(tick, inputs);
    const confirmed = this.inputs.getConfirmed(tick);
    const next = this.verifiedFrame.clone();
    this.simulate(
      next,
      confirmed.inputs.map((b) => b ?? emptyTicCmdBytes()),
      this.playerMask,
    );
    next.tick = tick;
    this.verifiedFrame = next;
    this.verifiedTick = tick;
    this.predictedFrame = next.clone();
    this.predictedTick = tick;
    this._pushHistory(next);
    return next;
  }

  /** @returns {number} */
  checksum() {
    return this.verifiedFrame?.checksum() ?? 0;
  }

  /**
   * @param {number} tick
   * @returns {InputSet}
   */
  _buildPredictedInputs(tick) {
    const set = new InputSet(tick, this.maxPlayers);
    for (let p = 0; p < this.maxPlayers; p++) {
      if ((this.playerMask & (1 << p)) === 0) {
        continue;
      }
      if (p === this.localPlayer) {
        const local = this.inputs.getLocal(tick);
        set.set(p, local ? new Uint8Array(local) : emptyTicCmdBytes());
      } else {
        const confirmed = this.inputs.getConfirmed(tick);
        if (confirmed?.inputs[p]) {
          set.set(p, new Uint8Array(confirmed.inputs[p]));
        } else {
          set.set(p, this.predictRemoteInput(p, tick, this.predictedFrame));
        }
      }
    }
    return set;
  }

  /**
   * @param {number} tick
   * @param {InputSet} confirmed
   */
  _rollbackAndResim(tick, confirmed) {
    this.rollbackCount += 1;
    const base = this.history.find((f) => f.tick === tick - 1)
      ?? this.verifiedFrame;

    let frame = base.clone();
    // Apply confirmed for `tick`
    this.simulate(
      frame,
      confirmed.inputs.map((b) => b ?? emptyTicCmdBytes()),
      this.playerMask,
    );
    frame.tick = tick;
    this.verifiedFrame = frame;
    this.verifiedTick = tick;
    this._pushHistory(frame);

    // Re-predict from verified to previous predicted head
    const target = Math.max(this.predictedTick, tick);
    this.predictedFrame = frame.clone();
    this.predictedTick = tick;
    while (this.predictedTick < target) {
      this.predict();
    }
  }

  /** @param {import('../frame/Frame.js').Frame} frame */
  _pushHistory(frame) {
    this.history.push(frame.clone());
    while (this.history.length > this.maxRollback) {
      this.history.shift();
    }
  }
}
