import { emptyTicCmdBytes, inputsEqual } from './TicCmdCodec.js';

/**
 * Per-tick input sets for all players (confirmed or predicted).
 */
export class InputSet {
  /**
   * @param {number} tick
   * @param {number} maxPlayers
   * @param {(Uint8Array|null)[]} [inputs]
   */
  constructor(tick, maxPlayers, inputs) {
    this.tick = tick;
    this.maxPlayers = maxPlayers;
    /** @type {(Uint8Array|null)[]} */
    this.inputs = inputs ?? Array.from({ length: maxPlayers }, () => null);
  }

  /**
   * @param {number} playerId
   * @param {Uint8Array} bytes
   */
  set(playerId, bytes) {
    this.inputs[playerId] = bytes;
  }

  /** @param {number} playerId @returns {Uint8Array} */
  get(playerId) {
    return this.inputs[playerId] ?? emptyTicCmdBytes();
  }

  /** @returns {boolean} */
  isComplete(playerMask) {
    for (let i = 0; i < this.maxPlayers; i++) {
      if ((playerMask & (1 << i)) === 0) {
        continue;
      }
      if (!this.inputs[i]) {
        return false;
      }
    }
    return true;
  }

  /** @returns {InputSet} */
  clone() {
    return new InputSet(
      this.tick,
      this.maxPlayers,
      this.inputs.map((b) => (b ? new Uint8Array(b) : null)),
    );
  }

  /**
   * @param {InputSet} other
   * @param {number} playerMask
   */
  equals(other, playerMask) {
    if (this.tick !== other.tick) {
      return false;
    }
    for (let i = 0; i < this.maxPlayers; i++) {
      if ((playerMask & (1 << i)) === 0) {
        continue;
      }
      const a = this.inputs[i] ?? emptyTicCmdBytes();
      const b = other.inputs[i] ?? emptyTicCmdBytes();
      if (!inputsEqual(a, b)) {
        return false;
      }
    }
    return true;
  }
}

/**
 * Ring of confirmed + pending local inputs keyed by tick.
 */
export class InputBuffer {
  /** @param {number} maxPlayers @param {number} [capacity=128] */
  constructor(maxPlayers, capacity = 128) {
    this.maxPlayers = maxPlayers;
    this.capacity = capacity;
    /** @type {Map<number, InputSet>} */
    this.confirmed = new Map();
    /** @type {Map<number, Uint8Array>} */
    this.localPending = new Map();
  }

  /**
   * @param {number} tick
   * @param {number} localPlayer
   * @param {Uint8Array} bytes
   */
  queueLocal(tick, localPlayer, bytes) {
    this.localPending.set(tick, new Uint8Array(bytes));
    void localPlayer;
    this._trim();
  }

  /** @param {number} tick @returns {Uint8Array|undefined} */
  getLocal(tick) {
    return this.localPending.get(tick);
  }

  /**
   * @param {number} tick
   * @param {(Uint8Array|null)[]} inputs
   */
  confirm(tick, inputs) {
    const set = new InputSet(tick, this.maxPlayers, inputs.map((b) => (b ? new Uint8Array(b) : null)));
    this.confirmed.set(tick, set);
    this.localPending.delete(tick);
    this._trim();
  }

  /** @param {number} tick @returns {InputSet|undefined} */
  getConfirmed(tick) {
    return this.confirmed.get(tick);
  }

  _trim() {
    if (this.confirmed.size <= this.capacity && this.localPending.size <= this.capacity) {
      return;
    }
    const confKeys = [...this.confirmed.keys()].sort((a, b) => a - b);
    while (confKeys.length > this.capacity) {
      this.confirmed.delete(confKeys.shift());
    }
    const locKeys = [...this.localPending.keys()].sort((a, b) => a - b);
    while (locKeys.length > this.capacity) {
      this.localPending.delete(locKeys.shift());
    }
  }
}
