/**
 * @typedef {import('./ViewBuffer.js').ViewBuffer} ViewBuffer
 */

import { FRACBITS, FRACUNIT } from '../core/renderConstants.js';
import { fixedDiv } from '../math/fixed.js';

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
   * Draw a patch scaled in fixed-point (r_things.c — R_DrawVisSprite / R_DrawMaskedColumn).
   * @param {number} x Mobj anchor X (offset applied here)
   * @param {number} y Mobj anchor Y (offset applied here)
   * @param {PatchHeader} patch
   * @param {Uint8Array} patchData
   * @param {Uint8Array|null} colormap
   * @param {number} scale Fixed-point scale (FRACUNIT = 1:1)
   * @param {Int16Array|null} [clipbot]
   * @param {Int16Array|null} [cliptop]
   * @param {number} [clipX1=0]
   */
  drawPatchScaled(x, y, patch, patchData, colormap, scale, clipbot = null, cliptop = null, clipX1 = 0) {
    if (scale <= 0) {
      return;
    }

    const screenWidth = this.buffer.screenWidth;
    const screenHeight = this.buffer.screenHeight;
    const pixels = this.buffer.pixels;
    const destWidth = (patch.width * scale) >> FRACBITS;
    if (destWidth <= 0) {
      return;
    }

    const startX = x - ((patch.leftOffset * scale) >> FRACBITS);
    const sprtopscreen = (y - ((patch.topOffset * scale) >> FRACBITS)) << FRACBITS;
    const xiscale = fixedDiv(FRACUNIT, scale);
    let frac = 0;

    for (let destCol = 0; destCol < destWidth; destCol++) {
      const screenX = startX + destCol;
      const srcCol = Math.min(patch.width - 1, frac >> FRACBITS);
      frac += xiscale;

      if (screenX < 0 || screenX >= screenWidth) {
        continue;
      }

      let floorClip = screenHeight;
      let ceilingClip = -1;
      if (clipbot && cliptop) {
        const clipIdx = screenX - clipX1;
        if (clipIdx < 0 || clipIdx >= clipbot.length) {
          continue;
        }
        floorClip = clipbot[clipIdx];
        ceilingClip = cliptop[clipIdx];
      }

      let columnOffset = patch.columnOffsets[srcCol];
      let topDelta = patchData[columnOffset];

      while (topDelta !== 0xff) {
        const length = patchData[columnOffset + 1];
        const sourceIndex = columnOffset + 3;
        const topFixed = sprtopscreen + scale * topDelta;
        const bottomFixed = topFixed + scale * length;
        let dcYl = (topFixed + FRACUNIT - 1) >> FRACBITS;
        let dcYh = (bottomFixed - 1) >> FRACBITS;

        if (dcYh >= floorClip) {
          dcYh = floorClip - 1;
        }
        if (dcYl <= ceilingClip) {
          dcYl = ceilingClip + 1;
        }

        if (dcYl < 0) {
          dcYl = 0;
        }
        if (dcYh >= screenHeight) {
          dcYh = screenHeight - 1;
        }
        if (dcYl > dcYh) {
          columnOffset += length + 4;
          topDelta = patchData[columnOffset];
          continue;
        }

        for (let screenY = dcYl; screenY <= dcYh; screenY++) {
          const srcRow = Math.min(
            length - 1,
            Math.max(0, ((screenY << FRACBITS) - topFixed) / scale | 0),
          );
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
