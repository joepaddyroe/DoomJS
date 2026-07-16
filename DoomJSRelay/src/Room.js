import { MessageType, PROTOCOL_VERSION, encodeMessage } from './protocol.js';

/** How many ticks ahead clients may buffer (vanilla-ish BACKUPTICS). */
const INPUT_LEAD = 12;

/**
 * One multiplayer room: lobby + per-tick input collection → fan-out confirmed.
 */
export class Room {
  /**
   * @param {string} id
   * @param {{ maxPlayers?: number }} [opts]
   */
  constructor(id, opts = {}) {
    this.id = id;
    this.maxPlayers = opts.maxPlayers ?? 4;
    /** @type {Map<string, { playerId: number, ready: boolean, ws: import('ws').WebSocket }>} */
    this.clients = new Map();
    /** @type {number[]} free player slots */
    this.freeSlots = Array.from({ length: this.maxPlayers }, (_, i) => i);
    this.hostClientId = null;
    /** @type {object|null} */
    this.setup = null;
    this.started = false;
    this.tick = 0;
    /** @type {Map<number, (number[]|null)[]>} tick → inputs by player */
    this.pending = new Map();
    this.playerMask = 0;
    this.inputLead = INPUT_LEAD;
  }

  get playerCount() {
    return this.clients.size;
  }

  /**
   * @param {string} clientId
   * @param {import('ws').WebSocket} ws
   * @returns {{ playerId: number }}
   */
  addClient(clientId, ws) {
    if (this.started) {
      throw new Error('Room already started');
    }
    if (this.freeSlots.length === 0) {
      throw new Error('Room full');
    }
    const playerId = this.freeSlots.shift();
    this.clients.set(clientId, { playerId, ready: false, ws });
    if (this.hostClientId === null) {
      this.hostClientId = clientId;
    }
    this._recomputeMask();
    return { playerId };
  }

  /** @param {string} clientId */
  removeClient(clientId) {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }
    this.clients.delete(clientId);
    this.freeSlots.push(client.playerId);
    this.freeSlots.sort((a, b) => a - b);
    if (this.hostClientId === clientId) {
      this.hostClientId = this.clients.keys().next().value ?? null;
    }
    this._recomputeMask();
  }

  /** @param {string} clientId @param {object} setup */
  setSetup(clientId, setup) {
    if (clientId !== this.hostClientId) {
      throw new Error('Only host can set setup');
    }
    this.setup = setup;
  }

  /** @param {string} clientId */
  setReady(clientId, ready = true) {
    const c = this.clients.get(clientId);
    if (!c) {
      throw new Error('Not in room');
    }
    c.ready = ready;
  }

  allReady() {
    if (this.clients.size < 1) {
      return false;
    }
    for (const c of this.clients.values()) {
      if (!c.ready) {
        return false;
      }
    }
    return true;
  }

  /** @param {string} clientId */
  start(clientId) {
    if (clientId !== this.hostClientId) {
      throw new Error('Only host can start');
    }
    if (!this.setup) {
      throw new Error('Setup required');
    }
    if (!this.allReady()) {
      throw new Error('Not all players ready');
    }
    this.started = true;
    this.tick = 0;
    this.pending.clear();
  }

  /**
   * Buffer a player's input for a tick. May confirm one or more ticks in order.
   * @param {string} clientId
   * @param {number} tick
   * @param {number[]} cmdBytes
   * @returns {object[]} zero or more confirmed messages (in tick order)
   */
  submitInput(clientId, tick, cmdBytes) {
    if (!this.started) {
      throw new Error('Room not started');
    }
    const client = this.clients.get(clientId);
    if (!client) {
      throw new Error('Not in room');
    }
    if (tick <= this.tick) {
      // Stale / duplicate — ignore quietly (client may have resent).
      return [];
    }
    if (tick > this.tick + this.inputLead) {
      throw new Error(`Tick ${tick} too far ahead (server at ${this.tick}, lead ${this.inputLead})`);
    }

    let slot = this.pending.get(tick);
    if (!slot) {
      slot = Array.from({ length: this.maxPlayers }, () => null);
      this.pending.set(tick, slot);
    }
    slot[client.playerId] = cmdBytes;

    return this._drainConfirmed();
  }

  /**
   * Confirm consecutive complete ticks starting at tick+1.
   * @returns {object[]}
   */
  _drainConfirmed() {
    /** @type {object[]} */
    const confirmed = [];
    while (true) {
      const nextTick = this.tick + 1;
      const slot = this.pending.get(nextTick);
      if (!slot || !this._tickComplete(slot)) {
        break;
      }
      this.tick = nextTick;
      this.pending.delete(nextTick);
      confirmed.push({
        type: MessageType.CONFIRMED,
        roomId: this.id,
        tick: nextTick,
        inputs: slot,
        playerMask: this.playerMask,
      });
    }
    return confirmed;
  }

  /** @returns {object} */
  snapshot() {
    return {
      type: MessageType.ROOM_STATE,
      protocol: PROTOCOL_VERSION,
      roomId: this.id,
      hostClientId: this.hostClientId,
      started: this.started,
      tick: this.tick,
      setup: this.setup,
      playerMask: this.playerMask,
      players: [...this.clients.entries()].map(([clientId, c]) => ({
        clientId,
        playerId: c.playerId,
        ready: c.ready,
      })),
    };
  }

  /** @param {object} msg */
  broadcast(msg) {
    const raw = encodeMessage(msg);
    for (const c of this.clients.values()) {
      if (c.ws.readyState === 1) {
        c.ws.send(raw);
      }
    }
  }

  /** @param {(number[]|null)[]} slot */
  _tickComplete(slot) {
    for (let i = 0; i < this.maxPlayers; i++) {
      if ((this.playerMask & (1 << i)) === 0) {
        continue;
      }
      if (!slot[i]) {
        return false;
      }
    }
    return true;
  }

  _recomputeMask() {
    let mask = 0;
    for (const c of this.clients.values()) {
      mask |= 1 << c.playerId;
    }
    this.playerMask = mask;
  }
}
