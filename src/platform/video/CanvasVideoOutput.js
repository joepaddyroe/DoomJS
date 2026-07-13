import { SCREENWIDTH, SCREENHEIGHT } from '../../core/renderConstants.js';

/** Fallback integer scale when the window is smaller than one game pixel per screen pixel. */
export const DEFAULT_PIXEL_SCALE = 2;

/**
 * Presents the indexed software framebuffer at native 320×200 resolution,
 * scaled uniformly from window height with pillar/letterbox borders.
 *
 * Doom's software renderer always draws at SCREENWIDTH × SCREENHEIGHT (320×200).
 * Display scale is floor(windowHeight / 200) so the image grows with window height;
 * width follows at 4:3 and excess horizontal space is pillarboxed.
 */
export class CanvasVideoOutput {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {number} [gameWidth=SCREENWIDTH]
   * @param {number} [gameHeight=SCREENHEIGHT]
   */
  constructor(canvas, gameWidth = SCREENWIDTH, gameHeight = SCREENHEIGHT) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.gameWidth = gameWidth;
    this.gameHeight = gameHeight;
    this.windowWidth = gameWidth;
    this.windowHeight = gameHeight;
    /** @type {number} Integer uniform scale from game pixels to display pixels. */
    this.pixelScale = DEFAULT_PIXEL_SCALE;

    this.imageData = new ImageData(gameWidth, gameHeight);
    this.rgbBuffer = this.imageData.data;

    /** @type {Uint8ClampedArray|null} */
    this.paletteRgb = null;

    this.offscreen = document.createElement('canvas');
    this.offscreen.width = gameWidth;
    this.offscreen.height = gameHeight;
    this.offscreenCtx = this.offscreen.getContext('2d', { alpha: false });
    this.offscreenCtx.imageSmoothingEnabled = false;

    this.ctx.imageSmoothingEnabled = false;

    this.resize(window.innerWidth, window.innerHeight);
  }

  /**
   * Resize the display canvas to the browser viewport and recompute integer scale.
   * @param {number} width Viewport width in CSS pixels
   * @param {number} height Viewport height in CSS pixels
   */
  resize(width, height) {
    this.windowWidth = Math.max(1, width | 0);
    this.windowHeight = Math.max(1, height | 0);
    this.pixelScale = this.computePixelScale();

    this.canvas.width = this.windowWidth;
    this.canvas.height = this.windowHeight;
    this.canvas.style.width = `${this.windowWidth}px`;
    this.canvas.style.height = `${this.windowHeight}px`;
  }

  /**
   * Uniform scale chosen to fill the viewport height (4:3 preserved).
   * This eliminates vertical letterboxing at the cost of possible horizontal crop
   * on very narrow viewports.
   * @returns {number}
   */
  computePixelScale() {
    return Math.max(1, this.windowHeight / this.gameHeight);
  }

  /**
   * Centered destination rectangle for the scaled game image.
   * @returns {{ x: number, y: number, w: number, h: number }}
   */
  getDestRect() {
    const w = this.gameWidth * this.pixelScale;
    const h = this.windowHeight;
    return {
      x: ((this.windowWidth - w) / 2) | 0,
      y: 0,
      w,
      h,
    };
  }

  /**
   * @param {Uint8ClampedArray|Uint8Array} rgb Flat RGB buffer, 768 bytes (256 × 3).
   */
  setPalette(rgb) {
    this.paletteRgb = rgb instanceof Uint8ClampedArray ? rgb : new Uint8ClampedArray(rgb);
  }

  /**
   * Neutral gray-brown ramp for renderer testing until PLAYPAL is loaded.
   * @returns {Uint8ClampedArray}
   */
  static createDemoPalette() {
    const palette = new Uint8ClampedArray(256 * 3);

    for (let i = 0; i < 256; i++) {
      const base = i * 3;
      if (i === 0) {
        palette[base] = 0;
        palette[base + 1] = 0;
        palette[base + 2] = 0;
        continue;
      }

      const shade = i / 255;
      palette[base] = Math.min(255, Math.floor(24 + shade * 200));
      palette[base + 1] = Math.min(255, Math.floor(24 + shade * 180));
      palette[base + 2] = Math.min(255, Math.floor(20 + shade * 140));
    }

    return palette;
  }

  /**
   * Convert indexed pixels to RGB and blit with integer nearest-neighbor scale.
   * @param {Uint8Array} indexedPixels gameWidth × gameHeight palette indices
   */
  present(indexedPixels) {
    if (!this.paletteRgb) {
      this.setPalette(CanvasVideoOutput.createDemoPalette());
    }

    const rgb = this.rgbBuffer;
    const palette = this.paletteRgb;

    for (let i = 0, px = 0; i < indexedPixels.length; i++, px += 4) {
      const color = indexedPixels[i] * 3;
      rgb[px] = palette[color];
      rgb[px + 1] = palette[color + 1];
      rgb[px + 2] = palette[color + 2];
      rgb[px + 3] = 255;
    }

    this.offscreenCtx.putImageData(this.imageData, 0, 0);

    const dest = this.getDestRect();

    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.windowWidth, this.windowHeight);
    this.ctx.drawImage(
      this.offscreen,
      0,
      0,
      this.gameWidth,
      this.gameHeight,
      dest.x,
      dest.y,
      dest.w,
      dest.h,
    );
  }
}
