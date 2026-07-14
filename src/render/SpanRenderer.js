import { FLAT_MASK, FLAT_ROWMASK } from '../core/renderConstants.js';

/**
 * @typedef {import('./ViewBuffer.js').ViewBuffer} ViewBuffer
 */

/**
 * @typedef {Object} SpanDrawParams
 * @property {number} y Screen row
 * @property {number} x1 Left column (inclusive)
 * @property {number} x2 Right column (inclusive)
 * @property {number} xfrac Horizontal texture coordinate (16.16 fixed)
 * @property {number} yfrac Vertical texture coordinate (16.16 fixed)
 * @property {number} xstep Horizontal step per pixel (16.16 fixed)
 * @property {number} ystep Vertical step per pixel (16.16 fixed)
 * @property {Uint8Array} source 64×64 flat texture (4096 bytes)
 * @property {Uint8Array} colormap 256-entry light remapping table
 */

/**
 * Horizontal floor/ceiling span drawer (r_draw.c — R_DrawSpan).
 *
 * Flats are drawn as horizontal spans: for each screen row, texture u/v
 * are stepped horizontally through a 64×64 tile.
 */
export class SpanRenderer {
  /**
   * @param {ViewBuffer} buffer
   */
  constructor(buffer) {
    this.buffer = buffer;
  }

  /**
   * @param {number} xfrac
   * @param {number} yfrac
   * @returns {number}
   */
  flatSpot(xfrac, yfrac) {
    // r_draw.c: ((yfrac>>(16-6))&(63*64)) + ((xfrac>>16)&63)
    return ((yfrac >> 10) & FLAT_ROWMASK) + ((xfrac >> 16) & FLAT_MASK);
  }

  /**
   * Draw one horizontal span (R_DrawSpan).
   * @param {SpanDrawParams} params
   */
  drawSpan(params) {
    const {
      y: dsY,
      x1: dsX1,
      x2: dsX2,
      xfrac: dsXfrac,
      yfrac: dsYfrac,
      xstep: dsXstep,
      ystep: dsYstep,
      source: dsSource,
      colormap: dsColormap,
    } = params;

    const pixels = this.buffer.pixels;
    let xfrac = dsXfrac;
    let yfrac = dsYfrac;
    let dest = this.buffer.viewColumnOffset(dsX1, dsY);
    let count = dsX2 - dsX1;

    do {
      const spot = this.flatSpot(xfrac, yfrac);
      pixels[dest++] = dsColormap[dsSource[spot]];
      xfrac += dsXstep;
      yfrac += dsYstep;
    } while (count--);
  }

  /**
   * Low-detail span — each texel covers two screen pixels (R_DrawSpanLow).
   * @param {SpanDrawParams} params
   */
  drawSpanLow(params) {
    const {
      y: dsY,
      x1: dsX1,
      x2: dsX2,
      xfrac: dsXfrac,
      yfrac: dsYfrac,
      xstep: dsXstep,
      ystep: dsYstep,
      source: dsSource,
      colormap: dsColormap,
    } = params;

    const pixels = this.buffer.pixels;
    let xfrac = dsXfrac;
    let yfrac = dsYfrac;
    const doubledX1 = dsX1 << 1;
    let dest = this.buffer.viewColumnOffset(doubledX1, dsY);
    let count = dsX2 - dsX1;

    do {
      const spot = this.flatSpot(xfrac, yfrac);
      const color = dsColormap[dsSource[spot]];
      pixels[dest++] = color;
      pixels[dest++] = color;
      xfrac += dsXstep;
      yfrac += dsYstep;
    } while (count--);
  }
}
