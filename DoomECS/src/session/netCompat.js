/**
 * Tiny helpers so DoomECS does not depend on DoomJSRelay package.
 * Mirror of DoomJSRelay/src/protocol.js array codecs.
 */

/** @param {Uint8Array} bytes @returns {number[]} */
export function bytesToArray(bytes) {
  return [...bytes];
}

/** @param {number[]|null|undefined} arr @returns {Uint8Array|null} */
export function arrayToBytes(arr) {
  if (!arr) {
    return null;
  }
  return Uint8Array.from(arr);
}
