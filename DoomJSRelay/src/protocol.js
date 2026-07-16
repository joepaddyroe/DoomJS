/**
 * Shared JSON protocol between DoomJS clients and DoomJSRelay.
 * Keep this file mirrored conceptually with DoomECS session ticks.
 */

export const PROTOCOL_VERSION = 1;

/** @typedef {'hello'|'createRoom'|'joinRoom'|'roomState'|'setup'|'ready'|'start'|'input'|'confirmed'|'leave'|'error'|'ping'|'pong'} MessageType */

export const MessageType = {
  HELLO: 'hello',
  CREATE_ROOM: 'createRoom',
  JOIN_ROOM: 'joinRoom',
  ROOM_STATE: 'roomState',
  SETUP: 'setup',
  READY: 'ready',
  START: 'start',
  INPUT: 'input',
  CONFIRMED: 'confirmed',
  LEAVE: 'leave',
  ERROR: 'error',
  PING: 'ping',
  PONG: 'pong',
};

/**
 * @param {object} msg
 * @returns {string}
 */
export function encodeMessage(msg) {
  return JSON.stringify(msg);
}

/**
 * @param {string|Buffer|ArrayBuffer} raw
 * @returns {object}
 */
export function decodeMessage(raw) {
  const text = typeof raw === 'string'
    ? raw
    : Buffer.isBuffer(raw)
      ? raw.toString('utf8')
      : new TextDecoder().decode(raw);
  return JSON.parse(text);
}

/**
 * Ticcmd as number[] (8 bytes) for JSON transport.
 * @param {Uint8Array} bytes
 * @returns {number[]}
 */
export function bytesToArray(bytes) {
  return [...bytes];
}

/**
 * @param {number[]|null|undefined} arr
 * @returns {Uint8Array|null}
 */
export function arrayToBytes(arr) {
  if (!arr) {
    return null;
  }
  return Uint8Array.from(arr);
}
