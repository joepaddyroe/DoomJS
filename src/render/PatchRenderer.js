/**
 * @typedef {import('./ViewBuffer.js').ViewBuffer} ViewBuffer
 */

import { FRACUNIT } from '../core/renderConstants.js';

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
    this.drawPatchSlice(x, y, patch, patchData, 0, patch.width, colormap);
  }

  /**
   * Draw a horizontal slice of a patch (st_stuff.c — V_CopyRect column window).
   * @param {number} x Destination screen X
   * @param {number} y Destination screen Y
   * @param {PatchHeader} patch
   * @param {Uint8Array} patchData
   * @param {number} srcCol First patch column to draw
   * @param {number} width Number of patch columns to draw
   * @param {Uint8Array|null} [colormap]
   */
  drawPatchSlice(x, y, patch, patchData, srcCol, width, colormap = null) {
    const screenWidth = this.buffer.screenWidth;
    const pixels = this.buffer.pixels;

    y -= patch.topOffset;
    x -= patch.leftOffset;

    const firstCol = Math.max(0, srcCol);
    const lastCol = Math.min(patch.width, srcCol + width);

    if (x + (lastCol - firstCol) <= 0 || x >= screenWidth || y + patch.height <= 0) {
      return;
    }

    for (let col = firstCol; col < lastCol; col++) {
      const destX = x + (col - srcCol);
      if (destX < 0 || destX >= screenWidth) {
        continue;
      }

      let columnOffset = patch.columnOffsets[col];
      let topDelta = patchData[columnOffset];
      let destTop = y * screenWidth + destX;

      while (topDelta !== 0xff) {
        const length = patchData[columnOffset + 1];
        let sourceIndex = columnOffset + 3;
        let dest = destTop + topDelta * screenWidth;
        let count = length;

        while (count--) {
          const screenY = (dest - destTop) / screenWidth + y;
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
   * Draw a wide patch onto a narrower screen by wrapping the trailing columns
   * onto the left (426px STBAR → 320px screen).
   * @param {number} x
   * @param {number} y
   * @param {PatchHeader} patch
   * @param {Uint8Array} patchData
   * @param {number} destWidth Target width in pixels (usually SCREENWIDTH)
   * @param {Uint8Array|null} [colormap]
   */
  drawPatchWrapped(x, y, patch, patchData, destWidth, colormap = null) {
    if (patch.width <= destWidth) {
      this.drawPatch(x, y, patch, patchData, colormap ?? undefined);
      return;
    }

    const screenWidth = this.buffer.screenWidth;
    const screenHeight = this.buffer.screenHeight;
    const pixels = this.buffer.pixels;
    const extra = patch.width - destWidth;

    y -= patch.topOffset;
    x -= patch.leftOffset;

    for (let screenCol = 0; screenCol < destWidth; screenCol++) {
      const destX = x + screenCol;
      if (destX < 0 || destX >= screenWidth) {
        continue;
      }

      const patchCol = screenCol < extra
        ? patch.width - extra + screenCol
        : screenCol - extra;

      let columnOffset = patch.columnOffsets[patchCol];
      let topDelta = patchData[columnOffset];
      let destTop = y * screenWidth + destX;

      while (topDelta !== 0xff) {
        const length = patchData[columnOffset + 1];
        let sourceIndex = columnOffset + 3;
        let dest = destTop + topDelta * screenWidth;
        let count = length;

        while (count--) {
          const screenY = (dest - destTop) / screenWidth + y;
          if (screenY >= 0 && screenY < screenHeight) {
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
   * Draw a patch scaled in fixed-point (r_things.c projection scale).
   * @param {number} x
   * @param {number} y
   * @param {PatchHeader} patch
   * @param {Uint8Array} patchData
   * @param {Uint8Array|null} colormap
   * @param {number} scale Fixed-point scale (FRACUNIT = 1:1)
   */
  drawPatchScaled(x, y, patch, patchData, colormap, scale) {
    if (scale >= (FRACUNIT * 3) / 4 && scale <= (FRACUNIT * 5) / 4) {
      this.drawPatch(x, y, patch, patchData, colormap ?? undefined);
      return;
    }

    const screenWidth = this.buffer.screenWidth;
    const screenHeight = this.buffer.screenHeight;
    const pixels = this.buffer.pixels;
    const destWidth = Math.max(1, (patch.width * scale) >> 16);
    const destHeight = Math.max(1, (patch.height * scale) >> 16);
    const startX = x - ((patch.leftOffset * scale) >> 16);
    const startY = y - ((patch.topOffset * scale) >> 16);

    if (startX + destWidth <= 0 || startX >= screenWidth || startY + destHeight <= 0) {
      return;
    }

    for (let destCol = 0; destCol < destWidth; destCol++) {
      const screenX = startX + destCol;
      if (screenX < 0 || screenX >= screenWidth) {
        continue;
      }

      const srcCol = Math.min(patch.width - 1, (destCol * patch.width) / destWidth | 0);
      let columnOffset = patch.columnOffsets[srcCol];
      let topDelta = patchData[columnOffset];

      while (topDelta !== 0xff) {
        const length = patchData[columnOffset + 1];
        let sourceIndex = columnOffset + 3;
        const destTop = startY + ((topDelta * scale) >> 16);
        const destRun = Math.max(1, (length * scale) >> 16);

        for (let row = 0; row < destRun; row++) {
          const screenY = destTop + row;
          if (screenY < 0 || screenY >= screenHeight) {
            continue;
          }
          const srcRow = Math.min(length - 1, (row * length) / destRun | 0);
          const color = patchData[sourceIndex + srcRow];
          pixels[screenY * screenWidth + screenX] = colormap ? colormap[color] : color;
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
