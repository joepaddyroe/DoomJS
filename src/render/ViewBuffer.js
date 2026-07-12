import { SCREENWIDTH, SCREENHEIGHT, SBARHEIGHT } from '../core/renderConstants.js';

/**
 * Linear indexed-color framebuffer with row/column lookup tables.
 * Port of r_draw.c view buffer setup (R_InitBuffer, ylookup, columnofs).
 */
export class ViewBuffer {
  /**
   * @param {number} [screenWidth=SCREENWIDTH]
   * @param {number} [screenHeight=SCREENHEIGHT]
   */
  constructor(screenWidth = SCREENWIDTH, screenHeight = SCREENHEIGHT) {
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
    this.pixels = new Uint8Array(screenWidth * screenHeight);

    /** @type {Int32Array} Byte offset of each view-relative row. */
    this.ylookup = new Int32Array(screenHeight);
    /** @type {Int32Array} Screen x for each view-relative column. */
    this.columnofs = new Int32Array(screenWidth);

    this.viewWidth = screenWidth;
    this.viewHeight = screenHeight;
    this.viewWindowX = 0;
    this.viewWindowY = 0;
  }

  /**
   * Rebuild lookup tables for a sub-window within the screen (R_InitBuffer).
   * @param {number} width View width in pixels
   * @param {number} height View height in pixels
   */
  initBuffer(width, height) {
    this.viewWidth = width;
    this.viewHeight = height;
    this.viewWindowX = (this.screenWidth - width) >> 1;

    for (let i = 0; i < width; i++) {
      this.columnofs[i] = this.viewWindowX + i;
    }

    if (width === this.screenWidth) {
      this.viewWindowY = 0;
    } else {
      this.viewWindowY = (this.screenHeight - SBARHEIGHT - height) >> 1;
    }

    for (let i = 0; i < height; i++) {
      this.ylookup[i] = (i + this.viewWindowY) * this.screenWidth;
    }
  }

  /**
   * Clear the entire screen buffer to a palette index.
   * @param {number} [color=0]
   */
  clear(color = 0) {
    this.pixels.fill(color);
  }

  /**
   * Byte offset of a screen pixel.
   * @param {number} x
   * @param {number} y
   * @returns {number}
   */
  offsetAt(x, y) {
    return y * this.screenWidth + x;
  }

  /**
   * Starting byte offset for a view-relative column draw (R_DrawColumn dest setup).
   * @param {number} viewX Column within the view window
   * @param {number} viewY Row within the view window
   * @returns {number}
   */
  viewColumnOffset(viewX, viewY) {
    return this.ylookup[viewY] + this.columnofs[viewX];
  }
}
