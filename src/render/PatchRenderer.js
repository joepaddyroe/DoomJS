/**
 * @typedef {import('./ViewBuffer.js').ViewBuffer} ViewBuffer
 */

/**
 * @typedef {Object} PatchHeader
 * @property {number} width
 * @property {number} height
 * @property {number} leftOffset
 * @property {number} topOffset
 * @property {Int32Array} columnOffsets Byte offset from patch start to each column_t
 */

/**
 * Masked patch drawer using post-based columns (v_video.c — V_DrawPatch).
 *
 * Patches store columns as a list of vertical posts (transparent gaps skipped).
 * Each post is: topdelta (y skip), length (run height), then length pixel bytes.
 */
export class PatchRenderer {
  /**
   * @param {ViewBuffer} buffer
   */
  constructor(buffer) {
    this.buffer = buffer;
  }

  /**
   * Draw an indexed patch at screen coordinates.
   * @param {number} x
   * @param {number} y
   * @param {PatchHeader} patch
   * @param {Uint8Array} patchData Raw patch lump bytes
   * @param {Uint8Array} [colormap] Optional per-column colormap; defaults to identity
   */
  drawPatch(x, y, patch, patchData, colormap = null) {
    const screenWidth = this.buffer.screenWidth;
    const pixels = this.buffer.pixels;

    y -= patch.topOffset;
    x -= patch.leftOffset;

    if (x + patch.width <= 0 || x >= screenWidth || y + patch.height <= 0) {
      return;
    }

    let destTop = y * screenWidth + x;

    for (let col = 0; col < patch.width; col++, x++, destTop++) {
      if (x < 0 || x >= screenWidth) {
        continue;
      }

      let columnOffset = patch.columnOffsets[col];
      let topDelta = patchData[columnOffset];

      while (topDelta !== 0xff) {
        const length = patchData[columnOffset + 1];
        const sourceIndex = columnOffset + 3;
        let dest = destTop + topDelta * screenWidth;
        let count = length;

        while (count--) {
          const screenY = (dest - (y * screenWidth + x)) / screenWidth + y;
          if (screenY >= 0 && screenY < this.buffer.screenHeight) {
            const color = patchData[sourceIndex++];
            pixels[dest] = colormap ? colormap[color] : color;
          } else {
            sourceIndex++;
          }
          dest += screenWidth;
        }

        columnOffset += length + 4;
        topDelta = patchData[columnOffset];
      }
    }
  }

  /**
   * Parse patch header from WAD lump bytes.
   * @param {Uint8Array} data
   * @returns {{ header: PatchHeader, data: Uint8Array }}
   */
  static parsePatch(data) {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const width = view.getInt16(0, true);
    const height = view.getInt16(2, true);
    const leftOffset = view.getInt16(4, true);
    const topOffset = view.getInt16(6, true);
    const columnOffsets = new Int32Array(width);

    for (let i = 0; i < width; i++) {
      columnOffsets[i] = view.getInt32(8 + i * 4, true);
    }

    return {
      header: { width, height, leftOffset, topOffset, columnOffsets },
      data,
    };
  }
}
