import WebSocket from 'ws';
import { MessageType, encodeMessage, decodeMessage, bytesToArray } from './protocol.js';

/**
 * Node WebSocket client for DoomJSRelay.
 */
export class RelayClient {
  /** @param {string} url */
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
    /** @type {Map<string, { resolve: Function, reject: Function, pred: (m:object)=>boolean }[]>} */
    this._waiters = new Map();
  }

  /** @returns {Promise<object>} hello */
  connect() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);
      this.ws = ws;
      ws.on('message', (raw) => {
        const msg = decodeMessage(raw);
        if (msg.type === MessageType.HELLO) {
          this.clientId = msg.clientId;
          resolve(msg);
        }
        if (msg.type === MessageType.JOIN_ROOM) {
          this.roomId = msg.roomId;
          this.playerId = msg.playerId;
          this.host = !!msg.host;
        }
        if (msg.type === MessageType.ERROR) {
          const err = new Error(msg.message || 'relay error');
          for (const list of this._waiters.values()) {
            for (const w of list) {
              w.reject(err);
            }
          }
          this._waiters.clear();
        }
        this._resolveWaiters(msg);
        this.onMessage?.(msg);
      });
      ws.on('error', (err) => reject(err));
    });
  }

  /**
   * @param {string} type
   * @param {(m: object) => boolean} [pred]
   * @param {number} [timeoutMs]
   */
  waitFor(type, pred = () => true, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for ${type}`));
      }, timeoutMs);
      const entry = {
        pred,
        resolve: (msg) => {
          clearTimeout(timer);
          resolve(msg);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      };
      const list = this._waiters.get(type) ?? [];
      list.push(entry);
      this._waiters.set(type, list);
    });
  }

  /** @param {object} msg */
  _resolveWaiters(msg) {
    const list = this._waiters.get(msg.type);
    if (!list?.length) {
      return;
    }
    const next = [];
    for (const w of list) {
      if (w.pred(msg)) {
        w.resolve(msg);
      } else {
        next.push(w);
      }
    }
    if (next.length) {
      this._waiters.set(msg.type, next);
    } else {
      this._waiters.delete(msg.type);
    }
  }

  /** @param {object} msg */
  send(msg) {
    this.ws?.send(encodeMessage(msg));
  }

  /** @param {string} [roomId] */
  createRoom(roomId) {
    this.send({ type: MessageType.CREATE_ROOM, roomId });
  }

  /** @param {string} roomId */
  joinRoom(roomId) {
    this.send({ type: MessageType.JOIN_ROOM, roomId });
  }

  /** @param {object} setup */
  setup(setup) {
    this.send({ type: MessageType.SETUP, setup });
  }

  ready(ready = true) {
    this.send({ type: MessageType.READY, ready });
  }

  start() {
    this.send({ type: MessageType.START });
  }

  /**
   * @param {number} tick
   * @param {Uint8Array} cmd
   */
  sendInput(tick, cmd) {
    this.send({ type: MessageType.INPUT, tick, cmd: bytesToArray(cmd) });
  }

  close() {
    this.ws?.close();
    this.ws = null;
  }
}
