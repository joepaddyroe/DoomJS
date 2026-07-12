import {
  SCREENWIDTH,
  SCREENHEIGHT,
  CENTERY,
} from '../core/renderConstants.js';
import { ViewBuffer } from './ViewBuffer.js';
import { ColumnRenderer } from './ColumnRenderer.js';
import { SpanRenderer } from './SpanRenderer.js';
import { PatchRenderer } from './PatchRenderer.js';

/**
 * @typedef {import('./ColumnRenderer.js').ColumnDrawParams} ColumnDrawParams
 * @typedef {import('./SpanRenderer.js').SpanDrawParams} SpanDrawParams
 */

/**
 * Software renderer facade — composes column, span, and patch drawers.
 *
 * This is the JavaScript equivalent of r_draw.c: all actual pixel writes to
 * the view buffer go through this class. Higher-level code (BSP, segs, planes,
 * sprites) sets draw parameters then calls the appropriate method.
 *
 * Original Doom used global dc_* / ds_* state; here the same values are passed
 * explicitly as parameter objects for readability.
 */
export class SoftwareRenderer {
  /**
   * @param {number} [screenWidth=SCREENWIDTH]
   * @param {number} [screenHeight=SCREENHEIGHT]
   */
  constructor(screenWidth = SCREENWIDTH, screenHeight = SCREENHEIGHT) {
    this.buffer = new ViewBuffer(screenWidth, screenHeight);
    this.columns = new ColumnRenderer(this.buffer);
    this.spans = new SpanRenderer(this.buffer);
    this.patches = new PatchRenderer(this.buffer);

    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
    this.viewWidth = screenWidth;
    this.viewHeight = screenHeight;
    this.centerY = CENTERY;

    /** @type {Uint8Array|null} Full COLORMAP lump (32 × 256). */
    this.colormaps = null;

    /** @type {Uint8Array|null} Player translation tables (768 bytes, 3 × 256). */
    this.translationTables = null;
  }

  /**
   * @returns {Uint8Array} Direct read/write access to indexed screen pixels.
   */
  get pixels() {
    return this.buffer.pixels;
  }

  /**
   * Configure view window and rebuild ylookup / columnofs (R_InitBuffer).
   * @param {number} width
   * @param {number} height
   */
  initBuffer(width, height) {
    this.viewWidth = width;
    this.viewHeight = height;
    this.centerY = (height / 2) | 0;
    this.buffer.initBuffer(width, height);
  }

  /**
   * @param {number} [color=0]
   */
  clear(color = 0) {
    this.buffer.clear(color);
  }

  /**
   * Build default player shirt translation tables (R_InitTranslationTables).
   * Maps the green color ramp to gray, brown, and red.
   */
  initTranslationTables() {
    const tables = new Uint8Array(256 * 3);

    for (let i = 0; i < 256; i++) {
      if (i >= 0x70 && i <= 0x7f) {
        tables[i] = 0x60 + (i & 0x0f);
        tables[i + 256] = 0x40 + (i & 0x0f);
        tables[i + 512] = 0x20 + (i & 0x0f);
      } else {
        tables[i] = i;
        tables[i + 256] = i;
        tables[i + 512] = i;
      }
    }

    this.translationTables = tables;
    return tables;
  }

  /**
   * @param {Uint8Array} colormaps Full COLORMAP lump from WAD.
   */
  setColormaps(colormaps) {
    this.colormaps = colormaps;
  }

  /**
   * Return one 256-entry light table from the colormap lump.
   * @param {number} level Map light level 0–255
   * @returns {Uint8Array}
   */
  colormapForLight(level) {
    if (!this.colormaps) {
      return identityColormap();
    }
    const index = Math.min(31, (level >> 3) & 31);
    return this.colormaps.subarray(index * 256, (index + 1) * 256);
  }

  /**
   * Draw a vertical wall/sprite column (R_DrawColumn).
   * @param {Omit<ColumnDrawParams, 'centerY'>} params
   */
  drawColumn(params) {
    this.columns.drawColumn({ ...params, centerY: this.centerY });
  }

  /**
   * @param {Omit<ColumnDrawParams, 'centerY'>} params
   */
  drawColumnLow(params) {
    this.columns.drawColumnLow({ ...params, centerY: this.centerY });
  }

  /**
   * @param {Omit<ColumnDrawParams, 'centerY'>} params
   */
  drawFuzzColumn(params) {
    if (!this.colormaps) {
      throw new Error('drawFuzzColumn requires colormaps');
    }
    this.columns.drawFuzzColumn(
      { ...params, centerY: this.centerY },
      this.colormaps,
      this.viewHeight,
    );
  }

  /**
   * @param {Omit<ColumnDrawParams, 'centerY'>} params
   * @param {number} [playerIndex=0] Player color slot 0–2
   */
  drawTranslatedColumn(params, playerIndex = 0) {
    if (!this.translationTables) {
      this.initTranslationTables();
    }
    const offset = (playerIndex & 3) * 256;
    this.columns.drawTranslatedColumn(
      { ...params, centerY: this.centerY },
      this.translationTables.subarray(offset, offset + 256),
    );
  }

  /**
   * Draw a horizontal floor/ceiling span (R_DrawSpan).
   * @param {SpanDrawParams} params
   */
  drawSpan(params) {
    this.spans.drawSpan(params);
  }

  /**
   * @param {SpanDrawParams} params
   */
  drawSpanLow(params) {
    this.spans.drawSpanLow(params);
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {import('./PatchRenderer.js').PatchHeader} patch
   * @param {Uint8Array} patchData
   * @param {Uint8Array} [colormap]
   */
  drawPatch(x, y, patch, patchData, colormap = null) {
    this.patches.drawPatch(x, y, patch, patchData, colormap);
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {import('./PatchRenderer.js').PatchHeader} patch
   * @param {Uint8Array} patchData
   * @param {Uint8Array|null} colormap
   * @param {number} scale
   */
  drawPatchScaled(x, y, patch, patchData, colormap, scale) {
    this.patches.drawPatchScaled(x, y, patch, patchData, colormap, scale);
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {import('./PatchRenderer.js').PatchHeader} patch
   * @param {Uint8Array} patchData
   * @param {number} destWidth
   * @param {Uint8Array|null} [colormap]
   */
  drawPatchWrapped(x, y, patch, patchData, destWidth, colormap = null) {
    this.patches.drawPatchWrapped(x, y, patch, patchData, destWidth, colormap);
  }
}

/**
 * Identity colormap (no lighting change) for testing before WAD load.
 * @returns {Uint8Array}
 */
export function identityColormap() {
  const map = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    map[i] = i;
  }
  return map;
}

/**
 * Create a simple 32-level COLORMAP approximation for testing.
 * Each level darkens palette indices toward black.
 * @returns {Uint8Array}
 */
export function createTestColormaps() {
  const colormaps = new Uint8Array(32 * 256);
  for (let level = 0; level < 32; level++) {
    const dest = level * 256;
    const factor = (32 - level) / 32;
    for (let i = 0; i < 256; i++) {
      colormaps[dest + i] = Math.max(0, Math.min(255, Math.floor(i * factor)));
    }
  }
  return colormaps;
}
