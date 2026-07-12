import { FRACBITS, MAX_TEXTURE_HEIGHT } from '../core/renderConstants.js';
import { int32 } from '../math/fixed.js';
import { FUZZTABLE, FUZZTABLE_SIZE } from './fuzzTable.js';

/**
 * @typedef {import('./ViewBuffer.js').ViewBuffer} ViewBuffer
 */

/**
 * @typedef {Object} ColumnDrawParams
 * @property {number} x Screen column
 * @property {number} yl Top row (inclusive)
 * @property {number} yh Bottom row (inclusive)
 * @property {number} iscale Vertical scale step (16.16 fixed)
 * @property {number} textureMid Texture v origin (16.16 fixed)
 * @property {Uint8Array} source Texture column texels (128 tall)
 * @property {Uint8Array} colormap 256-entry light remapping table
 * @property {number} centerY View center row (centery)
 */

/**
 * Vertical wall/sprite column drawer (r_draw.c — R_DrawColumn family).
 *
 * Doom draws walls as vertical columns: for each screen x, a texture column
 * is scaled vertically with a DDA (digital differential analyzer).
 */
export class ColumnRenderer {
  /**
   * @param {ViewBuffer} buffer
   */
  constructor(buffer) {
    this.buffer = buffer;
    this.fuzzPos = 0;
  }

  /**
   * @param {number} textureMid
   * @param {number} yl
   * @param {number} centerY
   * @param {number} iscale
   * @returns {number}
   */
  columnFracStart(textureMid, yl, centerY, iscale) {
    return int32(textureMid + Math.imul(yl - centerY, int32(iscale)));
  }

  /**
   * Scale and draw one texture column (R_DrawColumn).
   * @param {ColumnDrawParams} params
   */
  drawColumn(params) {
    const {
      x: dcX,
      yl: dcYl,
      yh: dcYh,
      iscale: dcIscale,
      textureMid: dcTextureMid,
      source: dcSource,
      colormap: dcColormap,
      centerY,
    } = params;

    const screenWidth = this.buffer.screenWidth;
    const pixels = this.buffer.pixels;

    let count = dcYh - dcYl;
    if (count < 0) {
      return;
    }

    let dest = this.buffer.viewColumnOffset(dcX, dcYl);
    let frac = this.columnFracStart(dcTextureMid, dcYl, centerY, dcIscale);
    const fracStep = int32(dcIscale);

    do {
      pixels[dest] = dcColormap[dcSource[(frac >> FRACBITS) & (MAX_TEXTURE_HEIGHT - 1)]];
      dest += screenWidth;
      frac = int32(frac + fracStep);
    } while (count--);
  }

  /**
   * Low-detail column draw — each texel covers two screen columns (R_DrawColumnLow).
   * @param {ColumnDrawParams} params
   */
  drawColumnLow(params) {
    const {
      x: dcX,
      yl: dcYl,
      yh: dcYh,
      iscale: dcIscale,
      textureMid: dcTextureMid,
      source: dcSource,
      colormap: dcColormap,
      centerY,
    } = params;

    const screenWidth = this.buffer.screenWidth;
    const pixels = this.buffer.pixels;
    const doubledX = dcX << 1;

    let count = dcYh - dcYl;
    if (count < 0) {
      return;
    }

    let dest = this.buffer.viewColumnOffset(doubledX, dcYl);
    let dest2 = this.buffer.viewColumnOffset(doubledX + 1, dcYl);
    let frac = this.columnFracStart(dcTextureMid, dcYl, centerY, dcIscale);
    const fracStep = int32(dcIscale);

    do {
      const color = dcColormap[dcSource[(frac >> FRACBITS) & (MAX_TEXTURE_HEIGHT - 1)]];
      pixels[dest] = color;
      pixels[dest2] = color;
      dest += screenWidth;
      dest2 += screenWidth;
      frac = int32(frac + fracStep);
    } while (count--);
  }

  /**
   * Spectre / invisible shadow column (R_DrawFuzzColumn).
   * @param {ColumnDrawParams} params
   * @param {Uint8Array} colormaps Full COLORMAP lump (32 × 256 bytes)
   * @param {number} viewHeight Active view height
   */
  drawFuzzColumn(params, colormaps, viewHeight) {
    let { yl: dcYl, yh: dcYh } = params;

    if (!dcYl) {
      dcYl = 1;
    }
    if (dcYh === viewHeight - 1) {
      dcYh = viewHeight - 2;
    }

    const {
      x: dcX,
      iscale: dcIscale,
      textureMid: dcTextureMid,
      centerY,
    } = params;

    const screenWidth = this.buffer.screenWidth;
    const pixels = this.buffer.pixels;

    let count = dcYh - dcYl;
    if (count < 0) {
      return;
    }

    let dest = this.buffer.viewColumnOffset(dcX, dcYl);
    let frac = this.columnFracStart(dcTextureMid, dcYl, centerY, dcIscale);
    const fracStep = int32(dcIscale);
    const fuzzColormap = colormaps.subarray(6 * 256, 7 * 256);

    do {
      const fuzzOffset = FUZZTABLE[this.fuzzPos];
      pixels[dest] = fuzzColormap[pixels[dest + fuzzOffset]];

      if (++this.fuzzPos === FUZZTABLE_SIZE) {
        this.fuzzPos = 0;
      }

      dest += screenWidth;
      frac = int32(frac + fracStep);
    } while (count--);
  }

  /**
   * Player sprite column with color translation (R_DrawTranslatedColumn).
   * @param {ColumnDrawParams} params
   * @param {Uint8Array} translation 256-byte player color map
   */
  drawTranslatedColumn(params, translation) {
    const {
      x: dcX,
      yl: dcYl,
      yh: dcYh,
      iscale: dcIscale,
      textureMid: dcTextureMid,
      source: dcSource,
      colormap: dcColormap,
      centerY,
    } = params;

    const screenWidth = this.buffer.screenWidth;
    const pixels = this.buffer.pixels;

    let count = dcYh - dcYl;
    if (count < 0) {
      return;
    }

    let dest = this.buffer.viewColumnOffset(dcX, dcYl);
    let frac = this.columnFracStart(dcTextureMid, dcYl, centerY, dcIscale);
    const fracStep = int32(dcIscale);

    do {
      pixels[dest] = dcColormap[translation[dcSource[frac >> FRACBITS]]];
      dest += screenWidth;
      frac = int32(frac + fracStep);
    } while (count--);
  }
}
