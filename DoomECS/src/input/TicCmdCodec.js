/**
 * Binary ticcmd packing (Doom-compatible layout for later Game bridge).
 *
 * Layout (8 bytes, little-endian):
 *   0: int8  forwardmove
 *   1: int8  sidemove
 *   2-3: int16 angleturn
 *   4-5: int16 consistancy
 *   6: uint8 chatchar
 *   7: uint8 buttons
 */

export const TICCMD_BYTES = 8;

/**
 * @typedef {{ forwardmove?: number, sidemove?: number, angleturn?: number, consistancy?: number, chatchar?: number, buttons?: number }} TicCmdLike
 */

/**
 * @param {TicCmdLike} cmd
 * @returns {Uint8Array}
 */
export function encodeTicCmd(cmd = {}) {
  const buf = new Uint8Array(TICCMD_BYTES);
  const view = new DataView(buf.buffer);
  view.setInt8(0, cmd.forwardmove ?? 0);
  view.setInt8(1, cmd.sidemove ?? 0);
  view.setInt16(2, cmd.angleturn ?? 0, true);
  view.setInt16(4, cmd.consistancy ?? 0, true);
  view.setUint8(6, (cmd.chatchar ?? 0) & 0xff);
  view.setUint8(7, (cmd.buttons ?? 0) & 0xff);
  return buf;
}

/**
 * @param {Uint8Array} bytes
 * @param {number} [offset=0]
 * @returns {Required<TicCmdLike>}
 */
export function decodeTicCmd(bytes, offset = 0) {
  const view = new DataView(bytes.buffer, bytes.byteOffset + offset, TICCMD_BYTES);
  return {
    forwardmove: view.getInt8(0),
    sidemove: view.getInt8(1),
    angleturn: view.getInt16(2, true),
    consistancy: view.getInt16(4, true),
    chatchar: view.getUint8(6),
    buttons: view.getUint8(7),
  };
}

/** @returns {Uint8Array} */
export function emptyTicCmdBytes() {
  return encodeTicCmd({});
}

/**
 * Compare two input blobs.
 * @param {Uint8Array} a
 * @param {Uint8Array} b
 */
export function inputsEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}
