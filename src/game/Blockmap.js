import { FRACBITS } from '../core/renderConstants.js';

/**
 * Blockmap for line iteration (p_setup.c — blockmaplump).
 */
export class Blockmap {
  /**
   * @param {Int16Array} lump Short array from BLOCKMAP lump.
   */
  constructor(lump) {
    this.orgX = lump[0] << FRACBITS;
    this.orgY = lump[1] << FRACBITS;
    this.width = lump[2];
    this.height = lump[3];
    this.lump = lump;
  }

  /**
   * @param {import('../wad/WadFile.js').WadFile} wad
   * @param {Uint8Array} data
   */
  static fromLump(data) {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const count = data.byteLength / 2;
    const lump = new Int16Array(count);
    for (let i = 0; i < count; i++) {
      lump[i] = view.getInt16(i * 2, true);
    }
    return new Blockmap(lump);
  }

  /**
   * Line indices for one block cell (p_maputl.c — P_BlockLinesIterator).
   * @param {number} bx
   * @param {number} by
   * @returns {number[]}
   */
  lineIndicesForBlock(bx, by) {
    if (bx < 0 || by < 0 || bx >= this.width || by >= this.height) {
      return [];
    }

    const offset = this.lump[4 + by * this.width + bx];
    const indices = [];
    for (let i = offset; i < this.lump.length && this.lump[i] !== -1; i++) {
      indices.push(this.lump[i]);
    }
    return indices;
  }
}
