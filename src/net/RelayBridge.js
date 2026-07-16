/**
 * Optional bridge helpers between DoomJS TicCmd objects and DoomECS binary cmds.
 * Not imported by main.js / Game.js — opt-in only (see demo/net-demo.html).
 */

import {
  encodeTicCmd,
  decodeTicCmd,
} from '../../DoomECS/src/input/TicCmdCodec.js';

/**
 * @param {import('../game/TicCmd.js').TicCmd & { consistancy?: number, chatchar?: number }} cmd
 * @returns {Uint8Array}
 */
export function ticCmdToBytes(cmd) {
  return encodeTicCmd(cmd);
}

/**
 * @param {Uint8Array} bytes
 * @returns {import('../game/TicCmd.js').TicCmd & { consistancy: number, chatchar: number }}
 */
export function bytesToTicCmd(bytes) {
  return decodeTicCmd(bytes);
}

/**
 * Browser WebSocket client for DoomJSRelay (lobby + input).
 */
export class RelayClient {
  /**
   * @param {string} url e.g. ws://127.0.0.1:7777
   */
  constructor(url) {
    this.url = url;
    /** @type {WebSocket|null} */
    this.ws = null;
    this.clientId = null;
    this.roomId = null;
    this.playerId = null;
    this.host = false;
    /** @type {((msg: object) => void)|null} */
    this.onMessage = null;
  }

  /** @returns {Promise<object>} hello message */
  connect() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);
      this.ws = ws;

      const onError = () => reject(new Error('WebSocket error'));
      ws.addEventListener('error', onError, { once: true });

      ws.addEventListener('message', (ev) => {
        const msg = JSON.parse(String(ev.data));
        if (msg.type === 'hello') {
          this.clientId = msg.clientId;
          ws.removeEventListener('error', onError);
          resolve(msg);
        }
        if (msg.type === 'joinRoom') {
          this.roomId = msg.roomId;
          this.playerId = msg.playerId;
          this.host = !!msg.host;
        }
        this.onMessage?.(msg);
      });
    });
  }

  /** @param {object} msg */
  send(msg) {
    this.ws?.send(JSON.stringify(msg));
  }

  createRoom(roomId) {
    this.send({ type: 'createRoom', roomId });
  }

  joinRoom(roomId) {
    this.send({ type: 'joinRoom', roomId });
  }

  /**
   * @param {number} tick
   * @param {Uint8Array} cmd
   */
  sendInput(tick, cmd) {
    this.send({ type: 'input', tick, cmd: [...cmd] });
  }

  close() {
    this.ws?.close();
    this.ws = null;
  }
}
