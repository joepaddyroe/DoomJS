import { RelayClient, ticCmdToBytes, bytesToTicCmd } from './RelayBridge.js';
import { createTicCmd } from '../game/TicCmd.js';

/**
 * Strict lockstep over DoomJSRelay (wait-for-confirm; no Doom world rollback yet).
 */
export class NetGameSession {
  /** @param {{ url?: string }} [opts] */
  constructor(opts = {}) {
    this.url = opts.url ?? 'ws://127.0.0.1:7777';
    this.client = new RelayClient(this.url);
    this.active = false;
    this.connected = false;
    this.localPlayer = 0;
    this.playerMask = 1;
    this.host = false;
    this.roomId = null;
    /** @type {object|null} */
    this.setup = null;
    this.seed = 1;

    this.nextSendTick = 1;
    this.verifiedTick = 0;
    /** @type {Map<number, (import('../game/TicCmd.js').TicCmd|null)[]>} */
    this.confirmed = new Map();
    this.maxLead = 8;

    /** @type {((setup: object) => void)|null} */
    this.onMatchStart = null;
    /** @type {((msg: object) => void)|null} */
    this.onLobby = null;
    /** @type {((err: string) => void)|null} */
    this.onError = null;
  }

  /** @returns {Promise<object>} */
  async connect() {
    this.client.onMessage = (msg) => this._onMessage(msg);
    const hello = await this.client.connect();
    this.connected = true;
    return hello;
  }

  createRoom(roomId) {
    this.client.createRoom(roomId);
  }

  joinRoom(roomId) {
    this.client.joinRoom(roomId);
  }

  /** @param {object} setup */
  sendSetup(setup) {
    this.client.send({ type: 'setup', setup });
  }

  ready(ready = true) {
    this.client.send({ type: 'ready', ready });
  }

  startMatch() {
    this.client.send({ type: 'start' });
  }

  /**
   * Called once match begins (after relay `start`).
   * @param {{ playerMask: number, seed: number, setup: object }} meta
   */
  beginPlaying(meta) {
    this.active = true;
    this.playerMask = meta.playerMask;
    this.seed = meta.seed;
    this.setup = meta.setup;
    this.nextSendTick = 1;
    this.verifiedTick = 0;
    this.confirmed.clear();
  }

  /**
   * Queue local ticcmd for the next outgoing tick (if within lead).
   * @param {import('../game/TicCmd.js').TicCmd} cmd
   */
  offerLocalCmd(cmd) {
    if (!this.active) {
      return;
    }
    if (this.nextSendTick > this.verifiedTick + this.maxLead) {
      return;
    }
    const tick = this.nextSendTick;
    this.client.sendInput(tick, ticCmdToBytes(cmd));
    this.nextSendTick += 1;
  }

  /**
   * If the next verified tick is ready, return cmds for all seats (sparse by playerId).
   * @returns {{ tick: number, cmds: (import('../game/TicCmd.js').TicCmd|null)[] }|null}
   */
  pollVerified() {
    if (!this.active) {
      return null;
    }
    const tick = this.verifiedTick + 1;
    const cmds = this.confirmed.get(tick);
    if (!cmds) {
      return null;
    }
    this.confirmed.delete(tick);
    this.verifiedTick = tick;
    return { tick, cmds };
  }

  /** @param {object} msg */
  _onMessage(msg) {
    if (msg.type === 'joinRoom') {
      this.localPlayer = msg.playerId;
      this.host = !!msg.host;
      this.roomId = msg.roomId;
      this.onLobby?.(msg);
      return;
    }
    if (msg.type === 'roomState') {
      this.onLobby?.(msg);
      return;
    }
    if (msg.type === 'start') {
      this.beginPlaying({
        playerMask: msg.playerMask,
        seed: msg.seed ?? msg.setup?.seed ?? 1,
        setup: msg.setup ?? {},
      });
      this.onMatchStart?.(msg);
      return;
    }
    if (msg.type === 'confirmed') {
      const maxPlayers = 4;
      /** @type {(import('../game/TicCmd.js').TicCmd|null)[]} */
      const cmds = Array.from({ length: maxPlayers }, () => null);
      for (let i = 0; i < maxPlayers; i++) {
        if ((msg.playerMask & (1 << i)) === 0) {
          continue;
        }
        const bytes = msg.inputs?.[i];
        cmds[i] = bytes ? bytesToTicCmd(Uint8Array.from(bytes)) : createTicCmd();
      }
      this.confirmed.set(msg.tick, cmds);
      return;
    }
    if (msg.type === 'error') {
      this.onError?.(msg.message ?? 'relay error');
    }
  }

  close() {
    this.client.close();
    this.active = false;
    this.connected = false;
  }
}
