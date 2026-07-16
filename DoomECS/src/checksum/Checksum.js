/**
 * FNV-1a 32-bit over bytes — cheap frame checksum for desync detection / replay verify.
 * @param {Uint8Array} bytes
 * @returns {number} unsigned 32-bit
 */
export function fnv1a32(bytes) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * @param {DataView} view
 * @param {number} byteLength
 * @returns {number}
 */
export function fnv1a32View(view, byteLength) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < byteLength; i++) {
    hash ^= view.getUint8(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
